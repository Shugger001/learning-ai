import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

interface RouteParams {
  params: { id: string };
}

export async function POST(_request: Request, { params }: RouteParams) {
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
    .from("studies")
    .update({ share_token: token })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id, share_token, title")
    .single();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { error } = await supabase
    .from("studies")
    .update({ share_token: null })
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) return apiError(error.message, 500);
  return apiSuccess({ ok: true });
}
