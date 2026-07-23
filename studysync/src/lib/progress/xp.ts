import { createAdminClient } from "@/lib/supabase/admin";
import { BADGE_CATALOG, levelFromXp } from "@/lib/progress/badges";

export {
  BADGE_CATALOG,
  levelFromXp,
  xpToNextLevel,
} from "@/lib/progress/badges";

async function unlockBadge(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  badgeKey: string
) {
  if (!BADGE_CATALOG[badgeKey]) return false;
  const { data: existing } = await admin
    .from("user_achievements")
    .select("id")
    .eq("user_id", userId)
    .eq("badge_key", badgeKey)
    .maybeSingle();
  if (existing) return false;
  await admin.from("user_achievements").upsert(
    { user_id: userId, badge_key: badgeKey },
    { onConflict: "user_id,badge_key", ignoreDuplicates: true }
  );
  return true;
}

export type XpEvent =
  | { type: "card_review"; streak?: number }
  | { type: "quiz"; score: number; total: number; boss?: boolean }
  | { type: "battle" }
  | { type: "exam_set" };

/** Award XP and evaluate achievement unlocks. Soft-fails if tables missing. */
export async function awardXp(userId: string, event: XpEvent) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { xp: 0, level: 1, gained: 0, badges: [] as string[] };
  }

  let gained = 0;
  if (event.type === "card_review") gained = 5;
  else if (event.type === "quiz") {
    gained = 15;
    if (event.total > 0 && event.score / event.total >= 0.8) gained += 10;
  } else if (event.type === "battle") gained = 25;
  else if (event.type === "exam_set") gained = 20;

  const { data: profile } = await admin
    .from("profiles")
    .select("xp, level, current_streak")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) {
    return { xp: 0, level: 1, gained: 0, badges: [] as string[] };
  }

  const prevXp = Number(profile.xp ?? 0);
  const nextXp = prevXp + gained;
  const nextLevel = levelFromXp(nextXp);
  const streak = Number(
    event.type === "card_review" && event.streak != null
      ? event.streak
      : profile.current_streak ?? 0
  );

  const { error } = await admin
    .from("profiles")
    .update({ xp: nextXp, level: nextLevel })
    .eq("user_id", userId);

  if (error) {
    // Columns may not exist until APPLY_XP_EXAM_SYNC.sql
    return {
      xp: prevXp,
      level: Number(profile.level ?? 1),
      gained: 0,
      badges: [] as string[],
    };
  }

  const unlocked: string[] = [];

  async function tryUnlock(key: string) {
    const fresh = await unlockBadge(admin!, userId, key);
    if (fresh) unlocked.push(key);
  }

  if (event.type === "card_review") {
    await tryUnlock("first_review");
    if (streak >= 3) await tryUnlock("streak_3");
    if (streak >= 7) await tryUnlock("streak_7");
    if (streak >= 30) await tryUnlock("streak_30");

    const { count } = await admin
      .from("flashcards")
      .select("id, studies!inner(user_id)", { count: "exact", head: true })
      .eq("studies.user_id", userId)
      .gte("reps", 3);
    if ((count ?? 0) >= 25) await tryUnlock("mastery_25");
    if ((count ?? 0) >= 50) await tryUnlock("mastery_50");
  }

  if (event.type === "quiz") {
    if (event.total > 0 && event.score / event.total >= 0.8) {
      await tryUnlock("quiz_ace");
      if (event.boss) await tryUnlock("exam_boss");
    }
    const { count } = await admin
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= 10) await tryUnlock("quiz_10");
  }

  if (event.type === "battle") await tryUnlock("battle_first");
  if (event.type === "exam_set") await tryUnlock("exam_set");
  if (nextLevel >= 5) await tryUnlock("level_5");
  if (nextLevel >= 10) await tryUnlock("level_10");

  return { xp: nextXp, level: nextLevel, gained, badges: unlocked };
}
