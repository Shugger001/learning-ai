import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

interface RouteParams {
  params: { code: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const code = params.code.trim().toUpperCase();
  const { data: room } = await supabase
    .from("study_rooms")
    .select("id, study_id")
    .eq("join_code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (!room) return apiError("Room not found", 404);

  const { data: battle, error } = await supabase
    .from("quiz_battles")
    .select("*")
    .eq("room_id", room.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.message.includes("quiz_battles") || error.code === "PGRST205") {
      return apiError(
        "Quiz battles need APPLY_GOALS_BATTLES_DIGEST.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  if (!battle) return apiSuccess({ battle: null, quizzes: [] });

  // Expire stale battles
  if (new Date(battle.ends_at).getTime() < Date.now()) {
    await supabase
      .from("quiz_battles")
      .update({ status: "finished" })
      .eq("id", battle.id);
    return apiSuccess({ battle: null, quizzes: [] });
  }

  const quizIds = Array.isArray(battle.quiz_ids)
    ? (battle.quiz_ids as string[])
    : [];
  let quizzes: unknown[] = [];
  if (quizIds.length > 0) {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return apiError("Server misconfigured", 500);
    }
    const { data } = await admin
      .from("quizzes")
      .select("*")
      .eq("study_id", room.study_id)
      .in("id", quizIds);
    const order = new Map(quizIds.map((id, i) => [id, i]));
    quizzes = (data ?? []).sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    );
  }

  return apiSuccess({ battle, quizzes });
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const code = params.code.trim().toUpperCase();
  const body = await request.json().catch(() => ({}));
  const parsed = z
    .object({
      duration_sec: z.number().int().min(60).max(600).optional(),
      count: z.number().int().min(3).max(15).optional(),
    })
    .safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { data: room } = await supabase
    .from("study_rooms")
    .select("id, study_id, host_id")
    .eq("join_code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (!room) return apiError("Room not found", 404);
  if (room.host_id !== user.id) {
    return apiError("Only the host can start a battle", 403);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  // Finish any active battle first
  await admin
    .from("quiz_battles")
    .update({ status: "finished" })
    .eq("room_id", room.id)
    .eq("status", "active");

  const count = parsed.data.count ?? 8;
  const duration = parsed.data.duration_sec ?? 120;
  const { data: quizPool } = await admin
    .from("quizzes")
    .select("id")
    .eq("study_id", room.study_id)
    .order("position", { ascending: true })
    .limit(40);

  const shuffled = [...(quizPool ?? [])].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));
  if (picked.length < 3) {
    return apiError("Need at least 3 quiz questions in this study", 400);
  }

  const endsAt = new Date(Date.now() + duration * 1000).toISOString();
  const { data: battle, error } = await admin
    .from("quiz_battles")
    .insert({
      room_id: room.id,
      study_id: room.study_id,
      host_id: user.id,
      quiz_ids: picked.map((q) => q.id),
      duration_sec: duration,
      status: "active",
      ends_at: endsAt,
    })
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("quiz_battles") || error.code === "PGRST205") {
      return apiError(
        "Quiz battles need APPLY_GOALS_BATTLES_DIGEST.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  const { data: quizzes } = await admin
    .from("quizzes")
    .select("*")
    .in(
      "id",
      picked.map((q) => q.id)
    );

  const order = new Map(picked.map((q, i) => [q.id, i]));
  const ordered = (quizzes ?? []).sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
  );

  return apiSuccess({ battle, quizzes: ordered }, 201);
}
