"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils/cn";
import type { ApiResponse } from "@/types/api";
import type { CalendarDay } from "@/types/calendar";

function startOfWeek(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function keyOf(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function WeekCalendar({
  initialDays,
  initialWeekStart,
}: {
  initialDays: CalendarDay[];
  initialWeekStart: string;
}) {
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [days, setDays] = useState(initialDays);
  const [loading, setLoading] = useState(false);

  const weekLabel = useMemo(() => {
    const start = new Date(`${weekStart}T00:00:00.000Z`);
    const end = addDays(start, 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [weekStart]);

  useEffect(() => {
    if (weekStart === initialWeekStart) return;
    const start = new Date(`${weekStart}T00:00:00.000Z`);
    const end = addDays(start, 6);
    setLoading(true);
    void fetch(
      `/api/review/calendar?from=${keyOf(start)}&to=${keyOf(end)}`
    )
      .then((r) => r.json())
      .then((json: ApiResponse<CalendarDay[]>) => {
        if (json.success) setDays(json.data);
      })
      .finally(() => setLoading(false));
  }, [weekStart, initialWeekStart]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <motion.div className="space-y-8" {...fadeUp}>
      <div className="space-y-2">
        <div className="signal-bar" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Schedule
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Study calendar
        </h1>
        <p className="max-w-xl text-[15px] text-muted-foreground">
          Due cards and upcoming spaced-recall blocks. Tap a day to open review.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setWeekStart(keyOf(addDays(new Date(`${weekStart}T00:00:00.000Z`), -7)))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-[10rem] text-center text-sm font-medium">{weekLabel}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setWeekStart(keyOf(addDays(new Date(`${weekStart}T00:00:00.000Z`), 7)))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setWeekStart(keyOf(startOfWeek(new Date())))}
        >
          This week
        </Button>
      </div>

      <div
        className={cn(
          "grid gap-2 sm:grid-cols-7",
          loading && "opacity-60"
        )}
      >
        {days.map((day) => {
          const total = day.dueCount + day.plannedCount;
          const isToday = day.date === today;
          const weekday = new Date(`${day.date}T12:00:00.000Z`).toLocaleDateString(
            undefined,
            { weekday: "short" }
          );
          const dayNum = new Date(`${day.date}T12:00:00.000Z`).getUTCDate();
          return (
            <Link
              key={day.date}
              href={`/review?date=${day.date}`}
              className={cn(
                "flex min-h-[7.5rem] flex-col border border-border/70 bg-card/40 p-3 transition-colors hover:border-primary/40 hover:bg-accent/30",
                isToday && "border-primary/50 bg-primary/5"
              )}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{weekday}</span>
                <span className={cn("font-medium", isToday && "text-primary")}>
                  {dayNum}
                </span>
              </div>
              <div className="mt-auto space-y-1 pt-4">
                {day.dueCount > 0 ? (
                  <p className="text-xs font-medium text-foreground">
                    {day.dueCount} due
                  </p>
                ) : null}
                {day.plannedCount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {day.plannedCount} planned
                  </p>
                ) : null}
                {total === 0 ? (
                  <p className="text-xs text-muted-foreground">Clear</p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/review">Review today</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/plan">Generate week plan</Link>
        </Button>
      </div>
    </motion.div>
  );
}
