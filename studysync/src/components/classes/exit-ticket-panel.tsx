"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuizPanel } from "@/components/study/quiz-panel";
import type { ApiResponse } from "@/types/api";
import type { Quiz } from "@/types/database";

type ExitPayload = {
  required: boolean;
  title?: string | null;
  quizzes: Quiz[];
  progress: {
    exit_ticket_score: number | null;
    exit_ticket_total: number | null;
    exit_ticket_at: string | null;
  } | null;
};

export function ExitTicketPanel({
  classId,
  assignmentId,
}: {
  classId: string;
  assignmentId: string;
}) {
  const [data, setData] = useState<ExitPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(
      `/api/classes/${classId}/assignments/${assignmentId}/exit-ticket`
    )
      .then((r) => r.json())
      .then((json: ApiResponse<ExitPayload>) => {
        if (cancelled) return;
        if (!json.success) {
          setError(json.error);
          return;
        }
        setData(json.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [classId, assignmentId]);

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>;
  }
  if (!data) {
    return (
      <p className="text-xs text-muted-foreground">
        <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
        Checking exit ticket…
      </p>
    );
  }
  if (!data.required) return null;

  if (data.progress?.exit_ticket_at) {
    return (
      <p className="mt-2 text-xs text-emerald-700">
        Exit ticket submitted · {data.progress.exit_ticket_score}/
        {data.progress.exit_ticket_total}
      </p>
    );
  }

  if (!open) {
    return (
      <div className="mt-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Take exit ticket ({data.quizzes.length} Q)
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 border border-border/70 bg-background/50 p-3">
      <p className="mb-2 text-sm font-medium">Exit ticket</p>
      {doneMsg ? (
        <p className="text-sm text-emerald-700">{doneMsg}</p>
      ) : (
        <QuizPanel
          studyId={assignmentId}
          quizzes={data.quizzes}
          readOnly
          maxQuestions={data.quizzes.length}
          onComplete={({ score, total }) => {
            void fetch(
              `/api/classes/${classId}/assignments/${assignmentId}/exit-ticket`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ score, total }),
              }
            )
              .then((r) => r.json())
              .then((json: ApiResponse<unknown>) => {
                if (json.success) {
                  setDoneMsg(`Submitted · ${score}/${total}`);
                  setData((prev) =>
                    prev
                      ? {
                          ...prev,
                          progress: {
                            exit_ticket_score: score,
                            exit_ticket_total: total,
                            exit_ticket_at: new Date().toISOString(),
                          },
                        }
                      : prev
                  );
                } else {
                  setError(json.error);
                }
              });
          }}
        />
      )}
    </div>
  );
}
