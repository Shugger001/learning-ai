import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const nowIso = new Date().toISOString();

  const [
    profileRes,
    studiesRes,
    dueRes,
    attemptsRes,
    activityRes,
    hardCardsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("current_streak, longest_streak, last_study_date, full_name")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("studies")
      .select("id, title, status")
      .eq("user_id", user.id)
      .eq("status", "complete"),
    supabase
      .from("flashcards")
      .select("id, study_id, question, due_at, ease, reps, studies!inner(user_id, status)")
      .eq("studies.user_id", user.id)
      .eq("studies.status", "complete")
      .lte("due_at", nowIso),
    supabase
      .from("quiz_attempts")
      .select("id, study_id, score, total, wrong_quiz_ids, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("study_activity")
      .select("activity_date, cards_reviewed, quizzes_taken")
      .eq("user_id", user.id)
      .order("activity_date", { ascending: false })
      .limit(30),
    supabase
      .from("flashcards")
      .select("id, study_id, question, ease, reps, interval_days, studies!inner(user_id, title, status)")
      .eq("studies.user_id", user.id)
      .eq("studies.status", "complete")
      .lt("ease", 2.2)
      .order("ease", { ascending: true })
      .limit(12),
  ]);

  const studies = studiesRes.data ?? [];
  const studyTitle = new Map(studies.map((s) => [s.id, s.title]));

  const dueCards = (dueRes.data ?? []).map((c) => ({
    id: c.id,
    study_id: c.study_id,
    question: c.question,
    due_at: c.due_at,
    study_title: studyTitle.get(c.study_id) ?? "Study",
  }));

  const weakCards = (hardCardsRes.data ?? []).map((c) => {
    const study = c.studies as unknown as { title?: string } | null;
    return {
      id: c.id,
      study_id: c.study_id,
      question: c.question,
      ease: c.ease,
      reps: c.reps,
      study_title: study?.title ?? studyTitle.get(c.study_id) ?? "Study",
    };
  });

  const attempts = attemptsRes.error ? [] : (attemptsRes.data ?? []);
  const activity = activityRes.error ? [] : (activityRes.data ?? []);

  const weakTopics = new Map<string, number>();
  for (const a of attempts) {
    const wrong = Array.isArray(a.wrong_quiz_ids) ? a.wrong_quiz_ids.length : 0;
    if (wrong <= 0) continue;
    const title = studyTitle.get(a.study_id) ?? "Study";
    weakTopics.set(title, (weakTopics.get(title) ?? 0) + wrong);
  }

  const profile = profileRes.data;

  return apiSuccess({
    streak: {
      current: Number(profile?.current_streak ?? 0),
      longest: Number(profile?.longest_streak ?? 0),
      lastStudyDate: profile?.last_study_date ?? null,
    },
    dueCount: dueCards.length,
    dueCards: dueCards.slice(0, 8),
    weakCards,
    weakTopics: Array.from(weakTopics.entries())
      .map(([title, misses]) => ({ title, misses }))
      .sort((a, b) => b.misses - a.misses)
      .slice(0, 8),
    recentAttempts: attempts.slice(0, 8).map((a) => ({
      id: a.id,
      study_id: a.study_id,
      study_title: studyTitle.get(a.study_id) ?? "Study",
      score: a.score,
      total: a.total,
      created_at: a.created_at,
    })),
    activity,
    studyCount: studies.length,
  });
}
