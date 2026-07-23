import type {
  DetailLevel,
  FlashcardDifficulty,
  LearnerBand,
  LearningNeeds,
} from "@/types/database";

export type { LearningNeeds };

export const LEARNER_BANDS: {
  id: LearnerBand;
  label: string;
  hint: string;
}[] = [
  {
    id: "elementary",
    label: "Elementary",
    hint: "Grades 3–5 · plain words, short chunks",
  },
  {
    id: "middle",
    label: "Middle school",
    hint: "Grades 6–8 · clear structure, define jargon",
  },
  {
    id: "high_school",
    label: "High school",
    hint: "Grades 9–12 · exam-ready explanations",
  },
  {
    id: "college",
    label: "College",
    hint: "University · denser academic material",
  },
  {
    id: "adult",
    label: "Adult / professional",
    hint: "Career or lifelong learning",
  },
];

export const DEFAULT_LEARNING_NEEDS: LearningNeeds = {
  simplified_language: false,
  dyslexia_friendly: false,
  focus_assist: false,
  reduced_motion: false,
};

export function normalizeLearningNeeds(raw: unknown): LearningNeeds {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    simplified_language: Boolean(o.simplified_language),
    dyslexia_friendly: Boolean(o.dyslexia_friendly),
    focus_assist: Boolean(o.focus_assist),
    reduced_motion: Boolean(o.reduced_motion),
  };
}

export function isLearnerBand(value: unknown): value is LearnerBand {
  return (
    value === "elementary" ||
    value === "middle" ||
    value === "high_school" ||
    value === "college" ||
    value === "adult"
  );
}

/** Default notes verbosity when creating a study. */
export function defaultDetailLevel(
  band: LearnerBand | null | undefined
): DetailLevel {
  if (band === "elementary" || band === "middle") return "concise";
  return "detailed";
}

/** Initial flashcard difficulty before SRS ratings. */
export function defaultFlashcardDifficulty(
  band: LearnerBand | null | undefined
): FlashcardDifficulty {
  if (band === "elementary" || band === "middle") return "easy";
  return "medium";
}

/** Prompt fragment for study generation / tutor / drills. */
export function learnerPromptGuidance(params: {
  band: LearnerBand | null | undefined;
  simplifiedLanguage?: boolean;
}): string {
  const simplified = Boolean(params.simplifiedLanguage);
  const band = params.band;

  const bandLine = (() => {
    switch (band) {
      case "elementary":
        return "Audience: elementary students (approx. grades 3–5). Use short sentences, everyday words, concrete examples, and gentle encouragement. Avoid idioms and abstract jargon; when a term is required, define it immediately in plain language.";
      case "middle":
        return "Audience: middle-school students (grades 6–8). Use clear structure, define jargon the first time it appears, and keep examples relatable. Scaffold multi-step ideas.";
      case "high_school":
        return "Audience: high-school students (grades 9–12). Aim for exam-ready clarity: precise terms with quick definitions, practice-oriented questions, and structured notes.";
      case "college":
        return "Audience: college / university learners. Assume domain literacy; use denser academic prose, precise terminology, and nuanced distinctions.";
      case "adult":
        return "Audience: adult / professional learners. Be efficient and practical; assume maturity and prior knowledge unless the source is introductory.";
      default:
        return "Audience: general learners. Prefer clear, accessible language without talking down.";
    }
  })();

  const simplifyLine = simplified
    ? " Extra constraint: simplify vocabulary further, shorten sentences, and prefer bullet lists over long paragraphs."
    : "";

  return `${bandLine}${simplifyLine}`;
}
