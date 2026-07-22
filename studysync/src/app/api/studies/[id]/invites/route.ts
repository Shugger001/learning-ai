import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";

interface RouteParams {
  params: { id: string };
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["viewer", "commenter", "editor"]).default("commenter"),
});

async function assertOwner(studyId: string, userId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("studies")
    .select("id, share_token, title")
    .eq("id", studyId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const study = await assertOwner(params.id, user.id);
  if (!study) return apiError("Study not found", 404);

  const { data, error } = await supabase
    .from("share_invites")
    .select("id, email, role, token, accepted_at, created_at")
    .eq("study_id", params.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("share_invites") || error.code === "PGRST205") {
      return apiSuccess([]);
    }
    return apiError(error.message, 500);
  }
  return apiSuccess(data ?? []);
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const study = await assertOwner(params.id, user.id);
  if (!study) return apiError("Study not found", 404);

  const body = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  let shareToken = study.share_token;
  if (!shareToken) {
    shareToken = crypto.randomUUID().replace(/-/g, "");
    const { error: shareError } = await admin
      .from("studies")
      .update({ share_token: shareToken })
      .eq("id", params.id);
    if (shareError) return apiError(shareError.message, 500);
  }

  const token = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await admin
    .from("share_invites")
    .insert({
      study_id: params.id,
      inviter_id: user.id,
      email: parsed.data.email.trim().toLowerCase(),
      role: parsed.data.role,
      token,
    })
    .select("id, email, role, token, accepted_at, created_at")
    .single();

  if (error) {
    if (error.message.includes("share_invites") || error.code === "PGRST205") {
      return apiError(
        "Share invites need the library/share/progress migration. Run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return apiSuccess(
    {
      ...data,
      share_token: shareToken,
      invite_url: `${origin}/share/${shareToken}?invite=${token}`,
    },
    201
  );
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const study = await assertOwner(params.id, user.id);
  if (!study) return apiError("Study not found", 404);

  const inviteId = new URL(request.url).searchParams.get("id");
  if (!inviteId) return apiError("id required", 400);

  const { error } = await supabase
    .from("share_invites")
    .delete()
    .eq("id", inviteId)
    .eq("study_id", params.id);

  if (error) return apiError(error.message, 500);
  return apiSuccess({ deleted: true });
}
