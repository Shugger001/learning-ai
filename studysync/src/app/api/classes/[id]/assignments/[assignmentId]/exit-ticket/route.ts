import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

interface RouteParams {
  params: { id: string; assignmentId: string };
}

/** Student submits exit-ticket quiz results for an assignment. */
export async function POST(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      score: z.number().int().min(0),
      total: z.number().int().min(1),
    })
    .safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  if (parsed.data.score > parsed.data.total) {
    return apiError("Score cannot exceed total", 400);
  }

  const { data: assignment } = await supabase
    .from("class_assignments")
    .select("id, class_id, exit_ticket_required, exit_ticket_quiz_ids")
    .eq("id", params.assignmentId)
    .eq("class_id", params.id)
    .maybeSingle();
  if (!assignment) return apiError("Assignment not found", 404);
  if (!assignment.exit_ticket_required) {
    return apiError("This assignment has no exit ticket", 400);
  }

  const { data: member } = await supabase
    .from("class_members")
    .select("id")
    .eq("class_id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return apiError("Not a class member", 403);

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("assignment_progress")
    .select("id")
    .eq("assignment_id", params.assignmentId)
    .eq("user_id", user.id)
    .maybeSingle();

  const patch = {
    exit_ticket_score: parsed.data.score,
    exit_ticket_total: parsed.data.total,
    exit_ticket_at: now,
    last_reviewed_at: now,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("assignment_progress")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) {
      if (error.message.includes("exit_ticket")) {
        return apiError(
          "Exit tickets need APPLY_HABITS_FOCUS_TICKETS.sql — run it in Supabase SQL Editor.",
          503
        );
      }
      return apiError(error.message, 500);
    }
    return apiSuccess(data);
  }

  const { data, error } = await supabase
    .from("assignment_progress")
    .insert({
      assignment_id: params.assignmentId,
      user_id: user.id,
      cards_reviewed: 0,
      ...patch,
    })
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("exit_ticket")) {
      return apiError(
        "Exit tickets need APPLY_HABITS_FOCUS_TICKETS.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }
  return apiSuccess(data, 201);
}

/** Load exit-ticket quiz questions for a student. */
export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data: assignment } = await supabase
    .from("class_assignments")
    .select(
      "id, class_id, study_id, title, exit_ticket_required, exit_ticket_quiz_ids"
    )
    .eq("id", params.assignmentId)
    .eq("class_id", params.id)
    .maybeSingle();
  if (!assignment) return apiError("Assignment not found", 404);
  if (!assignment.exit_ticket_required) {
    return apiSuccess({ required: false, quizzes: [], progress: null });
  }

  const ids = Array.isArray(assignment.exit_ticket_quiz_ids)
    ? assignment.exit_ticket_quiz_ids
    : [];

  const [{ data: quizzes }, { data: progress }] = await Promise.all([
    ids.length
      ? supabase
          .from("quizzes")
          .select("*")
          .in("id", ids)
          .eq("study_id", assignment.study_id)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from("assignment_progress")
      .select("exit_ticket_score, exit_ticket_total, exit_ticket_at")
      .eq("assignment_id", params.assignmentId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return apiSuccess({
    required: true,
    title: assignment.title,
    quizzes: quizzes ?? [],
    progress: progress ?? null,
  });
}
