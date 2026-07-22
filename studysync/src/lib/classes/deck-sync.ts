import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function contentKey(question: string) {
  const normalized = question.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

type AdminLike = SupabaseClient;

/** Copy teacher pack into a student-owned study, preserving content keys. */
export async function cloneTeacherPack(params: {
  admin: AdminLike;
  teacherStudyId: string;
  studentUserId: string;
  title?: string | null;
}) {
  const { admin, teacherStudyId, studentUserId } = params;

  const { data: teacher, error: teacherErr } = await admin
    .from("studies")
    .select("*")
    .eq("id", teacherStudyId)
    .maybeSingle();
  if (teacherErr || !teacher) {
    throw new Error(teacherErr?.message ?? "Teacher study not found");
  }

  const { data: studentStudy, error: studyErr } = await admin
    .from("studies")
    .insert({
      user_id: studentUserId,
      title: params.title?.trim() || teacher.title,
      content_type: teacher.content_type,
      status: "complete",
      file_url: null,
      source_url: teacher.source_url,
      transcript_text: teacher.transcript_text,
      flashcard_count: teacher.flashcard_count,
      quiz_count: teacher.quiz_count,
      detail_level: teacher.detail_level,
      processing_progress: 100,
      source_study_id: teacher.id,
      pack_version: Number(teacher.pack_version ?? 1),
    })
    .select("*")
    .single();

  if (studyErr || !studentStudy) {
    throw new Error(studyErr?.message ?? "Failed to create student copy");
  }

  const [{ data: cards }, { data: quizzes }, { data: notes }] =
    await Promise.all([
      admin
        .from("flashcards")
        .select(
          "question, answer, difficulty, position, content_key"
        )
        .eq("study_id", teacherStudyId)
        .order("position", { ascending: true }),
      admin
        .from("quizzes")
        .select(
          "question, options, correct_answer, explanation, quiz_type, position, content_key"
        )
        .eq("study_id", teacherStudyId)
        .order("position", { ascending: true }),
      admin
        .from("notes")
        .select("content, summary, mind_map")
        .eq("study_id", teacherStudyId)
        .maybeSingle(),
    ]);

  const now = new Date().toISOString();
  if (cards && cards.length > 0) {
    const { error } = await admin.from("flashcards").insert(
      cards.map((c, i) => ({
        study_id: studentStudy.id,
        question: c.question,
        answer: c.answer,
        difficulty: c.difficulty ?? "medium",
        position: c.position ?? i,
        content_key: c.content_key || contentKey(c.question),
        ease: 2.5,
        interval_days: 0,
        reps: 0,
        due_at: now,
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (quizzes && quizzes.length > 0) {
    const { error } = await admin.from("quizzes").insert(
      quizzes.map((q, i) => ({
        study_id: studentStudy.id,
        question: q.question,
        options: q.options ?? [],
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        quiz_type: q.quiz_type ?? "mcq",
        position: q.position ?? i,
        content_key: q.content_key || contentKey(q.question),
      }))
    );
    if (error) throw new Error(error.message);
  }

  if (notes) {
    await admin.from("notes").insert({
      study_id: studentStudy.id,
      content: notes.content,
      summary: notes.summary,
      mind_map: notes.mind_map,
    });
  }

  // Backfill content keys on teacher pack for future syncs
  await ensureTeacherContentKeys(admin, teacherStudyId);

  return studentStudy;
}

async function ensureTeacherContentKeys(
  admin: AdminLike,
  teacherStudyId: string
) {
  const { data: cards } = await admin
    .from("flashcards")
    .select("id, question, content_key")
    .eq("study_id", teacherStudyId)
    .is("content_key", null);
  for (const c of cards ?? []) {
    await admin
      .from("flashcards")
      .update({ content_key: contentKey(c.question) })
      .eq("id", c.id);
  }

  const { data: quizzes } = await admin
    .from("quizzes")
    .select("id, question, content_key")
    .eq("study_id", teacherStudyId)
    .is("content_key", null);
  for (const q of quizzes ?? []) {
    await admin
      .from("quizzes")
      .update({ content_key: contentKey(q.question) })
      .eq("id", q.id);
  }
}

/**
 * Push teacher content into student copy.
 * Updates Q/A for matching content_key; keeps student SRS fields.
 * Adds new cards/quizzes; never deletes student cards.
 */
export async function syncStudentPack(params: {
  admin: AdminLike;
  teacherStudyId: string;
  studentStudyId: string;
}) {
  const { admin, teacherStudyId, studentStudyId } = params;
  await ensureTeacherContentKeys(admin, teacherStudyId);

  const [
    { data: teacherCards },
    { data: studentCards },
    { data: teacherQuizzes },
    { data: studentQuizzes },
    { data: teacherNotes },
    { data: teacherStudy },
  ] = await Promise.all([
    admin
      .from("flashcards")
      .select("question, answer, difficulty, position, content_key")
      .eq("study_id", teacherStudyId),
    admin
      .from("flashcards")
      .select("id, content_key, ease, interval_days, reps, due_at")
      .eq("study_id", studentStudyId),
    admin
      .from("quizzes")
      .select(
        "question, options, correct_answer, explanation, quiz_type, position, content_key"
      )
      .eq("study_id", teacherStudyId),
    admin
      .from("quizzes")
      .select("id, content_key")
      .eq("study_id", studentStudyId),
    admin
      .from("notes")
      .select("content, summary, mind_map")
      .eq("study_id", teacherStudyId)
      .maybeSingle(),
    admin
      .from("studies")
      .select("title, flashcard_count, quiz_count, pack_version, transcript_text, detail_level")
      .eq("id", teacherStudyId)
      .maybeSingle(),
  ]);

  const studentByKey = new Map(
    (studentCards ?? [])
      .filter((c) => c.content_key)
      .map((c) => [c.content_key as string, c])
  );

  let addedCards = 0;
  let updatedCards = 0;
  const now = new Date().toISOString();

  for (const tc of teacherCards ?? []) {
    const key = tc.content_key || contentKey(tc.question);
    const existing = studentByKey.get(key);
    if (existing) {
      await admin
        .from("flashcards")
        .update({
          question: tc.question,
          answer: tc.answer,
          difficulty: tc.difficulty,
          position: tc.position,
          content_key: key,
        })
        .eq("id", existing.id);
      updatedCards += 1;
    } else {
      await admin.from("flashcards").insert({
        study_id: studentStudyId,
        question: tc.question,
        answer: tc.answer,
        difficulty: tc.difficulty ?? "medium",
        position: tc.position ?? 0,
        content_key: key,
        ease: 2.5,
        interval_days: 0,
        reps: 0,
        due_at: now,
      });
      addedCards += 1;
    }
  }

  const quizByKey = new Map(
    (studentQuizzes ?? [])
      .filter((q) => q.content_key)
      .map((q) => [q.content_key as string, q])
  );

  let addedQuizzes = 0;
  let updatedQuizzes = 0;

  for (const tq of teacherQuizzes ?? []) {
    const key = tq.content_key || contentKey(tq.question);
    const existing = quizByKey.get(key);
    if (existing) {
      await admin
        .from("quizzes")
        .update({
          question: tq.question,
          options: tq.options ?? [],
          correct_answer: tq.correct_answer,
          explanation: tq.explanation,
          quiz_type: tq.quiz_type ?? "mcq",
          position: tq.position,
          content_key: key,
        })
        .eq("id", existing.id);
      updatedQuizzes += 1;
    } else {
      await admin.from("quizzes").insert({
        study_id: studentStudyId,
        question: tq.question,
        options: tq.options ?? [],
        correct_answer: tq.correct_answer,
        explanation: tq.explanation,
        quiz_type: tq.quiz_type ?? "mcq",
        position: tq.position ?? 0,
        content_key: key,
      });
      addedQuizzes += 1;
    }
  }

  if (teacherNotes) {
    const { data: existingNotes } = await admin
      .from("notes")
      .select("id")
      .eq("study_id", studentStudyId)
      .maybeSingle();
    if (existingNotes) {
      await admin
        .from("notes")
        .update({
          content: teacherNotes.content,
          summary: teacherNotes.summary,
          mind_map: teacherNotes.mind_map,
        })
        .eq("id", existingNotes.id);
    } else {
      await admin.from("notes").insert({
        study_id: studentStudyId,
        content: teacherNotes.content,
        summary: teacherNotes.summary,
        mind_map: teacherNotes.mind_map,
      });
    }
  }

  if (teacherStudy) {
    await admin
      .from("studies")
      .update({
        title: teacherStudy.title,
        flashcard_count: teacherStudy.flashcard_count,
        quiz_count: teacherStudy.quiz_count,
        pack_version: Number(teacherStudy.pack_version ?? 1),
        transcript_text: teacherStudy.transcript_text,
        detail_level: teacherStudy.detail_level,
      })
      .eq("id", studentStudyId);
  }

  return {
    addedCards,
    updatedCards,
    addedQuizzes,
    updatedQuizzes,
    packVersion: Number(teacherStudy?.pack_version ?? 1),
  };
}
