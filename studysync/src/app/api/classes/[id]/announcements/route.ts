import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { emailFrom, getResend } from "@/lib/email/resend";
import { z } from "zod";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data: classroom } = await supabase
    .from("classes")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();
  if (!classroom) return apiError("Class not found", 404);

  const { data, error } = await supabase
    .from("class_announcements")
    .select("*")
    .eq("class_id", params.id)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    if (
      error.message.includes("class_announcements") ||
      error.code === "PGRST205" ||
      error.code === "42P01"
    ) {
      return apiError(
        "Announcements need APPLY_PODCAST_ANNOUNCE_MASTERY.sql — run it in Supabase SQL Editor.",
        503
      );
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

  const { data: owned } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!owned) return apiError("Class not found", 404);

  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      body: z.string().min(1).max(2000),
      notify: z.boolean().optional(),
    })
    .safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { data, error } = await supabase
    .from("class_announcements")
    .insert({
      class_id: params.id,
      author_id: user.id,
      body: parsed.data.body.trim(),
    })
    .select("*")
    .single();

  if (error) {
    if (
      error.message.includes("class_announcements") ||
      error.code === "PGRST205"
    ) {
      return apiError(
        "Announcements need APPLY_PODCAST_ANNOUNCE_MASTERY.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  let emailed = 0;
  if (parsed.data.notify !== false) {
    const resend = getResend();
    if (resend) {
      let admin;
      try {
        admin = createAdminClient();
      } catch {
        admin = null;
      }
      if (admin) {
        const { data: members } = await admin
          .from("class_members")
          .select("email, user_id, accepted_at")
          .eq("class_id", params.id)
          .not("accepted_at", "is", null);
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          "https://studysync-alpha-opal.vercel.app";
        const unique = new Set<string>();
        for (const m of members ?? []) {
          const to = (m.email || "").trim().toLowerCase();
          if (!to || unique.has(to)) continue;
          unique.add(to);
          try {
            await resend.emails.send({
              from: emailFrom(),
              to,
              subject: `Class update · ${owned.name}`,
              html: `<p><strong>${owned.name}</strong></p><p>${escapeHtml(
                parsed.data.body.trim()
              ).replace(/\n/g, "<br/>")}</p><p><a href="${appUrl}/classes/${params.id}">Open class</a></p>`,
            });
            emailed += 1;
          } catch {
            // continue
          }
        }
      }
    }
  }

  return apiSuccess({ ...data, emailed }, 201);
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError("id required", 400);

  const { data: owned } = await supabase
    .from("classes")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!owned) return apiError("Class not found", 404);

  const { error } = await supabase
    .from("class_announcements")
    .delete()
    .eq("id", id)
    .eq("class_id", params.id);

  if (error) return apiError(error.message, 500);
  return apiSuccess({ deleted: true });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
