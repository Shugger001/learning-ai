import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import type { CalendarDay } from "@/types/calendar";

function toDateKey(iso: string) {
  return iso.slice(0, 10);
}

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return apiError("from and to required (YYYY-MM-DD)", 400);

  const fromIso = `${from}T00:00:00.000Z`;
  const toExclusive = new Date(`${to}T00:00:00.000Z`);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  const toIso = toExclusive.toISOString();

  const { data: studies, error: studiesError } = await supabase
    .from("studies")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "complete");

  if (studiesError) return apiError(studiesError.message, 500);
  const studyIds = (studies ?? []).map((s) => s.id);
  if (studyIds.length === 0) return apiSuccess([] as CalendarDay[]);

  const { data: cards, error } = await supabase
    .from("flashcards")
    .select("id, study_id, due_at")
    .in("study_id", studyIds)
    .gte("due_at", fromIso)
    .lt("due_at", toIso)
    .order("due_at", { ascending: true })
    .limit(2000);

  if (error) return apiError(error.message, 500);

  const today = new Date().toISOString().slice(0, 10);
  const byDay = new Map<string, CalendarDay>();

  for (const c of cards ?? []) {
    const date = toDateKey(c.due_at);
    const row =
      byDay.get(date) ??
      ({
        date,
        dueCount: 0,
        plannedCount: 0,
        studyIds: [] as string[],
      } satisfies CalendarDay);
    if (date <= today) row.dueCount += 1;
    else row.plannedCount += 1;
    if (!row.studyIds.includes(c.study_id)) row.studyIds.push(c.study_id);
    byDay.set(date, row);
  }

  // Fill empty days in range for stable week UI
  const days: CalendarDay[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    days.push(
      byDay.get(key) ?? {
        date: key,
        dueCount: 0,
        plannedCount: 0,
        studyIds: [] as string[],
      }
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return apiSuccess(days);
}
