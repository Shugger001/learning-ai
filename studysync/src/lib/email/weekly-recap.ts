import { createAdminClient } from "@/lib/supabase/admin";

export type DigestPayload = {
  email: string;
  fullName: string | null;
  dueCount: number;
  duePreview: string[];
  streak: number;
  weakTopics: { title: string; misses: number }[];
};

export async function buildDigestForUser(userId: string): Promise<DigestPayload | null> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const email = authUser.user?.email;
  if (!email) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, current_streak")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: studies } = await admin
    .from("studies")
    .select("id, title")
    .eq("user_id", userId)
    .eq("status", "complete");

  const studyList = studies ?? [];
  const studyIds = studyList.map((s) => s.id);
  const titleById = new Map(studyList.map((s) => [s.id, s.title]));

  let dueCount = 0;
  let duePreview: string[] = [];
  if (studyIds.length > 0) {
    const { data: due } = await admin
      .from("flashcards")
      .select("question, study_id")
      .in("study_id", studyIds)
      .lte("due_at", new Date().toISOString())
      .limit(40);
    dueCount = due?.length ?? 0;
    duePreview = (due ?? []).slice(0, 5).map((c) => c.question);
  }

  const { data: attempts } = await admin
    .from("quiz_attempts")
    .select("study_id, wrong_quiz_ids")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const weakTopics = new Map<string, number>();
  for (const a of attempts ?? []) {
    const wrong = Array.isArray(a.wrong_quiz_ids) ? a.wrong_quiz_ids.length : 0;
    if (wrong <= 0) continue;
    const title = titleById.get(a.study_id) ?? "Study";
    weakTopics.set(title, (weakTopics.get(title) ?? 0) + wrong);
  }

  return {
    email,
    fullName: profile?.full_name ?? null,
    dueCount,
    duePreview,
    streak: Number(profile?.current_streak ?? 0),
    weakTopics: Array.from(weakTopics.entries())
      .map(([title, misses]) => ({ title, misses }))
      .sort((a, b) => b.misses - a.misses)
      .slice(0, 5),
  };
}

export function renderDigestHtml(digest: DigestPayload, appUrl: string) {
  const name = digest.fullName?.split(" ")[0] || "there";
  const weak =
    digest.weakTopics.length > 0
      ? digest.weakTopics
          .map((t) => `<li>${escapeHtml(t.title)} — ${t.misses} misses</li>`)
          .join("")
      : "<li>No weak topics yet — keep quizzing.</li>";
  const dueList =
    digest.duePreview.length > 0
      ? digest.duePreview.map((q) => `<li>${escapeHtml(q.slice(0, 120))}</li>`).join("")
      : "<li>You're caught up on cards.</li>";

  return `<!doctype html><html><body style="font-family:Georgia,serif;line-height:1.5;color:#111;max-width:560px;margin:0 auto;padding:24px">
  <p style="letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#1f6f54;font-weight:700">StudySync weekly recap</p>
  <h1 style="font-size:24px;margin:8px 0 16px">Hi ${escapeHtml(name)},</h1>
  <p>Here's your study pulse for the week.</p>
  <p><strong>Streak:</strong> ${digest.streak} day${digest.streak === 1 ? "" : "s"}</p>
  <p><strong>Due now:</strong> ${digest.dueCount} card${digest.dueCount === 1 ? "" : "s"}</p>
  <h2 style="font-size:16px;margin-top:24px">Due cards</h2>
  <ul>${dueList}</ul>
  <h2 style="font-size:16px;margin-top:24px">Weak topics</h2>
  <ul>${weak}</ul>
  <p style="margin-top:28px"><a href="${appUrl}/review" style="background:#1f6f54;color:#fff;padding:10px 16px;text-decoration:none">Review today</a></p>
  <p style="margin-top:24px;font-size:12px;color:#666"><a href="${appUrl}/progress">Manage email preferences</a></p>
  </body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
