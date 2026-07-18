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
  content_type: "video" | "pdf" | "audio" | "text";
  flashcard_count: 10 | 20 | 50;
  detail_level: "concise" | "detailed";
  /** Raw pasted text when content_type is "text" */
  text_content?: string;
}

export interface ProcessFileRequest {
  study_id: string;
}
