import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data: owned } = await supabase
    .from("classes")
    .select("id, join_code, name")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!owned) return apiError("Class not found", 404);

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({ email: z.string().email() })
    .safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const inviteToken = crypto.randomUUID().replace(/-/g, "");
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data, error } = await admin
    .from("class_members")
    .upsert(
      {
        class_id: params.id,
        email: parsed.data.email.toLowerCase(),
        role: "student",
        invite_token: inviteToken,
      },
      { onConflict: "class_id,email" }
    )
    .select("*")
    .single();

  if (error) return apiError(error.message, 500);

  const origin =
    process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  return apiSuccess({
    ...data,
    invite_url: `${origin}/classes/join?token=${inviteToken}`,
    join_url: `${origin}/classes/join?code=${owned.join_code}`,
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const memberId = new URL(request.url).searchParams.get("id");
  if (!memberId) return apiError("id required", 400);

  const { data: owned } = await supabase
    .from("classes")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!owned) return apiError("Class not found", 404);

  const { error } = await supabase
    .from("class_members")
    .delete()
    .eq("id", memberId)
    .eq("class_id", params.id);

  if (error) return apiError(error.message, 500);
  return apiSuccess({ deleted: true });
}
