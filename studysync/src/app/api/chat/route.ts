import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { chatMessageSchema } from "@/lib/validations/study";
import { chatAboutStudy } from "@/lib/ai/generate";
import { FREE_LIMITS, isPro } from "@/lib/billing/limits";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const studyId = new URL(request.url).searchParams.get("study_id");
  if (!studyId) return apiError("study_id required", 400);

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("study_id", studyId)
    .order("created_at", { ascending: true });

  if (error) return apiError(error.message, 500);
  return apiSuccess(data);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { study_id, message } = parsed.data;

  const { data: study } = await supabase
    .from("studies")
    .select("id, transcript_text, title")
    .eq("id", study_id)
    .eq("user_id", user.id)
    .single();

  if (!study) return apiError("Study not found", 404);

  const { data: notes } = await supabase
    .from("notes")
    .select("content, summary")
    .eq("study_id", study_id)
    .maybeSingle();

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("plan, chat_used")
    .eq("user_id", user.id)
    .single();

  if (
    profile &&
    !isPro(profile.plan) &&
    (profile.chat_used ?? 0) >= FREE_LIMITS.chat
  ) {
    return apiError(
      `Free plan chat limit reached (${FREE_LIMITS.chat}). Upgrade to Pro.`,
      402
    );
  }

  await supabase.from("chat_messages").insert({
    study_id,
    user_id: user.id,
    role: "user",
    content: message,
  });

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("study_id", study_id)
    .order("created_at", { ascending: true })
    .limit(20);

  const context = [
    `Title: ${study.title}`,
    notes?.summary ? `Summary: ${notes.summary}` : "",
    notes?.content ? `Notes:\n${notes.content}` : "",
    study.transcript_text ? `Source:\n${study.transcript_text}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const answer = await chatAboutStudy({
    question: message,
    context,
    history: (history ?? [])
      .filter((h) => h.role === "user" || h.role === "assistant")
      .map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
  });

  const { data: assistantMsg, error } = await supabase
    .from("chat_messages")
    .insert({
      study_id,
      user_id: user.id,
      role: "assistant",
      content: answer,
    })
    .select("*")
    .single();

  if (error) return apiError(error.message, 500);

  if (profile) {
    await admin
      .from("profiles")
      .update({ chat_used: (profile.chat_used ?? 0) + 1 })
      .eq("user_id", user.id);
  }

  return apiSuccess(assistantMsg);
}
