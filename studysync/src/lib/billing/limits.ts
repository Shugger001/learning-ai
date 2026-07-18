/** Free-plan soft limits (pro = unlimited). 30-day rolling window. */
export const FREE_LIMITS = {
  uploads: 10,
  chat: 30,
  podcasts: 3,
} as const;

export const USAGE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export function isPro(plan?: string | null) {
  return plan === "pro";
}

export type UsageProfile = {
  plan?: string | null;
  uploads_used?: number | null;
  chat_used?: number | null;
  podcasts_used?: number | null;
  usage_reset_at?: string | null;
};

export type UsageRemaining = {
  uploads: number;
  chat: number;
  podcasts: number;
  resetsAt: string;
};

/** If the 30-day window expired, zero counters and bump usage_reset_at. */
export async function ensureUsagePeriod<T extends UsageProfile>(
  // Supabase admin client - keep loose to avoid coupling this helper to client types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: { from: (table: string) => any },
  userId: string,
  profile: T | null | undefined
): Promise<T | null> {
  if (!profile) return null;
  if (isPro(profile.plan)) return profile;

  // Column may be missing until product-depth migration is applied.
  if (!("usage_reset_at" in profile) || profile.usage_reset_at === undefined) {
    return profile;
  }

  const resetAt = profile.usage_reset_at
    ? new Date(profile.usage_reset_at).getTime()
    : 0;
  const now = Date.now();

  if (resetAt && now - resetAt < USAGE_PERIOD_MS) {
    return profile;
  }

  const nextReset = new Date().toISOString();
  await admin
    .from("profiles")
    .update({
      uploads_used: 0,
      chat_used: 0,
      podcasts_used: 0,
      usage_reset_at: nextReset,
    })
    .eq("user_id", userId);

  return {
    ...profile,
    uploads_used: 0,
    chat_used: 0,
    podcasts_used: 0,
    usage_reset_at: nextReset,
  };
}

export function remainingUsage(
  profile: UsageProfile | null | undefined
): UsageRemaining | null {
  if (!profile || isPro(profile.plan)) return null;

  const resetsAt =
    profile.usage_reset_at ??
    new Date(Date.now() + USAGE_PERIOD_MS).toISOString();

  return {
    uploads: Math.max(0, FREE_LIMITS.uploads - (profile.uploads_used ?? 0)),
    chat: Math.max(0, FREE_LIMITS.chat - (profile.chat_used ?? 0)),
    podcasts: Math.max(
      0,
      FREE_LIMITS.podcasts - (profile.podcasts_used ?? 0)
    ),
    resetsAt,
  };
}
