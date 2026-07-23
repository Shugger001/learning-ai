"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Headphones, Loader2, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { levelFromXp, xpToNextLevel } from "@/lib/progress/badges";
import type { ApiResponse } from "@/types/api";
import type { ExamCampaign, SpacedEpisode } from "@/types/database";
import { rampIntensity } from "@/lib/exam/campaign";

function daysLeft(examAt: string) {
  const today = new Date().toISOString().slice(0, 10);
  const a = new Date(`${today}T00:00:00.000Z`).getTime();
  const b = new Date(`${examAt.slice(0, 10)}T00:00:00.000Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

interface HabitStripProps {
  xp: number;
  level: number;
  dueToday: number;
}

export function HabitStrip({ xp, level, dueToday }: HabitStripProps) {
  const [episode, setEpisode] = useState<SpacedEpisode | null>(null);
  const [campaign, setCampaign] = useState<ExamCampaign | null>(null);
  const [drillBusy, setDrillBusy] = useState(false);
  const [drillMsg, setDrillMsg] = useState<string | null>(null);

  const nextXp = xpToNextLevel(xp);
  const resolvedLevel = level || levelFromXp(xp);

  useEffect(() => {
    void fetch("/api/spaced-podcast")
      .then((r) => r.json())
      .then((json: ApiResponse<SpacedEpisode | null>) => {
        if (json.success && json.data) setEpisode(json.data);
      })
      .catch(() => undefined);

    void fetch("/api/exam-campaigns")
      .then((r) => r.json())
      .then((json: ApiResponse<ExamCampaign[]>) => {
        if (!json.success || !Array.isArray(json.data)) return;
        const upcoming = json.data
          .map((c) => ({ c, left: daysLeft(String(c.exam_at)) }))
          .filter((x) => x.left >= 0)
          .sort((a, b) => a.left - b.left)[0];
        setCampaign(upcoming?.c ?? null);
      })
      .catch(() => undefined);
  }, []);

  const examMeta = useMemo(() => {
    if (!campaign) return null;
    const left = daysLeft(String(campaign.exam_at));
    return { left, intensity: rampIntensity(left), primary: campaign.study_ids?.[0] };
  }, [campaign]);

  async function generateDrill() {
    setDrillBusy(true);
    setDrillMsg(null);
    const res = await fetch("/api/spaced-podcast", { method: "POST" });
    const json = (await res.json()) as ApiResponse<SpacedEpisode>;
    setDrillBusy(false);
    if (!json.success) {
      setDrillMsg(json.error);
      return;
    }
    setEpisode(json.data);
    setDrillMsg(json.data.audio_url ? "Drill ready" : "Script ready");
  }

  return (
    <section className="space-y-3 border border-border/70 bg-card/30 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Today’s habit
          </h2>
          <p className="text-sm text-muted-foreground">
            Due cards, XP, spaced drill, and your next exam.
          </p>
        </div>
        <Link
          href="/compare"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Compare studies
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-border/60 bg-background/40 p-3">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            Level {resolvedLevel}
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
            <AnimatedNumber value={xp} /> XP
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {nextXp} to next level
          </p>
        </div>

        <div className="border border-border/60 bg-background/40 p-3">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            Due today
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
            <AnimatedNumber value={dueToday} />
          </p>
          <Link
            href="/review"
            className="mt-1 inline-block text-xs text-primary hover:underline"
          >
            Start review →
          </Link>
        </div>

        <div className="border border-border/60 bg-background/40 p-3">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <Headphones className="h-3.5 w-3.5" />
            Spaced drill
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={drillBusy}
              onClick={() => void generateDrill()}
            >
              {drillBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              {episode?.audio_url || episode?.script ? "Refresh" : "Generate"}
            </Button>
            {episode?.audio_url ? (
              <audio controls src={episode.audio_url} className="h-8 max-w-full" />
            ) : null}
          </div>
          {drillMsg ? (
            <p className="mt-1 text-xs text-muted-foreground">{drillMsg}</p>
          ) : null}
        </div>

        <div className="border border-border/60 bg-background/40 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Next exam
          </p>
          {campaign && examMeta ? (
            <>
              <p className="mt-1 font-display text-lg font-semibold tracking-tight">
                {campaign.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {examMeta.left === 0
                  ? "Today"
                  : `${examMeta.left} day${examMeta.left === 1 ? "" : "s"} left`}{" "}
                · {examMeta.intensity}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href="/exam" className="text-xs text-primary hover:underline">
                  Campaigns
                </Link>
                {examMeta.primary ? (
                  <Link
                    href={`/study/${examMeta.primary}?tab=quiz&exam=1`}
                    className="text-xs text-primary hover:underline"
                  >
                    Timed quiz →
                  </Link>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">No countdown set</p>
              <Link href="/exam" className="mt-1 inline-block text-xs text-primary hover:underline">
                Add exam campaign →
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
