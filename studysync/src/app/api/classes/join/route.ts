import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      code: z.string().min(4).max(12).optional(),
      token: z.string().min(8).optional(),
    })
    .safeParse(body);
  if (!parsed.success || (!parsed.data.code && !parsed.data.token)) {
    return apiError("code or token required", 400);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  if (parsed.data.token) {
    const { data: member } = await admin
      .from("class_members")
      .select("*, classes(*)")
      .eq("invite_token", parsed.data.token)
      .maybeSingle();
    if (!member) return apiError("Invite not found", 404);

    const { data, error } = await admin
      .from("class_members")
      .update({
        user_id: user.id,
        email: (user.email ?? member.email).toLowerCase(),
        accepted_at: new Date().toISOString(),
      })
      .eq("id", member.id)
      .select("*, classes(*)")
      .single();

    if (error) return apiError(error.message, 500);
    return apiSuccess(data);
  }

  const code = parsed.data.code!.toUpperCase();
  const { data: classroom } = await admin
    .from("classes")
    .select("*")
    .eq("join_code", code)
    .maybeSingle();
  if (!classroom) return apiError("Class code not found", 404);

  const email = (user.email ?? "").toLowerCase();
  const { data, error } = await admin
    .from("class_members")
    .upsert(
      {
        class_id: classroom.id,
        user_id: user.id,
        email: email || `user-${user.id.slice(0, 8)}@local`,
        role: "student",
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "class_id,email" }
    )
    .select("*, classes(*)")
    .single();

  if (error) return apiError(error.message, 500);
  return apiSuccess({ ...data, class: classroom });
}
