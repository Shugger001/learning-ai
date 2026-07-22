import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

interface RouteParams {
  params: { token: string };
}

/** Public sanitized progress snapshot for accountability / teachers. */
export async function GET(_request: Request, { params }: RouteParams) {
  const token = params.token?.trim();
  if (!token) return apiError("token required", 400);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select(
      "user_id, full_name, current_streak, longest_streak, last_study_date, progress_share_token"
    )
    .eq("progress_share_token", token)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes("progress_share_token") ||
      error.code === "PGRST204"
    ) {
      return apiError(
        "Progress share needs APPLY_PLAN_VOICE_SHARE.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }
  if (!profile) return apiError("Snapshot not found", 404);

  const userId = profile.user_id as string;
  const nowIso = new Date().toISOString();

  const [{ data: studies }, { data: activity }, { data: attempts }, dueRes] =
    await Promise.all([
      admin
        .from("studies")
        .select("id, title")
        .eq("user_id", userId)
        .eq("status", "complete"),
      admin
        .from("study_activity")
        .select("activity_date, cards_reviewed, quizzes_taken")
        .eq("user_id", userId)
        .order("activity_date", { ascending: false })
        .limit(14),
      admin
        .from("quiz_attempts")
        .select("study_id, score, total, wrong_quiz_ids, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("flashcards")
        .select("id, studies!inner(user_id, status)")
        .eq("studies.user_id", userId)
        .eq("studies.status", "complete")
        .lte("due_at", nowIso)
        .limit(100),
    ]);

  const studyTitle = new Map((studies ?? []).map((s) => [s.id, s.title]));
  const weakTopics = new Map<string, { title: string; misses: number }>();
  for (const a of attempts ?? []) {
    const wrong = Array.isArray(a.wrong_quiz_ids) ? a.wrong_quiz_ids.length : 0;
    if (wrong <= 0) continue;
    const title = studyTitle.get(a.study_id) ?? "Study";
    const prev = weakTopics.get(a.study_id);
    weakTopics.set(a.study_id, {
      title,
      misses: (prev?.misses ?? 0) + wrong,
    });
  }

  const recentScores = (attempts ?? []).slice(0, 5).map((a) => ({
    study_title: studyTitle.get(a.study_id) ?? "Study",
    score: a.score,
    total: a.total,
    created_at: a.created_at,
  }));

  return apiSuccess({
    displayName: profile.full_name?.split(" ")[0] || "Student",
    streak: {
      current: Number(profile.current_streak ?? 0),
      longest: Number(profile.longest_streak ?? 0),
      lastStudyDate: profile.last_study_date,
    },
    dueCount: dueRes.data?.length ?? 0,
    studyCount: studies?.length ?? 0,
    activity: activity ?? [],
    weakTopics: Array.from(weakTopics.values())
      .sort((a, b) => b.misses - a.misses)
      .slice(0, 5),
    recentScores,
  });
}
