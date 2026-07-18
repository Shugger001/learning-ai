import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  generatePodcastScript,
  synthesizePodcastAudio,
} from "@/lib/ai/generate";
import { FREE_LIMITS, ensureUsagePeriod, isPro } from "@/lib/billing/limits";
import { z } from "zod";

const bodySchema = z.object({ study_id: z.string().uuid() });

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const studyId = new URL(request.url).searchParams.get("study_id");
  if (!studyId) return apiError("study_id required", 400);

  const { data, error } = await supabase
    .from("podcasts")
    .select("*")
    .eq("study_id", studyId)
    .maybeSingle();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return apiError("Invalid study_id", 400);

  const { study_id } = parsed.data;

  const { data: study } = await supabase
    .from("studies")
    .select("id, title, transcript_text, user_id")
    .eq("id", study_id)
    .eq("user_id", user.id)
    .single();

  if (!study) return apiError("Study not found", 404);

  const { data: notes } = await supabase
    .from("notes")
    .select("content, summary")
    .eq("study_id", study_id)
    .maybeSingle();

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data: rawProfile } = await admin
    .from("profiles")
    .select("plan, podcasts_used, usage_reset_at")
    .eq("user_id", user.id)
    .single();

  const profile = await ensureUsagePeriod(admin, user.id, rawProfile);

  if (
    profile &&
    !isPro(profile.plan) &&
    (profile.podcasts_used ?? 0) >= FREE_LIMITS.podcasts
  ) {
    return apiError(
      `Free plan podcast limit reached (${FREE_LIMITS.podcasts} / 30 days). Upgrade to Pro.`,
      402
    );
  }

  await admin.from("podcasts").upsert(
    {
      study_id,
      status: "processing",
      error_message: null,
    },
    { onConflict: "study_id" }
  );

  try {
    const source =
      notes?.content ||
      notes?.summary ||
      study.transcript_text ||
      study.title;

    const script = await generatePodcastScript(source, study.title);
    let audioUrl: string | null = null;

    if (process.env.OPENAI_API_KEY) {
      const audio = await synthesizePodcastAudio(script);
      const path = `${user.id}/${study_id}.mp3`;
      const { error: upErr } = await admin.storage
        .from("podcasts")
        .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = admin.storage.from("podcasts").getPublicUrl(path);
      audioUrl = pub.publicUrl;
    }

    const { data: podcast, error } = await admin
      .from("podcasts")
      .update({
        status: "complete",
        script,
        audio_url: audioUrl,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("study_id", study_id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    if (profile) {
      await admin
        .from("profiles")
        .update({ podcasts_used: (profile.podcasts_used ?? 0) + 1 })
        .eq("user_id", user.id);
    }

    return apiSuccess(podcast);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Podcast failed";
    await admin
      .from("podcasts")
      .update({ status: "error", error_message: message })
      .eq("study_id", study_id);
    return apiError(message, 500);
  }
}
