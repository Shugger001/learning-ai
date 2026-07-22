import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const stripe = new Stripe(key);
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid signature" },
      { status: 400 }
    );
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "customer.subscription.updated"
  ) {
    const obj = event.data.object as
      | Stripe.Checkout.Session
      | Stripe.Subscription;
    let userId =
      "metadata" in obj ? obj.metadata?.user_id : undefined;

    if (
      !userId &&
      event.type === "checkout.session.completed" &&
      "client_reference_id" in obj
    ) {
      userId = obj.client_reference_id ?? undefined;
    }

    const admin = createAdminClient();
    if (userId) {
      await admin.from("profiles").update({ plan: "pro" }).eq("user_id", userId);
    } else if ("customer" in obj && obj.customer) {
      await admin
        .from("profiles")
        .update({ plan: "pro" })
        .eq("stripe_customer_id", String(obj.customer));
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = String(sub.customer);
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ plan: "free" })
      .eq("stripe_customer_id", customerId);
  }

  return NextResponse.json({ received: true });
}
