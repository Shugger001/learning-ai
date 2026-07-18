/** Resolve one or many storage paths from studies.file_url */
export function resolveStudyFilePaths(fileUrl: string | null | undefined): string[] {
  if (!fileUrl?.trim()) return [];
  const trimmed = fileUrl.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((p): p is string => typeof p === "string" && p.length > 0);
      }
    } catch {
      return [trimmed];
    }
  }
  return [trimmed];
}

export function encodeStudyFilePaths(paths: string[]): string | null {
  if (!paths.length) return null;
  if (paths.length === 1) return paths[0];
  return JSON.stringify(paths);
}

export function inferContentTypeFromFilename(
  filename: string
): "pdf" | "audio" | "video" | "text" {
  const lower = filename.toLowerCase();
  if (/\.(pdf|pptx?)$/i.test(lower)) return "pdf";
  if (/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(lower)) return "audio";
  if (/\.(webm)$/i.test(lower)) return "audio";
  if (/\.(mp4|mov|m4v|avi|mkv)$/i.test(lower)) return "video";
  if (/\.(txt|md)$/i.test(lower)) return "text";
  return "pdf";
}
