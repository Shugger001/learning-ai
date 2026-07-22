import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { awardXp } from "@/lib/progress/xp";

/** Award XP when a room battle finishes for this user. */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const result = await awardXp(user.id, { type: "battle" });
  return apiSuccess(result);
}
