import { createClient } from "@/lib/supabase/server";
import { ReviewWidgetClient } from "@/components/review/review-widget-client";
import type { ReviewTodayPayload } from "@/types/review";

export default async function ReviewWidgetPage() {
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

  const studyIds = (studies ?? []).map((s) => s.id);
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
    initial = {
      dueCount: cards.length,
      dueCards: cards,
      quizzes: [],
    };
  }

  return <ReviewWidgetClient initial={initial} />;
}
