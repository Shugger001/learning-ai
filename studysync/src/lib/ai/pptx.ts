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
    const body = extractAllText(xml);
    const slideNum = /slide(\d+)\.xml$/i.exec(path)?.[1] ?? "?";
    if (body) {
      sections.push(`## Slide ${slideNum}\n${body}`);
    } else {
      sections.push(
        `## Slide ${slideNum}\n(No extractable text — likely image-heavy)`
      );
    }
  }

  // SmartArt / diagrams often hold labels outside slide XML
  const diagramPaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/diagrams\/data\d+\.xml$/i.test(name))
    .sort();
  for (let i = 0; i < diagramPaths.length; i++) {
    const file = zip.file(diagramPaths[i]);
    if (!file) continue;
    const body = extractAllText(await file.async("string"));
    if (body) sections.push(`### Diagram ${i + 1}\n${body}`);
  }

  // Chart titles / series labels
  const chartPaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/charts\/chart\d+\.xml$/i.test(name))
    .sort();
  for (let i = 0; i < chartPaths.length; i++) {
    const file = zip.file(chartPaths[i]);
    if (!file) continue;
    const body = extractAllText(await file.async("string"));
    if (body) sections.push(`### Chart ${i + 1}\n${body}`);
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
    const body = extractAllText(xml);
    if (body) {
      const noteNum = /notesSlide(\d+)\.xml$/i.exec(path)?.[1] ?? "?";
      sections.push(`### Speaker notes (slide ${noteNum})\n${body}`);
    }
  }

  const combined = sections.join("\n\n").trim();
  if (!combined || wordCount(combined) < 8) {
    throw new Error("Could not extract usable text from PowerPoint file");
  }
  return combined;
}

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Prefer paragraph structure; fall back to every text run so tables,
 * SmartArt fragments, and odd shapes still contribute.
 */
function extractAllText(xml: string): string {
  const fromParagraphs = extractParagraphText(xml);
  if (wordCount(fromParagraphs) >= 3) return fromParagraphs;

  const runs = Array.from(xml.matchAll(/<a:t\b[^>]*>([^<]*)<\/a:t>/g))
    .map((m) => decodeXmlEntities(m[1] ?? "").trim())
    .filter(Boolean);

  // Deduplicate consecutive identical runs (common in SmartArt)
  const deduped: string[] = [];
  for (const run of runs) {
    if (deduped[deduped.length - 1] !== run) deduped.push(run);
  }
  return deduped.join(" ").replace(/\s+/g, " ").trim();
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
