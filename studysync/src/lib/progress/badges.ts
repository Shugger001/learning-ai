export const BADGE_CATALOG: Record<
  string,
  { title: string; description: string }
> = {
  first_review: {
    title: "First flip",
    description: "Rate your first flashcard",
  },
  streak_3: { title: "Warming up", description: "3-day study streak" },
  streak_7: { title: "Week warrior", description: "7-day study streak" },
  streak_30: { title: "Unstoppable", description: "30-day study streak" },
  quiz_ace: {
    title: "Quiz ace",
    description: "Score 80%+ on a quiz",
  },
  quiz_10: {
    title: "Quiz grind",
    description: "Complete 10 quiz attempts",
  },
  battle_first: {
    title: "Battle ready",
    description: "Finish a room quiz battle",
  },
  mastery_25: {
    title: "Solid footing",
    description: "Master 25 cards (reps ≥ 3)",
  },
  mastery_50: {
    title: "Deck master",
    description: "Master 50 cards (reps ≥ 3)",
  },
  level_5: { title: "Level 5", description: "Reach level 5" },
  level_10: { title: "Level 10", description: "Reach level 10" },
  exam_set: {
    title: "Countdown set",
    description: "Create an exam campaign",
  },
  exam_boss: {
    title: "Boss cleared",
    description: "Pass a boss quiz (≥80%) during a campaign",
  },
};

export function levelFromXp(xp: number) {
  return Math.max(1, Math.floor(Math.max(0, xp) / 100) + 1);
}

export function xpToNextLevel(xp: number) {
  const level = levelFromXp(xp);
  return level * 100 - xp;
}
