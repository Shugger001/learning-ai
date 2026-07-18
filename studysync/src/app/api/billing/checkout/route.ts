import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  return new Stripe(key);
}

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_CREDITS_PRICE_ID) {
    // Demo upgrade without Stripe configured
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return apiError("Billing not configured", 500);
    }
    await admin
      .from("profiles")
      .update({ plan: "pro" })
      .eq("user_id", user.id);
    return apiSuccess({
      mode: "demo",
      url: null,
      message: "Upgraded to Pro (demo mode - set Stripe keys for real checkout).",
    });
  }

  try {
    const stripe = getStripe();
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

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
      line_items: [
        { price: process.env.STRIPE_CREDITS_PRICE_ID, quantity: 1 },
      ],
      success_url: `${origin}/dashboard?upgraded=1`,
      cancel_url: `${origin}/pricing`,
      metadata: { user_id: user.id },
    });

    return apiSuccess({ mode: "stripe", url: session.url });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Checkout failed",
      500
    );
  }
}
