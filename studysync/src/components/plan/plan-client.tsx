"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";
import type { PlanSession, WeekPlan } from "@/lib/plan/generate";

function mondayOf(date = new Date()) {
  const x = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x.toISOString().slice(0, 10);
}

function addDays(dateKey: string, n: number) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type PlanPayload = WeekPlan & { saved?: boolean; updatedAt?: string };

export function PlanClient() {
  const [weekStart, setWeekStart] = useState(mondayOf());
  const [sessions, setSessions] = useState<PlanSession[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (ws: string) => {
    const res = await fetch(`/api/plan?week_start=${ws}`);
    const json = (await res.json()) as ApiResponse<PlanPayload>;
    if (!json.success) {
      setError(json.error);
      return;
    }
    setError(null);
    setSessions(json.data.sessions ?? []);
  }, []);

  useEffect(() => {
    void load(weekStart);
  }, [weekStart, load]);

  async function generate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: weekStart }),
    });
    const json = (await res.json()) as ApiResponse<PlanPayload>;
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setSessions(json.data.sessions ?? []);
    setMessage(
      `Plan ready · ${json.data.sessions?.length ?? 0} sessions this week`
    );
  }

  const byDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    return days.map((date) => ({
      date,
      items: sessions.filter((s) => s.date === date),
    }));
  }, [weekStart, sessions]);

  const weekLabel = useMemo(() => {
    const start = new Date(`${weekStart}T00:00:00.000Z`);
    const end = new Date(`${addDays(weekStart, 6)}T00:00:00.000Z`);
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [weekStart]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Spaced plan
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Week plan
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Auto-build sessions from due cards, class assignments, and weak topics.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
        >
          Prev
        </Button>
        <p className="min-w-[10rem] text-center text-sm font-medium">{weekLabel}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
        >
          Next
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setWeekStart(mondayOf())}
        >
          This week
        </Button>
        <Button
          type="button"
          className="ml-auto"
          disabled={busy}
          onClick={() => void generate()}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate plan
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}

      <div className="space-y-4">
        {byDay.map(({ date, items }) => {
          const weekday = new Date(`${date}T12:00:00.000Z`).toLocaleDateString(
            undefined,
            { weekday: "long", month: "short", day: "numeric" }
          );
          return (
            <section key={date} className="border border-border/70 p-4">
              <h2 className="text-sm font-medium">{weekday}</h2>
              {items.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Rest / light day
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {items.map((s, i) => (
                    <li
                      key={`${s.date}-${s.title}-${i}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{s.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.minutes} min
                          {s.note ? ` · ${s.note}` : ""}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href={s.href}>Open</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/calendar">Calendar</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/review">Review today</Link>
        </Button>
      </div>
    </div>
  );
}
