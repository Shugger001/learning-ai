export type PlanSession = {
  date: string;
  title: string;
  kind: "cards" | "assignment" | "weak" | "exam_ramp" | "boss";
  studyId?: string | null;
  cardsTarget: number;
  minutes: number;
  href: string;
  note?: string;
};

export type WeekPlan = {
  weekStart: string;
  sessions: PlanSession[];
};

const DAILY_CARD_CAP = 35;

function addDays(dateKey: string, n: number) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Build a balanced Mon–Sun plan from dues, assignments, and weak spots. */
export function buildWeekPlan(params: {
  weekStart: string;
  today: string;
  cardDays: { date: string; studyId: string; studyTitle: string; count: number }[];
  assignments: {
    title: string;
    studyId: string;
    dueAt: string | null;
    className: string;
  }[];
  weakStudy?: { studyId: string; title: string; misses: number } | null;
  examSessions?: PlanSession[];
}): WeekPlan {
  const sessions: PlanSession[] = [];
  const days = Array.from({ length: 7 }, (_, i) => addDays(params.weekStart, i));

  // Bucket card load by day; dump overdue onto today (or week start if today before week)
  const load = new Map<string, { count: number; studyId: string; title: string }>();
  let overflow = 0;
  let overflowStudy: { studyId: string; title: string } | null = null;

  for (const row of params.cardDays) {
    const day = row.date < params.today ? params.today : row.date;
    if (day < params.weekStart || day > addDays(params.weekStart, 6)) {
      if (day < params.weekStart) {
        overflow += row.count;
        overflowStudy = { studyId: row.studyId, title: row.studyTitle };
      }
      continue;
    }
    const existing = load.get(day);
    if (existing) {
      existing.count += row.count;
    } else {
      load.set(day, {
        count: row.count,
        studyId: row.studyId,
        title: row.studyTitle,
      });
    }
  }

  const anchor =
    params.today >= params.weekStart && params.today <= addDays(params.weekStart, 6)
      ? params.today
      : params.weekStart;
  if (overflow > 0) {
    const existing = load.get(anchor);
    if (existing) existing.count += overflow;
    else
      load.set(anchor, {
        count: overflow,
        studyId: overflowStudy?.studyId ?? "",
        title: overflowStudy?.title ?? "Catch-up",
      });
  }

  // Spread overflow days over the week if a day exceeds cap
  for (const day of days) {
    const row = load.get(day);
    if (!row) continue;
    let remaining = row.count;
    let cursor = day;
    while (remaining > 0) {
      const chunk = Math.min(DAILY_CARD_CAP, remaining);
      sessions.push({
        date: cursor,
        title: `Review · ${row.title}`,
        kind: "cards",
        studyId: row.studyId || null,
        cardsTarget: chunk,
        minutes: Math.max(10, Math.round(chunk * 0.6)),
        href: `/review?date=${cursor}`,
        note: `${chunk} spaced cards`,
      });
      remaining -= chunk;
      if (remaining > 0) {
        const nextIdx = days.indexOf(cursor) + 1;
        cursor = days[Math.min(nextIdx, days.length - 1)] ?? cursor;
        if (nextIdx >= days.length) break;
      }
    }
  }

  for (const a of params.assignments) {
    const dueDay = a.dueAt ? a.dueAt.slice(0, 10) : null;
    const sessionDay =
      dueDay && dueDay >= params.weekStart && dueDay <= addDays(params.weekStart, 6)
        ? dueDay
        : addDays(params.weekStart, 4); // Friday default for undated
    sessions.push({
      date: sessionDay,
      title: a.title,
      kind: "assignment",
      studyId: a.studyId,
      cardsTarget: 15,
      minutes: 25,
      href: `/study/${a.studyId}`,
      note: `Class · ${a.className}${dueDay ? ` · due ${dueDay}` : ""}`,
    });
  }

  if (params.weakStudy) {
    const mid = addDays(params.weekStart, 2);
    sessions.push({
      date: mid,
      title: `Weak topics · ${params.weakStudy.title}`,
      kind: "weak",
      studyId: params.weakStudy.studyId,
      cardsTarget: 10,
      minutes: 20,
      href: `/study/${params.weakStudy.studyId}?tab=chat`,
      note: `${params.weakStudy.misses} recent quiz misses — tutor recommended`,
    });
  }

  if (params.examSessions?.length) {
    sessions.push(...params.examSessions);
  }

  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  return { weekStart: params.weekStart, sessions };
}
