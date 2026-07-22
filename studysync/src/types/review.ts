import type { Flashcard, Quiz } from "@/types/database";

export type ReviewTodayPayload = {
  dueCount: number;
  dueCards: Flashcard[];
  quizzes: (Quiz & { study_title: string })[];
};
