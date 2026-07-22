export type DeckMastery = {
  studyId: string;
  title: string;
  cardCount: number;
  mastered: number;
  struggling: number;
  avgEase: number;
  avgReps: number;
  /** 0–100 strength score from ease × reps. */
  score: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Combine average ease + reps into a 0–100 mastery score. */
export function masteryScore(avgEase: number, avgReps: number) {
  const easeNorm = clamp((avgEase - 1.3) / 1.7, 0, 1);
  const repsNorm = clamp(avgReps / 5, 0, 1);
  return Math.round(100 * (0.55 * easeNorm + 0.45 * repsNorm));
}

export function buildDeckMastery(
  rows: {
    study_id: string;
    title: string;
    ease: number;
    reps: number;
  }[]
): DeckMastery[] {
  const byStudy = new Map<
    string,
    {
      title: string;
      easeSum: number;
      repsSum: number;
      count: number;
      mastered: number;
      struggling: number;
    }
  >();

  for (const row of rows) {
    const ease = Number(row.ease ?? 2.5);
    const reps = Number(row.reps ?? 0);
    const existing = byStudy.get(row.study_id);
    if (existing) {
      existing.easeSum += ease;
      existing.repsSum += reps;
      existing.count += 1;
      if (reps >= 3 && ease >= 2.3) existing.mastered += 1;
      if (ease < 2.2) existing.struggling += 1;
    } else {
      byStudy.set(row.study_id, {
        title: row.title,
        easeSum: ease,
        repsSum: reps,
        count: 1,
        mastered: reps >= 3 && ease >= 2.3 ? 1 : 0,
        struggling: ease < 2.2 ? 1 : 0,
      });
    }
  }

  return Array.from(byStudy.entries())
    .map(([studyId, v]) => {
      const avgEase = v.count ? v.easeSum / v.count : 2.5;
      const avgReps = v.count ? v.repsSum / v.count : 0;
      return {
        studyId,
        title: v.title,
        cardCount: v.count,
        mastered: v.mastered,
        struggling: v.struggling,
        avgEase: Math.round(avgEase * 100) / 100,
        avgReps: Math.round(avgReps * 100) / 100,
        score: masteryScore(avgEase, avgReps),
      };
    })
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title));
}

export function heatColor(score: number) {
  if (score >= 75) return "bg-emerald-600/80";
  if (score >= 55) return "bg-lime-600/70";
  if (score >= 35) return "bg-amber-500/70";
  if (score >= 20) return "bg-orange-500/70";
  return "bg-rose-600/70";
}
