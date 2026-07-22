import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { generateSpacedDrillScript } from "@/lib/ai/spaced-drill";
import { synthesizeSpeech } from "@/lib/ai/generate";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const day = todayUtc();
  const { data, error } = await supabase
    .from("spaced_episodes")
    .select("*")
    .eq("user_id", user.id)
    .eq("episode_date", day)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes("spaced_episodes") ||
      error.code === "PGRST205" ||
      error.code === "42P01"
    ) {
      return apiError(
        "Spaced drills need APPLY_PODCAST_ANNOUNCE_MASTERY.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  return apiSuccess(data);
}

/** Generate today's short audio drill from weak + due cards. */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const day = todayUtc();
  const nowIso = new Date().toISOString();

  const { data: existing } = await admin
    .from("spaced_episodes")
    .select("*")
    .eq("user_id", user.id)
    .eq("episode_date", day)
    .maybeSingle();

  if (existing?.status === "complete" && existing.audio_url) {
    return apiSuccess(existing);
  }

  const { data: studies } = await supabase
    .from("studies")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("status", "complete");
  const studyList = studies ?? [];
  const studyIds = studyList.map((s) => s.id);
  const titleById = new Map(studyList.map((s) => [s.id, s.title]));

  if (studyIds.length === 0) {
    return apiError("Add a complete study first", 400);
  }

  const [{ data: dueCards }, { data: weakCards }] = await Promise.all([
    supabase
      .from("flashcards")
      .select("id, study_id, question, answer, ease, due_at")
      .in("study_id", studyIds)
      .lte("due_at", nowIso)
      .order("due_at", { ascending: true })
      .limit(12),
    supabase
      .from("flashcards")
      .select("id, study_id, question, answer, ease, due_at")
      .in("study_id", studyIds)
      .lt("ease", 2.2)
      .order("ease", { ascending: true })
      .limit(12),
  ]);

  const picked = new Map<
    string,
    { id: string; study_id: string; question: string; answer: string }
  >();
  for (const c of [...(dueCards ?? []), ...(weakCards ?? [])]) {
    if (!picked.has(c.id)) picked.set(c.id, c);
    if (picked.size >= 8) break;
  }

  const cards = Array.from(picked.values());
  if (cards.length < 2) {
    return apiError("Need at least 2 due or weak cards for a drill", 400);
  }

  const primaryStudy = cards[0]?.study_id ?? null;

  const { data: row, error: upsertErr } = await admin
    .from("spaced_episodes")
    .upsert(
      {
        user_id: user.id,
        episode_date: day,
        study_id: primaryStudy,
        card_ids: cards.map((c) => c.id),
        status: "processing",
        error_message: null,
        updated_at: nowIso,
      },
      { onConflict: "user_id,episode_date" }
    )
    .select("*")
    .single();

  if (upsertErr) {
    if (
      upsertErr.message.includes("spaced_episodes") ||
      upsertErr.code === "PGRST205"
    ) {
      return apiError(
        "Spaced drills need APPLY_PODCAST_ANNOUNCE_MASTERY.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(upsertErr.message, 500);
  }

  try {
    const script = await generateSpacedDrillScript(
      cards.map((c) => ({
        question: c.question,
        answer: c.answer,
        studyTitle: titleById.get(c.study_id) ?? "Study",
      })),
      day
    );

    let audioUrl: string | null = null;
    if (process.env.OPENAI_API_KEY) {
      const chunks: string[] = [];
      const cleaned = script.replace(/\s+/g, " ").trim();
      for (let i = 0; i < cleaned.length; i += 850) {
        chunks.push(cleaned.slice(i, i + 850));
      }
      const parts: Buffer[] = [];
      for (const chunk of chunks.slice(0, 6)) {
        parts.push(await synthesizeSpeech(chunk, "alloy"));
      }
      const audio = Buffer.concat(parts);
      const path = `${user.id}/spaced/${day}.mp3`;
      const { error: upErr } = await admin.storage
        .from("podcasts")
        .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = admin.storage.from("podcasts").getPublicUrl(path);
      audioUrl = pub.publicUrl;
    }

    const { data: episode, error } = await admin
      .from("spaced_episodes")
      .update({
        status: "complete",
        script,
        audio_url: audioUrl,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return apiSuccess(episode);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Drill failed";
    await admin
      .from("spaced_episodes")
      .update({
        status: "error",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return apiError(message, 500);
  }
}
