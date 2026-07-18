import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createStudySchema } from "@/lib/validations/study";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { data, error } = await supabase
    .from("studies")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(data);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const formData = await request.formData();
  const metaRaw = formData.get("meta");
  const file = formData.get("file");

  if (typeof metaRaw !== "string") {
    return apiError("Missing study metadata", 400);
  }

  let metaJson: unknown;
  try {
    metaJson = JSON.parse(metaRaw);
  } catch {
    return apiError("Invalid metadata JSON", 400);
  }

  const parsed = createStudySchema.safeParse(metaJson);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const meta = parsed.data;

  if (meta.content_type === "text" && !meta.text_content?.trim()) {
    return apiError("Text content is required for text studies", 400);
  }

  if (meta.content_type !== "text" && !(file instanceof File)) {
    return apiError("File is required", 400);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError(
      "Server misconfigured: missing Supabase service role key",
      500
    );
  }

  let fileUrl: string | null = null;
  const transcriptText: string | null = meta.text_content?.trim() ?? null;

  if (file instanceof File) {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from("lectures")
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return apiError(`Upload failed: ${uploadError.message}`, 500);
    }

    fileUrl = path;
  }

  const { data: study, error: studyError } = await admin
    .from("studies")
    .insert({
      user_id: user.id,
      title: meta.title,
      content_type: meta.content_type,
      status: "processing",
      file_url: fileUrl,
      transcript_text: transcriptText,
      flashcard_count: meta.flashcard_count,
      detail_level: meta.detail_level,
      processing_progress: 5,
    })
    .select("*")
    .single();

  if (studyError || !study) {
    return apiError(studyError?.message ?? "Failed to create study", 500);
  }

  const origin = new URL(request.url).origin;
  const cookie = request.headers.get("cookie") ?? "";

  void fetch(`${origin}/api/process-file`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify({ study_id: study.id }),
  }).catch(() => null);

  return apiSuccess(study, 201);
}
