import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

interface RouteParams {
  params: { token: string };
}

const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  author_name: z.string().trim().min(1).max(80).optional(),
  invite_token: z.string().optional(),
});

export async function GET(_request: Request, { params }: RouteParams) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data: study } = await admin
    .from("studies")
    .select("id")
    .eq("share_token", params.token)
    .maybeSingle();

  if (!study) return apiError("Shared study not found", 404);

  const { data, error } = await admin
    .from("share_comments")
    .select("id, author_name, body, created_at, user_id")
    .eq("study_id", study.id)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.message.includes("share_comments") || error.code === "PGRST205") {
      return apiSuccess([]);
    }
    return apiError(error.message, 500);
  }
  return apiSuccess(data ?? []);
}

export async function POST(request: Request, { params }: RouteParams) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data: study } = await admin
    .from("studies")
    .select("id")
    .eq("share_token", params.token)
    .maybeSingle();

  if (!study) return apiError("Shared study not found", 404);

  const body = await request.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let inviteId: string | null = null;
  if (parsed.data.invite_token) {
    const { data: invite } = await admin
      .from("share_invites")
      .select("id, email, role, accepted_at")
      .eq("token", parsed.data.invite_token)
      .eq("study_id", study.id)
      .maybeSingle();

    if (!invite) return apiError("Invite not found", 404);
    if (invite.role === "viewer") {
      return apiError("This invite is view-only", 403);
    }
    inviteId = invite.id;
    if (!invite.accepted_at) {
      await admin
        .from("share_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id);
    }
  }

  const authorName =
    parsed.data.author_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Guest";

  const { data, error } = await admin
    .from("share_comments")
    .insert({
      study_id: study.id,
      user_id: user?.id ?? null,
      invite_id: inviteId,
      author_name: authorName,
      body: parsed.data.body,
    })
    .select("id, author_name, body, created_at, user_id")
    .single();

  if (error) {
    if (error.message.includes("share_comments") || error.code === "PGRST205") {
      return apiError(
        "Comments need the library/share/progress migration. Run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  return apiSuccess(data, 201);
}
