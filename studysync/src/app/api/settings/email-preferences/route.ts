import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

function newUnsubToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

const defaults = {
  weekly_recap: false,
  timezone: "UTC",
  last_weekly_sent_at: null as string | null,
  unsubscribe_token: null as string | null,
  coach_digest: false,
  coach_email: null as string | null,
  free_minutes: 25,
  last_coach_sent_at: null as string | null,
  assignment_reminders: true,
  last_due_reminder_at: null as string | null,
};

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("email_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (error.message.includes("email_preferences") || error.code === "PGRST205") {
      return apiSuccess({ user_id: user.id, ...defaults });
    }
    return apiError(error.message, 500);
  }

  return apiSuccess(data ?? { user_id: user.id, ...defaults });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      weekly_recap: z.boolean().optional(),
      timezone: z.string().min(1).max(64).optional(),
      coach_digest: z.boolean().optional(),
      coach_email: z.string().email().nullable().optional(),
      free_minutes: z.number().int().min(10).max(120).optional(),
      assignment_reminders: z.boolean().optional(),
    })
    .safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { data: existing } = await supabase
    .from("email_preferences")
    .select("unsubscribe_token")
    .eq("user_id", user.id)
    .maybeSingle();

  const row: Record<string, unknown> = {
    user_id: user.id,
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  if (
    (parsed.data.weekly_recap === true ||
      parsed.data.coach_digest === true ||
      parsed.data.assignment_reminders === true) &&
    !existing?.unsubscribe_token
  ) {
    row.unsubscribe_token = newUnsubToken();
  }

  const { data, error } = await supabase
    .from("email_preferences")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("email_preferences") || error.code === "PGRST205") {
      return apiError(
        "Email preferences need APPLY_CLASSES_EMAIL.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    if (
      error.message.includes("coach_") ||
      error.message.includes("free_minutes") ||
      error.message.includes("assignment_reminders")
    ) {
      return apiError(
        "Email prefs need APPLY_GOALS_BATTLES_DIGEST.sql / APPLY_PODCAST_ANNOUNCE_MASTERY.sql — run in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  return apiSuccess(data);
}
