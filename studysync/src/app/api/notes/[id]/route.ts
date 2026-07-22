import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { updateNoteSchema } from "@/lib/validations/study";

interface RouteParams {
  params: { id: string };
}

async function canEditNote(noteId: string, userId: string, email?: string | null) {
  const supabase = createClient();
  const { data: note } = await supabase
    .from("notes")
    .select("id, study_id, studies!inner(user_id)")
    .eq("id", noteId)
    .maybeSingle();

  if (!note) return false;
  const ownerId = (note.studies as unknown as { user_id: string }).user_id;
  if (ownerId === userId) return true;

  if (!email) return false;
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return false;
  }
  const { data: invite } = await admin
    .from("share_invites")
    .select("id")
    .eq("study_id", note.study_id)
    .eq("role", "editor")
    .ilike("email", email)
    .maybeSingle();
  return Boolean(invite);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const allowed = await canEditNote(params.id, user.id, user.email);
  if (!allowed) {
    return apiError("Forbidden", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  const client = admin ?? supabase;
  const { data, error } = await client
    .from("notes")
    .update(parsed.data)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(data);
}
