import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { buildWeekPlan, type WeekPlan } from "@/lib/plan/generate";
import { buildExamSessions } from "@/lib/exam/campaign";

function mondayOf(date = new Date()) {
  const x = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x.toISOString().slice(0, 10);
}

function addDays(dateKey: string, n: number) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function gatherPlanInputs(weekStart: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null as null, error: "Unauthorized" as const };

  const weekEnd = addDays(weekStart, 6);
  const fromIso = `${weekStart}T00:00:00.000Z`;
  const toExclusive = new Date(`${weekEnd}T00:00:00.000Z`);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  const toIso = toExclusive.toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const { data: studies } = await supabase
    .from("studies")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("status", "complete");
  const studyList = studies ?? [];
  const studyIds = studyList.map((s) => s.id);
  const titleById = new Map(studyList.map((s) => [s.id, s.title]));

  const cardDays: {
    date: string;
    studyId: string;
    studyTitle: string;
    count: number;
  }[] = [];

  if (studyIds.length > 0) {
    const { data: overdue } = await supabase
      .from("flashcards")
      .select("study_id, due_at")
      .in("study_id", studyIds)
      .lt("due_at", fromIso)
      .limit(500);
    const overdueByStudy = new Map<string, number>();
    for (const c of overdue ?? []) {
      overdueByStudy.set(
        c.study_id,
        (overdueByStudy.get(c.study_id) ?? 0) + 1
      );
    }
    for (const [studyId, count] of Array.from(overdueByStudy.entries())) {
      cardDays.push({
        date: today < weekStart ? weekStart : today,
        studyId,
        studyTitle: titleById.get(studyId) ?? "Study",
        count,
      });
    }

    const { data: weekCards } = await supabase
      .from("flashcards")
      .select("study_id, due_at")
      .in("study_id", studyIds)
      .gte("due_at", fromIso)
      .lt("due_at", toIso)
      .limit(2000);
    const bucket = new Map<string, number>();
    for (const c of weekCards ?? []) {
      const key = `${c.due_at.slice(0, 10)}|${c.study_id}`;
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }
    for (const [key, count] of Array.from(bucket.entries())) {
      const [date, studyId] = key.split("|");
      cardDays.push({
        date,
        studyId,
        studyTitle: titleById.get(studyId) ?? "Study",
        count,
      });
    }
  }

  const assignments: {
    title: string;
    studyId: string;
    dueAt: string | null;
    className: string;
  }[] = [];

  const { data: memberships } = await supabase
    .from("class_members")
    .select("class_id, classes(name)")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null);
  const classIds = (memberships ?? []).map((m) => m.class_id);
  const classNameById = new Map<string, string>();
  for (const m of memberships ?? []) {
    const cls = m.classes as unknown as { name?: string } | null;
    classNameById.set(m.class_id, cls?.name ?? "Class");
  }
  if (classIds.length > 0) {
    const { data: assigned } = await supabase
      .from("class_assignments")
      .select("title, study_id, due_at, class_id, studies(title)")
      .in("class_id", classIds);
    for (const a of assigned ?? []) {
      const due = a.due_at ? String(a.due_at).slice(0, 10) : null;
      if (due && (due < weekStart || due > weekEnd)) continue;
      const study = a.studies as unknown as { title?: string } | null;
      assignments.push({
        title: a.title || study?.title || "Assignment",
        studyId: a.study_id,
        dueAt: a.due_at,
        className: classNameById.get(a.class_id) ?? "Class",
      });
    }
  }

  let weakStudy: { studyId: string; title: string; misses: number } | null =
    null;
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("study_id, wrong_quiz_ids")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const weakMap = new Map<string, number>();
  for (const a of attempts ?? []) {
    const wrong = Array.isArray(a.wrong_quiz_ids) ? a.wrong_quiz_ids.length : 0;
    if (wrong <= 0) continue;
    weakMap.set(a.study_id, (weakMap.get(a.study_id) ?? 0) + wrong);
  }
  const top = Array.from(weakMap.entries()).sort((a, b) => b[1] - a[1])[0];
  if (top) {
    weakStudy = {
      studyId: top[0],
      title: titleById.get(top[0]) ?? "Study",
      misses: top[1],
    };
  }

  const { data: campaigns } = await supabase
    .from("exam_campaigns")
    .select("id, title, exam_at, study_ids")
    .eq("user_id", user.id)
    .gte("exam_at", today);

  const examCampaigns = (campaigns ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    examAt: String(c.exam_at).slice(0, 10),
    studyIds: Array.isArray(c.study_ids)
      ? (c.study_ids as string[])
      : [],
    studyTitles: Object.fromEntries(Array.from(titleById.entries())),
  }));

  return {
    user,
    today,
    cardDays,
    assignments,
    weakStudy,
    examCampaigns,
    error: null as null,
  };
}

export async function GET(request: Request) {
  const weekStart =
    new URL(request.url).searchParams.get("week_start") || mondayOf();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("study_week_plans")
    .select("week_start, sessions, updated_at")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes("study_week_plans") ||
      error.code === "PGRST205"
    ) {
      return apiError(
        "Week plans need APPLY_PLAN_VOICE_SHARE.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  if (!data) {
    return apiSuccess({
      weekStart,
      sessions: [],
      saved: false,
    } satisfies WeekPlan & { saved: boolean });
  }

  return apiSuccess({
    weekStart: data.week_start,
    sessions: data.sessions ?? [],
    saved: true,
    updatedAt: data.updated_at,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const weekStart =
    typeof body?.week_start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.week_start)
      ? body.week_start
      : mondayOf();

  const inputs = await gatherPlanInputs(weekStart);
  if (!inputs.user) return apiError("Unauthorized", 401);

  const examSessions = buildExamSessions({
    weekStart,
    today: inputs.today,
    campaigns: inputs.examCampaigns ?? [],
  });

  const plan = buildWeekPlan({
    weekStart,
    today: inputs.today,
    cardDays: inputs.cardDays,
    assignments: inputs.assignments,
    weakStudy: inputs.weakStudy,
    examSessions,
  });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("study_week_plans")
    .upsert(
      {
        user_id: inputs.user.id,
        week_start: weekStart,
        sessions: plan.sessions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,week_start" }
    )
    .select("week_start, sessions, updated_at")
    .single();

  if (error) {
    if (
      error.message.includes("study_week_plans") ||
      error.code === "PGRST205"
    ) {
      return apiError(
        "Week plans need APPLY_PLAN_VOICE_SHARE.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  return apiSuccess({
    weekStart: data.week_start,
    sessions: data.sessions ?? plan.sessions,
    saved: true,
    updatedAt: data.updated_at,
  });
}
