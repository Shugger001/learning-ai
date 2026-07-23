const META_QUESTION_RE =
  /slide\s*\d+|what is covered|key idea of|this slide|the (?:deck|lecture slides?)|source structure/i;

function stripTypePrefix(question: string) {
  return question
    .replace(
      /^(fill\s*in\s*the\s*blank|multiple\s*choice|short\s*answer)\s*:\s*/i,
      ""
    )
    .trim();
}

/** Guess a short topic label from an answer without copying the full answer. */
function topicFromAnswer(answer: string): string | null {
  const clean = answer.replace(/\s+/g, " ").trim();
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

/** Rewrite slide-meta prompts into direct study questions (safe for client + server). */
export function polishDirectQuestion(
  question: string,
  answerHint: string,
  kind: "flashcard" | "mcq" | "fill_blank" | "short_answer" | "quiz" = "flashcard"
): string {
  const q = stripTypePrefix(question);
  if (!META_QUESTION_RE.test(q)) return q;

  const topic = topicFromAnswer(answerHint);
  if (kind === "fill_blank" && topic) {
    return `${topic} is ____.`;
  }
  if (topic) {
    return kind === "mcq"
      ? `Which statement about ${topic} is most accurate?`
      : `What should you remember about ${topic}?`;
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
    quizzes: materials.quizzes.map((q) => ({
      ...q,
      question: polishDirectQuestion(
        q.question,
        q.correct_answer,
        q.quiz_type === "mcq" ||
          q.quiz_type === "fill_blank" ||
          q.quiz_type === "short_answer"
          ? q.quiz_type
          : "quiz"
      ),
    })),
  };
}
