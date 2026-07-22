"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Flame, Layers, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";

type Snapshot = {
  displayName: string;
  streak: {
    current: number;
    longest: number;
    lastStudyDate: string | null;
  };
  dueCount: number;
  studyCount: number;
  activity: {
    activity_date: string;
    cards_reviewed: number;
    quizzes_taken: number;
  }[];
  weakTopics: { title: string; misses: number }[];
  recentScores: {
    study_title: string;
    score: number;
    total: number;
    created_at: string;
  }[];
};

export function ProgressShareClient() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/share/progress/${params.token}`)
      .then((r) => r.json())
      .then((json: ApiResponse<Snapshot>) => {
        if (!json.success) {
          setError(json.error);
          return;
        }
        setData(json.data);
      })
      .catch(() => setError("Could not load snapshot"));
  }, [params.token]);

  if (!data && !error) {
    return <p className="text-sm text-muted-foreground">Loading snapshot…</p>;
  }

  if (!data) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error ?? "Not found"}
      </p>
    );
  }

  const cardsWeek = data.activity
    .slice(0, 7)
    .reduce((sum, d) => sum + (d.cards_reviewed ?? 0), 0);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <div className="space-y-2 text-center">
        <p className="page-kicker">
          StudySync snapshot
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {data.displayName}&apos;s progress
        </h1>
        <p className="text-sm text-muted-foreground">
          Shared analytics · no private card text
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border border-border/70 p-4 text-center">
          <Flame className="mx-auto h-5 w-5 text-primary" />
          <p className="mt-2 font-display text-2xl font-semibold">
            {data.streak.current}
          </p>
          <p className="text-xs text-muted-foreground">Day streak</p>
        </div>
        <div className="border border-border/70 p-4 text-center">
          <Layers className="mx-auto h-5 w-5 text-primary" />
          <p className="mt-2 font-display text-2xl font-semibold">
            {data.dueCount}
          </p>
          <p className="text-xs text-muted-foreground">Cards due</p>
        </div>
        <div className="border border-border/70 p-4 text-center">
          <Target className="mx-auto h-5 w-5 text-primary" />
          <p className="mt-2 font-display text-2xl font-semibold">{cardsWeek}</p>
          <p className="text-xs text-muted-foreground">Cards this week</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Weak topics
        </h2>
        {data.weakTopics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No weak topics yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.weakTopics.map((t) => (
              <li key={t.title} className="flex justify-between gap-2">
                <span>{t.title}</span>
                <span className="text-muted-foreground">{t.misses} misses</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Recent quizzes
        </h2>
        {data.recentScores.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quiz attempts yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.recentScores.map((a, i) => (
              <li key={`${a.created_at}-${i}`} className="flex justify-between gap-2">
                <span>{a.study_title}</span>
                <span className="text-muted-foreground">
                  {a.score}/{a.total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="text-center">
        <Button asChild>
          <Link href="/signup">Start StudySync</Link>
        </Button>
      </div>
    </div>
  );
}
