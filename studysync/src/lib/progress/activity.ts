import { createAdminClient } from "@/lib/supabase/admin";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Record daily study activity and update streak counters. */
export async function recordStudyActivity(
  userId: string,
  delta: {
    cardsReviewed?: number;
    quizzesTaken?: number;
    minutesStudied?: number;
    studyId?: string;
  }
) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { xp: 0, level: 1, gained: 0, badges: [] as string[] };
  }

  const day = todayUtc();
  const cards = delta.cardsReviewed ?? 0;
  const quizzes = delta.quizzesTaken ?? 0;
  const minutes = delta.minutesStudied ?? 0;

  const { data: existing } = await admin
    .from("study_activity")
    .select("id, cards_reviewed, quizzes_taken, minutes_studied")
    .eq("user_id", userId)
    .eq("activity_date", day)
    .maybeSingle();

  if (existing) {
    const patch: Record<string, number> = {
      cards_reviewed: (existing.cards_reviewed ?? 0) + cards,
      quizzes_taken: (existing.quizzes_taken ?? 0) + quizzes,
    };
    if (minutes > 0) {
      patch.minutes_studied = Number(existing.minutes_studied ?? 0) + minutes;
    }
    await admin.from("study_activity").update(patch).eq("id", existing.id);
  } else {
    const { error } = await admin.from("study_activity").insert({
      user_id: userId,
      activity_date: day,
      cards_reviewed: cards,
      quizzes_taken: quizzes,
      minutes_studied: minutes,
    });
    // Table may not exist until migration is applied.
    if (error) {
      return { xp: 0, level: 1, gained: 0, badges: [] as string[] };
    }
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("current_streak, longest_streak, last_study_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) {
    return { xp: 0, level: 1, gained: 0, badges: [] as string[] };
  }

  const last = profile.last_study_date as string | null;
  let current = Number(profile.current_streak ?? 0);
  let longest = Number(profile.longest_streak ?? 0);

  if (last === day) {
    // already counted today
  } else if (last === yesterdayUtc()) {
    current += 1;
  } else {
    current = 1;
  }
  longest = Math.max(longest, current);

  await admin
    .from("profiles")
    .update({
      current_streak: current,
      longest_streak: longest,
      last_study_date: day,
    })
    .eq("user_id", userId);

  let awards = { xp: 0, level: 1, gained: 0, badges: [] as string[] };
  if (cards > 0) {
    const { awardXp } = await import("@/lib/progress/xp");
    awards = await awardXp(userId, { type: "card_review", streak: current });
  }

  // Bump progress for teacher packs and student assignment copies
  if (cards > 0 && delta.studyId) {
    const { assignmentGoal } = await import("@/lib/classes/gradebook");
    const { data: studyMeta } = await admin
      .from("studies")
      .select("flashcard_count")
      .eq("id", delta.studyId)
      .maybeSingle();
    const goal = assignmentGoal(studyMeta?.flashcard_count);

    const assignmentIds = new Set<string>();
    const { data: direct } = await admin
      .from("class_assignments")
      .select("id")
      .eq("study_id", delta.studyId);
    for (const a of direct ?? []) assignmentIds.add(a.id);

    const { data: copies } = await admin
      .from("assignment_copies")
      .select("assignment_id")
      .eq("study_id", delta.studyId)
      .eq("user_id", userId);
    for (const c of copies ?? []) assignmentIds.add(c.assignment_id);

    for (const assignmentId of Array.from(assignmentIds)) {
      const { data: existingProg } = await admin
        .from("assignment_progress")
        .select("id, cards_reviewed, completed_at")
        .eq("assignment_id", assignmentId)
        .eq("user_id", userId)
        .maybeSingle();
      if (existingProg) {
        const nextCount = (existingProg.cards_reviewed ?? 0) + cards;
        const done =
          Boolean(existingProg.completed_at) || nextCount >= goal;
        await admin
          .from("assignment_progress")
          .update({
            cards_reviewed: nextCount,
            last_reviewed_at: new Date().toISOString(),
            completed_at: done
              ? existingProg.completed_at ?? new Date().toISOString()
              : null,
          })
          .eq("id", existingProg.id);
      } else {
        await admin.from("assignment_progress").insert({
          assignment_id: assignmentId,
          user_id: userId,
          cards_reviewed: cards,
          last_reviewed_at: new Date().toISOString(),
          completed_at: cards >= goal ? new Date().toISOString() : null,
        });
      }
    }
  }

  return awards;
}
