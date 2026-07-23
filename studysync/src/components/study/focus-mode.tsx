"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface FocusModeProps {
  studyId: string;
  active: boolean;
  onActiveChange: (next: boolean) => void;
  defaultMinutes?: number;
}

export function FocusModeControls({
  studyId,
  active,
  onActiveChange,
  defaultMinutes = 25,
}: FocusModeProps) {
  const [secondsLeft, setSecondsLeft] = useState(defaultMinutes * 60);
  const [running, setRunning] = useState(false);
  const loggedRef = useRef(false);
  const startedAt = useRef<number | null>(null);

  const logMinutes = useCallback(
    async (secs: number) => {
      const minutes = Math.max(1, Math.round(secs / 60));
      await fetch("/api/goals/daily/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes, study_id: studyId }),
      }).catch(() => undefined);
    },
    [studyId]
  );

  useEffect(() => {
    if (!active) {
      setRunning(false);
      return;
    }
    setSecondsLeft(defaultMinutes * 60);
    setRunning(true);
    loggedRef.current = false;
    startedAt.current = Date.now();
  }, [active, defaultMinutes]);

  useEffect(() => {
    if (!active || !running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          setRunning(false);
          if (!loggedRef.current && startedAt.current) {
            loggedRef.current = true;
            const elapsed = Math.round((Date.now() - startedAt.current) / 1000);
            void logMinutes(Math.max(elapsed, defaultMinutes * 60));
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [active, running, defaultMinutes, logMinutes]);

  async function exitFocus() {
    if (startedAt.current && !loggedRef.current) {
      const elapsed = Math.round((Date.now() - startedAt.current) / 1000);
      if (elapsed >= 30) {
        loggedRef.current = true;
        await logMinutes(elapsed);
      }
    }
    onActiveChange(false);
  }

  if (!active) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onActiveChange(true)}
      >
        <Maximize2 className="h-4 w-4" />
        Focus
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 border border-border/70 bg-card px-2.5 py-1 text-sm tabular-nums">
        <Timer className="h-3.5 w-3.5 text-muted-foreground" />
        {formatClock(secondsLeft)}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setRunning((v) => !v)}
      >
        {running ? "Pause" : "Resume"}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => void exitFocus()}>
        <Minimize2 className="h-4 w-4" />
        Exit focus
      </Button>
    </div>
  );
}

/** Soft-fail helper for consumers that only need to know log worked. */
export type FocusLogResult = ApiResponse<{
  minutesStudied: number;
  cardsReviewed: number;
  quizzesTaken: number;
}>;
