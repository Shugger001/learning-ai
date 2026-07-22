import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return apiError("Stripe is not configured", 503);
  }

  try {
    const stripe = new Stripe(key);
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return apiError("No Stripe customer on file — upgrade to Pro first.", 400);
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/pricing`,
    });

    return apiSuccess({ url: session.url });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Portal failed",
      500
    );
  }
}
