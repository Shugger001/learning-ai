import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createStudySchema } from "@/lib/validations/study";
import { fetchYouTubeTranscript } from "@/lib/ai/youtube";
import { FREE_LIMITS, ensureUsagePeriod, isPro } from "@/lib/billing/limits";
import { encodeStudyFilePaths } from "@/lib/studies/files";

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

  const contentTypeHeader = request.headers.get("content-type") || "";
  let metaJson: unknown;
  let uploadedFile: File | null = null;

  if (contentTypeHeader.includes("multipart/form-data")) {
    const formData = await request.formData();
    const metaRaw = formData.get("meta");
    const file = formData.get("file");
    if (typeof metaRaw !== "string") {
      return apiError("Missing study metadata", 400);
    }
    try {
      metaJson = JSON.parse(metaRaw);
    } catch {
      return apiError("Invalid metadata JSON", 400);
    }
    if (file instanceof File) uploadedFile = file;
  } else {
    metaJson = await request.json().catch(() => null);
    if (!metaJson) return apiError("Invalid JSON body", 400);
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
  const incomingPaths = [
    ...(meta.file_paths ?? []),
    ...(meta.file_path ? [meta.file_path] : []),
  ].filter((p, i, arr) => arr.indexOf(p) === i);

  if (needsFile && incomingPaths.length === 0 && !uploadedFile) {
    return apiError("File is required", 400);
  }

  for (const path of incomingPaths) {
    if (!path.startsWith(`${user.id}/`)) {
      return apiError("Invalid file path", 403);
    }
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

  const profileSelect = await admin
    .from("profiles")
    .select("plan, uploads_used, usage_reset_at")
    .eq("user_id", user.id)
    .maybeSingle();

  let rawProfile = profileSelect.data as {
    plan: string | null;
    uploads_used: number | null;
    usage_reset_at?: string | null;
  } | null;
  if (profileSelect.error?.message?.includes("usage_reset_at")) {
    const fallback = await admin
      .from("profiles")
      .select("plan, uploads_used")
      .eq("user_id", user.id)
      .maybeSingle();
    rawProfile = fallback.data;
  }

  const profile = await ensureUsagePeriod(admin, user.id, rawProfile);

  if (
    profile &&
    !isPro(profile.plan) &&
    (profile.uploads_used ?? 0) >= FREE_LIMITS.uploads
  ) {
    return apiError(
      `Free plan limit reached (${FREE_LIMITS.uploads} uploads / 30 days). Upgrade to Pro for unlimited studies.`,
      402
    );
  }

  let filePaths = [...incomingPaths];
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

  // Legacy/small-file path: upload through the API (kept for compatibility).
  if (filePaths.length === 0 && uploadedFile) {
    const ext = uploadedFile.name.split(".").pop() || "bin";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    const lower = uploadedFile.name.toLowerCase();
    let uploadContentType = uploadedFile.type || "application/octet-stream";
    if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) {
      uploadContentType =
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    } else if (lower.endsWith(".pdf") && !uploadContentType.includes("pdf")) {
      uploadContentType = "application/pdf";
    }

    const { error: uploadError } = await admin.storage
      .from("lectures")
      .upload(path, buffer, {
        contentType: uploadContentType,
        upsert: false,
      });

    if (uploadError) {
      const retry = await admin.storage.from("lectures").upload(path, buffer, {
        contentType: "application/octet-stream",
        upsert: false,
      });
      if (retry.error) {
        return apiError(`Upload failed: ${uploadError.message}`, 500);
      }
    }
    filePaths = [path];
  }

  if (filePaths.length > 0) {
    const { data: listed, error: listError } = await admin.storage
      .from("lectures")
      .list(user.id, { limit: 1000 });
    if (listError) {
      return apiError("Could not verify uploads. Please try again.", 500);
    }
    const names = new Set((listed ?? []).map((f) => f.name));
    for (const path of filePaths) {
      const fileName = path.split("/").pop();
      if (!fileName || !names.has(fileName)) {
        return apiError("Uploaded file not found. Please try again.", 400);
      }
    }
  }

  const fileUrl = encodeStudyFilePaths(filePaths);

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
