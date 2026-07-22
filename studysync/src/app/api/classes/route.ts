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

  let memberQuery = supabase
    .from("class_members")
    .select("class_id, role, accepted_at, classes(*)")
    .eq("user_id", user.id);
  // Also match pending invites by email (escape commas for PostgREST or)
  if (user.email) {
    const safeEmail = user.email.replace(/[,()]/g, "");
    memberQuery = supabase
      .from("class_members")
      .select("class_id, role, accepted_at, classes(*)")
      .or(`user_id.eq.${user.id},email.eq.${safeEmail}`);
  }

  const [{ data: owned }, { data: memberRows }] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    memberQuery,
  ]);

  const memberClasses = (memberRows ?? [])
    .map((row) => {
      const cls = row.classes as unknown as Record<string, unknown> | null;
      if (!cls || typeof cls !== "object") return null;
      return { ...cls, member_role: row.role, accepted_at: row.accepted_at };
    })
    .filter(Boolean);

  return apiSuccess({
    owned: owned ?? [],
    joined: memberClasses.filter(
      (c) => (c as { owner_id?: string }).owner_id !== user.id
    ),
  });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({ name: z.string().min(1).max(120) })
    .safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { data, error } = await supabase
    .from("classes")
    .insert({
      owner_id: user.id,
      name: parsed.data.name.trim(),
      join_code: joinCode(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("classes") || error.code === "PGRST205") {
      return apiError(
        "Classes need APPLY_CLASSES_EMAIL.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  // Owner as teacher member
  await supabase.from("class_members").insert({
    class_id: data.id,
    user_id: user.id,
    email: user.email ?? "teacher@local",
    role: "teacher",
    accepted_at: new Date().toISOString(),
  });

  return apiSuccess(data, 201);
}
