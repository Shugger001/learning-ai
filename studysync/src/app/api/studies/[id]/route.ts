import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { resolveStudyFilePaths } from "@/lib/studies/files";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { data: study, error } = await supabase
    .from("studies")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error || !study) {
    return apiError("Study not found", 404);
  }

  const [{ data: flashcards }, { data: quizzes }, { data: notes }] =
    await Promise.all([
      supabase
        .from("flashcards")
        .select("*")
        .eq("study_id", params.id)
        .order("position", { ascending: true }),
      supabase
        .from("quizzes")
        .select("*")
        .eq("study_id", params.id)
        .order("position", { ascending: true }),
      supabase.from("notes").select("*").eq("study_id", params.id).maybeSingle(),
    ]);

  return apiSuccess({
    ...study,
    flashcards: flashcards ?? [],
    quizzes: quizzes ?? [],
    notes: notes ?? null,
  });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  const { data: study } = await supabase
    .from("studies")
    .select("id, file_url, user_id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!study) {
    return apiError("Study not found", 404);
  }

  const paths = resolveStudyFilePaths(study.file_url);
  if (admin && paths.length > 0) {
    await admin.storage.from("lectures").remove(paths);
  }
  if (admin) {
    await admin.storage.from("podcasts").remove([`${user.id}/${params.id}.mp3`]);
  }

  const { error } = await supabase
    .from("studies")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess({ deleted: true });
}
