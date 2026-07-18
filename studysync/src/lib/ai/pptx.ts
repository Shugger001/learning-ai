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
    const texts = Array.from(xml.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g))
      .map((m) => decodeXmlEntities(m[1] ?? "").trim())
      .filter(Boolean);

    if (texts.length) {
      const slideNum = /slide(\d+)\.xml$/i.exec(path)?.[1] ?? "?";
      sections.push(`Slide ${slideNum}\n${texts.join("\n")}`);
    }
  }

  // Speaker notes (optional)
  const notePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(name))
    .sort();

  for (const path of notePaths) {
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async("string");
    const texts = Array.from(xml.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g))
      .map((m) => decodeXmlEntities(m[1] ?? "").trim())
      .filter(Boolean);
    if (texts.length) {
      sections.push(`Notes\n${texts.join("\n")}`);
    }
  }

  const combined = sections.join("\n\n").trim();
  if (!combined) {
    throw new Error("Could not extract text from PowerPoint file");
  }
  return combined;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
