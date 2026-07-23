export type ContentType =
  | "video"
  | "pdf"
  | "audio"
  | "text"
  | "youtube"
  | "notion";
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
  usage_reset_at: string;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  onboarding_completed: boolean;
  xp: number;
  level: number;
  progress_share_token?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  badge_key: string;
  unlocked_at: string;
}

export interface ExamCampaign {
  id: string;
  user_id: string;
  title: string;
  exam_at: string;
  study_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface AssignmentCopy {
  id: string;
  assignment_id: string;
  user_id: string;
  study_id: string;
  synced_at: string | null;
  teacher_pack_version: number;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  study_id: string;
  score: number;
  total: number;
  wrong_quiz_ids: string[];
  created_at: string;
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
  is_favorite: boolean;
  source_study_id?: string | null;
  pack_version?: number;
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
  content_key?: string | null;
  image_url?: string | null;
  occlusion?: OcclusionRect[] | null;
  created_at: string;
  updated_at: string;
}

export interface OcclusionRect {
  id: string;
  x: number; // 0–100 percent
  y: number;
  w: number;
  h: number;
  label?: string;
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
  content_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MindMapNode {
  name: string;
  id?: string;
  children?: MindMapNode[];
  collapsed?: boolean;
}

export interface ClassRoom {
  id: string;
  owner_id: string;
  name: string;
  join_code: string;
  created_at: string;
  updated_at: string;
}

export interface ClassMember {
  id: string;
  class_id: string;
  user_id: string | null;
  email: string;
  role: "teacher" | "student";
  invite_token: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface ClassAssignment {
  id: string;
  class_id: string;
  study_id: string;
  title: string | null;
  due_at: string | null;
  created_by: string;
  exit_ticket_required?: boolean;
  exit_ticket_quiz_ids?: string[];
  created_at: string;
}

export interface AssignmentProgress {
  id: string;
  assignment_id: string;
  user_id: string;
  cards_reviewed: number;
  last_reviewed_at: string | null;
  completed_at: string | null;
  exit_ticket_score?: number | null;
  exit_ticket_total?: number | null;
  exit_ticket_at?: string | null;
}

export interface EmailPreferences {
  user_id: string;
  weekly_recap: boolean;
  timezone: string;
  last_weekly_sent_at: string | null;
  unsubscribe_token?: string | null;
  coach_digest?: boolean;
  coach_email?: string | null;
  free_minutes?: number;
  last_coach_sent_at?: string | null;
  assignment_reminders?: boolean;
  last_due_reminder_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassAnnouncement {
  id: string;
  class_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface SpacedEpisode {
  id: string;
  user_id: string;
  episode_date: string;
  study_id: string | null;
  card_ids: string[];
  script: string | null;
  audio_url: string | null;
  status: "pending" | "processing" | "complete" | "error";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyRoom {
  id: string;
  study_id: string;
  host_id: string;
  name: string;
  join_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

export interface ShareInvite {
  id: string;
  study_id: string;
  inviter_id: string;
  email: string;
  role: "viewer" | "commenter" | "editor";
  token: string;
  accepted_at: string | null;
  created_at: string;
}

export interface ShareComment {
  id: string;
  study_id: string;
  user_id: string | null;
  invite_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

export interface StudyActivity {
  id: string;
  user_id: string;
  activity_date: string;
  cards_reviewed: number;
  quizzes_taken: number;
  created_at: string;
}

export interface StudyWithMaterials extends Study {
  flashcards: Flashcard[];
  quizzes: Quiz[];
  notes: Note | null;
  podcast?: Podcast | null;
}
