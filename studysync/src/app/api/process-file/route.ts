import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import { extractTextFromBuffer } from "@/lib/ai/extract";
import {
  generateMockMaterials,
  generateStudyMaterials,
} from "@/lib/ai/generate";
import type { ContentType } from "@/types/database";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  study_id: z.string().uuid(),
});

async function setProgress(
  admin: ReturnType<typeof createAdminClient>,
  studyId: string,
  progress: number,
  patch: Record<string, unknown> = {}
) {
  await admin
    .from("studies")
    .update({ processing_progress: progress, ...patch })
    .eq("id", studyId);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError("Invalid study_id", 400);
  }

  const { study_id } = parsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data: study, error: studyError } = await admin
    .from("studies")
    .select("*")
    .eq("id", study_id)
    .eq("user_id", user.id)
    .single();

  if (studyError || !study) {
    return apiError("Study not found", 404);
  }

  try {
    await setProgress(admin, study_id, 15, { status: "processing" });

    let sourceText = study.transcript_text as string | null;

    if (!sourceText && study.file_url) {
      await setProgress(admin, study_id, 25);

      const { data: fileData, error: downloadError } = await admin.storage
        .from("lectures")
        .download(study.file_url);

      if (downloadError || !fileData) {
        throw new Error(downloadError?.message ?? "Failed to download file");
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const filename = study.file_url.split("/").pop() || "upload.bin";

      await setProgress(admin, study_id, 40);
      sourceText = await extractTextFromBuffer({
        buffer,
        contentType: study.content_type as ContentType,
        filename,
      });
    }

    if (!sourceText?.trim()) {
      throw new Error("No text could be extracted from the upload");
    }

    await setProgress(admin, study_id, 55, { transcript_text: sourceText });

    const materials = process.env.OPENAI_API_KEY
      ? await generateStudyMaterials({
          sourceText,
          flashcardCount: study.flashcard_count,
          detailLevel: study.detail_level,
          contentType: study.content_type,
        })
      : generateMockMaterials({
          sourceText,
          flashcardCount: study.flashcard_count,
          titleHint: study.title,
        });

    await setProgress(admin, study_id, 80);

    await admin.from("flashcards").delete().eq("study_id", study_id);
    await admin.from("quizzes").delete().eq("study_id", study_id);
    await admin.from("notes").delete().eq("study_id", study_id);

    const { error: notesError } = await admin.from("notes").insert({
      study_id,
      content: materials.notes,
      summary: materials.summary,
      mind_map: materials.mind_map,
    });

    if (notesError) throw new Error(notesError.message);

    const { error: flashError } = await admin.from("flashcards").insert(
      materials.flashcards.map((card, index) => ({
        study_id,
        question: card.question,
        answer: card.answer,
        difficulty: "medium" as const,
        position: index,
      }))
    );

    if (flashError) throw new Error(flashError.message);

    const { error: quizError } = await admin.from("quizzes").insert(
      materials.quizzes.map((quiz, index) => ({
        study_id,
        question: quiz.question,
        options: quiz.options,
        correct_answer: quiz.correct_answer,
        explanation: quiz.explanation,
        position: index,
      }))
    );

    if (quizError) throw new Error(quizError.message);

    await admin
      .from("studies")
      .update({
        title: materials.title || study.title,
        status: "complete",
        processing_progress: 100,
        error_message: null,
        transcript_text: sourceText,
      })
      .eq("id", study_id);

    return apiSuccess({ study_id, status: "complete" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";

    await admin
      .from("studies")
      .update({
        status: "error",
        error_message: message,
        processing_progress: 100,
      })
      .eq("id", study_id);

    return apiError(message, 500);
  }
}
