import { requireAdmin, isAdminContext } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET(request: Request) {
  const ctx = await requireAdmin();
  if (!isAdminContext(ctx)) return ctx;
  const { admin } = ctx;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // processing | complete | error | all
  const q = (searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
  const limit = Math.min(50, Math.max(10, Number(searchParams.get("limit") || 25) || 25));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = admin
    .from("studies")
    .select(
      "id, user_id, title, status, content_type, processing_progress, error_message, created_at, updated_at, flashcard_count, quiz_count",
      { count: "exact" }
    )
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) return apiError(error.message, 500);

  return apiSuccess({
    studies: data ?? [],
    page,
    limit,
    total: count ?? 0,
  });
}
