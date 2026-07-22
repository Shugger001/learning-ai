import { createClient } from "@/lib/supabase/server";
import { DailyReviewClient } from "@/components/review/daily-review-client";
import type { ReviewTodayPayload } from "@/types/review";

function dayBounds(date: string) {
  const start = `${date}T00:00:00.000Z`;
  const endDate = new Date(start);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return { start, end: endDate.toISOString() };
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams?: { date?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = new Date().toISOString().slice(0, 10);
  const dateParam = searchParams?.date;
  const focusDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const isFuture = focusDate > today;
  const { start, end } = dayBounds(focusDate);
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
    let cardsQuery = supabase
      .from("flashcards")
      .select("*")
      .in("study_id", studyIds)
      .order("due_at", { ascending: true })
      .limit(40);

    if (isFuture) {
      cardsQuery = cardsQuery.gte("due_at", start).lt("due_at", end);
    } else if (focusDate === today) {
      cardsQuery = cardsQuery.lte("due_at", nowIso);
    } else {
      // Past day: cards that were due that day (preview)
      cardsQuery = cardsQuery.gte("due_at", start).lt("due_at", end);
    }

    const { data: dueCards } = await cardsQuery;
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

  return (
    <DailyReviewClient
      initial={initial}
      focusDate={focusDate !== today ? focusDate : undefined}
      studyAhead={isFuture}
    />
  );
}
