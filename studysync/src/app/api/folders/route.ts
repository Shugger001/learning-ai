import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return apiError(error.message, 500);
  return apiSuccess(data);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = z.object({ name: z.string().min(1).max(80) }).safeParse(body);
  if (!parsed.success) return apiError("Name required", 400);

  const { data, error } = await supabase
    .from("folders")
    .insert({ user_id: user.id, name: parsed.data.name })
    .select("*")
    .single();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data, 201);
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
      study_id: z.string().uuid(),
      folder_id: z.string().uuid().nullable(),
    })
    .safeParse(body);
  if (!parsed.success) return apiError("Invalid input", 400);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data, error } = await admin
    .from("studies")
    .update({ folder_id: parsed.data.folder_id })
    .eq("id", parsed.data.study_id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data);
}
