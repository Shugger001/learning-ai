import { z } from "zod";

export const createStudySchema = z.object({
  title: z.string().min(1).max(200),
  content_type: z.enum(["video", "pdf", "audio", "text", "youtube", "notion"]),
  flashcard_count: z.union([z.literal(10), z.literal(20), z.literal(50)]),
  quiz_count: z.union([
    z.literal(5),
    z.literal(10),
    z.literal(15),
    z.literal(20),
  ]),
  detail_level: z.enum(["concise", "detailed"]),
  text_content: z.string().optional(),
  source_url: z.string().url().optional(),
  folder_id: z.string().uuid().optional().nullable(),
  /** Path in lectures bucket after client-side direct upload */
  file_path: z.string().min(3).optional(),
  /** Multiple storage paths after client-side direct upload */
  file_paths: z.array(z.string().min(3)).min(1).max(25).optional(),
});

export const updateFlashcardSchema = z.object({
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  srs_rating: z.enum(["again", "hard", "good", "easy"]).optional(),
});

const mindMapNodeSchema: z.ZodType<{
  name: string;
  id?: string;
  children?: unknown[];
  collapsed?: boolean;
}> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    id: z.string().optional(),
    collapsed: z.boolean().optional(),
    children: z.array(mindMapNodeSchema).optional(),
  })
);

export const updateNoteSchema = z.object({
  content: z.string().optional(),
  summary: z.string().optional(),
  mind_map: mindMapNodeSchema.nullable().optional(),
});

export const updateQuizSchema = z.object({
  question: z.string().min(1).optional(),
  options: z.array(z.string()).min(2).optional(),
  correct_answer: z.string().min(1).optional(),
  explanation: z.string().optional(),
});

export const chatMessageSchema = z.object({
  study_id: z.string().uuid(),
  message: z.string().min(1).max(4000),
  mode: z.enum(["chat", "tutor"]).optional(),
});

export const practiceSchema = z.object({
  count: z.number().int().min(1).max(20).default(5),
  types: z
    .array(z.enum(["mcq", "fill_blank", "short_answer"]))
    .optional(),
});

export type CreateStudyInput = z.infer<typeof createStudySchema>;
