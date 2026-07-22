"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bell, BellOff, CheckCircle2, Layers, ListChecks } from "lucide-react";
import { FlashcardsPanel } from "@/components/study/flashcards-panel";
import { QuizPanel } from "@/components/study/quiz-panel";
import { Button } from "@/components/ui/button";
import { fadeUp } from "@/lib/motion";
import type { ApiResponse } from "@/types/api";
import type { Flashcard, Quiz } from "@/types/database";
import type { ReviewTodayPayload } from "@/types/review";

type Phase = "cards" | "quiz" | "done";

const REMINDER_KEY = "studysync_due_reminder";
const NOTIFIED_KEY = "studysync_due_notified_date";

export function DailyReviewClient({
  initial,
}: {
  initial: ReviewTodayPayload;
}) {
  const [phase, setPhase] = useState<Phase>(
    initial.dueCards.length > 0 ? "cards" : initial.quizzes.length > 0 ? "quiz" : "done"
  );
  const [dueCards, setDueCards] = useState<Flashcard[]>(initial.dueCards);
  const [quizzes, setQuizzes] = useState<(Quiz & { study_title?: string })[]>(
    initial.quizzes
  );
  const [dueCount, setDueCount] = useState(initial.dueCount);
  const [remindersOn, setRemindersOn] = useState(false);
  const [quizStudyId, setQuizStudyId] = useState<string | null>(
    initial.quizzes[0]?.study_id ?? null
  );

  useEffect(() => {
    setRemindersOn(localStorage.getItem(REMINDER_KEY) === "1");
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/review/today");
    const json = (await res.json()) as ApiResponse<ReviewTodayPayload>;
    if (!json.success) return;
    setDueCards(json.data.dueCards);
    setQuizzes(json.data.quizzes);
    setDueCount(json.data.dueCount);
    setQuizStudyId(json.data.quizzes[0]?.study_id ?? null);
  }, []);

  async function enableReminders() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setRemindersOn(false);
      localStorage.removeItem(REMINDER_KEY);
      return;
    }
    localStorage.setItem(REMINDER_KEY, "1");
    setRemindersOn(true);
    maybeNotify(dueCount);
  }

  function disableReminders() {
    localStorage.removeItem(REMINDER_KEY);
    setRemindersOn(false);
  }

  function maybeNotify(count: number) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }
    if (localStorage.getItem(REMINDER_KEY) !== "1") return;
    if (count <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(NOTIFIED_KEY) === today) return;
    localStorage.setItem(NOTIFIED_KEY, today);
    try {
      new Notification("StudySync — cards due", {
        body: `You have ${count} flashcard${count === 1 ? "" : "s"} due today.`,
        tag: "studysync-due",
      });
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (remindersOn) maybeNotify(dueCount);
  }, [remindersOn, dueCount]);

  const quizByStudy = quizzes.filter((q) =>
    quizStudyId ? q.study_id === quizStudyId : true
  );
  const shortQuiz = quizByStudy.slice(0, 8);

  return (
    <motion.div className="space-y-8" {...fadeUp}>
      <div className="space-y-2">
        <div className="signal-bar" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Daily loop
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Review today
        </h1>
        <p className="max-w-xl text-[15px] text-muted-foreground">
          Spaced cards first, then a short quiz from the same studies.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs ${
            phase === "cards"
              ? "border-primary bg-primary/10"
              : "border-border/70 text-muted-foreground"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Cards ({dueCount})
        </span>
        <span
          className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs ${
            phase === "quiz"
              ? "border-primary bg-primary/10"
              : "border-border/70 text-muted-foreground"
          }`}
        >
          <ListChecks className="h-3.5 w-3.5" />
          Short quiz
        </span>
        <span
          className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs ${
            phase === "done"
              ? "border-primary bg-primary/10"
              : "border-border/70 text-muted-foreground"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Done
        </span>
        <div className="ml-auto">
          {remindersOn ? (
            <Button type="button" variant="outline" size="sm" onClick={disableReminders}>
              <BellOff className="h-4 w-4" />
              Reminders on
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void enableReminders()}
            >
              <Bell className="h-4 w-4" />
              Remind me daily
            </Button>
          )}
        </div>
      </div>

      {phase === "cards" ? (
        <div className="space-y-4">
          {dueCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cards due — jump to a short quiz.
            </p>
          ) : (
            <FlashcardsPanel
              flashcards={dueCards}
              compact
              onRated={() => void refresh()}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() =>
                setPhase(shortQuiz.length > 0 ? "quiz" : "done")
              }
            >
              Continue to quiz
            </Button>
            <Button asChild variant="outline">
              <Link href="/progress">Progress hub</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "quiz" ? (
        <div className="space-y-4">
          {shortQuiz.length === 0 || !quizStudyId ? (
            <p className="text-sm text-muted-foreground">
              No quiz questions available yet. Open a study and generate practice.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Short quiz from{" "}
                <span className="font-medium text-foreground">
                  {shortQuiz[0]?.study_title ?? "your studies"}
                </span>
              </p>
              <QuizPanel
                studyId={quizStudyId}
                quizzes={shortQuiz}
                maxQuestions={8}
                onComplete={() => setPhase("done")}
              />
            </>
          )}
          <Button type="button" variant="outline" onClick={() => setPhase("done")}>
            Skip to done
          </Button>
        </div>
      ) : null}

      {phase === "done" ? (
        <div className="mx-auto max-w-md space-y-4 py-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Session complete
          </h2>
          <p className="text-sm text-muted-foreground">
            Streak and activity update when you rate cards or finish a quiz.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/dashboard">Back to library</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/progress">See progress</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
