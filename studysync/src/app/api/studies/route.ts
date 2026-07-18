import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createStudySchema } from "@/lib/validations/study";
import { fetchYouTubeTranscript } from "@/lib/ai/youtube";
import { FREE_LIMITS, isPro } from "@/lib/billing/limits";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

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

  if (meta.content_type === "youtube" && !meta.source_url?.trim()) {
    return apiError("YouTube URL is required", 400);
  }

  const needsFile =
    meta.content_type !== "text" && meta.content_type !== "youtube";
  if (needsFile && !(file instanceof File)) {
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

  const { data: profile } = await admin
    .from("profiles")
    .select("plan, uploads_used")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    profile &&
    !isPro(profile.plan) &&
    (profile.uploads_used ?? 0) >= FREE_LIMITS.uploads
  ) {
    return apiError(
      `Free plan limit reached (${FREE_LIMITS.uploads} uploads). Upgrade to Pro for unlimited studies.`,
      402
    );
  }

  let fileUrl: string | null = null;
  let transcriptText: string | null = meta.text_content?.trim() ?? null;
  const sourceUrl: string | null = meta.source_url?.trim() ?? null;

  if (meta.content_type === "youtube" && sourceUrl) {
    try {
      transcriptText = await fetchYouTubeTranscript(sourceUrl);
    } catch (err) {
      return apiError(
        err instanceof Error ? err.message : "YouTube transcript failed",
        400
      );
    }
  }

  if (file instanceof File) {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const lower = file.name.toLowerCase();
    let uploadContentType = file.type || "application/octet-stream";
    if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) {
      uploadContentType =
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    } else if (lower.endsWith(".pdf") && !uploadContentType.includes("pdf")) {
      uploadContentType = "application/pdf";
    } else if (
      lower.endsWith(".webm") ||
      lower.endsWith(".ogg") ||
      uploadContentType.startsWith("audio/")
    ) {
      uploadContentType = file.type || "audio/webm";
    }

    const { error: uploadError } = await admin.storage
      .from("lectures")
      .upload(path, buffer, {
        contentType: uploadContentType,
        upsert: false,
      });

    if (uploadError) {
      // Retry as octet-stream when bucket MIME allowlist rejects recordings/etc.
      const retry = await admin.storage.from("lectures").upload(path, buffer, {
        contentType: "application/octet-stream",
        upsert: false,
      });
      if (retry.error) {
        return apiError(`Upload failed: ${uploadError.message}`, 500);
      }
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
      source_url: sourceUrl,
      folder_id: meta.folder_id ?? null,
      transcript_text: transcriptText,
      flashcard_count: meta.flashcard_count,
      quiz_count: meta.quiz_count,
      detail_level: meta.detail_level,
      processing_progress: 5,
    })
    .select("*")
    .single();

  if (studyError || !study) {
    return apiError(studyError?.message ?? "Failed to create study", 500);
  }

  if (profile) {
    await admin
      .from("profiles")
      .update({ uploads_used: (profile.uploads_used ?? 0) + 1 })
      .eq("user_id", user.id);
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
