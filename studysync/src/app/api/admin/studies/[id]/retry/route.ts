import { requireAdmin, isAdminContext } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/response";

interface RouteParams {
  params: { id: string };
}

/** Force-retry a stuck/errored study via process-file. */
export async function POST(request: Request, { params }: RouteParams) {
  const ctx = await requireAdmin();
  if (!isAdminContext(ctx)) return ctx;
  const { admin } = ctx;

  const { data: study, error } = await admin
    .from("studies")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return apiError(error.message, 500);
  if (!study) return apiError("Study not found", 404);

  await admin
    .from("studies")
    .update({
      status: "processing",
      processing_progress: 5,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  const origin = new URL(request.url).origin;
  void fetch(`${origin}/api/process-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ study_id: params.id }),
  }).catch(() => undefined);

  return apiSuccess({ id: params.id, status: "processing" });
}
