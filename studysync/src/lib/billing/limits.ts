/** Free-plan soft limits (pro = unlimited). */
export const FREE_LIMITS = {
  uploads: 10,
  chat: 30,
  podcasts: 3,
} as const;

export function isPro(plan?: string | null) {
  return plan === "pro";
}
