"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";

type HealthPayload = {
  generatedAt: string;
  queue: {
    processing: number;
    stuck: number;
    errors: number;
    podcastsBusy: number;
    activeRooms: number;
  };
  env: Record<string, boolean>;
  latestErrors: {
    id: string;
    title: string;
    error_message: string | null;
    updated_at: string;
  }[];
};

export function AdminHealthClient() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch("/api/admin/health");
    const json = (await res.json()) as ApiResponse<HealthPayload>;
    if (!json.success) {
      setError(json.error);
      return;
    }
    setData(json.data);
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(id);
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Checking systems…</p>;

  const envEntries = Object.entries(data.env);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-accent">Health</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            System vitals
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Auto-refresh · {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          Refresh now
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ["Processing", data.queue.processing],
            ["Stuck >30m", data.queue.stuck],
            ["Errors", data.queue.errors],
            ["Podcasts busy", data.queue.podcastsBusy],
            ["Live rooms", data.queue.activeRooms],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="border border-border/70 bg-card/50 p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="border border-border/70 bg-card/40 p-4">
        <h2 className="font-display text-lg font-semibold">Environment</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {envEntries.map(([key, ok]) => (
            <li
              key={key}
              className="flex items-center justify-between border border-border/50 px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs">{key}</span>
              <span className={ok ? "text-emerald-700" : "text-destructive"}>
                {ok ? "ready" : "missing"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border border-border/70 bg-card/40 p-4">
        <h2 className="font-display text-lg font-semibold">Latest errors</h2>
        <ul className="mt-3 divide-y divide-border/50">
          {data.latestErrors.length === 0 ? (
            <li className="py-2 text-sm text-muted-foreground">Clear</li>
          ) : (
            data.latestErrors.map((e) => (
              <li key={e.id} className="py-3 text-sm">
                <Link href={`/study/${e.id}`} className="font-medium hover:underline">
                  {e.title}
                </Link>
                <p className="text-xs text-destructive">
                  {e.error_message || "Unknown"}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
