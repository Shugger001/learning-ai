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
  delta: { cardsReviewed?: number; quizzesTaken?: number }
) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }

  const day = todayUtc();
  const cards = delta.cardsReviewed ?? 0;
  const quizzes = delta.quizzesTaken ?? 0;

  const { data: existing } = await admin
    .from("study_activity")
    .select("id, cards_reviewed, quizzes_taken")
    .eq("user_id", userId)
    .eq("activity_date", day)
    .maybeSingle();

  if (existing) {
    await admin
      .from("study_activity")
      .update({
        cards_reviewed: (existing.cards_reviewed ?? 0) + cards,
        quizzes_taken: (existing.quizzes_taken ?? 0) + quizzes,
      })
      .eq("id", existing.id);
  } else {
    const { error } = await admin.from("study_activity").insert({
      user_id: userId,
      activity_date: day,
      cards_reviewed: cards,
      quizzes_taken: quizzes,
    });
    // Table may not exist until migration is applied.
    if (error) return;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("current_streak, longest_streak, last_study_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) return;

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
}
