import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { updateFlashcardSchema } from "@/lib/validations/study";

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
    .select("id, study_id, studies!inner(user_id)")
    .eq("id", params.id)
    .single();

  if (!existing) {
    return apiError("Flashcard not found", 404);
  }

  const { data, error } = await supabase
    .from("flashcards")
    .update(parsed.data)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(data);
}
