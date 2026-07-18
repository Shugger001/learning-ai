"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@/types/api";
import type { Quiz } from "@/types/database";

interface QuizPanelProps {
  studyId: string;
  quizzes: Quiz[];
}

export function QuizPanel({ studyId, quizzes: initial }: QuizPanelProps) {
  const [quizzes, setQuizzes] = useState(initial);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quiz = quizzes[index];
  const options = Array.isArray(quiz?.options) ? quiz.options : [];
  const type = quiz?.quiz_type ?? "mcq";
  const answered = selected !== null;
  const isCorrect =
    answered &&
    selected?.trim().toLowerCase() === quiz.correct_answer.trim().toLowerCase();
  const atEnd = answered && index === quizzes.length - 1;

  const progress = useMemo(() => {
    if (!quizzes.length) return 0;
    return Math.round(((index + (answered ? 1 : 0)) / quizzes.length) * 100);
  }, [answered, index, quizzes.length]);

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
    if (!typed.trim()) return;
    setSelected(typed.trim());
  }

  if (quizzes.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No quiz questions yet. Generate practice questions from this study.
        </p>
        <Button onClick={() => void generateMore()} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          Generate practice
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          Question {index + 1} of {quizzes.length}
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
                  onClick={() => setSelected(option)}
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
          {atEnd ? (
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
          <Button
            type="button"
            onClick={() => {
              setSelected(null);
              setTyped("");
              setIndex((i) => Math.min(quizzes.length - 1, i + 1));
            }}
            disabled={!answered || index === quizzes.length - 1}
          >
            Next question
          </Button>
        </div>
      </div>
    </div>
  );
}
