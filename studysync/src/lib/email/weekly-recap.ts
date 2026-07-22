import { createAdminClient } from "@/lib/supabase/admin";

export type DigestPayload = {
  email: string;
  fullName: string | null;
  dueCount: number;
  duePreview: string[];
  streak: number;
  weakTopics: { title: string; misses: number }[];
  assignments: {
    title: string;
    className: string;
    dueAt: string | null;
    cardsReviewed: number;
    completed: boolean;
  }[];
  weekAhead: { date: string; dueCount: number }[];
  unsubscribeToken: string | null;
};

export async function buildDigestForUser(
  userId: string
): Promise<DigestPayload | null> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const email = authUser.user?.email;
  if (!email) return null;

  const [{ data: profile }, { data: prefs }] = await Promise.all([
    admin
      .from("profiles")
      .select("full_name, current_streak")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("email_preferences")
      .select("unsubscribe_token")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  let unsubscribeToken = prefs?.unsubscribe_token as string | null;
  if (!unsubscribeToken) {
    unsubscribeToken = crypto.randomUUID().replace(/-/g, "");
    await admin.from("email_preferences").upsert(
      {
        user_id: userId,
        unsubscribe_token: unsubscribeToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  }

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
  const weekAheadMap = new Map<string, number>();
  if (studyIds.length > 0) {
    const now = new Date();
    const { data: due } = await admin
      .from("flashcards")
      .select("question, study_id")
      .in("study_id", studyIds)
      .lte("due_at", now.toISOString())
      .limit(40);
    dueCount = due?.length ?? 0;
    duePreview = (due ?? []).slice(0, 5).map((c) => c.question);

    const weekEnd = new Date(now);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const { data: upcoming } = await admin
      .from("flashcards")
      .select("due_at")
      .in("study_id", studyIds)
      .gt("due_at", now.toISOString())
      .lte("due_at", weekEnd.toISOString())
      .limit(200);
    for (const card of upcoming ?? []) {
      if (!card.due_at) continue;
      const day = String(card.due_at).slice(0, 10);
      weekAheadMap.set(day, (weekAheadMap.get(day) ?? 0) + 1);
    }
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

  const assignments: DigestPayload["assignments"] = [];
  const { data: memberships } = await admin
    .from("class_members")
    .select("class_id, classes(name)")
    .eq("user_id", userId)
    .not("accepted_at", "is", null);

  const classIds = (memberships ?? []).map((m) => m.class_id);
  const classNameById = new Map<string, string>();
  for (const m of memberships ?? []) {
    const cls = m.classes as unknown as { name?: string } | null;
    classNameById.set(m.class_id, cls?.name ?? "Class");
  }

  if (classIds.length > 0) {
    const { data: assigned } = await admin
      .from("class_assignments")
      .select("id, title, due_at, class_id, studies(title)")
      .in("class_id", classIds)
      .order("due_at", { ascending: true })
      .limit(12);

    const assignmentIds = (assigned ?? []).map((a) => a.id);
    const progressByAssignment = new Map<
      string,
      { cards_reviewed: number; completed_at: string | null }
    >();
    if (assignmentIds.length > 0) {
      const { data: prog } = await admin
        .from("assignment_progress")
        .select("assignment_id, cards_reviewed, completed_at")
        .eq("user_id", userId)
        .in("assignment_id", assignmentIds);
      for (const p of prog ?? []) {
        progressByAssignment.set(p.assignment_id, {
          cards_reviewed: p.cards_reviewed ?? 0,
          completed_at: p.completed_at,
        });
      }
    }

    for (const a of assigned ?? []) {
      const study = a.studies as unknown as { title?: string } | null;
      const prog = progressByAssignment.get(a.id);
      assignments.push({
        title: a.title || study?.title || "Assigned pack",
        className: classNameById.get(a.class_id) ?? "Class",
        dueAt: a.due_at,
        cardsReviewed: prog?.cards_reviewed ?? 0,
        completed: Boolean(prog?.completed_at),
      });
    }
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
    assignments,
    weekAhead: Array.from(weekAheadMap.entries())
      .map(([date, count]) => ({ date, dueCount: count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    unsubscribeToken,
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
      ? digest.duePreview
          .map((q) => `<li>${escapeHtml(q.slice(0, 120))}</li>`)
          .join("")
      : "<li>You're caught up on cards.</li>";

  const assigned =
    digest.assignments.length > 0
      ? digest.assignments
          .map((a) => {
            const due = a.dueAt
              ? ` · due ${new Date(a.dueAt).toLocaleDateString()}`
              : "";
            const status = a.completed
              ? "done"
              : `${a.cardsReviewed} cards reviewed`;
            return `<li><strong>${escapeHtml(a.title)}</strong> (${escapeHtml(
              a.className
            )})${due} — ${escapeHtml(status)}</li>`;
          })
          .join("")
      : "<li>No class packs assigned right now.</li>";

  const week =
    digest.weekAhead.length > 0
      ? digest.weekAhead
          .map(
            (d) =>
              `<li>${escapeHtml(d.date)} — ${d.dueCount} card${
                d.dueCount === 1 ? "" : "s"
              }</li>`
          )
          .join("")
      : "<li>Quiet week ahead on the calendar.</li>";

  const unsub = digest.unsubscribeToken
    ? `${appUrl}/unsubscribe?token=${encodeURIComponent(digest.unsubscribeToken)}`
    : `${appUrl}/progress`;

  return `<!doctype html><html><body style="font-family:Georgia,serif;line-height:1.5;color:#111;max-width:560px;margin:0 auto;padding:24px">
  <p style="letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#1f6f54;font-weight:700">StudySync weekly recap</p>
  <h1 style="font-size:24px;margin:8px 0 16px">Hi ${escapeHtml(name)},</h1>
  <p>Here's your study pulse for the week.</p>
  <p><strong>Streak:</strong> ${digest.streak} day${digest.streak === 1 ? "" : "s"}</p>
  <p><strong>Due now:</strong> ${digest.dueCount} card${digest.dueCount === 1 ? "" : "s"}</p>
  <h2 style="font-size:16px;margin-top:24px">Due cards</h2>
  <ul>${dueList}</ul>
  <h2 style="font-size:16px;margin-top:24px">Class assignments</h2>
  <ul>${assigned}</ul>
  <h2 style="font-size:16px;margin-top:24px">Week ahead</h2>
  <ul>${week}</ul>
  <h2 style="font-size:16px;margin-top:24px">Weak topics</h2>
  <ul>${weak}</ul>
  <p style="margin-top:28px"><a href="${appUrl}/review" style="background:#1f6f54;color:#fff;padding:10px 16px;text-decoration:none">Review today</a></p>
  <p style="margin-top:24px;font-size:12px;color:#666">
    <a href="${appUrl}/progress">Manage preferences</a>
    · <a href="${unsub}">Unsubscribe</a>
  </p>
  </body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
