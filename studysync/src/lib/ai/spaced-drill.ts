import OpenAI from "openai";
import { normalizeSourceText } from "@/lib/ai/generate";
import { learnerPromptGuidance } from "@/lib/learner/bands";
import type { LearnerBand } from "@/types/database";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export type DrillCard = {
  question: string;
  answer: string;
  studyTitle: string;
};

/** Short spoken drill script from weak / due cards (no dual-host format). */
export async function generateSpacedDrillScript(
  cards: DrillCard[],
  dayLabel: string,
  opts?: {
    learnerBand?: LearnerBand | null;
    simplifiedLanguage?: boolean;
  }
) {
  const lines = cards
    .slice(0, 8)
    .map(
      (c, i) =>
        `${i + 1}. [${c.studyTitle}] Q: ${c.question}\nA: ${c.answer}`
    )
    .join("\n\n");

  if (!process.env.OPENAI_API_KEY) {
    const parts = cards.slice(0, 5).flatMap((c, i) => [
      `Card ${i + 1} from ${c.studyTitle}.`,
      `Question: ${c.question}.`,
      `Pause.`,
      `Answer: ${c.answer}.`,
    ]);
    return `StudySync spaced drill for ${dayLabel}. ${parts.join(" ")} Keep going — small reps win.`;
  }

  const audience = learnerPromptGuidance({
    band: opts?.learnerBand,
    simplifiedLanguage: opts?.simplifiedLanguage,
  });

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content: `You write a 60–90 second spoken study drill for text-to-speech. ${audience} Single narrator. Include brief pauses written as the word Pause. For each card: state the study name, ask the question, say Pause, then give a concise answer. Warm, clear, under 450 words. No markdown.`,
      },
      {
        role: "user",
        content: `Date: ${dayLabel}\n\nCards:\n${normalizeSourceText(lines).slice(0, 8000)}`,
      },
    ],
  });

  return (
    completion.choices[0]?.message?.content?.trim() ||
    `StudySync spaced drill for ${dayLabel}. Review your due cards next.`
  );
}
