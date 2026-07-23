"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import type { ApiResponse } from "@/types/api";

type Metrics = {
  generatedAt: string;
  users: { total: number; pro: number; free: number; proRate: number };
  studies: {
    total: number;
    complete: number;
    processing: number;
    error: number;
    createdLast24h: number;
    byType: Record<string, number>;
  };
  engagement: {
    dau: number;
    wau: number;
    cardsWeek: number;
    quizzesWeek: number;
    minutesWeek: number;
    quizAttemptsWeek: number;
  };
  ops: { classes: number; activeRooms: number; podcastsProcessing: number };
  recentErrors: {
    id: string;
    title: string;
    error_message: string | null;
    updated_at: string;
  }[];
  stuckProcessing: {
    id: string;
    title: string;
    processing_progress: number;
    updated_at: string;
  }[];
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="border border-border/70 bg-card/50 p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
        <AnimatedNumber value={value} />
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function AdminOverviewClient() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/metrics");
    const json = (await res.json()) as ApiResponse<Metrics>;
    setLoading(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setData(json.data);
  }

  useEffect(() => {
    void load();
  }, []);

  if (error) {
    return (
      <div className="space-y-3 border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-destructive">{error}</p>
        <p className="text-muted-foreground">
          If this mentions APPLY_ADMIN.sql, run it in Supabase and set{" "}
          <code className="text-xs">is_admin = true</code> on your profile.
        </p>
        <Button type="button" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        {loading ? "Loading command center…" : "No data"}
      </p>
    );
  }

  const typeEntries = Object.entries(data.studies.byType).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-accent">
            Command center
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Platform pulse
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live ops snapshot · {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Users" value={data.users.total} hint={`${data.users.proRate}% Pro`} />
        <Stat label="DAU" value={data.engagement.dau} hint={`${data.engagement.wau} WAU`} />
        <Stat
          label="Studies"
          value={data.studies.total}
          hint={`+${data.studies.createdLast24h} last 24h`}
        />
        <Stat
          label="Errors"
          value={data.studies.error}
          hint={`${data.studies.processing} processing`}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Cards / 7d" value={data.engagement.cardsWeek} />
        <Stat label="Quiz attempts / 7d" value={data.engagement.quizAttemptsWeek} />
        <Stat label="Focus min / 7d" value={data.engagement.minutesWeek} />
        <Stat
          label="Live rooms"
          value={data.ops.activeRooms}
          hint={`${data.ops.classes} classes`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border border-border/70 bg-card/40 p-4">
          <h2 className="font-display text-lg font-semibold">Content mix</h2>
          <ul className="mt-3 space-y-2">
            {typeEntries.length === 0 ? (
              <li className="text-sm text-muted-foreground">No studies yet</li>
            ) : (
              typeEntries.map(([type, n]) => {
                const pct = data.studies.total
                  ? Math.round((n / data.studies.total) * 100)
                  : 0;
                return (
                  <li key={type}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="capitalize">{type}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {n} · {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="border border-border/70 bg-card/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Stuck processing</h2>
            <Link href="/admin/studies?status=processing" className="text-xs text-primary hover:underline">
              View queue
            </Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {data.stuckProcessing.length === 0 ? (
              <li className="text-muted-foreground">Queue looks healthy</li>
            ) : (
              data.stuckProcessing.map((s) => (
                <li key={s.id} className="flex justify-between gap-2 border-b border-border/50 py-2">
                  <span className="truncate font-medium">{s.title}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {s.processing_progress}%
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="border border-border/70 bg-card/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent failures</h2>
          <Link href="/admin/studies?status=error" className="text-xs text-primary hover:underline">
            All errors
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-border/50">
          {data.recentErrors.length === 0 ? (
            <li className="py-2 text-sm text-muted-foreground">No recent errors</li>
          ) : (
            data.recentErrors.map((s) => (
              <li key={s.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/study/${s.id}`}
                    className="font-medium hover:underline"
                  >
                    {s.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.updated_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-destructive">
                  {s.error_message || "Unknown error"}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
