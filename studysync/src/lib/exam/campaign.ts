import type { PlanSession } from "@/lib/plan/generate";

export type ExamCampaignInput = {
  id: string;
  title: string;
  examAt: string; // YYYY-MM-DD
  studyIds: string[];
  studyTitles?: Record<string, string>;
};

function addDays(dateKey: string, n: number) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00.000Z`).getTime();
  const b = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Ramp intensity: light → medium → heavy as exam nears. */
export function rampIntensity(daysLeft: number): "light" | "medium" | "heavy" | "done" {
  if (daysLeft < 0) return "done";
  if (daysLeft <= 3) return "heavy";
  if (daysLeft <= 10) return "medium";
  return "light";
}

/** Build week sessions for active exam campaigns overlapping this week. */
export function buildExamSessions(params: {
  weekStart: string;
  today: string;
  campaigns: ExamCampaignInput[];
}): PlanSession[] {
  const sessions: PlanSession[] = [];
  const weekEnd = addDays(params.weekStart, 6);

  for (const c of params.campaigns) {
    const examAt = c.examAt.slice(0, 10);
    if (examAt < params.weekStart) continue;

    const primaryId = c.studyIds[0] ?? null;
    const primaryTitle =
      (primaryId && c.studyTitles?.[primaryId]) || c.title;

    for (let i = 0; i < 7; i++) {
      const day = addDays(params.weekStart, i);
      if (day > examAt) continue;
      if (day < params.today && day < params.weekStart) continue;

      const daysLeft = daysBetween(day, examAt);
      const intensity = rampIntensity(daysLeft);
      if (intensity === "done") continue;

      const cardsTarget =
        intensity === "heavy" ? 30 : intensity === "medium" ? 20 : 12;
      const minutes =
        intensity === "heavy" ? 35 : intensity === "medium" ? 25 : 15;

      sessions.push({
        date: day,
        title: `Ramp · ${c.title}`,
        kind: "exam_ramp",
        studyId: primaryId,
        cardsTarget,
        minutes,
        href: primaryId
          ? `/study/${primaryId}`
          : `/exam`,
        note: `${daysLeft}d to exam · ${intensity} load`,
      });

      // Boss quizzes: every other day in medium, daily in heavy, plus exam eve
      const bossDay =
        intensity === "heavy" ||
        (intensity === "medium" && i % 2 === 0) ||
        day === examAt ||
        day === addDays(examAt, -1);

      if (bossDay && primaryId && day <= weekEnd) {
        sessions.push({
          date: day,
          title: `Boss quiz · ${primaryTitle}`,
          kind: "boss",
          studyId: primaryId,
          cardsTarget: 0,
          minutes: intensity === "heavy" ? 25 : 18,
          href: `/study/${primaryId}?tab=quiz&exam=1&boss=1`,
          note:
            day === examAt
              ? "Exam day · full timed run"
              : "Timed exam mode · aim for 80%+",
        });
      }
    }
  }

  return sessions;
}
