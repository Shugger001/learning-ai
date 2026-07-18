import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("library_items")
    .select("id, title, subject, description, created_at")
    .order("subject");

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
  const itemId = body?.item_id as string | undefined;
  if (!itemId) return apiError("item_id required", 400);

  const { data: item } = await supabase
    .from("library_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (!item) return apiError("Library item not found", 404);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data: study, error } = await admin
    .from("studies")
    .insert({
      user_id: user.id,
      title: item.title,
      content_type: "text",
      status: "processing",
      transcript_text: item.content,
      flashcard_count: 20,
      quiz_count: 10,
      detail_level: "detailed",
      processing_progress: 5,
    })
    .select("*")
    .single();

  if (error || !study) {
    return apiError(error?.message ?? "Failed to clone library item", 500);
  }

  const origin = new URL(request.url).origin;
  const cookie = request.headers.get("cookie") ?? "";
  void fetch(`${origin}/api/process-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ study_id: study.id }),
  }).catch(() => null);

  return apiSuccess(study, 201);
}
