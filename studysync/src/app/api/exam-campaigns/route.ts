import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { awardXp } from "@/lib/progress/xp";
import { z } from "zod";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("exam_campaigns")
    .select("*")
    .eq("user_id", user.id)
    .order("exam_at", { ascending: true });

  if (error) {
    if (
      error.message.includes("exam_campaigns") ||
      error.code === "PGRST205" ||
      error.code === "42P01"
    ) {
      return apiError(
        "Exam campaigns need APPLY_XP_EXAM_SYNC.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  return apiSuccess(data ?? []);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      title: z.string().min(1).max(120),
      exam_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      study_ids: z.array(z.string().uuid()).max(8).default([]),
    })
    .safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  if (parsed.data.study_ids.length > 0) {
    const { data: owned } = await supabase
      .from("studies")
      .select("id")
      .eq("user_id", user.id)
      .in("id", parsed.data.study_ids);
    if ((owned ?? []).length !== parsed.data.study_ids.length) {
      return apiError("Pick studies from your library", 400);
    }
  }

  const { data, error } = await supabase
    .from("exam_campaigns")
    .insert({
      user_id: user.id,
      title: parsed.data.title.trim(),
      exam_at: parsed.data.exam_at,
      study_ids: parsed.data.study_ids,
    })
    .select("*")
    .single();

  if (error) {
    if (
      error.message.includes("exam_campaigns") ||
      error.code === "PGRST205" ||
      error.code === "42P01"
    ) {
      return apiError(
        "Exam campaigns need APPLY_XP_EXAM_SYNC.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  await awardXp(user.id, { type: "exam_set" });
  return apiSuccess(data, 201);
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError("id required", 400);

  const { error } = await supabase
    .from("exam_campaigns")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return apiError(error.message, 500);
  return apiSuccess({ deleted: true });
}
