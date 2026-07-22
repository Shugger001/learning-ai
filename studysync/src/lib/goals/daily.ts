export type DailyGoal = {
  cardTarget: number;
  quizTarget: number;
  minutes: number;
  dueCount: number;
  streak: number;
  reason: string;
};

/** Adaptive target from streak, due load, and available study minutes. */
export function computeDailyGoal(params: {
  streak: number;
  dueCount: number;
  freeMinutes?: number | null;
}): DailyGoal {
  const free = Math.max(
    10,
    Math.min(120, Number(params.freeMinutes ?? 25) || 25)
  );
  const streak = Math.max(0, Number(params.streak ?? 0) || 0);
  const due = Math.max(0, Number(params.dueCount ?? 0) || 0);

  // Capacity from free time (~0.6 min/card, ~2.5 min/quiz)
  const capacityCards = Math.max(5, Math.floor(free / 0.6));
  const capacityQuizzes = Math.max(1, Math.floor(free / 2.5));

  // Streak shaping: cold start lighter; hot streak slightly more ambitious
  let streakFactor = 1;
  if (streak === 0) streakFactor = 0.7;
  else if (streak === 1) streakFactor = 0.85;
  else if (streak >= 7) streakFactor = 1.15;
  else if (streak >= 3) streakFactor = 1.05;

  let cardTarget = Math.round(
    Math.min(due || capacityCards * 0.5, capacityCards) * streakFactor
  );
  cardTarget = Math.max(5, Math.min(50, cardTarget));
  if (due > 0) cardTarget = Math.min(cardTarget, due);

  let quizTarget = Math.round(
    Math.min(capacityQuizzes, Math.max(2, Math.ceil(cardTarget / 8))) *
      (streak >= 3 ? 1.1 : 1)
  );
  quizTarget = Math.max(2, Math.min(12, quizTarget));

  const parts: string[] = [];
  parts.push(`${free} min free`);
  if (due > 0) parts.push(`${due} due`);
  else parts.push("no backlog");
  if (streak > 0) parts.push(`${streak}d streak`);
  else parts.push("rebuilding streak");

  return {
    cardTarget,
    quizTarget,
    minutes: free,
    dueCount: due,
    streak,
    reason: parts.join(" · "),
  };
}
