import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

interface RouteParams {
  params: { token: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data: study } = await admin
    .from("studies")
    .select("id, title, content_type, status, share_token")
    .eq("share_token", params.token)
    .single();

  if (!study) return apiError("Shared study not found", 404);

  const [{ data: notes }, { data: flashcards }, { data: quizzes }] =
    await Promise.all([
      admin.from("notes").select("*").eq("study_id", study.id).maybeSingle(),
      admin
        .from("flashcards")
        .select("*")
        .eq("study_id", study.id)
        .order("position"),
      admin
        .from("quizzes")
        .select("*")
        .eq("study_id", study.id)
        .order("position"),
    ]);

  return apiSuccess({ study, notes, flashcards, quizzes });
}
