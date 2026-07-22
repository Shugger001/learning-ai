import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

async function setPlan(params: {
  userId?: string | null;
  customerId?: string | null;
  plan: "free" | "pro";
}) {
  const admin = createAdminClient();
  const patch = { plan: params.plan };

  if (params.userId) {
    await admin.from("profiles").update(patch).eq("user_id", params.userId);
    return;
  }
  if (params.customerId) {
    await admin
      .from("profiles")
      .update(patch)
      .eq("stripe_customer_id", params.customerId);
  }
}

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id || session.client_reference_id;
    if (session.mode === "subscription") {
      await setPlan({
        userId,
        customerId: session.customer ? String(session.customer) : null,
        plan: "pro",
      });
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const active = ["active", "trialing"].includes(sub.status);
    await setPlan({
      userId: sub.metadata?.user_id,
      customerId: String(sub.customer),
      plan: active ? "pro" : "free",
    });
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    await setPlan({
      userId: sub.metadata?.user_id,
      customerId: String(sub.customer),
      plan: "free",
    });
  }

  return NextResponse.json({ received: true });
}
