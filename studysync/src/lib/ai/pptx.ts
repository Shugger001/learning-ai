import JSZip from "jszip";

/** Extract visible text from a .pptx (Office Open XML) buffer. */
export async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = Number(/slide(\d+)\.xml$/i.exec(a)?.[1] ?? 0);
      const nb = Number(/slide(\d+)\.xml$/i.exec(b)?.[1] ?? 0);
      return na - nb;
    });

  if (slidePaths.length === 0) {
    throw new Error("No slides found in PowerPoint file");
  }

  const sections: string[] = [];

  for (const path of slidePaths) {
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async("string");
    const body = extractParagraphText(xml);
    if (body) {
      const slideNum = /slide(\d+)\.xml$/i.exec(path)?.[1] ?? "?";
      sections.push(`## Slide ${slideNum}\n${body}`);
    }
  }

  const notePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = Number(/notesSlide(\d+)\.xml$/i.exec(a)?.[1] ?? 0);
      const nb = Number(/notesSlide(\d+)\.xml$/i.exec(b)?.[1] ?? 0);
      return na - nb;
    });

  for (const path of notePaths) {
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async("string");
    const body = extractParagraphText(xml);
    if (body) {
      const noteNum = /notesSlide(\d+)\.xml$/i.exec(path)?.[1] ?? "?";
      sections.push(`### Speaker notes (slide ${noteNum})\n${body}`);
    }
  }

  const combined = sections.join("\n\n").trim();
  if (!combined) {
    throw new Error("Could not extract text from PowerPoint file");
  }
  return combined;
}

/**
 * PowerPoint splits words across many <a:t> runs inside one <a:p>.
 * Join runs within each paragraph, keep paragraphs as separate lines.
 */
function extractParagraphText(xml: string): string {
  const paragraphs = Array.from(xml.matchAll(/<a:p\b[^>]*>[\s\S]*?<\/a:p>/g));
  const lines: string[] = [];

  for (const match of paragraphs) {
    const paragraph = match[0]
      .replace(/<a:br\b[^>]*\/>/g, "\n")
      .replace(/<a:br\b[^>]*>\s*<\/a:br>/g, "\n");

    const runs = Array.from(
      paragraph.matchAll(/<a:t\b[^>]*>([^<]*)<\/a:t>/g)
    ).map((m) => decodeXmlEntities(m[1] ?? ""));

    const line = runs
      .join("")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    if (line) lines.push(line);
  }

  return lines.join("\n");
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
