import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { updateFlashcardSchema } from "@/lib/validations/study";
import { applySrsRating } from "@/lib/ai/srs";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateFlashcardSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { data: existing } = await supabase
    .from("flashcards")
    .select(
      "id, study_id, ease, interval_days, reps, due_at, difficulty, studies!inner(user_id)"
    )
    .eq("id", params.id)
    .single();

  if (!existing) {
    return apiError("Flashcard not found", 404);
  }

  const patch: Record<string, unknown> = { ...parsed.data };
  delete patch.srs_rating;

  if (parsed.data.srs_rating) {
    const next = applySrsRating(
      {
        ease: Number(existing.ease ?? 2.5),
        interval_days: Number(existing.interval_days ?? 0),
        reps: Number(existing.reps ?? 0),
        due_at: existing.due_at ?? new Date().toISOString(),
        difficulty: existing.difficulty ?? "medium",
      },
      parsed.data.srs_rating
    );
    Object.assign(patch, next);
  }

  const { data, error } = await supabase
    .from("flashcards")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return apiError(error.message, 500);
  }

  if (parsed.data.srs_rating) {
    const { recordStudyActivity } = await import("@/lib/progress/activity");
    const awards = await recordStudyActivity(user.id, {
      cardsReviewed: 1,
      studyId: existing.study_id as string,
    });
    return apiSuccess({ ...data, awards });
  }

  return apiSuccess(data);
}
