import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { chatMessageSchema } from "@/lib/validations/study";
import { streamChatAboutStudy } from "@/lib/ai/generate";
import { FREE_LIMITS, ensureUsagePeriod, isPro } from "@/lib/billing/limits";
import {
  isLearnerBand,
  normalizeLearningNeeds,
} from "@/lib/learner/bands";

async function buildWeakContext(
  studyId: string,
  userId: string
): Promise<string> {
  const supabase = createClient();
  const [{ data: weakCards }, { data: attempts }] = await Promise.all([
    supabase
      .from("flashcards")
      .select("question, answer, ease, difficulty")
      .eq("study_id", studyId)
      .lt("ease", 2.2)
      .order("ease", { ascending: true })
      .limit(8),
    supabase
      .from("quiz_attempts")
      .select("wrong_quiz_ids")
      .eq("user_id", userId)
      .eq("study_id", studyId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const lines: string[] = [];
  if (weakCards && weakCards.length > 0) {
    lines.push("Hard flashcards (low ease):");
    for (const c of weakCards) {
      lines.push(
        `- Q: ${c.question.slice(0, 160)} | A: ${String(c.answer).slice(0, 120)} (ease ${c.ease})`
      );
    }
  }

  const wrongIds = new Set<string>();
  for (const a of attempts ?? []) {
    if (Array.isArray(a.wrong_quiz_ids)) {
      for (const id of a.wrong_quiz_ids) wrongIds.add(String(id));
    }
  }
  if (wrongIds.size > 0) {
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("question, correct_answer")
      .eq("study_id", studyId)
      .in("id", Array.from(wrongIds).slice(0, 8));
    if (quizzes && quizzes.length > 0) {
      lines.push("Missed quiz items:");
      for (const q of quizzes) {
        lines.push(
          `- ${q.question.slice(0, 160)} (answer: ${String(q.correct_answer).slice(0, 80)})`
        );
      }
    }
  }

  return lines.join("\n") || "No weak cards or missed quizzes recorded yet.";
}

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
  const mode = parsed.data.mode === "tutor" ? "tutor" : "chat";
  const wantsStream =
    request.headers.get("accept")?.includes("text/event-stream") ||
    new URL(request.url).searchParams.get("stream") === "1";

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

  const profileSelect = await admin
    .from("profiles")
    .select("plan, chat_used, usage_reset_at, learner_band, learning_needs")
    .eq("user_id", user.id)
    .single();

  let rawProfile = profileSelect.data as {
    plan: string | null;
    chat_used: number | null;
    usage_reset_at?: string | null;
    learner_band?: string | null;
    learning_needs?: unknown;
  } | null;
  if (
    profileSelect.error?.message?.includes("usage_reset_at") ||
    profileSelect.error?.message?.includes("learner_band")
  ) {
    const fallback = await admin
      .from("profiles")
      .select("plan, chat_used")
      .eq("user_id", user.id)
      .single();
    rawProfile = fallback.data;
  }

  const profile = await ensureUsagePeriod(admin, user.id, rawProfile);

  if (
    profile &&
    !isPro(profile.plan) &&
    (profile.chat_used ?? 0) >= FREE_LIMITS.chat
  ) {
    return apiError(
      `Free plan chat limit reached (${FREE_LIMITS.chat} / 30 days). Upgrade to Pro.`,
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

  const weakContext =
    mode === "tutor" ? await buildWeakContext(study_id, user.id) : undefined;

  const historyMsgs = (history ?? [])
    .filter((h) => h.role === "user" || h.role === "assistant")
    .map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    }));

  const learnerBand = isLearnerBand(rawProfile?.learner_band)
    ? rawProfile.learner_band
    : null;
  const learningNeeds = normalizeLearningNeeds(rawProfile?.learning_needs);

  const streamParams = {
    question: message,
    context,
    history: historyMsgs,
    mode: mode as "chat" | "tutor",
    weakContext,
    learnerBand,
    simplifiedLanguage: learningNeeds.simplified_language,
  };

  if (!wantsStream) {
    let answer = "";
    for await (const chunk of streamChatAboutStudy(streamParams)) {
      answer += chunk;
    }

    const { data: assistantMsg, error } = await supabase
      .from("chat_messages")
      .insert({
        study_id,
        user_id: user.id,
        role: "assistant",
        content: answer || "I couldn't generate an answer.",
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

  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChatAboutStudy(streamParams)) {
          full += chunk;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ token: chunk })}\n\n`)
          );
        }

        const { data: assistantMsg, error } = await supabase
          .from("chat_messages")
          .insert({
            study_id,
            user_id: user.id,
            role: "assistant",
            content: full || "I couldn't generate an answer.",
          })
          .select("*")
          .single();

        if (error) throw new Error(error.message);

        if (profile) {
          await admin
            .from("profiles")
            .update({ chat_used: (profile.chat_used ?? 0) + 1 })
            .eq("user_id", user.id);
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, message: assistantMsg })}\n\n`
          )
        );
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Chat failed";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
