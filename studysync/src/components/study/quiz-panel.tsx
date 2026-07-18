"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import type { Quiz } from "@/types/database";

interface QuizPanelProps {
  quizzes: Quiz[];
}

export function QuizPanel({ quizzes }: QuizPanelProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  if (quizzes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No quiz questions generated yet.</p>
    );
  }

  const quiz = quizzes[index];
  const options = Array.isArray(quiz.options) ? quiz.options : [];
  const answered = selected !== null;
  const isCorrect = selected === quiz.correct_answer;

  function choose(option: string) {
    if (answered) return;
    setSelected(option);
  }

  function next() {
    setSelected(null);
    setIndex((i) => Math.min(quizzes.length - 1, i + 1));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Question {index + 1} of {quizzes.length}
      </p>
      <h2 className="text-xl font-semibold leading-snug">{quiz.question}</h2>

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
                onClick={() => choose(option)}
                className={cn(
                  "w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  !answered && "hover:bg-accent",
                  showCorrect && "border-success bg-success/10",
                  showWrong && "border-destructive bg-destructive/10"
                )}
              >
                {option}
              </button>
            </li>
          );
        })}
      </ul>

      {answered ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            isCorrect
              ? "border-success/40 bg-success/5"
              : "border-destructive/40 bg-destructive/5"
          )}
          role="status"
        >
          <p className="font-medium">
            {isCorrect ? "Correct" : "Not quite"}
          </p>
          {quiz.explanation ? (
            <p className="mt-1 text-muted-foreground">{quiz.explanation}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={index === 0}
          onClick={() => {
            setSelected(null);
            setIndex((i) => Math.max(0, i - 1));
          }}
        >
          Previous
        </Button>
        <Button
          type="button"
          onClick={next}
          disabled={!answered || index === quizzes.length - 1}
        >
          Next question
        </Button>
      </div>
    </div>
  );
}
