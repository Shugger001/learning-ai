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

  if (contentType === "text") {
    return buffer.toString("utf-8");
  }

  if (contentType === "pdf") {
    if (isPptxFilename(filename)) {
      return extractTextFromPptx(buffer);
    }

    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      if (!result.text?.trim()) {
        throw new Error("Could not extract text from PDF");
      }
      return result.text;
    } finally {
      await parser.destroy().catch(() => undefined);
    }
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
