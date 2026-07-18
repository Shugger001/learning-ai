import { YoutubeTranscript } from "youtube-transcript";

const YT_ID =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

export function extractYouTubeId(url: string): string | null {
  const match = url.match(YT_ID);
  return match?.[1] ?? null;
}

export async function fetchYouTubeTranscript(url: string): Promise<string> {
  const id = extractYouTubeId(url);
  if (!id) {
    throw new Error("Invalid YouTube URL");
  }

  try {
    const items = await YoutubeTranscript.fetchTranscript(id);
    const text = items
      .map((item) => item.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) {
      throw new Error("Empty transcript");
    }
    return text;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new Error(
      `Could not fetch YouTube captions (${message}). Try a video with captions enabled.`
    );
  }
}
