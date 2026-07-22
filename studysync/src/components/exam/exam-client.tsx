"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rampIntensity } from "@/lib/exam/campaign";
import type { ApiResponse } from "@/types/api";
import type { ExamCampaign, Study } from "@/types/database";

function daysLeft(examAt: string) {
  const today = new Date().toISOString().slice(0, 10);
  const a = new Date(`${today}T00:00:00.000Z`).getTime();
  const b = new Date(`${examAt.slice(0, 10)}T00:00:00.000Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function ExamClient() {
  const [campaigns, setCampaigns] = useState<ExamCampaign[]>([]);
  const [studies, setStudies] = useState<Study[]>([]);
  const [title, setTitle] = useState("");
  const [examAt, setExamAt] = useState("");
  const [studyId, setStudyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/exam-campaigns");
    const json = (await res.json()) as ApiResponse<ExamCampaign[]>;
    if (!json.success) {
      setError(json.error);
      return;
    }
    setError(null);
    setCampaigns(json.data);
  }, []);

  useEffect(() => {
    void load();
    void fetch("/api/studies")
      .then((r) => r.json())
      .then((json: ApiResponse<Study[]>) => {
        if (json.success) {
          setStudies(json.data.filter((s) => s.status === "complete"));
        }
      })
      .catch(() => undefined);
  }, [load]);

  const upcoming = useMemo(
    () =>
      [...campaigns].sort((a, b) =>
        String(a.exam_at).localeCompare(String(b.exam_at))
      ),
    [campaigns]
  );

  async function createCampaign() {
    if (!title.trim() || !examAt) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/exam-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        exam_at: examAt,
        study_ids: studyId ? [studyId] : [],
      }),
    });
    const json = (await res.json()) as ApiResponse<ExamCampaign>;
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setTitle("");
    setExamAt("");
    setStudyId("");
    setMessage("Campaign set — regenerate your week plan to pull ramp sessions.");
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/exam-campaigns?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="page-kicker">
          Countdown
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Exam campaigns
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Set an exam date. StudySync ramps card load and schedules boss quizzes
          until day zero.
        </p>
      </div>

      <div className="space-y-3 border border-border/70 bg-card/40 p-4">
        <h2 className="text-sm font-medium">New campaign</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Midterm · Biology"
            className="min-w-[12rem] flex-1"
          />
          <Input
            type="date"
            value={examAt}
            onChange={(e) => setExamAt(e.target.value)}
            className="w-[11rem]"
            aria-label="Exam date"
          />
          <select
            className="h-10 min-w-[12rem] flex-1 border border-input bg-background px-2 text-sm"
            value={studyId}
            onChange={(e) => setStudyId(e.target.value)}
          >
            <option value="">Primary study (optional)</option>
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <Button
            type="button"
            disabled={busy || !title.trim() || !examAt}
            onClick={() => void createCampaign()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Start countdown
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
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Active
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No campaigns yet. Add an exam date to unlock the ramp.
          </p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((c) => {
              const left = daysLeft(String(c.exam_at));
              const intensity = rampIntensity(left);
              const primary = Array.isArray(c.study_ids)
                ? c.study_ids[0]
                : null;
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-border/70 p-4"
                >
                  <div>
                    <p className="flex items-center gap-2 font-medium">
                      <Target className="h-4 w-4 text-primary" />
                      {c.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {left < 0
                        ? "Exam passed"
                        : left === 0
                          ? "Exam day"
                          : `${left} day${left === 1 ? "" : "s"} left`}
                      {" · "}
                      {intensity} ramp
                      {" · "}
                      {new Date(
                        `${String(c.exam_at).slice(0, 10)}T12:00:00.000Z`
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {primary ? (
                      <>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/study/${primary}`}>Review</Link>
                        </Button>
                        <Button asChild size="sm">
                          <Link
                            href={`/study/${primary}?tab=quiz&exam=1&boss=1`}
                          >
                            Boss quiz
                          </Link>
                        </Button>
                      </>
                    ) : null}
                    <Button asChild size="sm" variant="outline">
                      <Link href="/plan">Week plan</Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void remove(c.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
