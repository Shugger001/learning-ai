export type ContentType = "video" | "pdf" | "audio" | "text";
export type StudyStatus = "processing" | "complete" | "error";
export type FlashcardDifficulty = "easy" | "medium" | "hard";
export type DetailLevel = "concise" | "detailed";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  credits: number;
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

export interface StudyWithMaterials extends Study {
  flashcards: Flashcard[];
  quizzes: Quiz[];
  notes: Note | null;
}
