import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("profiles")
    .select("progress_share_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes("progress_share_token") ||
      error.code === "PGRST204"
    ) {
      return apiSuccess({ token: null, url: null });
    }
    return apiError(error.message, 500);
  }

  const token = data?.progress_share_token ?? null;
  return apiSuccess({
    token,
    url: token ? `/share/progress/${token}` : null,
  });
}

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const token = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await admin
    .from("profiles")
    .update({ progress_share_token: token })
    .eq("user_id", user.id)
    .select("progress_share_token")
    .single();

  if (error) {
    if (
      error.message.includes("progress_share_token") ||
      error.code === "PGRST204"
    ) {
      return apiError(
        "Progress share needs APPLY_PLAN_VOICE_SHARE.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  return apiSuccess({
    token: data.progress_share_token,
    url: `/share/progress/${data.progress_share_token}`,
  });
}

export async function DELETE() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { error } = await supabase
    .from("profiles")
    .update({ progress_share_token: null })
    .eq("user_id", user.id);

  if (error) {
    if (error.message.includes("progress_share_token")) {
      return apiError(
        "Progress share needs APPLY_PLAN_VOICE_SHARE.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  return apiSuccess({ ok: true });
}
