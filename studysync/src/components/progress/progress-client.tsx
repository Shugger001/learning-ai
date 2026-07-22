"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Flame, Layers, ListChecks, Loader2, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import { heatColor } from "@/lib/progress/mastery";
import { cn } from "@/lib/utils/cn";
import type { ApiResponse } from "@/types/api";
import type { EmailPreferences, SpacedEpisode } from "@/types/database";

export interface ProgressPayload {
  streak: {
    current: number;
    longest: number;
    lastStudyDate: string | null;
  };
  xp: number;
  level: number;
  xpToNext: number;
  achievements: {
    badge_key: string;
    title: string;
    description: string;
    unlocked_at: string;
  }[];
  dueCount: number;
  dueCards: {
    id: string;
    study_id: string;
    question: string;
    due_at: string;
    study_title: string;
  }[];
  weakCards: {
    id: string;
    study_id: string;
    question: string;
    ease: number;
    reps: number;
    study_title: string;
  }[];
  weakTopics: { study_id: string; title: string; misses: number }[];
  recentAttempts: {
    id: string;
    study_id: string;
    study_title: string;
    score: number;
    total: number;
    created_at: string;
  }[];
  activity: {
    activity_date: string;
    cards_reviewed: number;
    quizzes_taken: number;
  }[];
  studyCount: number;
  mastery: {
    studyId: string;
    title: string;
    cardCount: number;
    mastered: number;
    struggling: number;
    avgEase: number;
    avgReps: number;
    score: number;
  }[];
}

export function ProgressClient({ data }: { data: ProgressPayload }) {
  const [weeklyRecap, setWeeklyRecap] = useState(false);
  const [coachDigest, setCoachDigest] = useState(false);
  const [coachEmail, setCoachEmail] = useState("");
  const [assignmentReminders, setAssignmentReminders] = useState(true);
  const [prefMessage, setPrefMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [episode, setEpisode] = useState<SpacedEpisode | null>(null);
  const [drillBusy, setDrillBusy] = useState(false);
  const [drillMessage, setDrillMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/settings/email-preferences")
      .then((r) => r.json())
      .then((json: ApiResponse<EmailPreferences>) => {
        if (json.success) {
          setWeeklyRecap(Boolean(json.data.weekly_recap));
          setCoachDigest(Boolean(json.data.coach_digest));
          setCoachEmail(json.data.coach_email ?? "");
          setAssignmentReminders(
            json.data.assignment_reminders !== false
          );
        }
      })
      .catch(() => undefined);
    void fetch("/api/progress/share")
      .then((r) => r.json())
      .then((json: ApiResponse<{ token: string | null; url: string | null }>) => {
        if (json.success && json.data.url) {
          setShareUrl(`${window.location.origin}${json.data.url}`);
        }
      })
      .catch(() => undefined);
    void fetch("/api/spaced-podcast")
      .then((r) => r.json())
      .then((json: ApiResponse<SpacedEpisode | null>) => {
        if (json.success && json.data) setEpisode(json.data);
      })
      .catch(() => undefined);
  }, []);

  async function toggleRecap(next: boolean) {
    setWeeklyRecap(next);
    setPrefMessage(null);
    const res = await fetch("/api/settings/email-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekly_recap: next }),
    });
    const json = (await res.json()) as ApiResponse<EmailPreferences>;
    if (!json.success) {
      setWeeklyRecap(!next);
      setPrefMessage(json.error);
      return;
    }
    setPrefMessage(next ? "Weekly recap enabled" : "Weekly recap disabled");
  }

  async function saveCoach(next: boolean, email = coachEmail) {
    setCoachDigest(next);
    setPrefMessage(null);
    const res = await fetch("/api/settings/email-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coach_digest: next,
        coach_email: email.trim() || null,
      }),
    });
    const json = (await res.json()) as ApiResponse<EmailPreferences>;
    if (!json.success) {
      setCoachDigest(!next);
      setPrefMessage(json.error);
      return;
    }
    setPrefMessage(
      next
        ? `Coach digest on · ${json.data.coach_email ?? "set an email"}`
        : "Coach digest disabled"
    );
  }

  async function enableShare() {
    setShareMessage(null);
    const res = await fetch("/api/progress/share", { method: "POST" });
    const json = (await res.json()) as ApiResponse<{
      token: string;
      url: string;
    }>;
    if (!json.success) {
      setShareMessage(json.error);
      return;
    }
    const url = `${window.location.origin}${json.data.url}`;
    setShareUrl(url);
    await navigator.clipboard.writeText(url);
    setShareMessage("Snapshot link copied");
  }

  async function disableShare() {
    await fetch("/api/progress/share", { method: "DELETE" });
    setShareUrl(null);
    setShareMessage("Snapshot link disabled");
  }

  async function toggleReminders(next: boolean) {
    setAssignmentReminders(next);
    setPrefMessage(null);
    const res = await fetch("/api/settings/email-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_reminders: next }),
    });
    const json = (await res.json()) as ApiResponse<EmailPreferences>;
    if (!json.success) {
      setAssignmentReminders(!next);
      setPrefMessage(json.error);
      return;
    }
    setPrefMessage(
      next ? "Assignment due reminders on" : "Assignment due reminders off"
    );
  }

  async function generateDrill() {
    setDrillBusy(true);
    setDrillMessage(null);
    const res = await fetch("/api/spaced-podcast", { method: "POST" });
    const json = (await res.json()) as ApiResponse<SpacedEpisode>;
    setDrillBusy(false);
    if (!json.success) {
      setDrillMessage(json.error);
      return;
    }
    setEpisode(json.data);
    setDrillMessage(
      json.data.audio_url
        ? "Today’s spaced drill is ready"
        : "Script ready — add OPENAI_API_KEY for audio"
    );
  }

  const cardsThisWeek = data.activity
    .slice(0, 7)
    .reduce((sum, d) => sum + (d.cards_reviewed ?? 0), 0);
  const quizzesThisWeek = data.activity
    .slice(0, 7)
    .reduce((sum, d) => sum + (d.quizzes_taken ?? 0), 0);

  return (
    <motion.div className="space-y-10" {...fadeUp}>
      <div className="space-y-2">
        <div className="signal-bar" aria-hidden />
        <p className="page-kicker">
          Memory
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Progress hub
        </h1>
        <p className="max-w-xl text-[15px] text-muted-foreground">
          XP, badges, due cards, and your study streak in one place.
        </p>
      </div>

      <motion.dl
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {[
          {
            label: "Level",
            value: String(data.level),
            hint: `${data.xp} XP · ${data.xpToNext} to next`,
            icon: Trophy,
          },
          {
            label: "Streak",
            value: `${data.streak.current}d`,
            hint: `Best ${data.streak.longest}d`,
            icon: Flame,
          },
          {
            label: "Due now",
            value: String(data.dueCount),
            hint: "Cards waiting",
            icon: Layers,
          },
          {
            label: "Cards / 7d",
            value: String(cardsThisWeek),
            hint: "Reviews logged",
            icon: Target,
          },
          {
            label: "Quizzes / 7d",
            value: String(quizzesThisWeek),
            hint: "Attempts logged",
            icon: ListChecks,
          },
        ].map(({ label, value, hint, icon: Icon }) => (
          <motion.div
            key={label}
            variants={staggerItem}
            className="border border-border/70 bg-card/40 p-4"
          >
            <dt className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </dt>
            <dd className="font-display mt-2 text-2xl font-semibold tabular-nums">
              {value}
            </dd>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </motion.div>
        ))}
      </motion.dl>

      {data.achievements.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold tracking-tight">
            Achievements
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.achievements.map((a) => (
              <li
                key={a.badge_key}
                className="border border-border/70 bg-card/40 p-4"
              >
                <p className="text-sm font-medium">{a.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.description}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Unlocked{" "}
                  {new Date(a.unlocked_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Earn badges by reviewing cards, acing quizzes, and finishing battles.
        </p>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">
              Mastery map
            </h2>
            <p className="text-sm text-muted-foreground">
              Deck strength from ease × reps — cooler green is stronger.
            </p>
          </div>
        </div>
        {data.mastery.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Complete a study to see deck heat.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.mastery.map((m) => (
              <li key={m.studyId}>
                <Link
                  href={`/study/${m.studyId}`}
                  className="block border border-border/70 p-3 transition hover:border-primary/40"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-12 w-12 shrink-0",
                        heatColor(m.score)
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.score}% · {m.mastered}/{m.cardCount} mastered
                        {m.struggling
                          ? ` · ${m.struggling} weak`
                          : ""}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 border border-border/70 bg-card/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Spaced audio drill</h2>
            <p className="text-xs text-muted-foreground">
              Short podcast from today’s due and weak cards.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={drillBusy}
            onClick={() => void generateDrill()}
          >
            {drillBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {episode?.status === "complete" ? "Refresh drill" : "Generate drill"}
          </Button>
        </div>
        {drillMessage ? (
          <p className="text-xs text-muted-foreground" role="status">
            {drillMessage}
          </p>
        ) : null}
        {episode?.audio_url ? (
          <audio controls src={episode.audio_url} className="w-full" />
        ) : episode?.script ? (
          <p className="max-h-32 overflow-y-auto text-xs text-muted-foreground whitespace-pre-wrap">
            {episode.script}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/review">Review today</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/exam">Exam campaign</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/plan">Week plan</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/library">Browse library</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/classes">Classes</Link>
        </Button>
        {shareUrl ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(shareUrl);
                setShareMessage("Snapshot link copied");
              }}
            >
              Copy snapshot
            </Button>
            <Button type="button" variant="ghost" onClick={() => void disableShare()}>
              Disable snapshot
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" onClick={() => void enableShare()}>
            Share snapshot
          </Button>
        )}
      </div>
      {shareMessage ? (
        <p className="text-xs text-muted-foreground" role="status">
          {shareMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border border-border/70 bg-card/40 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Weekly recap email</p>
          <p className="text-xs text-muted-foreground">
            Due cards, streak, and weak topics every Monday.
          </p>
          {prefMessage ? (
            <p className="mt-1 text-xs text-muted-foreground">{prefMessage}</p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant={weeklyRecap ? "default" : "outline"}
          onClick={() => void toggleRecap(!weeklyRecap)}
        >
          {weeklyRecap ? "On" : "Off"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border border-border/70 bg-card/40 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Assignment due reminders</p>
          <p className="text-xs text-muted-foreground">
            Email the day before a class pack is due.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={assignmentReminders ? "default" : "outline"}
          onClick={() => void toggleReminders(!assignmentReminders)}
        >
          {assignmentReminders ? "On" : "Off"}
        </Button>
      </div>

      <div className="space-y-3 border border-border/70 bg-card/40 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Parent / coach digest</p>
            <p className="text-xs text-muted-foreground">
              Weekly email with streak and weak topics — no card question text.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant={coachDigest ? "default" : "outline"}
            disabled={coachDigest ? false : !coachEmail.trim()}
            onClick={() => void saveCoach(!coachDigest)}
          >
            {coachDigest ? "On" : "Off"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="email"
            placeholder="coach@school.edu"
            value={coachEmail}
            onChange={(e) => setCoachEmail(e.target.value)}
            className="max-w-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!coachEmail.trim()}
            onClick={() => void saveCoach(true, coachEmail)}
          >
            Save email
          </Button>
        </div>
      </div>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-display text-xl font-bold tracking-tight">
            Due soon
          </h2>
          {data.dueCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">You&apos;re caught up.</p>
          ) : (
            <ul className="space-y-2">
              {data.dueCards.map((card) => (
                <li key={card.id} className="border border-border/70 px-3 py-2.5">
                  <Link
                    href={`/study/${card.study_id}?tab=flashcards`}
                    className="block"
                  >
                    <p className="text-xs text-primary">{card.study_title}</p>
                    <p className="mt-1 text-sm font-medium leading-snug">
                      {card.question}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-xl font-bold tracking-tight">
            Weak topics
          </h2>
          {data.weakTopics.length === 0 && data.weakCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Take a few quizzes to surface weak spots.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.weakTopics.map((t) => (
                <li
                  key={t.study_id}
                  className="flex items-center justify-between gap-3 border border-border/70 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.misses} miss{t.misses === 1 ? "" : "es"}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/study/${t.study_id}?tab=quiz&exam=1&minutes=20`}
                    >
                      Exam
                    </Link>
                  </Button>
                </li>
              ))}
              {data.weakCards.slice(0, 4).map((card) => (
                <li key={card.id} className="border border-border/70 px-3 py-2.5">
                  <Link href={`/study/${card.study_id}?tab=flashcards`}>
                    <p className="text-xs text-primary">{card.study_title}</p>
                    <p className="mt-1 text-sm leading-snug">{card.question}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ease {Number(card.ease).toFixed(2)} · {card.reps} reps
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold tracking-tight">
          Recent quiz attempts
        </h2>
        {data.recentAttempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attempts yet.</p>
        ) : (
          <ul className="divide-y divide-border/60 border border-border/70">
            {data.recentAttempts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <Link
                  href={`/study/${a.study_id}?tab=quiz&exam=1&wrong=1&minutes=15`}
                  className="font-medium hover:underline"
                >
                  {a.study_title}
                </Link>
                <span className="text-muted-foreground">
                  {a.score}/{a.total} ·{" "}
                  {new Date(a.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold tracking-tight">
          Activity
        </h2>
        {data.activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Review cards or finish a quiz to start your streak.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.activity.slice(0, 12).map((day) => (
              <li
                key={day.activity_date}
                className="border border-border/70 px-3 py-2 text-sm"
              >
                <p className="font-medium">
                  {new Date(day.activity_date + "T00:00:00Z").toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric" }
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {day.cards_reviewed} cards · {day.quizzes_taken} quizzes
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </motion.div>
  );
}
