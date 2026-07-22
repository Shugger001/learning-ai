import { createClient } from "@/lib/supabase/server";
import { WeekCalendar } from "@/components/calendar/week-calendar";
import type { CalendarDay } from "@/types/calendar";

function startOfWeek(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function keyOf(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function CalendarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 6);
  const from = keyOf(weekStart);
  const to = keyOf(weekEnd);

  const { data: studies } = await supabase
    .from("studies")
    .select("id")
    .eq("user_id", user!.id)
    .eq("status", "complete");

  const studyIds = (studies ?? []).map((s) => s.id);
  const fromIso = `${from}T00:00:00.000Z`;
  const toExclusive = addDays(weekEnd, 1).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const byDay = new Map<string, CalendarDay>();
  if (studyIds.length > 0) {
    const { data: cards } = await supabase
      .from("flashcards")
      .select("id, study_id, due_at")
      .in("study_id", studyIds)
      .gte("due_at", fromIso)
      .lt("due_at", toExclusive)
      .limit(2000);

    for (const c of cards ?? []) {
      const date = c.due_at.slice(0, 10);
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
      if (!row.studyIds.includes(c.study_id)) {
        row.studyIds.push(c.study_id);
      }
      byDay.set(date, row);
    }
  }

  const days: CalendarDay[] = [];
  for (let i = 0; i < 7; i++) {
    const key = keyOf(addDays(weekStart, i));
    days.push(
      byDay.get(key) ?? {
        date: key,
        dueCount: 0,
        plannedCount: 0,
        studyIds: [],
      }
    );
  }

  return <WeekCalendar initialDays={days} initialWeekStart={from} />;
}
