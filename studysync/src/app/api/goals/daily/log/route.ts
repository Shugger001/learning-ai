import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      minutes: z.number().int().min(1).max(180),
      study_id: z.string().uuid().optional(),
    })
    .safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { recordStudyActivity } = await import("@/lib/progress/activity");
  await recordStudyActivity(user.id, {
    minutesStudied: parsed.data.minutes,
    studyId: parsed.data.study_id,
  });

  const today = new Date().toISOString().slice(0, 10);
  const { data: activity } = await supabase
    .from("study_activity")
    .select("minutes_studied, cards_reviewed, quizzes_taken")
    .eq("user_id", user.id)
    .eq("activity_date", today)
    .maybeSingle();

  return apiSuccess({
    minutesStudied: activity?.minutes_studied ?? parsed.data.minutes,
    cardsReviewed: activity?.cards_reviewed ?? 0,
    quizzesTaken: activity?.quizzes_taken ?? 0,
  });
}
