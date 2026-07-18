export type ContentType = "video" | "pdf" | "audio" | "text" | "youtube";
export type StudyStatus = "processing" | "complete" | "error";
export type FlashcardDifficulty = "easy" | "medium" | "hard";
export type DetailLevel = "concise" | "detailed";
export type QuizType = "mcq" | "fill_blank" | "short_answer";
export type PlanType = "free" | "pro";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  credits: number;
  plan: PlanType;
  stripe_customer_id: string | null;
  uploads_used: number;
  chat_used: number;
  podcasts_used: number;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Study {
  id: string;
  user_id: string;
  title: string;
  content_type: ContentType;
  status: StudyStatus;
  file_url: string | null;
  source_url: string | null;
  folder_id: string | null;
  share_token: string | null;
  transcript_text: string | null;
  flashcard_count: number;
  quiz_count: number;
  detail_level: DetailLevel;
  error_message: string | null;
  processing_progress: number;
  created_at: string;
  updated_at: string;
}

export interface Flashcard {
  id: string;
  study_id: string;
  question: string;
  answer: string;
  difficulty: FlashcardDifficulty;
  position: number;
  ease: number;
  interval_days: number;
  reps: number;
  due_at: string;
  created_at: string;
  updated_at: string;
}

export interface Quiz {
  id: string;
  study_id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  quiz_type: QuizType;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface MindMapNode {
  name: string;
  children?: MindMapNode[];
}

export interface Note {
  id: string;
  study_id: string;
  content: string;
  summary: string | null;
  mind_map: MindMapNode | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  study_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Podcast {
  id: string;
  study_id: string;
  status: "pending" | "processing" | "complete" | "error";
  script: string | null;
  audio_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  content: string;
  created_at: string;
}

export interface StudyWithMaterials extends Study {
  flashcards: Flashcard[];
  quizzes: Quiz[];
  notes: Note | null;
  podcast?: Podcast | null;
}
