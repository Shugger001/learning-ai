import { requireAdmin, isAdminContext } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/response";

export async function GET() {
  const ctx = await requireAdmin();
  if (!isAdminContext(ctx)) return ctx;
  const { admin } = ctx;

  const [
    { count: free },
    { count: pro },
    { count: withStripe },
    { data: recentPro },
    { data: nearLimit },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("plan", "free"),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("plan", "pro"),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("stripe_customer_id", "is", null),
    admin
      .from("profiles")
      .select("user_id, full_name, plan, stripe_customer_id, updated_at")
      .eq("plan", "pro")
      .order("updated_at", { ascending: false })
      .limit(12),
    admin
      .from("profiles")
      .select(
        "user_id, full_name, plan, uploads_used, chat_used, podcasts_used"
      )
      .eq("plan", "free")
      .or("uploads_used.gte.8,chat_used.gte.24,podcasts_used.gte.2")
      .limit(20),
  ]);

  return apiSuccess({
    free: free ?? 0,
    pro: pro ?? 0,
    withStripe: withStripe ?? 0,
    recentPro: recentPro ?? [],
    nearLimit: nearLimit ?? [],
    env: {
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      priceConfigured: Boolean(
        process.env.STRIPE_PRO_PRICE_ID || process.env.STRIPE_CREDITS_PRICE_ID
      ),
      webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    },
  });
}
