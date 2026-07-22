import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  return new Stripe(key);
}

function proPriceId() {
  return (
    process.env.STRIPE_PRO_PRICE_ID ||
    process.env.STRIPE_CREDITS_PRICE_ID ||
    ""
  );
}

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  if (!process.env.STRIPE_SECRET_KEY || !proPriceId()) {
    return apiError(
      "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID.",
      503
    );
  }

  try {
    const stripe = getStripe();
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id, plan")
      .eq("user_id", user.id)
      .single();

    if (profile?.plan === "pro") {
      return apiError("Already on Pro — use Manage subscription instead.", 400);
    }

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: proPriceId(), quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded=1`,
      cancel_url: `${origin}/pricing`,
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      subscription_data: {
        metadata: { user_id: user.id },
      },
    });

    if (!session.url) return apiError("Checkout session missing URL", 500);
    return apiSuccess({ mode: "stripe" as const, url: session.url });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Checkout failed",
      500
    );
  }
}
