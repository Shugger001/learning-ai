import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data: owned } = await supabase
    .from("classes")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!owned) return apiError("Class not found", 404);

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      study_id: z.string().uuid(),
      title: z.string().max(200).optional(),
      due_at: z.string().datetime().optional().nullable(),
    })
    .safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { data: study } = await supabase
    .from("studies")
    .select("id, title, status")
    .eq("id", parsed.data.study_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!study || study.status !== "complete") {
    return apiError("Pick a complete study from your library", 400);
  }

  const { data, error } = await supabase
    .from("class_assignments")
    .insert({
      class_id: params.id,
      study_id: study.id,
      title: parsed.data.title?.trim() || study.title,
      due_at: parsed.data.due_at ?? null,
      created_by: user.id,
    })
    .select("*, studies(id, title, status, flashcard_count)")
    .single();

  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      return apiError("That pack is already assigned", 409);
    }
    return apiError(error.message, 500);
  }

  // Ensure teacher study is shareable for students
  if (!study) return apiSuccess(data, 201);
  const { data: full } = await supabase
    .from("studies")
    .select("share_token")
    .eq("id", study.id)
    .single();
  if (!full?.share_token) {
    await supabase
      .from("studies")
      .update({ share_token: crypto.randomUUID().replace(/-/g, "") })
      .eq("id", study.id);
  }

  return apiSuccess(data, 201);
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const assignmentId = new URL(request.url).searchParams.get("id");
  if (!assignmentId) return apiError("id required", 400);

  const { data: owned } = await supabase
    .from("classes")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!owned) return apiError("Class not found", 404);

  const { error } = await supabase
    .from("class_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("class_id", params.id);

  if (error) return apiError(error.message, 500);
  return apiSuccess({ deleted: true });
}
