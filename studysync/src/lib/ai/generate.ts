import OpenAI, { toFile } from "openai";
import { z } from "zod";
import type { DetailLevel, MindMapNode } from "@/types/database";

const flashcardSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const quizSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  correct_answer: z.string(),
  explanation: z.string(),
});

const mindMapSchema: z.ZodType<MindMapNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    children: z.array(mindMapSchema).optional(),
  })
);

const materialsSchema = z.object({
  title: z.string(),
  summary: z.string(),
  notes: z.string(),
  flashcards: z.array(flashcardSchema),
  quizzes: z.array(quizSchema),
  mind_map: mindMapSchema,
});

export type GeneratedMaterials = z.infer<typeof materialsSchema>;

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

/** Collapse OCR/slide artifacts like one-word-per-line into readable prose. */
export function normalizeSourceText(text: string): string {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const out: string[] = [];
  let buf = "";

  const flush = () => {
    if (buf) {
      out.push(buf.trim());
      buf = "";
    }
  };

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line) || /^Slide\s+\d+/i.test(line)) {
      flush();
      out.push(line.startsWith("#") ? line : `## ${line}`);
      continue;
    }

    const endsSentence = /[.!?:;]$/.test(line);
    const isShortFragment = line.split(/\s+/).length <= 4 && line.length < 40;

    if (!buf) {
      buf = line;
    } else if (isShortFragment && !endsSentence) {
      buf = `${buf} ${line}`.replace(/\s+/g, " ");
    } else if (!endsSentence && isShortFragment) {
      buf = `${buf} ${line}`.replace(/\s+/g, " ");
    } else {
      buf = `${buf} ${line}`.replace(/\s+/g, " ");
      if (endsSentence || buf.length > 160) flush();
    }

    if (endsSentence) flush();
  }
  flush();

  return out.join("\n\n").trim();
}

export async function transcribeAudio(buffer: Buffer, filename: string) {
  const openai = getOpenAI();
  const file = await toFile(buffer, filename);

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });

  return transcription.text;
}

export async function generateStudyMaterials(params: {
  sourceText: string;
  flashcardCount: number;
  detailLevel: DetailLevel;
  contentType: string;
}): Promise<GeneratedMaterials> {
  const openai = getOpenAI();
  const quizCount = Math.min(10, Math.max(5, Math.floor(params.flashcardCount / 2)));
  const notesGuidance =
    params.detailLevel === "concise"
      ? "Keep notes concise: short bullets, high-signal only."
      : "Write detailed, well-structured study notes with clear headings, short paragraphs, examples, and key definitions.";

  const truncated = normalizeSourceText(params.sourceText).slice(0, 100_000);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are StudySync, an expert study-material generator.
Return ONLY valid JSON matching this shape:
{
  "title": string,
  "summary": string (2–4 polished sentences, no line breaks mid-sentence),
  "notes": string (clean markdown ready to read),
  "flashcards": [{ "question": string, "answer": string }],
  "quizzes": [{ "question": string, "options": string[], "correct_answer": string, "explanation": string }],
  "mind_map": { "name": string, "children": [{ "name": string, "children": [...] }] }
}
Rules:
- Generate exactly ${params.flashcardCount} flashcards for active recall.
- Generate ${quizCount} multiple-choice quizzes with 4 options each.
- correct_answer must exactly match one option.
- ${notesGuidance}
- Notes MUST use proper markdown: # / ## headings, bullet lists, and short paragraphs — never one word per line.
- Rewrite slide fragments into coherent study prose; do not dump raw OCR/slide text.
- Summary must be a readable paragraph (not fragmented lines).
- Mind map should be hierarchical with 1 root and 2–3 depth levels.
- Base everything strictly on the source content.`,
      },
      {
        role: "user",
        content: `Content type: ${params.contentType}\n\nSource material:\n${truncated}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No content returned from OpenAI");
  }

  const parsed = materialsSchema.parse(JSON.parse(raw));
  return parsed;
}

/** Deterministic fallback when OPENAI_API_KEY is missing (local demos). */
export function generateMockMaterials(params: {
  sourceText: string;
  flashcardCount: number;
  titleHint?: string;
}): GeneratedMaterials {
  const title = params.titleHint || "Untitled Study";
  const normalized = normalizeSourceText(params.sourceText);
  const slides = splitIntoSections(normalized);
  const overview = slides
    .slice(0, 4)
    .map((s) => s.body)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);

  const summary =
    overview.length > 40
      ? overview
      : `A structured overview of ${title}, covering the main ideas from your upload.`;

  const notesBody =
    slides.length > 0
      ? slides
          .map((section) => {
            const bullets = section.body
              .split(/(?<=[.!?])\s+/)
              .map((s) => s.trim())
              .filter((s) => s.length > 12)
              .slice(0, 6);
            const list =
              bullets.length > 0
                ? bullets.map((b) => `- ${b}`).join("\n")
                : `- ${section.body.slice(0, 200)}`;
            return `## ${section.heading}\n\n${list}`;
          })
          .join("\n\n")
      : `## Overview\n\n- Review the main ideas from ${title}\n- Practice with flashcards and the quiz`;

  const flashcards = Array.from({ length: params.flashcardCount }, (_, i) => {
    const section = slides[i % Math.max(slides.length, 1)];
    return {
      question: section
        ? `What is covered in “${section.heading}”?`
        : `Key concept #${i + 1} from ${title}?`,
      answer: section
        ? section.body.slice(0, 180) || `Review section ${i + 1} of ${title}.`
        : `Review point ${i + 1} from ${title}.`,
    };
  });

  const topic = slides[0]?.heading ?? title;

  return {
    title,
    summary,
    notes: `# ${title}\n\n## Overview\n\n${summary}\n\n${notesBody}\n`,
    flashcards,
    quizzes: [
      {
        question: `What is the primary focus of “${title}”?`,
        options: [
          topic,
          "Unrelated trivia",
          "A random math proof",
          "None of the above",
        ],
        correct_answer: topic,
        explanation: "StudySync materials are generated from your uploaded lecture content.",
      },
      {
        question: "Which study method does StudySync emphasize?",
        options: ["Passive rereading", "Active recall", "Highlighting only", "Cramming"],
        correct_answer: "Active recall",
        explanation: "Flashcards and quizzes are designed for active recall practice.",
      },
    ],
    mind_map: {
      name: title,
      children: slides.slice(0, 4).map((s) => ({
        name: s.heading.slice(0, 40),
        children: [{ name: "Key points" }],
      })),
    },
  };
}

function splitIntoSections(
  text: string
): { heading: string; body: string }[] {
  const parts = text.split(/\n(?=##\s)/);
  const sections: { heading: string; body: string }[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const headingMatch = /^##\s+(.+)\n?([\s\S]*)$/.exec(trimmed);
    if (headingMatch) {
      sections.push({
        heading: headingMatch[1].trim(),
        body: headingMatch[2].replace(/\s+/g, " ").trim(),
      });
    } else {
      sections.push({
        heading: "Key ideas",
        body: trimmed.replace(/\s+/g, " ").trim(),
      });
    }
  }

  return sections.filter((s) => s.body.length > 0);
}
