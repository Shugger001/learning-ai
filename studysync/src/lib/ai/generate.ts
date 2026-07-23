import OpenAI, { toFile } from "openai";
import { z } from "zod";
import type { DetailLevel, LearnerBand, MindMapNode } from "@/types/database";
import { learnerPromptGuidance } from "@/lib/learner/bands";

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

/** Slide decks often have few words per page — treat as sparse teaching outlines. */
export function isSparseSlideSource(text: string, contentType: string): boolean {
  const isSlideLike =
    contentType === "pdf" ||
    /\.pptx?/i.test(contentType) ||
    /^##\s+Slide\s+\d+/m.test(text);

  if (!isSlideLike) return false;

  const words = text.split(/\s+/).filter(Boolean).length;
  const slideMarks = (text.match(/^##\s+Slide\s+\d+/gim) ?? []).length;
  const avgPerSlide = slideMarks > 0 ? words / slideMarks : words;

  // Thin decks: short overall, or many slides with little text each
  return words < 900 || (slideMarks >= 3 && avgPerSlide < 55);
}

export async function generateStudyMaterials(params: {
  sourceText: string;
  flashcardCount: number;
  quizCount: number;
  detailLevel: DetailLevel;
  contentType: string;
  learnerBand?: LearnerBand | null;
  simplifiedLanguage?: boolean;
}): Promise<GeneratedMaterials> {
  const openai = getOpenAI();
  const quizCount = Math.min(30, Math.max(1, params.quizCount));
  const truncated = normalizeSourceText(params.sourceText).slice(0, 100_000);
  const sparse = isSparseSlideSource(truncated, params.contentType);

  const notesGuidance = sparse
    ? params.detailLevel === "concise"
      ? "Source is a sparse slide deck. Expand each slide into a short study section (3–6 bullets or 2–3 sentences): define terms, spell out abbreviations, and state why the point matters. Never leave a slide as a one-line echo."
      : "Source is a sparse slide deck. Expand EVERY slide into a full study section with heading, definitions, explanations, and how ideas connect. Turn bullet fragments into teachable prose a student could study without the original slides. Do not invent unrelated topics, but DO elaborate on what the bullets imply."
    : params.detailLevel === "concise"
      ? "Keep notes concise: short bullets, high-signal only."
      : "Write detailed, well-structured study notes with clear headings, short paragraphs, examples, and key definitions.";

  const audienceGuidance = learnerPromptGuidance({
    band: params.learnerBand,
    simplifiedLanguage: params.simplifiedLanguage,
  });

  const sparseRules = sparse
    ? `
- CRITICAL: The source is thin slide text. Your notes and summary must be SUBSTANTIALLY longer and richer than the source — teach the material, do not mirror blank bullets.
- For each "## Slide N" section that has real content, produce a matching ## Notes section that explains it.
- If a slide says "(No extractable text — likely image-heavy)", note that briefly and move on; do not invent fake content for it.
- Summary: 3–5 full sentences covering the arc of the deck.
- Notes target length: roughly 80–150 words per contentful slide (or ~400+ words total for short decks).`
    : "";

  const completion = await openai.chat.completions.create({
    model: sparse ? "gpt-4o" : "gpt-4o-mini",
    temperature: sparse ? 0.55 : 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are StudySync, an expert study-material generator.
${audienceGuidance}
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
- Questions must be DIRECT about the subject matter. Test a fact, term, relationship, or skill from the content.
- NEVER mention slide numbers, "Slide N", "this slide", "the deck", "key idea of …", or other source structure.
- Do NOT start questions with "Fill in the blank:" / "Multiple choice:" — the UI already labels the type.
- For mcq: provide exactly 4 options; correct_answer must match one option; stem asks a clear question.
- For fill_blank: options can be []; write a natural sentence with "____" where the answer goes (e.g. "Photosynthesis occurs in the ____."); correct_answer is the missing word/phrase.
- For short_answer: options can be []; ask a concrete question; correct_answer is a concise model answer.
- ${notesGuidance}
- Notes MUST use proper markdown: # / ## headings, bullet lists, and short paragraphs - never one word per line.
- Rewrite slide fragments into coherent study prose; do not dump raw OCR/slide text.
- Summary must be a readable paragraph (not fragmented lines).
- Mind map should be hierarchical with 1 root and 2–3 depth levels.
- Stay faithful to the source topics and terminology; do not invent unrelated facts.${sparseRules}`,
      },
      {
        role: "user",
        content: `Content type: ${params.contentType}${sparse ? " (sparse slide deck — expand into full study notes)" : ""}\n\nSource material:\n${truncated}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("No content returned from OpenAI");
  }

  const parsed = materialsSchema.parse(JSON.parse(raw));

  // Guard against empty/near-empty notes from thin decks
  if (!parsed.notes?.trim() || parsed.notes.trim().length < 80) {
    const fallback = generateMockMaterials({
      sourceText: truncated,
      flashcardCount: params.flashcardCount,
      quizCount,
      titleHint: parsed.title,
    });
    return {
      ...parsed,
      summary:
        parsed.summary?.trim().length > 40 ? parsed.summary : fallback.summary,
      notes: fallback.notes,
      mind_map: parsed.mind_map?.name ? parsed.mind_map : fallback.mind_map,
    };
  }

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
    const focus = (section?.heading ?? "").replace(
      /^slide\s+\d+\s*[:.-]?\s*/i,
      ""
    );
    return {
      question: focus
        ? `What should you remember about ${focus}?`
        : `Key concept #${i + 1} from ${title}?`,
      answer: section
        ? section.body.slice(0, 180) || `Review ${focus || `section ${i + 1}`} of ${title}.`
        : `Review point ${i + 1} from ${title}.`,
    };
  });

  const quizzes = Array.from({ length: quizCount }, (_, i) => {
    const section = slides[i % Math.max(slides.length, 1)];
    const focus = (section?.heading ?? `concept ${i + 1}`).replace(
      /^slide\s+\d+\s*[:.-]?\s*/i,
      ""
    ) || `concept ${i + 1}`;
    const snippet =
      section?.body.replace(/\s+/g, " ").trim().slice(0, 80) || focus;
    const kind = i % 3;
    if (kind === 1) {
      return {
        question: `${focus} is best described as ____.`,
        options: [],
        correct_answer: snippet.slice(0, 60) || focus,
        explanation: `Recall what ${focus} means in this material.`,
        quiz_type: "fill_blank" as const,
      };
    }
    if (kind === 2) {
      return {
        question: `What does ${focus} mean, and why does it matter?`,
        options: [],
        correct_answer: section?.body.slice(0, 120) || snippet,
        explanation: `Compare your answer to the model response.`,
        quiz_type: "short_answer" as const,
      };
    }
    return {
      question: `Which statement about ${focus} is most accurate?`,
      options: [
        snippet || `A correct point about ${focus}`,
        "An unrelated detail not covered in the material",
        "A contradiction of the lecture content",
        "None of the above",
      ],
      correct_answer: snippet || `A correct point about ${focus}`,
      explanation: `This checks understanding of ${focus}.`,
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
Allowed quiz_type values: ${types.join(", ")}. Mix types. For mcq use 4 options.
Rules:
- Ask DIRECT questions about the subject (facts, terms, relationships)—never "Slide N", "key idea of …", or source structure.
- Do not prefix with "Fill in the blank:" or similar; put ____ inside a natural sentence for fill_blank.`,
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
    return `Host A: Welcome to StudySync Audio - today we're reviewing ${title}.
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

/** Short TTS clip for tutor replies (MP3). */
export async function synthesizeSpeech(
  text: string,
  voice: "alloy" | "onyx" = "alloy"
): Promise<Buffer> {
  const openai = getOpenAI();
  const cleaned = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: cleaned || "Let's keep going.",
  });
  return Buffer.from(await response.arrayBuffer());
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
  let full = "";
  for await (const chunk of streamChatAboutStudy(params)) {
    full += chunk;
  }
  return full || "I couldn't generate an answer.";
}

export async function* streamChatAboutStudy(params: {
  question: string;
  context: string;
  history: { role: "user" | "assistant"; content: string }[];
  mode?: "chat" | "tutor";
  weakContext?: string;
  learnerBand?: LearnerBand | null;
  simplifiedLanguage?: boolean;
}): AsyncGenerator<string> {
  if (!process.env.OPENAI_API_KEY) {
    const mock =
      params.mode === "tutor"
        ? `Let's dig into a weak spot. Based on your materials: ${params.context.slice(0, 200)}… What do you think is the key idea? (Add OPENAI_API_KEY for full tutor mode.)`
        : `Based on your materials: ${params.context.slice(0, 280)}… (Add OPENAI_API_KEY for full chat answers.)`;
    for (let i = 0; i < mock.length; i += 12) {
      yield mock.slice(i, i + 12);
      await new Promise((r) => setTimeout(r, 18));
    }
    return;
  }

  const openai = getOpenAI();
  const isTutor = params.mode === "tutor";
  const audience = learnerPromptGuidance({
    band: params.learnerBand,
    simplifiedLanguage: params.simplifiedLanguage,
  });
  const system = isTutor
    ? `You are StudySync Tutor in Socratic mode. ${audience} Guide the learner with short questions—do not dump full answers unless they ask or are clearly stuck after 2+ turns. Prefer one focused question at a time. Use ONLY the study materials and weak-spot context below. When quizzing, wait for their answer before revealing. Use markdown sparingly.\n\nMATERIALS:\n${params.context.slice(0, 70_000)}\n\nWEAK SPOTS:\n${(params.weakContext || "None listed.").slice(0, 8_000)}`
    : `You are StudySync Tutor. ${audience} Answer ONLY using the study materials below. Be clear and concise. Use markdown when helpful.\n\nMATERIALS:\n${params.context.slice(0, 80_000)}`;

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: isTutor ? 0.45 : 0.3,
    stream: true,
    messages: [
      {
        role: "system",
        content: system,
      },
      ...params.history.slice(-8),
      { role: "user" as const, content: params.question },
    ],
  });

  for await (const part of stream) {
    const text = part.choices[0]?.delta?.content;
    if (text) yield text;
  }
}
