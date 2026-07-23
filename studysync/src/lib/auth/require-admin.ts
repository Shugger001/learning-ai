import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api/response";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

export type AdminContext = {
  user: User;
  profile: Profile;
  admin: ReturnType<typeof createAdminClient>;
};

function emailAllowlisted(email: string | undefined | null) {
  const raw = process.env.ADMIN_EMAILS ?? "";
  if (!raw.trim() || !email) return false;
  const set = new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
  return set.has(email.toLowerCase());
}

/** Returns admin context or a NextResponse error. */
export async function requireAdmin(): Promise<AdminContext | Response> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return apiError("Unauthorized", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const isAdmin =
    Boolean((profile as Profile | null)?.is_admin) ||
    emailAllowlisted(user.email);

  if (!isAdmin || !profile) {
    return apiError("Forbidden — admin only", 403);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Admin service role is not configured", 503);
  }

  return {
    user,
    profile: profile as Profile,
    admin,
  };
}

/** For server layouts/pages — null if not admin. */
export async function getAdminSession(): Promise<{
  user: User;
  profile: Profile;
} | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const isAdmin =
      Boolean((profile as Profile | null)?.is_admin) ||
      emailAllowlisted(user.email);

    if (!isAdmin || !profile) return null;
    return { user, profile: profile as Profile };
  } catch {
    return null;
  }
}

export function isAdminContext(
  value: AdminContext | Response
): value is AdminContext {
  return !(value instanceof Response) && "admin" in value;
}
