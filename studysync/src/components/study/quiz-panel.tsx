"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@/types/api";
import type { Quiz, QuizAttempt } from "@/types/database";

interface QuizPanelProps {
  studyId: string;
  quizzes: Quiz[];
  /** When true, skip persist + generate-more (public share). */
  readOnly?: boolean;
}

type Mode = "quiz" | "results";

export function QuizPanel({
  studyId,
  quizzes: initial,
  readOnly = false,
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
  const [reviewIds, setReviewIds] = useState<string[] | null>(null);
  const [savedAttempt, setSavedAttempt] = useState(false);

  useEffect(() => {
    if (readOnly) return;
    void fetch(`/api/studies/${studyId}/quiz-attempt`)
      .then((r) => r.json())
      .then((json: ApiResponse<QuizAttempt | null>) => {
        if (json.success) setLastAttempt(json.data);
      });
  }, [studyId, readOnly]);

  const queue = useMemo(() => {
    if (!reviewIds) return quizzes;
    return quizzes.filter((q) => reviewIds.includes(q.id));
  }, [quizzes, reviewIds]);

  const quiz = queue[index];
  const options = Array.isArray(quiz?.options) ? quiz.options : [];
  const type = quiz?.quiz_type ?? "mcq";
  const answered = selected !== null;
  const isCorrect =
    answered &&
    selected?.trim().toLowerCase() === quiz.correct_answer.trim().toLowerCase();
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

  async function generateMore() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/studies/${studyId}/practice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 5 }),
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
      value.toLowerCase() === quiz.correct_answer.trim().toLowerCase()
    );
  }

  function recordAnswer(correct: boolean) {
    if (!quiz) return;
    setResults((prev) => ({ ...prev, [quiz.id]: correct }));
  }

  async function finishSession() {
    const ids = queue.map((q) => q.id);
    const wrong = ids.filter((id) => results[id] === false);
    const correct = ids.filter((id) => results[id] === true).length;
    const total = ids.length;
    setMode("results");
    setSavedAttempt(false);

    if (readOnly) return;

    const res = await fetch(`/api/studies/${studyId}/quiz-attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: correct,
        total,
        wrong_quiz_ids: wrong,
      }),
    });
    const json = (await res.json()) as ApiResponse<QuizAttempt>;
    if (json.success) {
      setLastAttempt(json.data);
      setSavedAttempt(true);
    }
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
  }

  if (quizzes.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No quiz questions yet.
          {readOnly ? null : " Generate practice questions from this study."}
        </p>
        {!readOnly ? (
          <Button onClick={() => void generateMore()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : null}
            Generate practice
          </Button>
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
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Session complete</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            {pct}%
          </h2>
          <p className="text-sm text-muted-foreground">
            {correct} of {total} correct
            {savedAttempt ? " · saved" : null}
          </p>
        </div>

        {wrongQuizzes.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Missed questions</h3>
            <ul className="space-y-2">
              {wrongQuizzes.map((q) => (
                <li
                  key={q.id}
                  className="border border-border/70 px-3 py-2 text-sm"
                >
                  <p className="font-medium">{q.question}</p>
                  <p className="mt-1 text-muted-foreground">
                    Answer: {q.correct_answer}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Perfect run — nice work.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => restart(true)}>
            Retry session
          </Button>
          {wrongQuizzes.length > 0 ? (
            <Button type="button" variant="outline" onClick={() => restart(false)}>
              Review wrong
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
      </div>
    );
  }

  if (!quiz) {
    return (
      <p className="text-sm text-muted-foreground">No questions in this queue.</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {!readOnly && lastAttempt ? (
        <p className="text-xs text-muted-foreground">
          Last score: {lastAttempt.score}/{lastAttempt.total} (
          {Math.round((lastAttempt.score / Math.max(1, lastAttempt.total)) * 100)}
          %)
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

      <div className="h-1.5 w-full overflow-hidden bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <h2 className="font-display text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
        {quiz.question}
      </h2>

      {type === "mcq" ? (
        <ul className="space-y-2" role="listbox" aria-label="Answer choices">
          {options.map((option) => {
            const chosen = selected === option;
            const showCorrect = answered && option === quiz.correct_answer;
            const showWrong = answered && chosen && !isCorrect;
            return (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={chosen}
                  disabled={answered}
                  onClick={() => {
                    setSelected(option);
                    recordAnswer(
                      option.trim().toLowerCase() ===
                        quiz.correct_answer.trim().toLowerCase()
                    );
                  }}
                  className={cn(
                    "w-full border px-4 py-3 text-left text-sm transition-colors",
                    !answered && "hover:bg-accent",
                    showCorrect &&
                      "border-success bg-success/15 font-medium text-foreground",
                    showWrong &&
                      "border-destructive bg-destructive/15 text-foreground"
                  )}
                >
                  {option}
                </button>
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
            Check
          </Button>
        </div>
      )}

      {answered ? (
        <div
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
            <p className="mt-1 text-muted-foreground">
              Model answer: {quiz.correct_answer}
            </p>
          ) : null}
          {quiz.explanation ? (
            <p className="mt-1 text-muted-foreground">{quiz.explanation}</p>
          ) : null}
        </div>
      ) : null}

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
          {atEnd && !readOnly ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void generateMore()}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" /> : null}
              More practice
            </Button>
          ) : null}
          {atEnd ? (
            <Button type="button" onClick={() => void finishSession()}>
              See results
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

      {Object.keys(results).length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Session so far: {sessionScore.correct} correct
        </p>
      ) : null}
    </div>
  );
}
