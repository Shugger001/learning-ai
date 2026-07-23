import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { masteryScore } from "@/lib/progress/mastery";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const a = searchParams.get("a");
  const b = searchParams.get("b");
  if (!a || !b || a === b) {
    return apiError("Pick two different study ids (?a=&b=)", 400);
  }

  const { data: studies, error } = await supabase
    .from("studies")
    .select("id, title, flashcard_count, quiz_count, status")
    .eq("user_id", user.id)
    .in("id", [a, b]);

  if (error) return apiError(error.message, 500);
  const studyA = studies?.find((s) => s.id === a);
  const studyB = studies?.find((s) => s.id === b);
  if (!studyA || !studyB) return apiError("Studies not found", 404);

  const nowIso = new Date().toISOString();
  const [{ data: cards }, attemptsRes] = await Promise.all([
    supabase
      .from("flashcards")
      .select("id, study_id, ease, reps, due_at, content_key")
      .in("study_id", [a, b]),
    supabase
      .from("quiz_attempts")
      .select("study_id, score, total, created_at")
      .eq("user_id", user.id)
      .in("study_id", [a, b])
      .order("created_at", { ascending: false }),
  ]);

  const attempts = attemptsRes.error ? [] : attemptsRes.data ?? [];

  function side(studyId: string, title: string) {
    const deck = (cards ?? []).filter((c) => c.study_id === studyId);
    const easeSum = deck.reduce((s, c) => s + Number(c.ease ?? 2.5), 0);
    const repsSum = deck.reduce((s, c) => s + Number(c.reps ?? 0), 0);
    const count = deck.length || 1;
    const avgEase = easeSum / count;
    const avgReps = repsSum / count;
    const dueCount = deck.filter(
      (c) => new Date(c.due_at || 0).getTime() <= Date.now()
    ).length;
    const weakCount = deck.filter((c) => Number(c.ease ?? 2.5) < 2.2).length;
    const latest = attempts.find((x) => x.study_id === studyId);
    return {
      studyId,
      title,
      dueCount,
      weakCount,
      cardCount: deck.length,
      masteryScore: deck.length ? masteryScore(avgEase, avgReps) : 0,
      recentScore:
        latest && latest.total > 0
          ? Math.round((latest.score / latest.total) * 100)
          : null,
      contentKeys: deck
        .map((c) => c.content_key)
        .filter((k): k is string => Boolean(k)),
    };
  }

  const left = side(a, studyA.title);
  const right = side(b, studyB.title);
  const shared = new Set(
    left.contentKeys.filter((k) => right.contentKeys.includes(k))
  );

  return apiSuccess({
    a: {
      studyId: left.studyId,
      title: left.title,
      dueCount: left.dueCount,
      weakCount: left.weakCount,
      cardCount: left.cardCount,
      masteryScore: left.masteryScore,
      recentScore: left.recentScore,
    },
    b: {
      studyId: right.studyId,
      title: right.title,
      dueCount: right.dueCount,
      weakCount: right.weakCount,
      cardCount: right.cardCount,
      masteryScore: right.masteryScore,
      recentScore: right.recentScore,
    },
    sharedContentKeys: shared.size,
    comparedAt: nowIso,
  });
}
