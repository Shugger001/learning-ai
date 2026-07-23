const META_QUESTION_RE =
  /slide\s*\d+|what is covered|key idea of|core idea from|best matches|this slide|the (?:deck|lecture slides?)|source structure|unrelated detail not covered|contradiction of the lecture/i;

const PLACEHOLDER_OPTION_RE =
  /^(core idea from|an unrelated detail not covered|a contradiction of the lecture|none of the above)/i;

function stripTypePrefix(question: string) {
  return question
    .replace(
      /^(fill\s*in\s*the\s*blank|multiple\s*choice|short\s*answer)\s*:\s*/i,
      ""
    )
    .trim();
}

function stripSlideLabel(text: string) {
  return text
    .replace(/["'“”]?slide\s*\d+["'“”]?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Guess a short topic label from an answer without copying the full answer. */
function topicFromAnswer(answer: string): string | null {
  const clean = stripSlideLabel(answer.replace(/\s+/g, " ").trim());
  if (!clean || META_QUESTION_RE.test(clean) || PLACEHOLDER_OPTION_RE.test(clean)) {
    return null;
  }
  const def = clean.match(
    /^(.{2,70}?)\s+(is|are|was|were|means|refers to|describes)\b/i
  );
  if (def?.[1] && !META_QUESTION_RE.test(def[1])) {
    return def[1].replace(/^["'“”]+|["'“”]+$/g, "").trim();
  }
  const words = clean.split(" ").filter(Boolean);
  if (words.length >= 3) {
    const slice = words.slice(0, 6).join(" ").replace(/[.,;:]+$/, "");
    if (slice.length >= 8 && !META_QUESTION_RE.test(slice)) return slice;
  }
  return null;
}

function topicFromQuestion(question: string): string | null {
  // “Which statement best matches “Slide 1” in LectureNotesUpdated1 (1)?”
  const inTitle = question.match(
    /\bin\s+(.+?)(?:\s*\(\d+\))?\s*\??\s*$/i
  );
  if (inTitle?.[1]) {
    const title = stripSlideLabel(inTitle[1])
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .trim();
    if (title.length >= 3 && !/^slide\s*\d+/i.test(title)) return title;
  }
  return null;
}

/** True when an MCQ still uses the old placeholder option set. */
export function isPlaceholderMcq(quiz: {
  question?: string;
  options?: string[] | null;
  correct_answer?: string;
}): boolean {
  const opts = quiz.options ?? [];
  const hits = opts.filter((o) => PLACEHOLDER_OPTION_RE.test(o.trim())).length;
  return (
    hits >= 2 ||
    PLACEHOLDER_OPTION_RE.test((quiz.correct_answer ?? "").trim()) ||
    META_QUESTION_RE.test(quiz.question ?? "")
  );
}

/** Display label for an MCQ option (grading still uses the original string). */
export function polishMcqOption(option: string): string {
  const o = option.trim();
  if (/^core idea from/i.test(o)) {
    return "The main idea from this part of the lecture";
  }
  if (/^an unrelated detail not covered/i.test(o)) {
    return "Something unrelated that was not covered";
  }
  if (/^a contradiction of the lecture/i.test(o)) {
    return "A statement that contradicts the material";
  }
  if (/^none of the above$/i.test(o)) {
    return "None of the above";
  }
  if (META_QUESTION_RE.test(o)) {
    const cleaned = stripSlideLabel(o);
    return cleaned || "A point from the lecture";
  }
  return o;
}

/** Rewrite slide-meta prompts into direct study questions (safe for client + server). */
export function polishDirectQuestion(
  question: string,
  answerHint: string,
  kind:
    | "flashcard"
    | "mcq"
    | "fill_blank"
    | "short_answer"
    | "quiz" = "flashcard"
): string {
  const q = stripTypePrefix(question);
  if (!META_QUESTION_RE.test(q) && !/best matches/i.test(q)) return q;

  const topic =
    topicFromAnswer(answerHint) || topicFromQuestion(q) || null;

  if (kind === "fill_blank" && topic) {
    return `In this material, ${topic} is mainly about ____.`;
  }
  if (topic) {
    return kind === "mcq"
      ? `Which statement about ${topic} is most accurate?`
      : `What should you remember about ${topic}?`;
  }
  if (kind === "mcq") {
    return "Which statement best reflects the lecture material?";
  }
  return kind === "fill_blank"
    ? "The main point here is ____."
    : "What is the main takeaway from this point?";
}

export function polishGeneratedMaterials<
  T extends {
    flashcards: { question: string; answer: string }[];
    quizzes: {
      question: string;
      correct_answer: string;
      options?: string[];
      quiz_type?: string;
    }[];
  },
>(materials: T): T {
  return {
    ...materials,
    flashcards: materials.flashcards.map((c) => ({
      ...c,
      question: polishDirectQuestion(c.question, c.answer, "flashcard"),
    })),
    quizzes: materials.quizzes.map((q) => {
      const kind =
        q.quiz_type === "mcq" ||
        q.quiz_type === "fill_blank" ||
        q.quiz_type === "short_answer"
          ? q.quiz_type
          : "quiz";
      const polishedQuestion = polishDirectQuestion(
        q.question,
        q.correct_answer,
        kind
      );
      if (kind !== "mcq") {
        return { ...q, question: polishedQuestion };
      }
      const polishedOptions = Array.isArray(q.options)
        ? q.options.map((o) => polishMcqOption(o))
        : q.options;
      const polishedCorrect = polishMcqOption(q.correct_answer);
      return {
        ...q,
        question: polishedQuestion,
        options: polishedOptions,
        correct_answer: polishedCorrect,
      };
    }),
  };
}
