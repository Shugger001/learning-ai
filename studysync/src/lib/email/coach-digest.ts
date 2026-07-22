import { createAdminClient } from "@/lib/supabase/admin";

export type CoachDigestPayload = {
  coachEmail: string;
  studentName: string;
  streak: number;
  longestStreak: number;
  dueCount: number;
  studyCount: number;
  cardsThisWeek: number;
  quizzesThisWeek: number;
  weakTopics: { title: string; misses: number }[];
  snapshotUrl: string | null;
};

/** Privacy-safe progress digest for parent/coach (no card question text). */
export async function buildCoachDigestForUser(
  userId: string,
  coachEmail: string,
  appUrl: string
): Promise<CoachDigestPayload | null> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "full_name, current_streak, longest_streak, progress_share_token"
    )
    .eq("user_id", userId)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const [{ data: studies }, { data: activity }, { data: attempts }, dueRes] =
    await Promise.all([
      admin
        .from("studies")
        .select("id, title")
        .eq("user_id", userId)
        .eq("status", "complete"),
      admin
        .from("study_activity")
        .select("activity_date, cards_reviewed, quizzes_taken")
        .eq("user_id", userId)
        .order("activity_date", { ascending: false })
        .limit(7),
      admin
        .from("quiz_attempts")
        .select("study_id, wrong_quiz_ids")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("flashcards")
        .select("id, studies!inner(user_id, status)")
        .eq("studies.user_id", userId)
        .eq("studies.status", "complete")
        .lte("due_at", nowIso)
        .limit(100),
    ]);

  const titleById = new Map((studies ?? []).map((s) => [s.id, s.title]));
  const weakTopics = new Map<string, number>();
  for (const a of attempts ?? []) {
    const wrong = Array.isArray(a.wrong_quiz_ids) ? a.wrong_quiz_ids.length : 0;
    if (wrong <= 0) continue;
    const title = titleById.get(a.study_id) ?? "Study";
    weakTopics.set(title, (weakTopics.get(title) ?? 0) + wrong);
  }

  const cardsThisWeek = (activity ?? []).reduce(
    (sum, d) => sum + (d.cards_reviewed ?? 0),
    0
  );
  const quizzesThisWeek = (activity ?? []).reduce(
    (sum, d) => sum + (d.quizzes_taken ?? 0),
    0
  );

  const token = profile?.progress_share_token as string | null;
  return {
    coachEmail,
    studentName: profile?.full_name?.split(" ")[0] || "Student",
    streak: Number(profile?.current_streak ?? 0),
    longestStreak: Number(profile?.longest_streak ?? 0),
    dueCount: dueRes.data?.length ?? 0,
    studyCount: studies?.length ?? 0,
    cardsThisWeek,
    quizzesThisWeek,
    weakTopics: Array.from(weakTopics.entries())
      .map(([title, misses]) => ({ title, misses }))
      .sort((a, b) => b.misses - a.misses)
      .slice(0, 5),
    snapshotUrl: token ? `${appUrl}/share/progress/${token}` : null,
  };
}

export function renderCoachDigestHtml(
  digest: CoachDigestPayload,
  appUrl: string
) {
  const weak =
    digest.weakTopics.length > 0
      ? digest.weakTopics
          .map(
            (t) =>
              `<li>${escapeHtml(t.title)} — ${t.misses} recent misses</li>`
          )
          .join("")
      : "<li>No weak topics flagged this week.</li>";

  const snapshot = digest.snapshotUrl
    ? `<p style="margin-top:24px"><a href="${digest.snapshotUrl}" style="background:#1f6f54;color:#fff;padding:10px 16px;text-decoration:none">Open live snapshot</a></p>`
    : `<p style="margin-top:24px;font-size:13px;color:#666">Ask ${escapeHtml(digest.studentName)} to enable a progress snapshot link in StudySync.</p>`;

  return `<!doctype html><html><body style="font-family:Georgia,serif;line-height:1.5;color:#111;max-width:560px;margin:0 auto;padding:24px">
  <p style="letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#1f6f54;font-weight:700">StudySync coach digest</p>
  <h1 style="font-size:22px;margin:8px 0 16px">${escapeHtml(digest.studentName)}'s week</h1>
  <p>A privacy-safe summary — no flashcard question text included.</p>
  <ul>
    <li><strong>Streak:</strong> ${digest.streak} day${digest.streak === 1 ? "" : "s"} (best ${digest.longestStreak})</li>
    <li><strong>Cards due now:</strong> ${digest.dueCount}</li>
    <li><strong>Cards reviewed (7d):</strong> ${digest.cardsThisWeek}</li>
    <li><strong>Quizzes (7d):</strong> ${digest.quizzesThisWeek}</li>
    <li><strong>Study packs:</strong> ${digest.studyCount}</li>
  </ul>
  <h2 style="font-size:16px;margin-top:24px">Focus areas</h2>
  <ul>${weak}</ul>
  ${snapshot}
  <p style="margin-top:24px;font-size:12px;color:#666">Sent via StudySync · <a href="${appUrl}">studysync</a></p>
  </body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
