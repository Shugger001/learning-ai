import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { computeDailyGoal } from "@/lib/goals/daily";
import { z } from "zod";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const nowIso = new Date().toISOString();
  const [{ data: profile }, { data: prefs }, { count: dueCount }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("current_streak")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("email_preferences")
        .select("free_minutes")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("flashcards")
        .select("id, studies!inner(user_id, status)", {
          count: "exact",
          head: true,
        })
        .eq("studies.user_id", user.id)
        .eq("studies.status", "complete")
        .lte("due_at", nowIso),
    ]);

  const freeMinutes =
    prefs && typeof prefs.free_minutes === "number"
      ? prefs.free_minutes
      : 25;

  const goal = computeDailyGoal({
    streak: Number(profile?.current_streak ?? 0),
    dueCount: dueCount ?? 0,
    freeMinutes,
  });

  // Today's progress toward goal
  const today = nowIso.slice(0, 10);
  const { data: activity } = await supabase
    .from("study_activity")
    .select("cards_reviewed, quizzes_taken, minutes_studied")
    .eq("user_id", user.id)
    .eq("activity_date", today)
    .maybeSingle();

  return apiSuccess({
    goal,
    progress: {
      cardsReviewed: activity?.cards_reviewed ?? 0,
      quizzesTaken: activity?.quizzes_taken ?? 0,
      minutesStudied: activity?.minutes_studied ?? 0,
    },
    freeMinutes,
  });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      free_minutes: z.number().int().min(10).max(120),
    })
    .safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { data, error } = await supabase
    .from("email_preferences")
    .upsert(
      {
        user_id: user.id,
        free_minutes: parsed.data.free_minutes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("free_minutes")
    .single();

  if (error) {
    if (
      error.message.includes("free_minutes") ||
      error.message.includes("email_preferences") ||
      error.code === "PGRST205"
    ) {
      return apiError(
        "Daily goals need APPLY_GOALS_BATTLES_DIGEST.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  return apiSuccess({ free_minutes: data.free_minutes });
}
