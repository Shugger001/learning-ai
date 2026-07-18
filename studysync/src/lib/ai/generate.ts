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
      : "Write detailed notes with clear headings, examples, and key definitions.";

  const truncated = params.sourceText.slice(0, 100_000);

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
  "summary": string,
  "notes": string (markdown),
  "flashcards": [{ "question": string, "answer": string }],
  "quizzes": [{ "question": string, "options": string[], "correct_answer": string, "explanation": string }],
  "mind_map": { "name": string, "children": [{ "name": string, "children": [...] }] }
}
Rules:
- Generate exactly ${params.flashcardCount} flashcards for active recall.
- Generate ${quizCount} multiple-choice quizzes with 4 options each.
- correct_answer must exactly match one option.
- ${notesGuidance}
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
  const snippet = params.sourceText.slice(0, 280).trim() || "your lecture content";
  const title = params.titleHint || "Untitled Study";

  const flashcards = Array.from({ length: params.flashcardCount }, (_, i) => ({
    question: `Key concept #${i + 1} from ${title}?`,
    answer: `Review point ${i + 1}: ${snippet.slice(0, 120)}…`,
  }));

  return {
    title,
    summary: `Summary of ${title}: ${snippet}`,
    notes: `# ${title}\n\n## Overview\n\n${snippet}\n\n## Key takeaways\n\n- Review the main ideas from the source\n- Practice with flashcards and the quiz\n- Expand this note with your own examples\n`,
    flashcards,
    quizzes: [
      {
        question: `What is the primary focus of "${title}"?`,
        options: [
          "The core ideas presented in the lecture",
          "Unrelated trivia",
          "A random math proof",
          "None of the above",
        ],
        correct_answer: "The core ideas presented in the lecture",
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
      children: [
        {
          name: "Core concepts",
          children: [{ name: "Idea A" }, { name: "Idea B" }],
        },
        {
          name: "Practice",
          children: [{ name: "Flashcards" }, { name: "Quiz" }],
        },
      ],
    },
  };
}
