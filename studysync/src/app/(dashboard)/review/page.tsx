import { createClient } from "@/lib/supabase/server";
import { DailyReviewClient } from "@/components/review/daily-review-client";
import type { ReviewTodayPayload } from "@/types/review";

export default async function ReviewPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nowIso = new Date().toISOString();

  const { data: studies } = await supabase
    .from("studies")
    .select("id, title")
    .eq("user_id", user!.id)
    .eq("status", "complete");

  const studyList = studies ?? [];
  const studyIds = studyList.map((s) => s.id);
  const titleById = new Map(studyList.map((s) => [s.id, s.title]));

  let initial: ReviewTodayPayload = {
    dueCount: 0,
    dueCards: [],
    quizzes: [],
  };

  if (studyIds.length > 0) {
    const { data: dueCards } = await supabase
      .from("flashcards")
      .select("*")
      .in("study_id", studyIds)
      .lte("due_at", nowIso)
      .order("due_at", { ascending: true })
      .limit(40);

    const cards = dueCards ?? [];
    const quizStudyIds = Array.from(
      new Set(cards.map((c) => c.study_id).filter(Boolean))
    );
    const quizSourceIds =
      quizStudyIds.length > 0 ? quizStudyIds : studyIds.slice(0, 3);

    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("*")
      .in("study_id", quizSourceIds)
      .order("position", { ascending: true })
      .limit(12);

    initial = {
      dueCount: cards.length,
      dueCards: cards,
      quizzes: (quizzes ?? []).map((q) => ({
        ...q,
        study_title: titleById.get(q.study_id) ?? "Study",
      })),
    };
  }

  return <DailyReviewClient initial={initial} />;
}
