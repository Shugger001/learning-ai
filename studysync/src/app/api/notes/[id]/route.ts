import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { updateNoteSchema } from "@/lib/validations/study";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateNoteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { data, error } = await supabase
    .from("notes")
    .update(parsed.data)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return apiError(error.message, 500);
  }

  return apiSuccess(data);
}
