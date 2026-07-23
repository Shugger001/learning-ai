"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { ApiResponse } from "@/types/api";

type NextAction = {
  kind: string;
  label: string;
  href: string;
  reason: string;
};

export function WhatNextCoach({ studyId }: { studyId: string }) {
  const [actions, setActions] = useState<NextAction[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/studies/${studyId}/next`)
      .then((r) => r.json())
      .then(
        (
          json: ApiResponse<{
            actions: NextAction[];
          }>
        ) => {
          if (cancelled || !json.success) return;
          setActions(json.data.actions ?? []);
        }
      )
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  if (actions.length === 0) return null;

  const primary = actions[0];
  const rest = actions.slice(1, 3);

  return (
    <section className="border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            What next
          </p>
          <p className="mt-1 font-display text-lg font-semibold tracking-tight">
            {primary.label}
          </p>
          <p className="text-sm text-muted-foreground">{primary.reason}</p>
        </div>
        <Link
          href={primary.href}
          className="inline-flex items-center gap-1 border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-primary/40"
        >
          Go
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {rest.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {rest.map((a) => (
            <li key={a.kind}>
              <Link
                href={a.href}
                className="inline-block border border-border/60 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
