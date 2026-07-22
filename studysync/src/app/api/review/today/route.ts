import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import type { ReviewTodayPayload } from "@/types/review";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const nowIso = new Date().toISOString();

  const { data: studies, error: studiesError } = await supabase
    .from("studies")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("status", "complete");

  if (studiesError) return apiError(studiesError.message, 500);

  const studyList = studies ?? [];
  const studyIds = studyList.map((s) => s.id);
  const titleById = new Map(studyList.map((s) => [s.id, s.title]));

  if (studyIds.length === 0) {
    return apiSuccess({
      dueCount: 0,
      dueCards: [],
      quizzes: [],
    } satisfies ReviewTodayPayload);
  }

  const { data: dueCards, error: dueError } = await supabase
    .from("flashcards")
    .select("*")
    .in("study_id", studyIds)
    .lte("due_at", nowIso)
    .order("due_at", { ascending: true })
    .limit(40);

  if (dueError) return apiError(dueError.message, 500);

  const cards = dueCards ?? [];
  const quizStudyIds = Array.from(
    new Set(cards.map((c) => c.study_id).filter(Boolean))
  );
  const quizSourceIds =
    quizStudyIds.length > 0 ? quizStudyIds : studyIds.slice(0, 3);

  const { data: quizzes, error: quizError } = await supabase
    .from("quizzes")
    .select("*")
    .in("study_id", quizSourceIds)
    .order("position", { ascending: true })
    .limit(12);

  if (quizError) return apiError(quizError.message, 500);

  const quizPayload = (quizzes ?? []).map((q) => ({
    ...q,
    study_title: titleById.get(q.study_id) ?? "Study",
  }));

  return apiSuccess({
    dueCount: cards.length,
    dueCards: cards,
    quizzes: quizPayload,
  } satisfies ReviewTodayPayload);
}
