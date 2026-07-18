export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface CreateStudyRequest {
  title: string;
  content_type: "video" | "pdf" | "audio" | "text" | "youtube";
  flashcard_count: 10 | 20 | 50;
  quiz_count: 5 | 10 | 15 | 20;
  detail_level: "concise" | "detailed";
  /** Raw pasted text when content_type is "text" */
  text_content?: string;
  /** YouTube watch URL when content_type is "youtube" */
  source_url?: string;
  folder_id?: string | null;
}

export interface ProcessFileRequest {
  study_id: string;
}
