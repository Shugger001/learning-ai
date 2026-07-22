"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@/types/api";
import type { DailyGoal } from "@/lib/goals/daily";

type GoalPayload = {
  goal: DailyGoal;
  progress: { cardsReviewed: number; quizzesTaken: number };
  freeMinutes: number;
};

export function DailyGoalCard({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<GoalPayload | null>(null);
  const [minutes, setMinutes] = useState(25);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/goals/daily");
    const json = (await res.json()) as ApiResponse<GoalPayload>;
    if (!json.success) return;
    setData(json.data);
    setMinutes(json.data.freeMinutes);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMinutes() {
    setMessage(null);
    const res = await fetch("/api/goals/daily", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ free_minutes: minutes }),
    });
    const json = (await res.json()) as ApiResponse<{ free_minutes: number }>;
    if (!json.success) {
      setMessage(json.error);
      return;
    }
    setMessage("Free time updated");
    await load();
  }

  if (!data) return null;

  const { goal, progress } = data;
  const cardPct = Math.min(
    100,
    Math.round((progress.cardsReviewed / Math.max(1, goal.cardTarget)) * 100)
  );

  return (
    <div className="space-y-3 border border-border/70 bg-card/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <Target className="h-3.5 w-3.5" />
            Today&apos;s goal
          </p>
          <p className="mt-1 font-display text-xl font-semibold tracking-tight">
            {goal.cardTarget} cards · {goal.quizTarget} quiz Qs
          </p>
          <p className="text-xs text-muted-foreground">{goal.reason}</p>
        </div>
        {!compact ? (
          <Button asChild size="sm">
            <Link href="/review">Start</Link>
          </Button>
        ) : null}
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>
            {progress.cardsReviewed}/{goal.cardTarget} cards
          </span>
          <span>{cardPct}%</span>
        </div>
        <div className="h-1.5 w-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${cardPct}%` }} />
        </div>
      </div>
      {!compact ? (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="free-min">
              Free minutes today
            </label>
            <Input
              id="free-min"
              type="number"
              min={10}
              max={120}
              className="h-9 w-24"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) || 25)}
            />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void saveMinutes()}>
            Recalc
          </Button>
          {message ? (
            <p className="text-xs text-muted-foreground">{message}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
