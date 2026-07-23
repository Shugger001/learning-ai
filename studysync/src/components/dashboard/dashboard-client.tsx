"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileText,
  FolderOpen,
  Mic,
  Plus,
  Type,
  Video,
  Clapperboard,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { NewStudyModal } from "@/components/upload/new-study-modal";
import { StudyCard } from "@/components/dashboard/study-card";
import { FolderBar } from "@/components/dashboard/folder-bar";
import { FirstRunTour } from "@/components/onboarding/first-run-tour";
import { LearnerProfilePrompt } from "@/components/onboarding/learner-profile-prompt";
import { DailyGoalCard } from "@/components/goals/daily-goal-card";
import { HabitStrip } from "@/components/dashboard/habit-strip";
import { Button } from "@/components/ui/button";
import { ProcessingBar } from "@/components/ui/processing-bar";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils/cn";
import { FREE_LIMITS, type UsageRemaining } from "@/lib/billing/limits";
import type { ApiResponse } from "@/types/api";
import type {
  ContentType,
  Folder,
  LearnerBand,
  PlanType,
  Study,
} from "@/types/database";

export interface StudySummary {
  study_id: string;
  summary: string | null;
}

type LibraryFilter = "all" | "complete" | "processing" | "error" | "favorites";
type TypeFilter = "all" | ContentType;

interface DashboardClientProps {
  studies: Study[];
  summaries: StudySummary[];
  folders: Folder[];
  dueToday: number;
  plan: PlanType;
  usage: UsageRemaining | null;
  userName?: string | null;
  onboardingCompleted?: boolean;
  /** null = not set yet */
  learnerBand?: LearnerBand | null;
  /** Show one-time prompt when onboarding done but band unset (column exists). */
  needsLearnerSetup?: boolean;
  xp?: number;
  level?: number;
}

const PRIMARY_START: {
  type: ContentType;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    type: "youtube",
    label: "YouTube",
    hint: "Paste a lecture link",
    icon: Clapperboard,
  },
  {
    type: "audio",
    label: "Record",
    hint: "Capture live lecture audio",
    icon: Mic,
  },
];

const MORE_FORMATS: {
  type: ContentType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "pdf", label: "PDF / Slides", icon: FileText },
  { type: "notion", label: "Notion / Folder", icon: FolderOpen },
  { type: "video", label: "Video", icon: Video },
  { type: "text", label: "Paste text", icon: Type },
];

const FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "favorites", label: "Favorites" },
  { id: "complete", label: "Ready" },
  { id: "processing", label: "Generating" },
  { id: "error", label: "Failed" },
];

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "Any type" },
  { id: "youtube", label: "YouTube" },
  { id: "pdf", label: "PDF / slides" },
  { id: "audio", label: "Audio" },
  { id: "video", label: "Video" },
  { id: "text", label: "Text" },
];

const TIPS = [
  "Review due flashcards daily - spaced recall sticks better.",
  "Chat with a study when a concept still feels fuzzy.",
  "Generate a podcast for commute review.",
  "Browse the premade library for AP and STEM starters.",
];

export function DashboardClient({
  studies: initialStudies,
  summaries,
  folders: initialFolders,
  dueToday,
  plan,
  usage,
  userName,
  onboardingCompleted = true,
  learnerBand = null,
  needsLearnerSetup = false,
  xp = 0,
  level = 1,
}: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [studies, setStudies] = useState(initialStudies);
  const [folders, setFolders] = useState(initialFolders);
  const [open, setOpen] = useState(false);
  const [initialType, setInitialType] = useState<ContentType | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [folderId, setFolderId] = useState<string | null | "unfiled">(null);
  const [showMoreFormats, setShowMoreFormats] = useState(false);
  const [dueCount, setDueCount] = useState(dueToday);
  const [tipIndex, setTipIndex] = useState(0);
  const [tourOpen, setTourOpen] = useState(!onboardingCompleted);
  const [learnerPromptOpen, setLearnerPromptOpen] = useState(
    Boolean(onboardingCompleted && needsLearnerSetup && !learnerBand)
  );

  const firstName = userName?.trim().split(/\s+/)[0] || null;

  useEffect(() => {
    setStudies(initialStudies);
  }, [initialStudies]);

  useEffect(() => {
    setDueCount(dueToday);
  }, [dueToday]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpen(true);
      setInitialType(null);
      router.replace("/dashboard", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    const hasProcessing = studies.some((s) => s.status === "processing");
    if (!hasProcessing) return;
    const id = setInterval(() => router.refresh(), 3500);
    return () => clearInterval(id);
  }, [studies, router]);

  useEffect(() => {
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const summaryByStudy = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of summaries) {
      if (row.summary?.trim()) map.set(row.study_id, row.summary.trim());
    }
    return map;
  }, [summaries]);

  const stats = useMemo(() => {
    const complete = studies.filter((s) => s.status === "complete").length;
    const processing = studies.filter((s) => s.status === "processing").length;
    const failed = studies.filter((s) => s.status === "error").length;
    return {
      complete,
      processing,
      failed,
      total: studies.length,
    };
  }, [studies]);

  const continueStudy = useMemo(
    () => studies.find((s) => s.status === "complete") ?? null,
    [studies]
  );

  const processingStudies = useMemo(
    () => studies.filter((s) => s.status === "processing"),
    [studies]
  );

  const failedStudies = useMemo(
    () => studies.filter((s) => s.status === "error"),
    [studies]
  );

  const filtered = useMemo(() => {
    let list = studies;
    if (folderId === "unfiled") list = list.filter((s) => !s.folder_id);
    else if (folderId) list = list.filter((s) => s.folder_id === folderId);
    if (filter === "favorites") list = list.filter((s) => s.is_favorite);
    else if (filter !== "all") list = list.filter((s) => s.status === filter);
    if (typeFilter !== "all") {
      list = list.filter((s) => s.content_type === typeFilter);
    }
    return [...list].sort((a, b) => {
      const fav = Number(!!b.is_favorite) - Number(!!a.is_favorite);
      if (fav !== 0) return fav;
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }, [studies, filter, folderId, typeFilter]);

  const tip = TIPS[tipIndex];

  function openNew(type?: ContentType) {
    setInitialType(type ?? null);
    setOpen(true);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setInitialType(null);
  }

  async function retryFailed(id: string) {
    const res = await fetch(`/api/studies/${id}/retry`, { method: "POST" });
    const json = (await res.json()) as ApiResponse<Study>;
    if (json.success) {
      setStudies((prev) => prev.map((s) => (s.id === id ? json.data : s)));
      router.push(`/study/${id}`);
      router.refresh();
    }
  }

  async function deleteFailed(id: string, title: string) {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    const res = await fetch(`/api/studies/${id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    if (json.success) {
      setStudies((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    }
  }

  const primaryCta =
    dueToday > 0
      ? {
          href: `/review`,
          label: `Review ${dueToday} due card${dueToday === 1 ? "" : "s"}`,
          secondary: continueStudy
            ? ("Continue studying" as const)
            : ("Browse library" as const),
          secondaryHref: continueStudy
            ? `/study/${continueStudy.id}?tab=notes`
            : "/library",
        }
      : continueStudy
        ? {
            href: `/study/${continueStudy.id}?tab=notes`,
            label: "Continue studying",
            secondary: "Practice cards" as const,
            secondaryHref: `/study/${continueStudy.id}?tab=flashcards`,
          }
        : null;

  return (
    <>
      <section className="relative overflow-hidden shell-panel">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "linear-gradient(135deg, hsl(168 42% 16% / 0.06) 0%, transparent 48%), radial-gradient(ellipse 70% 90% at 100% 0%, hsl(38 55% 52% / 0.1), transparent 55%)",
          }}
        />
        <div className="relative flex flex-col gap-8 px-6 py-9 sm:px-9 sm:py-11 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl space-y-4">
            <div className="signal-bar" aria-hidden />
            <p className="page-kicker">Library</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {firstName ? `Welcome back, ${firstName}` : "Your studies"}
            </h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {dueToday > 0
                ? `${dueToday} flashcard${dueToday === 1 ? "" : "s"} due - start with spaced recall.`
                : "Upload, record, or paste a YouTube link to build your next study pack."}
            </p>
            {!onboardingCompleted || studies.length === 0 ? (
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>
                  {studies.length === 0 ? "○" : "●"} Add a lecture or sample pack
                </li>
                <li>
                  {dueCount > 0 || studies.some((s) => s.status === "complete")
                    ? "●"
                    : "○"}{" "}
                  Review due cards
                </li>
                <li>○ Check calendar for the week ahead</li>
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              {dueCount > 0 ? (
                <Button asChild size="lg">
                  <Link href="/review">
                    <BookOpen className="h-4 w-4" />
                    Review {dueCount} due
                  </Link>
                </Button>
              ) : null}
              {primaryCta ? (
                <>
                  {dueCount === 0 ? (
                    <Button asChild size="lg">
                      <Link href={primaryCta.href}>
                        {primaryCta.label}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="lg">
                      <Link href={primaryCta.href}>{primaryCta.label}</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="lg">
                    <Link href={primaryCta.secondaryHref}>
                      {primaryCta.secondary}
                    </Link>
                  </Button>
                </>
              ) : dueCount === 0 ? (
                <Button size="lg" onClick={() => openNew()}>
                  <Plus className="h-4 w-4" />
                  New study
                </Button>
              ) : (
                <Button size="lg" variant="outline" onClick={() => openNew()}>
                  <Plus className="h-4 w-4" />
                  New study
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <Link href="/library" className="hover:text-foreground">
                Premade library
              </Link>
              <Link href="/pricing" className="hover:text-foreground">
                {plan === "pro" ? "Pro plan" : "Upgrade"}
              </Link>
            </div>
            {usage ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Free plan · {usage.uploads}/{FREE_LIMITS.uploads} uploads ·{" "}
                  {usage.chat}/{FREE_LIMITS.chat} chat · {usage.podcasts}/
                  {FREE_LIMITS.podcasts} podcasts left
                  {usage.uploads <= 2 || usage.chat <= 5 || usage.podcasts <= 1
                    ? " - nearing limit"
                    : ""}
                </p>
                <p>
                  Resets{" "}
                  {new Date(usage.resetsAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  {" · "}
                  <Link href="/pricing" className="text-primary hover:underline">
                    Upgrade for unlimited
                  </Link>
                </p>
              </div>
            ) : null}
          </div>

          {studies.length > 0 ? (
            <dl className="grid grid-cols-3 gap-x-8 gap-y-4">
              {[
                { label: "Studies", value: stats.total },
                { label: "Due", value: dueCount },
                { label: "Ready", value: stats.complete },
              ].map((item) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">
                    <AnimatedNumber value={item.value} />
                  </dd>
                </motion.div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>

      <div className="mt-8 space-y-4">
        <HabitStrip xp={xp} level={level} dueToday={dueCount} />
        <DailyGoalCard />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Start from
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              YouTube and live recording first-other formats when you need them.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowMoreFormats((v) => !v)}
          >
            {showMoreFormats ? "Hide formats" : "More formats"}
          </Button>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PRIMARY_START.map(({ type, label, hint, icon: Icon }, i) => (
            <motion.li
              key={type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
            >
              <motion.button
                type="button"
                onClick={() => openNew(type)}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.99 }}
                className="group flex w-full items-start gap-3 border border-border/70 bg-card/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-border/60 text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold tracking-tight">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {hint}
                  </span>
                </span>
              </motion.button>
            </motion.li>
          ))}
        </ul>
        <AnimatePresence>
          {showMoreFormats ? (
            <motion.ul
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 grid gap-2 overflow-hidden sm:grid-cols-3"
            >
              {MORE_FORMATS.map(({ type, label, icon: Icon }) => (
                <li key={type}>
                  <motion.button
                    type="button"
                    onClick={() => openNew(type)}
                    whileHover={{ y: -2 }}
                    className="flex w-full items-center gap-2 border border-dashed border-border/70 px-3 py-2.5 text-left text-sm hover:border-primary/35 hover:bg-muted/30"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {label}
                  </motion.button>
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </section>

      <div className="mt-10">
        <FolderBar
          folders={folders}
          studies={studies}
          selectedFolderId={folderId}
          onSelectFolder={setFolderId}
          onFoldersChange={setFolders}
          onStudyMoved={(study) =>
            setStudies((prev) =>
              prev.map((s) => (s.id === study.id ? study : s))
            )
          }
        />
      </div>

      {studies.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 flex flex-col items-start border border-dashed border-border/80 px-6 py-16 sm:px-10"
        >
          <p className="text-sm font-medium text-primary">Get started</p>
          <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            Begin with one lecture
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Paste a YouTube link, record live audio, or drop a PDF. StudySync
            turns it into a full study pack.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={() => openNew()}>
              <Plus className="h-4 w-4" />
              Upload lecture
            </Button>
            <Button type="button" variant="outline" onClick={() => setTourOpen(true)}>
              Take the tour
            </Button>
            <Button asChild variant="outline">
              <Link href="/library">
                <BookOpen className="h-4 w-4" />
                Browse library
              </Link>
            </Button>
          </div>
        </motion.div>
      ) : (
        <>
          {processingStudies.length > 0 ? (
            <section className="mt-10 space-y-4">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  Generating
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  These packs are still being built.
                </p>
              </div>
              <ul className="space-y-3">
                {processingStudies.map((study) => (
                  <li key={study.id}>
                    <Link
                      href={`/study/${study.id}`}
                      className="flex items-center justify-between gap-4 border border-border/70 bg-card/40 px-4 py-3 transition-colors hover:border-primary/35"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{study.title}</p>
                        <ProcessingBar
                          value={study.processing_progress}
                          className="mt-2 w-40 max-w-full sm:w-56"
                        />
                      </div>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        {study.processing_progress}%
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {failedStudies.length > 0 ? (
            <section className="mt-10 border border-destructive/30 bg-destructive/5 px-5 py-4">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Needs attention
              </h2>
              <ul className="mt-3 space-y-2">
                {failedStudies.map((study) => (
                  <li
                    key={study.id}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{study.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {study.error_message || "Processing failed"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void retryFailed(study.id)}
                      >
                        Retry
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void deleteFailed(study.id, study.title)}
                      >
                        Delete
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/study/${study.id}`}>View</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-10 space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  All studies
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Filter your library and open any pack.
                </p>
              </div>
              <div
                className="flex gap-1 border-b border-border"
                role="tablist"
                aria-label="Filter studies"
              >
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.id}
                    onClick={() => setFilter(item.id)}
                    className={cn(
                      "relative px-3 py-2 text-sm font-medium transition-colors",
                      filter === item.id
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                    {filter === item.id ? (
                      <motion.span
                        layoutId="dash-filter-underline"
                        className="absolute inset-x-2 bottom-0 h-0.5 bg-primary"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2" aria-label="Filter by type">
              {TYPE_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTypeFilter(item.id)}
                  className={cn(
                    "border px-2.5 py-1 text-xs transition-colors",
                    typeFilter === item.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/70 text-muted-foreground hover:bg-muted/40"
                  )}
                  aria-pressed={typeFilter === item.id}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <p className="border border-dashed border-border/80 px-5 py-10 text-sm text-muted-foreground">
                No studies in this filter.
              </p>
            ) : (
              <motion.ul
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.05 } },
                }}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              >
                {filtered.map((study) => (
                  <motion.li
                    key={study.id}
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      show: { opacity: 1, y: 0 },
                    }}
                  >
                    <StudyCard
                      study={study}
                      summary={summaryByStudy.get(study.id)}
                      onDeleted={(id) =>
                        setStudies((prev) => prev.filter((s) => s.id !== id))
                      }
                      onRetried={(next) =>
                        setStudies((prev) =>
                          prev.map((s) => (s.id === next.id ? next : s))
                        )
                      }
                      onUpdated={(next) =>
                        setStudies((prev) =>
                          prev.map((s) => (s.id === next.id ? next : s))
                        )
                      }
                    />
                  </motion.li>
                ))}

                <motion.li
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    show: { opacity: 1, y: 0 },
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openNew()}
                    className="group flex h-full min-h-[12.5rem] w-full flex-col items-start justify-between border border-dashed border-border/80 bg-transparent p-5 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
                  >
                    <span className="flex h-9 w-9 items-center justify-center border border-border/60 text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                      <Plus className="h-4 w-4" aria-hidden />
                    </span>
                    <span>
                      <span className="font-display block text-lg font-semibold tracking-tight">
                        New study
                      </span>
                      <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        Upload another lecture
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                    </span>
                  </button>
                </motion.li>
              </motion.ul>
            )}
          </section>

          <div className="mt-12 h-6 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={tip}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="text-sm text-muted-foreground"
              >
                {tip}
              </motion.p>
            </AnimatePresence>
          </div>
        </>
      )}

      <NewStudyModal
        open={open}
        onOpenChange={handleOpenChange}
        initialContentType={initialType}
      />
      <FirstRunTour
        open={tourOpen}
        studyCount={studies.length}
        onClose={() => setTourOpen(false)}
        onSampleStarted={(study) =>
          setStudies((prev) => [study, ...prev.filter((s) => s.id !== study.id)])
        }
        onLearnerSaved={() => setLearnerPromptOpen(false)}
      />
      <LearnerProfilePrompt
        open={!tourOpen && learnerPromptOpen}
        onClose={() => setLearnerPromptOpen(false)}
        onSaved={() => setLearnerPromptOpen(false)}
      />
    </>
  );
}
