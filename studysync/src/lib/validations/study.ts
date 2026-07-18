import { z } from "zod";

export const createStudySchema = z.object({
  title: z.string().min(1).max(200),
  content_type: z.enum(["video", "pdf", "audio", "text"]),
  flashcard_count: z.union([z.literal(10), z.literal(20), z.literal(50)]),
  detail_level: z.enum(["concise", "detailed"]),
  text_content: z.string().optional(),
});

export const updateFlashcardSchema = z.object({
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

export const updateNoteSchema = z.object({
  content: z.string().optional(),
  summary: z.string().optional(),
});

export const updateQuizSchema = z.object({
  question: z.string().min(1).optional(),
  options: z.array(z.string()).min(2).optional(),
  correct_answer: z.string().min(1).optional(),
  explanation: z.string().optional(),
});

export type CreateStudyInput = z.infer<typeof createStudySchema>;
