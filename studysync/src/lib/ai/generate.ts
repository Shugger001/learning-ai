import OpenAI, { toFile } from "openai";
import { z } from "zod";
import type { DetailLevel, MindMapNode } from "@/types/database";

const flashcardSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const quizSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(0).max(6),
  correct_answer: z.string(),
  explanation: z.string(),
  quiz_type: z.enum(["mcq", "fill_blank", "short_answer"]).default("mcq"),
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
  quizCount: number;
  detailLevel: DetailLevel;
  contentType: string;
}): Promise<GeneratedMaterials> {
  const openai = getOpenAI();
  const quizCount = Math.min(30, Math.max(1, params.quizCount));
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
  "quizzes": [{ "question": string, "options": string[], "correct_answer": string, "explanation": string, "quiz_type": "mcq" | "fill_blank" | "short_answer" }],
  "mind_map": { "name": string, "children": [{ "name": string, "children": [...] }] }
}
Rules:
- Generate exactly ${params.flashcardCount} flashcards for active recall.
- Generate exactly ${quizCount} quiz questions mixing mcq, fill_blank, and short_answer (prefer ~60% mcq).
- For mcq: provide exactly 4 options; correct_answer must match one option.
- For fill_blank: options can be []; question should include a blank like "____"; correct_answer is the missing word/phrase.
- For short_answer: options can be []; correct_answer is a concise model answer.
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
  quizCount?: number;
  titleHint?: string;
}): GeneratedMaterials {
  const title = params.titleHint || "Untitled Study";
  const quizCount = Math.min(30, Math.max(1, params.quizCount ?? 10));
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

  const quizzes = Array.from({ length: quizCount }, (_, i) => {
    const section = slides[i % Math.max(slides.length, 1)];
    const focus = section?.heading ?? `topic ${i + 1}`;
    const correct = `Core idea from ${focus}`;
    const kind = i % 3;
    if (kind === 1) {
      return {
        question: `Fill in the blank: The key idea of “${focus}” is ____.`,
        options: [],
        correct_answer: focus,
        explanation: `This checks recall of ${focus}.`,
        quiz_type: "fill_blank" as const,
      };
    }
    if (kind === 2) {
      return {
        question: `In your own words, explain “${focus}” from ${title}.`,
        options: [],
        correct_answer: section?.body.slice(0, 120) || correct,
        explanation: `Compare your answer to the model response.`,
        quiz_type: "short_answer" as const,
      };
    }
    return {
      question: `Which statement best matches “${focus}” in ${title}?`,
      options: [
        correct,
        "An unrelated detail not covered in the material",
        "A contradiction of the lecture content",
        "None of the above",
      ],
      correct_answer: correct,
      explanation: `This question checks understanding of ${focus}.`,
      quiz_type: "mcq" as const,
    };
  });

  return {
    title,
    summary,
    notes: `# ${title}\n\n## Overview\n\n${summary}\n\n${notesBody}\n`,
    flashcards,
    quizzes,
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

export async function generatePracticeQuestions(params: {
  sourceText: string;
  count: number;
  types?: Array<"mcq" | "fill_blank" | "short_answer">;
}) {
  const types = params.types?.length
    ? params.types
    : (["mcq", "fill_blank", "short_answer"] as const);
  const count = Math.min(20, Math.max(1, params.count));

  if (!process.env.OPENAI_API_KEY) {
    return generateMockMaterials({
      sourceText: params.sourceText,
      flashcardCount: 1,
      quizCount: count,
      titleHint: "Practice",
    }).quizzes.slice(0, count);
  }

  const openai = getOpenAI();
  const truncated = normalizeSourceText(params.sourceText).slice(0, 60_000);
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Generate exactly ${count} practice questions as JSON: { "quizzes": [{ question, options, correct_answer, explanation, quiz_type }] }.
Allowed quiz_type values: ${types.join(", ")}. Mix types. For mcq use 4 options.`,
      },
      { role: "user", content: truncated },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No practice questions returned");
  const parsed = z
    .object({ quizzes: z.array(quizSchema) })
    .parse(JSON.parse(raw));
  return parsed.quizzes;
}

export async function generatePodcastScript(sourceText: string, title: string) {
  if (!process.env.OPENAI_API_KEY) {
    return `Host A: Welcome to StudySync Audio — today we're reviewing ${title}.
Host B: Let's start with the big ideas.
Host A: ${normalizeSourceText(sourceText).slice(0, 500)}
Host B: Great summary. Review your flashcards next!`;
  }

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content:
          "Write a lively 2-host educational podcast script (Host A / Host B) summarizing the study material in under 700 words. Plain text only, with 'Host A:' and 'Host B:' labels.",
      },
      {
        role: "user",
        content: `Title: ${title}\n\n${normalizeSourceText(sourceText).slice(0, 40_000)}`,
      },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() || "";
}

export async function synthesizePodcastAudio(script: string): Promise<Buffer> {
  const openai = getOpenAI();
  const segments = parsePodcastSegments(script);

  if (segments.length === 0) {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: "Welcome to your StudySync podcast review.",
    });
    return Buffer.from(await response.arrayBuffer());
  }

  if (segments.length === 1) {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: segments[0].host === "B" ? "onyx" : "alloy",
      input: segments[0].text.slice(0, 4000),
    });
    return Buffer.from(await response.arrayBuffer());
  }

  const parts: Buffer[] = [];
  for (const segment of segments) {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: segment.host === "B" ? "onyx" : "alloy",
      input: segment.text.slice(0, 4000),
    });
    parts.push(Buffer.from(await response.arrayBuffer()));
  }

  // OpenAI TTS returns MP3; concatenating frames is usually playable.
  return Buffer.concat(parts);
}

function parsePodcastSegments(
  script: string
): { host: "A" | "B"; text: string }[] {
  const lines = script.split(/\r?\n/);
  const segments: { host: "A" | "B"; text: string }[] = [];
  let current: { host: "A" | "B"; text: string } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^(?:Host\s*)?([AB])\s*:\s*(.*)$/i.exec(line);
    if (match) {
      if (current?.text.trim()) segments.push(current);
      current = {
        host: match[1].toUpperCase() as "A" | "B",
        text: match[2].trim(),
      };
      continue;
    }
    if (current) {
      current.text = `${current.text} ${line}`.trim();
    } else {
      current = { host: "A", text: line };
    }
  }
  if (current?.text.trim()) segments.push(current);

  return segments.filter((s) => s.text.length > 0);
}

export async function chatAboutStudy(params: {
  question: string;
  context: string;
  history: { role: "user" | "assistant"; content: string }[];
}) {
  if (!process.env.OPENAI_API_KEY) {
    return `Based on your materials: ${params.context.slice(0, 280)}… (Add OPENAI_API_KEY for full chat answers.)`;
  }

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `You are StudySync Tutor. Answer ONLY using the study materials below. Be clear and concise. Use markdown when helpful.\n\nMATERIALS:\n${params.context.slice(0, 80_000)}`,
      },
      ...params.history.slice(-8),
      { role: "user" as const, content: params.question },
    ],
  });

  return (
    completion.choices[0]?.message?.content?.trim() ||
    "I couldn't generate an answer."
  );
}
