import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

function joinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("study_rooms")
    .select("*, studies(id, title, status)")
    .eq("host_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("study_rooms") || error.code === "PGRST205") {
      return apiError(
        "Study rooms need APPLY_GRADEBOOK_ROOMS.sql — run it in Supabase SQL Editor.",
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
      study_id: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
    })
    .safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { data: study } = await supabase
    .from("studies")
    .select("id, title, status")
    .eq("id", parsed.data.study_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!study || study.status !== "complete") {
    return apiError("Pick a complete study you own", 400);
  }

  const { data, error } = await supabase
    .from("study_rooms")
    .insert({
      study_id: study.id,
      host_id: user.id,
      name: parsed.data.name?.trim() || `${study.title} room`,
      join_code: joinCode(),
      is_active: true,
    })
    .select("*, studies(id, title, status)")
    .single();

  if (error) {
    if (error.message.includes("study_rooms") || error.code === "PGRST205") {
      return apiError(
        "Study rooms need APPLY_GRADEBOOK_ROOMS.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  return apiSuccess(data, 201);
}
