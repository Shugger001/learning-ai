import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/response";
import { transcribeAudio } from "@/lib/ai/generate";

export const maxDuration = 60;

/** Whisper STT for voice tutor replies. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  if (!process.env.OPENAI_API_KEY) {
    return apiError("OPENAI_API_KEY not configured", 503);
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File)) {
    return apiError("audio file required", 400);
  }
  if (file.size > 12 * 1024 * 1024) {
    return apiError("Audio too large (max 12 MB)", 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || "answer.webm";
    const text = await transcribeAudio(buffer, filename);
    return Response.json({ success: true, data: { text } });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Transcription failed",
      500
    );
  }
}
