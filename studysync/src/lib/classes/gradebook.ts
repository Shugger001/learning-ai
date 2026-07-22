/** Goal cards for assignment completion (full deck, min 1). */
export function assignmentGoal(flashcardCount: number | null | undefined) {
  const n = Number(flashcardCount ?? 0);
  return Math.max(1, Number.isFinite(n) && n > 0 ? Math.floor(n) : 10);
}

export function completionPercent(
  cardsReviewed: number,
  flashcardCount: number | null | undefined
) {
  const goal = assignmentGoal(flashcardCount);
  return Math.min(100, Math.round((Math.max(0, cardsReviewed) / goal) * 100));
}

export function isAssignmentComplete(
  cardsReviewed: number,
  flashcardCount: number | null | undefined,
  completedAt?: string | null
) {
  if (completedAt) return true;
  return cardsReviewed >= assignmentGoal(flashcardCount);
}

export type GradeStatus = "done" | "stuck" | "overdue" | "in_progress" | "not_started" | "pending";

export function gradeStatus(params: {
  acceptedAt: string | null;
  cardsReviewed: number;
  flashcardCount: number | null | undefined;
  completedAt: string | null;
  lastReviewedAt: string | null;
  dueAt: string | null;
  now?: Date;
}): GradeStatus {
  const now = params.now ?? new Date();
  if (!params.acceptedAt) return "pending";
  if (isAssignmentComplete(params.cardsReviewed, params.flashcardCount, params.completedAt)) {
    return "done";
  }
  const overdue =
    params.dueAt && new Date(params.dueAt).getTime() < now.getTime();
  if (params.cardsReviewed <= 0) {
    return overdue ? "overdue" : "not_started";
  }
  if (params.lastReviewedAt) {
    const idleMs = now.getTime() - new Date(params.lastReviewedAt).getTime();
    if (idleMs >= 3 * 24 * 60 * 60 * 1000) return "stuck";
  }
  if (overdue) return "overdue";
  return "in_progress";
}

export function parseDueAt(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T23:59:59.000Z`).toISOString();
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
