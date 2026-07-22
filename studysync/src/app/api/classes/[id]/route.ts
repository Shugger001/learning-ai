import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";

interface RouteParams {
  params: { id: string };
}

async function assertOwner(classId: string, userId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .eq("owner_id", userId)
    .maybeSingle();
  return data;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data: classroom, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return apiError(error.message, 500);
  if (!classroom) return apiError("Class not found", 404);

  const [{ data: members }, { data: assignments }] = await Promise.all([
    supabase
      .from("class_members")
      .select("*")
      .eq("class_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("class_assignments")
      .select("*, studies(id, title, status, flashcard_count)")
      .eq("class_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  let progress: unknown[] = [];
  if (assignmentIds.length > 0) {
    const { data } = await supabase
      .from("assignment_progress")
      .select("*")
      .in("assignment_id", assignmentIds);
    progress = data ?? [];
  }

  return apiSuccess({
    class: classroom,
    members: members ?? [],
    assignments: assignments ?? [],
    progress,
    isOwner: classroom.owner_id === user.id,
  });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const owned = await assertOwner(params.id, user.id);
  if (!owned) return apiError("Class not found", 404);

  const { error } = await supabase.from("classes").delete().eq("id", params.id);
  if (error) return apiError(error.message, 500);
  return apiSuccess({ deleted: true });
}
