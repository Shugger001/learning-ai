import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("user_id", user.id);

  if (error) {
    if (error.message.includes("onboarding_completed")) {
      return apiError(
        "Onboarding flag missing — run APPLY_CALENDAR_ONBOARDING.sql",
        503
      );
    }
    return apiError(error.message, 500);
  }

  return apiSuccess({ completed: true });
}
