"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Timer } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProcessingBar } from "@/components/ui/processing-bar";
import { MarkdownMath } from "@/components/ui/markdown-math";
import type { ApiResponse } from "@/types/api";
import type { Quiz, QuizAttempt, QuizType } from "@/types/database";

const EASE = [0.22, 1, 0.36, 1] as const;

const PRACTICE_TYPES: { id: QuizType; label: string }[] = [
  { id: "mcq", label: "Multiple choice" },
  { id: "fill_blank", label: "Fill blank" },
  { id: "short_answer", label: "Short answer" },
];

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 700;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display}</>;
}

function formatClock(totalSec: number) {
  const m = Math.floor(Math.max(0, totalSec) / 60);
  const s = Math.max(0, totalSec) % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface QuizPanelProps {
  studyId: string;
  quizzes: Quiz[];
  /** When true, skip persist + generate-more (public share). */
  readOnly?: boolean;
  /** Timed exam: hide per-question feedback until the end. */
  examMode?: boolean;
  bossMode?: boolean;
  /** Exam duration in minutes (default 20). */
  examMinutes?: number;
  /** Seed queue from wrong ids (e.g. last attempt). */
  initialReviewIds?: string[] | null;
  /** Cap queue length (daily review short quiz). */
  maxQuestions?: number;
  /** Called after a saved attempt finishes. */
  onComplete?: (attempt: {
    score: number;
    total: number;
    wrongIds: string[];
  }) => void;
}

type Mode = "quiz" | "results";

export function QuizPanel({
  studyId,
  quizzes: initial,
  readOnly = false,
  examMode = false,
  bossMode = false,
  examMinutes = 20,
  initialReviewIds = null,
  maxQuestions,
  onComplete,
}: QuizPanelProps) {
  const [quizzes, setQuizzes] = useState(initial);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<Mode>("quiz");
  const [lastAttempt, setLastAttempt] = useState<QuizAttempt | null>(null);
  const [reviewIds, setReviewIds] = useState<string[] | null>(initialReviewIds);
  const [savedAttempt, setSavedAttempt] = useState(false);
  const [practiceTypes, setPracticeTypes] = useState<QuizType[]>([
    "mcq",
    "fill_blank",
    "short_answer",
  ]);
  const [secondsLeft, setSecondsLeft] = useState(
    examMode ? Math.max(1, examMinutes) * 60 : 0
  );
  const finishingRef = useRef(false);
  const finishSessionRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    setQuizzes(initial);
  }, [initial]);

  useEffect(() => {
    if (initialReviewIds?.length) setReviewIds(initialReviewIds);
  }, [initialReviewIds]);

  useEffect(() => {
    if (readOnly) return;
    void fetch(`/api/studies/${studyId}/quiz-attempt`)
      .then((r) => r.json())
      .then((json: ApiResponse<QuizAttempt | null>) => {
        if (json.success) setLastAttempt(json.data);
      })
      .catch(() => undefined);
  }, [studyId, readOnly]);

  const queue = useMemo(() => {
    let list = reviewIds
      ? quizzes.filter((q) => reviewIds.includes(q.id))
      : quizzes;
    if (maxQuestions && maxQuestions > 0) {
      list = list.slice(0, maxQuestions);
    }
    return list;
  }, [quizzes, reviewIds, maxQuestions]);

  const quiz = queue[index];
  const options = Array.isArray(quiz?.options) ? quiz.options : [];
  const type = quiz?.quiz_type ?? "mcq";
  const answered = selected !== null;
  const isCorrect =
    answered &&
    !!quiz &&
    selected?.trim().toLowerCase() ===
      (quiz.correct_answer ?? "").trim().toLowerCase();
  const atEnd = answered && index === queue.length - 1;

  const progress = useMemo(() => {
    if (!queue.length) return 0;
    return Math.round(((index + (answered ? 1 : 0)) / queue.length) * 100);
  }, [answered, index, queue.length]);

  const sessionScore = useMemo(() => {
    const ids = queue.map((q) => q.id);
    const answeredIds = ids.filter((id) => id in results);
    const correct = answeredIds.filter((id) => results[id]).length;
    return { correct, total: answeredIds.length || ids.length };
  }, [queue, results]);

  const typeBreakdown = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>();
    for (const q of queue) {
      if (!(q.id in results)) continue;
      const key = q.quiz_type ?? "mcq";
      const row = map.get(key) ?? { correct: 0, total: 0 };
      row.total += 1;
      if (results[q.id]) row.correct += 1;
      map.set(key, row);
    }
    return Array.from(map.entries());
  }, [queue, results]);

  const finishSession = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const ids = queue.map((q) => q.id);
    const wrong = ids.filter((id) => results[id] === false);
    const unanswered = ids.filter((id) => !(id in results));
    const allWrong = [...wrong, ...unanswered];
    const correct = ids.filter((id) => results[id] === true).length;
    const total = ids.length;
    setMode("results");
    setSavedAttempt(false);

    onComplete?.({ score: correct, total, wrongIds: allWrong });

    if (readOnly) {
      finishingRef.current = false;
      return;
    }

    const res = await fetch(`/api/studies/${studyId}/quiz-attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: correct,
        total,
        wrong_quiz_ids: allWrong,
        boss: bossMode,
      }),
    });
    const json = (await res.json()) as ApiResponse<QuizAttempt>;
    if (json.success) {
      setLastAttempt(json.data);
      setSavedAttempt(true);
    }
    finishingRef.current = false;
  }, [queue, results, readOnly, studyId, onComplete, bossMode]);

  finishSessionRef.current = finishSession;

  useEffect(() => {
    if (!examMode || mode !== "quiz" || queue.length === 0) return;
    setSecondsLeft(Math.max(1, examMinutes) * 60);
    finishingRef.current = false;
  }, [examMode, examMinutes, mode, queue.length]);

  useEffect(() => {
    if (!examMode || mode !== "quiz") return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          void finishSessionRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [examMode, mode]);

  function togglePracticeType(id: QuizType) {
    setPracticeTypes((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== id);
      }
      return [...prev, id];
    });
  }

  function PracticeTypePicker() {
    return (
      <div className="flex flex-wrap gap-2">
        {PRACTICE_TYPES.map(({ id, label }) => {
          const active = practiceTypes.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => togglePracticeType(id)}
              className={cn(
                "border px-2.5 py-1 text-xs transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/70 text-muted-foreground hover:bg-muted/40"
              )}
              aria-pressed={active}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  async function generateMore() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/studies/${studyId}/practice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 5, types: practiceTypes }),
    });
    const json = (await res.json()) as ApiResponse<Quiz[]>;
    setLoading(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setQuizzes((prev) => [...prev, ...json.data]);
  }

  function submitTyped() {
    if (!typed.trim() || !quiz) return;
    const value = typed.trim();
    setSelected(value);
    recordAnswer(
      value.toLowerCase() === (quiz.correct_answer ?? "").trim().toLowerCase()
    );
  }

  function recordAnswer(correct: boolean) {
    if (!quiz) return;
    setResults((prev) => ({ ...prev, [quiz.id]: correct }));
  }

  function restart(all = true) {
    const wrong = all
      ? null
      : Object.keys(results).filter((id) => results[id] === false);
    setIndex(0);
    setSelected(null);
    setTyped("");
    setResults({});
    setReviewIds(wrong && wrong.length ? wrong : null);
    setMode("quiz");
    setSavedAttempt(false);
    finishingRef.current = false;
    if (examMode) setSecondsLeft(Math.max(1, examMinutes) * 60);
  }

  if (quizzes.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No quiz questions yet.
          {readOnly ? null : " Generate practice questions from this study."}
        </p>
        {!readOnly ? (
          <>
            <PracticeTypePicker />
            <Button onClick={() => void generateMore()} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              Generate practice
            </Button>
          </>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  if (mode === "results") {
    const ids = queue.map((q) => q.id);
    const correct = ids.filter((id) => results[id]).length;
    const total = ids.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const wrongQuizzes = quizzes.filter((q) => results[q.id] === false);

    return (
      <motion.div
        className="mx-auto max-w-2xl space-y-6"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {examMode ? "Exam complete" : "Session complete"}
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            <CountUp value={pct} />%
          </h2>
          <p className="text-sm text-muted-foreground">
            {correct} of {total} correct
            {savedAttempt ? " · saved" : null}
          </p>
        </div>

        {typeBreakdown.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Breakdown</h3>
            <ul className="grid gap-2 sm:grid-cols-3">
              {typeBreakdown.map(([t, row]) => (
                <li
                  key={t}
                  className="border border-border/70 px-3 py-2 text-sm"
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.replace("_", " ")}
                  </p>
                  <p className="mt-1 font-medium tabular-nums">
                    {row.correct}/{row.total}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {wrongQuizzes.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Missed questions</h3>
            <ul className="space-y-2">
              {wrongQuizzes.map((q) => (
                <li
                  key={q.id}
                  className="border border-border/70 px-3 py-2 text-sm"
                >
                  <MarkdownMath className="font-medium">{q.question}</MarkdownMath>
                  <div className="mt-1 text-muted-foreground">
                    Answer: <MarkdownMath inline>{q.correct_answer}</MarkdownMath>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Perfect run - nice work.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => restart(true)}>
            Retry session
          </Button>
          {wrongQuizzes.length > 0 ? (
            <Button type="button" variant="outline" onClick={() => restart(false)}>
              Retry wrong only
            </Button>
          ) : null}
          {!readOnly && wrongQuizzes.length > 0 ? (
            <Button asChild variant="outline">
              <Link href={`/study/${studyId}?tab=chat`}>
                Explain my mistakes
              </Link>
            </Button>
          ) : null}
        </div>
      </motion.div>
    );
  }

  if (!quiz) {
    return (
      <p className="text-sm text-muted-foreground">No questions in this queue.</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {examMode ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-border/70 bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium">Exam mode</span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 tabular-nums",
              secondsLeft <= 60 ? "text-destructive" : "text-muted-foreground"
            )}
          >
            <Timer className="h-3.5 w-3.5" />
            {formatClock(secondsLeft)}
          </span>
        </div>
      ) : !readOnly && lastAttempt ? (
        <p className="text-xs text-muted-foreground">
          Last score: {lastAttempt.score}/{lastAttempt.total} (
          {Math.round((lastAttempt.score / Math.max(1, lastAttempt.total)) * 100)}
          %)
          {Array.isArray(lastAttempt.wrong_quiz_ids) &&
          lastAttempt.wrong_quiz_ids.length > 0 ? (
            <>
              {" · "}
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                onClick={() => {
                  setReviewIds(lastAttempt.wrong_quiz_ids);
                  setIndex(0);
                  setSelected(null);
                  setTyped("");
                  setResults({});
                  setMode("quiz");
                }}
              >
                retry wrong
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          Question {index + 1} of {queue.length}
          {reviewIds ? " · review" : null}
        </span>
        <span className="rounded-sm border border-border/70 bg-muted/40 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-foreground/80">
          {type.replace("_", " ")}
        </span>
      </div>

      <ProcessingBar value={progress} shimmer={false} className="h-1.5" />

      <AnimatePresence mode="wait">
        <motion.div
          key={quiz.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="space-y-6"
        >
          <h2 className="font-display text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
            <MarkdownMath>{quiz.question}</MarkdownMath>
          </h2>

          {type === "mcq" ? (
            <ul className="space-y-2" role="listbox" aria-label="Answer choices">
              {options.map((option) => {
                const chosen = selected === option;
                const showCorrect =
                  !examMode && answered && option === quiz.correct_answer;
                const showWrong =
                  !examMode && answered && chosen && !isCorrect;
                return (
                  <li key={option}>
                    <motion.button
                      type="button"
                      role="option"
                      aria-selected={chosen}
                      disabled={answered}
                      onClick={() => {
                        setSelected(option);
                        recordAnswer(
                          option.trim().toLowerCase() ===
                            (quiz.correct_answer ?? "").trim().toLowerCase()
                        );
                      }}
                      animate={
                        showCorrect
                          ? {
                              scale: [1, 1.02, 1],
                              borderColor: "hsl(var(--success))",
                            }
                          : showWrong
                            ? { scale: [1, 0.98, 1] }
                            : { scale: 1 }
                      }
                      transition={{ duration: 0.35, ease: EASE }}
                      className={cn(
                        "w-full border px-4 py-3 text-left text-sm transition-colors",
                        !answered && "hover:bg-accent",
                        chosen && examMode && "border-primary bg-primary/10",
                        showCorrect &&
                          "border-success bg-success/15 font-medium text-foreground",
                        showWrong &&
                          "border-destructive bg-destructive/15 text-foreground"
                      )}
                    >
                      <MarkdownMath inline>{option}</MarkdownMath>
                    </motion.button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex gap-2">
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={answered}
                placeholder={
                  type === "fill_blank" ? "Type the missing word…" : "Your answer…"
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitTyped();
                }}
              />
              <Button type="button" onClick={submitTyped} disabled={answered}>
                {examMode ? "Lock in" : "Check"}
              </Button>
            </div>
          )}

          {answered && !examMode ? (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: EASE }}
              className={cn(
                "border px-4 py-3 text-sm",
                isCorrect
                  ? "border-success/50 bg-success/10"
                  : "border-destructive/50 bg-destructive/10"
              )}
              role="status"
            >
              <p
                className={cn(
                  "font-semibold",
                  isCorrect ? "text-success" : "text-destructive"
                )}
              >
                {isCorrect ? "Correct" : "Not quite"}
              </p>
              {!isCorrect ? (
                <div className="mt-1 text-muted-foreground">
                  Model answer:{" "}
                  <MarkdownMath inline>{quiz.correct_answer}</MarkdownMath>
                </div>
              ) : null}
              {quiz.explanation ? (
                <MarkdownMath className="mt-1 text-muted-foreground">
                  {quiz.explanation}
                </MarkdownMath>
              ) : null}
            </motion.div>
          ) : null}

          {answered && examMode ? (
            <p className="text-xs text-muted-foreground">Answer locked in.</p>
          ) : null}
        </motion.div>
      </AnimatePresence>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={index === 0}
          onClick={() => {
            setSelected(null);
            setTyped("");
            setIndex((i) => Math.max(0, i - 1));
          }}
        >
          Previous
        </Button>
        <div className="flex gap-2">
          {atEnd && !readOnly && !examMode ? (
            <div className="flex flex-col items-end gap-2">
              <PracticeTypePicker />
              <Button
                type="button"
                variant="outline"
                onClick={() => void generateMore()}
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" /> : null}
                More practice
              </Button>
            </div>
          ) : null}
          {atEnd ? (
            <Button type="button" onClick={() => void finishSession()}>
              {examMode ? "Submit exam" : "See results"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                setSelected(null);
                setTyped("");
                setIndex((i) => Math.min(queue.length - 1, i + 1));
              }}
              disabled={!answered}
            >
              Next question
            </Button>
          )}
        </div>
      </div>

      {!examMode && Object.keys(results).length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Session so far: {sessionScore.correct} correct
        </p>
      ) : null}
    </div>
  );
}
