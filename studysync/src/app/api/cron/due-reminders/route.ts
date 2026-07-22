import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailFrom, getResend } from "@/lib/email/resend";

function addDays(dateKey: string, n: number) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not configured" },
      { status: 503 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Admin client missing" }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = addDays(today, 1);
  const fromIso = `${tomorrow}T00:00:00.000Z`;
  const toExclusive = new Date(`${addDays(tomorrow, 1)}T00:00:00.000Z`);
  const toIso = toExclusive.toISOString();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://studysync-alpha-opal.vercel.app";

  const { data: dueSoon, error } = await admin
    .from("class_assignments")
    .select("id, title, due_at, class_id, study_id, classes(name), studies(title)")
    .gte("due_at", fromIso)
    .lt("due_at", toIso);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  const failures: string[] = [];

  for (const assignment of dueSoon ?? []) {
    const className =
      (assignment.classes as unknown as { name?: string } | null)?.name ??
      "Class";
    const studyTitle =
      (assignment.studies as unknown as { title?: string } | null)?.title ??
      "Study pack";
    const title = assignment.title || studyTitle;

    const { data: members } = await admin
      .from("class_members")
      .select("email, user_id")
      .eq("class_id", assignment.class_id)
      .not("accepted_at", "is", null);

    for (const m of members ?? []) {
      if (!m.user_id) continue;

      const { data: prefs } = await admin
        .from("email_preferences")
        .select("assignment_reminders, unsubscribe_token")
        .eq("user_id", m.user_id)
        .maybeSingle();

      // Default on when prefs row missing
      if (prefs && prefs.assignment_reminders === false) continue;

      const { data: progress } = await admin
        .from("assignment_progress")
        .select("completed_at")
        .eq("assignment_id", assignment.id)
        .eq("user_id", m.user_id)
        .maybeSingle();
      if (progress?.completed_at) continue;

      const to = (m.email || "").trim();
      if (!to) continue;

      const unsub = prefs?.unsubscribe_token
        ? `${appUrl}/unsubscribe?token=${encodeURIComponent(prefs.unsubscribe_token)}`
        : `${appUrl}/progress`;

      try {
        await resend.emails.send({
          from: emailFrom(),
          to,
          subject: `Due tomorrow · ${title}`,
          html: `<p>Reminder from <strong>${className}</strong></p>
<p><strong>${title}</strong> is due tomorrow.</p>
<p><a href="${appUrl}/classes/${assignment.class_id}">Open class</a></p>
<p style="font-size:12px;color:#666"><a href="${unsub}">Unsubscribe</a></p>`,
          headers: {
            "List-Unsubscribe": `<${unsub}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        await admin
          .from("email_preferences")
          .upsert(
            {
              user_id: m.user_id,
              last_due_reminder_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
        sent += 1;
      } catch (err) {
        failures.push(
          err instanceof Error ? err.message : `failed for ${m.user_id}`
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    dueAssignments: dueSoon?.length ?? 0,
    sent,
    failures,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
