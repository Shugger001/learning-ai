import { requireAdmin, isAdminContext } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const ctx = await requireAdmin();
  if (!isAdminContext(ctx)) return ctx;
  const { admin } = ctx;

  const { data: profile, error } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", params.id)
    .maybeSingle();

  if (error) return apiError(error.message, 500);
  if (!profile) return apiError("User not found", 404);

  let email: string | null = null;
  try {
    const { data } = await admin.auth.admin.getUserById(params.id);
    email = data.user?.email ?? null;
  } catch {
    email = null;
  }

  const [
    { data: studies },
    { count: studyCount },
    { count: attemptCount },
    { data: activity },
  ] = await Promise.all([
    admin
      .from("studies")
      .select("id, title, status, content_type, created_at, error_message")
      .eq("user_id", params.id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("studies")
      .select("id", { count: "exact", head: true })
      .eq("user_id", params.id),
    admin
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", params.id),
    admin
      .from("study_activity")
      .select("*")
      .eq("user_id", params.id)
      .order("activity_date", { ascending: false })
      .limit(14),
  ]);

  return apiSuccess({
    profile,
    email,
    studyCount: studyCount ?? 0,
    attemptCount: attemptCount ?? 0,
    studies: studies ?? [],
    activity: activity ?? [],
  });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const ctx = await requireAdmin();
  if (!isAdminContext(ctx)) return ctx;
  const { admin, user } = ctx;

  if (params.id === user.id) {
    // Allow editing self except demoting own admin unless another admin exists
  }

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      plan: z.enum(["free", "pro"]).optional(),
      credits: z.number().int().min(0).max(10_000).optional(),
      uploads_used: z.number().int().min(0).optional(),
      chat_used: z.number().int().min(0).optional(),
      podcasts_used: z.number().int().min(0).optional(),
      is_admin: z.boolean().optional(),
      reset_usage: z.boolean().optional(),
    })
    .safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.plan) patch.plan = parsed.data.plan;
  if (parsed.data.credits != null) patch.credits = parsed.data.credits;
  if (parsed.data.uploads_used != null)
    patch.uploads_used = parsed.data.uploads_used;
  if (parsed.data.chat_used != null) patch.chat_used = parsed.data.chat_used;
  if (parsed.data.podcasts_used != null)
    patch.podcasts_used = parsed.data.podcasts_used;
  if (parsed.data.is_admin != null) {
    if (params.id === user.id && parsed.data.is_admin === false) {
      return apiError("You cannot remove your own admin flag", 400);
    }
    patch.is_admin = parsed.data.is_admin;
  }
  if (parsed.data.reset_usage) {
    patch.uploads_used = 0;
    patch.chat_used = 0;
    patch.podcasts_used = 0;
    patch.usage_reset_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from("profiles")
    .update(patch)
    .eq("user_id", params.id)
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("is_admin")) {
      return apiError(
        "Admin schema missing — run APPLY_ADMIN.sql in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  return apiSuccess(data);
}
