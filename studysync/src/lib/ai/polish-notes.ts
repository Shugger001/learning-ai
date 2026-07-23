/** Make generated notes feel like a study guide, not a slide dump. */
export function polishNotesMarkdown(notes: string): string {
  if (!notes?.trim()) return notes;

  let out = notes.replace(/\r\n/g, "\n");

  // "## Slide 3: Photosynthesis" → "## Photosynthesis"
  out = out.replace(/^#{1,3}\s*Slide\s*\d+\s*[:.\-–—)]\s*/gim, (match) =>
    match.replace(/Slide\s*\d+\s*[:.\-–—)]\s*/i, "")
  );
  // Bare "## Slide 3" → "## Key idea 3"
  out = out.replace(
    /^(#{1,3})\s*Slide\s*(\d+)\s*$/gim,
    (_, hashes, n) => `${hashes} Key idea ${n}`
  );

  out = out.replace(/\n{3,}/g, "\n\n").trim();

  if (!/^#{1,3}\s/m.test(out)) {
    out = `# Overview\n\n${out}`;
  }

  return out;
}

export function polishSummary(summary: string): string {
  if (!summary?.trim()) return summary;
  return summary
    .replace(/\bSlide\s*\d+\b/gi, "this topic")
    .replace(/\s+/g, " ")
    .trim();
}
