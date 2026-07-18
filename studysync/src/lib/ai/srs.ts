import type { FlashcardDifficulty } from "@/types/database";

export type SrsRating = "again" | "hard" | "good" | "easy";

export interface SrsState {
  ease: number;
  interval_days: number;
  reps: number;
  due_at: string;
  difficulty: FlashcardDifficulty;
}

/** SM-2 lite update based on user rating. */
export function applySrsRating(current: SrsState, rating: SrsRating): SrsState {
  let { ease, interval_days, reps } = current;
  const now = Date.now();

  if (rating === "again") {
    reps = 0;
    interval_days = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    if (reps === 0) interval_days = 1;
    else if (reps === 1) interval_days = 3;
    else interval_days = Math.max(1, Math.round(interval_days * ease));

    reps += 1;
    if (rating === "hard") ease = Math.max(1.3, ease - 0.15);
    if (rating === "easy") ease = ease + 0.15;
  }

  const difficulty: FlashcardDifficulty =
    rating === "again" || rating === "hard"
      ? "hard"
      : rating === "easy"
        ? "easy"
        : "medium";

  return {
    ease: Math.round(ease * 100) / 100,
    interval_days,
    reps,
    due_at: new Date(now + interval_days * 24 * 60 * 60 * 1000).toISOString(),
    difficulty,
  };
}
