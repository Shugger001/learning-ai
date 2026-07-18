import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data: studies, error: studiesError } = await supabase
    .from("studies")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "complete");

  if (studiesError) return apiError(studiesError.message, 500);

  const studyIds = (studies ?? []).map((s) => s.id);
  if (studyIds.length === 0) return apiSuccess([]);

  const { data, error } = await supabase
    .from("flashcards")
    .select("*")
    .in("study_id", studyIds)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(40);

  if (error) return apiError(error.message, 500);
  return apiSuccess(data ?? []);
}
