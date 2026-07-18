import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

interface RouteParams {
  params: { id: string };
}

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data: study, error } = await admin
    .from("studies")
    .select("id, user_id, status")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !study) {
    return apiError("Study not found", 404);
  }

  if (study.status !== "error") {
    return apiError("Only failed studies can be retried", 400);
  }

  const { data: updated, error: updateError } = await admin
    .from("studies")
    .update({
      status: "processing",
      error_message: null,
      processing_progress: 5,
    })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return apiError(updateError?.message ?? "Retry failed", 500);
  }

  const origin = new URL(request.url).origin;
  const cookie = request.headers.get("cookie") ?? "";

  void fetch(`${origin}/api/process-file`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify({ study_id: params.id }),
  }).catch(() => null);

  return apiSuccess(updated);
}
