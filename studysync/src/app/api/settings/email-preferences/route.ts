import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

function newUnsubToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

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
      return apiSuccess({
        user_id: user.id,
        weekly_recap: false,
        timezone: "UTC",
        last_weekly_sent_at: null,
        unsubscribe_token: null,
      });
    }
    return apiError(error.message, 500);
  }

  return apiSuccess(
    data ?? {
      user_id: user.id,
      weekly_recap: false,
      timezone: "UTC",
      last_weekly_sent_at: null,
      unsubscribe_token: null,
    }
  );
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

  if (parsed.data.weekly_recap === true && !existing?.unsubscribe_token) {
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
    if (error.message.includes("unsubscribe_token")) {
      return apiError(
        "Unsubscribe tokens need APPLY_GRADEBOOK_ROOMS.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  return apiSuccess(data);
}
