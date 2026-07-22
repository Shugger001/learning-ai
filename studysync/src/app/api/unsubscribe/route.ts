import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";

/** One-click unsubscribe via email token (no login required). */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) return apiError("token required", 400);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data, error } = await admin
    .from("email_preferences")
    .update({
      weekly_recap: false,
      updated_at: new Date().toISOString(),
    })
    .eq("unsubscribe_token", token)
    .select("user_id")
    .maybeSingle();

  if (error) {
    if (
      error.message.includes("unsubscribe_token") ||
      error.message.includes("email_preferences") ||
      error.code === "PGRST205"
    ) {
      return apiError(
        "Unsubscribe needs APPLY_GRADEBOOK_ROOMS.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  if (!data) return apiError("Invalid or expired unsubscribe link", 404);
  return apiSuccess({ unsubscribed: true });
}

export async function POST(request: Request) {
  return GET(request);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
