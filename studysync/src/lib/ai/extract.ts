import { transcribeAudio } from "@/lib/ai/generate";
import { extractTextFromPptx } from "@/lib/ai/pptx";
import type { ContentType } from "@/types/database";

function isPptxFilename(filename: string): boolean {
  return /\.pptx?$/i.test(filename);
}

export async function extractTextFromBuffer(params: {
  buffer: Buffer;
  contentType: ContentType;
  filename: string;
  mimeType?: string;
}): Promise<string> {
  const { buffer, contentType, filename, mimeType } = params;

  if (contentType === "text" || contentType === "notion") {
    return buffer.toString("utf-8");
  }

  if (contentType === "pdf") {
    if (isPptxFilename(filename)) {
      return extractTextFromPptx(buffer);
    }

    // unpdf is built for serverless (no pdf.worker.mjs fake-worker path issues)
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(result.text)
      ? result.text.join("\n\n")
      : String(result.text ?? "");
    if (!text.trim()) {
      throw new Error("Could not extract text from PDF");
    }
    return text;
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
