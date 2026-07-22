import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/response";
import { synthesizeSpeech } from "@/lib/ai/generate";
import { z } from "zod";

export const maxDuration = 30;

/** TTS for tutor / chat replies. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  if (!process.env.OPENAI_API_KEY) {
    return apiError("OPENAI_API_KEY not configured", 503);
  }

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      text: z.string().min(1).max(2000),
      voice: z.enum(["alloy", "onyx"]).optional(),
    })
    .safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  try {
    const audio = await synthesizeSpeech(
      parsed.data.text,
      parsed.data.voice ?? "alloy"
    );
    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Speech synthesis failed",
      500
    );
  }
}
