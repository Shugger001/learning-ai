import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { practiceSchema } from "@/lib/validations/study";
import { generatePracticeQuestions } from "@/lib/ai/generate";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const parsed = practiceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { data: study } = await supabase
    .from("studies")
    .select("id, transcript_text, title")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!study) return apiError("Study not found", 404);

  const { data: notes } = await supabase
    .from("notes")
    .select("content, summary")
    .eq("study_id", params.id)
    .maybeSingle();

  const source =
    notes?.content || notes?.summary || study.transcript_text || study.title;

  const quizzes = await generatePracticeQuestions({
    sourceText: source,
    count: parsed.data.count,
    types: parsed.data.types,
  });

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data: maxPos } = await admin
    .from("quizzes")
    .select("position")
    .eq("study_id", params.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const start = (maxPos?.position ?? -1) + 1;

  const { data: inserted, error } = await admin
    .from("quizzes")
    .insert(
      quizzes.map((quiz, index) => ({
        study_id: params.id,
        question: quiz.question,
        options: quiz.options?.length ? quiz.options : [],
        correct_answer: quiz.correct_answer,
        explanation: quiz.explanation,
        quiz_type: quiz.quiz_type ?? "mcq",
        position: start + index,
      }))
    )
    .select("*");

  if (error) return apiError(error.message, 500);
  return apiSuccess(inserted, 201);
}
