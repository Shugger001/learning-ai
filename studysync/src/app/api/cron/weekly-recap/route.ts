import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailFrom, getResend } from "@/lib/email/resend";
import { buildDigestForUser, renderDigestHtml } from "@/lib/email/weekly-recap";
import {
  buildCoachDigestForUser,
  renderCoachDigestHtml,
} from "@/lib/email/coach-digest";

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

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://studysync-alpha-opal.vercel.app";
  let sent = 0;
  let coachSent = 0;
  const failures: string[] = [];

  const { data: prefs, error } = await admin
    .from("email_preferences")
    .select(
      "user_id, unsubscribe_token, weekly_recap, coach_digest, coach_email"
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const row of prefs ?? []) {
    if (row.weekly_recap) {
      const digest = await buildDigestForUser(row.user_id);
      if (digest) {
        const unsubUrl = digest.unsubscribeToken
          ? `${appUrl}/unsubscribe?token=${encodeURIComponent(digest.unsubscribeToken)}`
          : `${appUrl}/progress`;
        try {
          await resend.emails.send({
            from: emailFrom(),
            to: digest.email,
            subject: `StudySync recap · ${digest.dueCount} due · ${digest.streak}d streak`,
            html: renderDigestHtml(digest, appUrl),
            headers: {
              "List-Unsubscribe": `<${unsubUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          });
          await admin
            .from("email_preferences")
            .update({
              last_weekly_sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", row.user_id);
          sent += 1;
        } catch (err) {
          failures.push(
            err instanceof Error ? err.message : `failed for ${row.user_id}`
          );
        }
      }
    }

    if (row.coach_digest && row.coach_email) {
      const coach = await buildCoachDigestForUser(
        row.user_id,
        row.coach_email,
        appUrl
      );
      if (coach) {
        try {
          await resend.emails.send({
            from: emailFrom(),
            to: coach.coachEmail,
            subject: `StudySync · ${coach.studentName}'s week · ${coach.streak}d streak`,
            html: renderCoachDigestHtml(coach, appUrl),
          });
          await admin
            .from("email_preferences")
            .update({
              last_coach_sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", row.user_id);
          coachSent += 1;
        } catch (err) {
          failures.push(
            err instanceof Error
              ? err.message
              : `coach failed for ${row.user_id}`
          );
        }
      }
    }
  }

  return NextResponse.json({ sent, coachSent, failures });
}

export async function POST(request: Request) {
  return GET(request);
}
