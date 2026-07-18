import { transcribeAudio } from "@/lib/ai/generate";
import type { ContentType } from "@/types/database";

export async function extractTextFromBuffer(params: {
  buffer: Buffer;
  contentType: ContentType;
  filename: string;
  mimeType?: string;
}): Promise<string> {
  const { buffer, contentType, filename, mimeType } = params;

  if (contentType === "text") {
    return buffer.toString("utf-8");
  }

  if (contentType === "pdf") {
    // pdf-parse is CommonJS; dynamic import keeps the edge/runtime happier
    const pdfParse = (await import("pdf-parse")).default as (
      data: Buffer
    ) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    if (!result.text?.trim()) {
      throw new Error("Could not extract text from PDF");
    }
    return result.text;
  }

  if (contentType === "audio" || contentType === "video") {
    // Whisper accepts common audio/video containers (mp3, mp4, wav, m4a, webm, …)
    const name =
      filename ||
      (contentType === "video" ? "lecture.mp4" : "lecture.mp3");
    return transcribeAudio(buffer, name);
  }

  throw new Error(`Unsupported content type: ${contentType} (${mimeType ?? "unknown"})`);
}
