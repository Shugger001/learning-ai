import { requireAdmin, isAdminContext } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: Request) {
  const ctx = await requireAdmin();
  if (!isAdminContext(ctx)) return ctx;
  const { admin } = ctx;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const plan = searchParams.get("plan"); // free | pro | all
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
  const limit = Math.min(50, Math.max(10, Number(searchParams.get("limit") || 25) || 25));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = admin
    .from("profiles")
    .select(
      "id, user_id, full_name, plan, credits, uploads_used, chat_used, podcasts_used, current_streak, xp, level, is_admin, stripe_customer_id, created_at, last_study_date, usage_reset_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (plan === "free" || plan === "pro") {
    query = query.eq("plan", plan);
  }
  if (q) {
    query = query.or(`full_name.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    if (error.message.includes("is_admin")) {
      return apiError(
        "Admin schema missing — run APPLY_ADMIN.sql in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  // Enrich with emails via auth admin (best-effort)
  const users = data ?? [];
  const emails: Record<string, string> = {};
  try {
    const { data: list } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    for (const u of list?.users ?? []) {
      if (u.email) emails[u.id] = u.email;
    }
  } catch {
    // ignore — service role may lack auth admin in some setups
  }

  let rows = users.map((p) => ({
    ...p,
    email: emails[p.user_id] ?? null,
  }));

  if (q) {
    rows = rows.filter(
      (r) =>
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        r.user_id.toLowerCase().includes(q)
    );
  }

  return apiSuccess({
    users: rows,
    page,
    limit,
    total: count ?? rows.length,
  });
}
