"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";
import type { Study } from "@/types/database";

type CompareSide = {
  studyId: string;
  title: string;
  dueCount: number;
  weakCount: number;
  cardCount: number;
  masteryScore: number;
  recentScore: number | null;
};

export function CompareClient({ studies }: { studies: Study[] }) {
  const ready = useMemo(
    () => studies.filter((s) => s.status === "complete"),
    [studies]
  );
  const [a, setA] = useState(ready[0]?.id ?? "");
  const [b, setB] = useState(ready[1]?.id ?? ready[0]?.id ?? "");
  const [result, setResult] = useState<{
    a: CompareSide;
    b: CompareSide;
    sharedContentKeys: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!a && ready[0]) setA(ready[0].id);
    if (!b && ready[1]) setB(ready[1].id);
  }, [ready, a, b]);

  async function runCompare() {
    if (!a || !b || a === b) {
      setError("Pick two different studies");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/studies/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`
    );
    const json = (await res.json()) as ApiResponse<{
      a: CompareSide;
      b: CompareSide;
      sharedContentKeys: number;
    }>;
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setResult(json.data);
  }

  if (ready.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        You need at least two complete studies to compare.{" "}
        <Link href="/dashboard" className="text-primary hover:underline">
          Back to library
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Study A</span>
          <select
            className="block w-56 border border-border bg-background px-2 py-1.5"
            value={a}
            onChange={(e) => setA(e.target.value)}
          >
            {ready.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Study B</span>
          <select
            className="block w-56 border border-border bg-background px-2 py-1.5"
            value={b}
            onChange={(e) => setB(e.target.value)}
          >
            {ready.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" onClick={() => void runCompare()} disabled={busy}>
          {busy ? "Comparing…" : "Compare"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Shared concept keys: {result.sharedContentKeys}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {[result.a, result.b].map((side) => (
              <div
                key={side.studyId}
                className="space-y-3 border border-border/70 p-4"
              >
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  {side.title}
                </h2>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Mastery</dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {side.masteryScore}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Cards</dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {side.cardCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Due</dt>
                    <dd className="tabular-nums">{side.dueCount}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Weak</dt>
                    <dd className="tabular-nums">{side.weakCount}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Recent quiz</dt>
                    <dd className="tabular-nums">
                      {side.recentScore != null ? `${side.recentScore}%` : "—"}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/study/${side.studyId}`}
                  className="text-sm text-primary hover:underline"
                >
                  Open study →
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
