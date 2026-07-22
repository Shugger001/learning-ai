import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";

interface RouteParams {
  params: { code: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const code = params.code.trim().toUpperCase();
  const { data, error } = await supabase
    .from("study_rooms")
    .select("*, studies(id, title, status, flashcard_count)")
    .eq("join_code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    if (error.message.includes("study_rooms") || error.code === "PGRST205") {
      return apiError(
        "Study rooms need APPLY_GRADEBOOK_ROOMS.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }
  if (!data) return apiError("Room not found", 404);

  return apiSuccess({
    ...data,
    isHost: data.host_id === user.id,
  });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const code = params.code.trim().toUpperCase();
  const { data: room } = await supabase
    .from("study_rooms")
    .select("id, host_id")
    .eq("join_code", code)
    .maybeSingle();

  if (!room || room.host_id !== user.id) {
    return apiError("Room not found", 404);
  }

  const { error } = await supabase
    .from("study_rooms")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", room.id);

  if (error) return apiError(error.message, 500);
  return apiSuccess({ closed: true });
}
