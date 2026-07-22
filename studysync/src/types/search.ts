export type SearchHit = {
  kind: "study" | "note" | "flashcard";
  study_id: string;
  title: string;
  snippet: string;
  href: string;
};
