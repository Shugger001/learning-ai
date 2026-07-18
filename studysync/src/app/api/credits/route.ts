import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("credits, full_name, avatar_url")
    .eq("user_id", user.id)
    .single();

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(data);
}

/** Dev/demo helper — add credits without Stripe (gated in production). */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return apiError("Use Stripe checkout in production", 403);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const body = await request.json().catch(() => ({}));
  const amount = typeof body.amount === "number" ? body.amount : 50;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("credits")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return apiError("Profile not found", 404);
  }

  const { data, error } = await admin
    .from("profiles")
    .update({ credits: profile.credits + amount })
    .eq("user_id", user.id)
    .select("credits")
    .single();

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(data);
}
