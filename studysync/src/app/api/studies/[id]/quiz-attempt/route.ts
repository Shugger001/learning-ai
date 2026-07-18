import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

interface RouteParams {
  params: { id: string };
}

const postSchema = z.object({
  score: z.number().int().min(0),
  total: z.number().int().min(1),
  wrong_quiz_ids: z.array(z.string().uuid()).default([]),
});

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data: study } = await supabase
    .from("studies")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!study) return apiError("Study not found", 404);

  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("study_id", params.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Table may not exist until product-depth migration is applied.
  if (error) {
    if (
      error.message.includes("quiz_attempts") ||
      error.code === "42P01" ||
      error.code === "PGRST205"
    ) {
      return apiSuccess(null);
    }
    return apiError(error.message, 500);
  }
  return apiSuccess(data);
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { data: study } = await supabase
    .from("studies")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!study) return apiError("Study not found", 404);

  const { score, total, wrong_quiz_ids } = parsed.data;
  if (score > total) return apiError("Score cannot exceed total", 400);

  const { data, error } = await supabase
    .from("quiz_attempts")
    .insert({
      user_id: user.id,
      study_id: params.id,
      score,
      total,
      wrong_quiz_ids,
    })
    .select("*")
    .single();

  if (error) return apiError(error.message, 500);
  return apiSuccess(data, 201);
}
