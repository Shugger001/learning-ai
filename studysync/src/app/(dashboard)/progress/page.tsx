import { createClient } from "@/lib/supabase/server";
import {
  ProgressClient,
  type ProgressPayload,
} from "@/components/progress/progress-client";
import { BADGE_CATALOG, levelFromXp, xpToNextLevel } from "@/lib/progress/xp";
import { buildDeckMastery } from "@/lib/progress/mastery";

export default async function ProgressPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nowIso = new Date().toISOString();

  const [
    profileRes,
    studiesRes,
    dueRes,
    attemptsRes,
    activityRes,
    hardCardsRes,
    achievementsRes,
    masteryCardsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("current_streak, longest_streak, last_study_date, xp, level")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("studies")
      .select("id, title, status")
      .eq("user_id", user!.id)
      .eq("status", "complete"),
    supabase
      .from("flashcards")
      .select(
        "id, study_id, question, due_at, studies!inner(user_id, status)"
      )
      .eq("studies.user_id", user!.id)
      .eq("studies.status", "complete")
      .lte("due_at", nowIso)
      .limit(40),
    supabase
      .from("quiz_attempts")
      .select("id, study_id, score, total, wrong_quiz_ids, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("study_activity")
      .select("activity_date, cards_reviewed, quizzes_taken")
      .eq("user_id", user!.id)
      .order("activity_date", { ascending: false })
      .limit(30),
    supabase
      .from("flashcards")
      .select(
        "id, study_id, question, ease, reps, studies!inner(user_id, title, status)"
      )
      .eq("studies.user_id", user!.id)
      .eq("studies.status", "complete")
      .lt("ease", 2.2)
      .order("ease", { ascending: true })
      .limit(12),
    supabase
      .from("user_achievements")
      .select("badge_key, unlocked_at")
      .eq("user_id", user!.id)
      .order("unlocked_at", { ascending: false }),
    supabase
      .from("flashcards")
      .select(
        "study_id, ease, reps, studies!inner(user_id, title, status)"
      )
      .eq("studies.user_id", user!.id)
      .eq("studies.status", "complete")
      .limit(2000),
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
    const nested = c.studies as unknown as
      | { title?: string }
      | { title?: string }[]
      | null;
    const study = Array.isArray(nested) ? nested[0] : nested;
    return {
      id: c.id,
      study_id: c.study_id,
      question: c.question,
      ease: Number(c.ease ?? 0),
      reps: Number(c.reps ?? 0),
      study_title: study?.title ?? studyTitle.get(c.study_id) ?? "Study",
    };
  });

  const attempts = attemptsRes.error ? [] : (attemptsRes.data ?? []);
  const activity = activityRes.error ? [] : (activityRes.data ?? []);
  const achievementRows = achievementsRes.error
    ? []
    : (achievementsRes.data ?? []);

  const masteryRows = (masteryCardsRes.data ?? []).map((c) => {
    const nested = c.studies as unknown as
      | { title?: string }
      | { title?: string }[]
      | null;
    const study = Array.isArray(nested) ? nested[0] : nested;
    return {
      study_id: c.study_id,
      title: study?.title ?? studyTitle.get(c.study_id) ?? "Study",
      ease: Number(c.ease ?? 2.5),
      reps: Number(c.reps ?? 0),
    };
  });

  const weakTopics = new Map<
    string,
    { study_id: string; title: string; misses: number }
  >();
  for (const a of attempts) {
    const wrong = Array.isArray(a.wrong_quiz_ids) ? a.wrong_quiz_ids.length : 0;
    if (wrong <= 0) continue;
    const title = studyTitle.get(a.study_id) ?? "Study";
    const prev = weakTopics.get(a.study_id);
    weakTopics.set(a.study_id, {
      study_id: a.study_id,
      title,
      misses: (prev?.misses ?? 0) + wrong,
    });
  }

  const xp = Number(profileRes.data?.xp ?? 0);
  const level = Number(profileRes.data?.level ?? levelFromXp(xp));

  const payload: ProgressPayload = {
    streak: {
      current: Number(profileRes.data?.current_streak ?? 0),
      longest: Number(profileRes.data?.longest_streak ?? 0),
      lastStudyDate: profileRes.data?.last_study_date ?? null,
    },
    xp,
    level,
    xpToNext: xpToNextLevel(xp),
    achievements: achievementRows.map((row) => {
      const meta = BADGE_CATALOG[row.badge_key] ?? {
        title: row.badge_key,
        description: "Unlocked",
      };
      return {
        badge_key: row.badge_key,
        title: meta.title,
        description: meta.description,
        unlocked_at: row.unlocked_at,
      };
    }),
    dueCount: dueCards.length,
    dueCards: dueCards.slice(0, 8),
    weakCards,
    weakTopics: Array.from(weakTopics.values())
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
    mastery: buildDeckMastery(masteryRows),
  };

  return <ProgressClient data={payload} />;
}
