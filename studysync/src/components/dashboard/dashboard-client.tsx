"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileText,
  Mic,
  Plus,
  Type,
  Video,
  Clapperboard,
} from "lucide-react";
import { motion } from "framer-motion";
import { NewStudyModal } from "@/components/upload/new-study-modal";
import { StudyCard } from "@/components/dashboard/study-card";
import { FolderBar } from "@/components/dashboard/folder-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { ContentType, Folder, PlanType, Study } from "@/types/database";

export interface StudySummary {
  study_id: string;
  summary: string | null;
}

type LibraryFilter = "all" | "complete" | "processing" | "error";

interface DashboardClientProps {
  studies: Study[];
  summaries: StudySummary[];
  folders: Folder[];
  dueToday: number;
  plan: PlanType;
  userName?: string | null;
}

const QUICK_START: {
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
  {
    type: "pdf",
    label: "PDF / Slides",
    hint: "Lecture decks & readings",
    icon: FileText,
  },
  {
    type: "video",
    label: "Video",
    hint: "Recorded lectures",
    icon: Video,
  },
  {
    type: "text",
    label: "Paste text",
    hint: "Notes or transcripts",
    icon: Type,
  },
];

const FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "complete", label: "Ready" },
  { id: "processing", label: "Generating" },
  { id: "error", label: "Failed" },
];

const TIPS = [
  "Review due flashcards daily — spaced recall sticks better.",
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
  userName,
}: DashboardClientProps) {
  const [studies, setStudies] = useState(initialStudies);
  const [folders, setFolders] = useState(initialFolders);
  const [open, setOpen] = useState(false);
  const [initialType, setInitialType] = useState<ContentType | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [folderId, setFolderId] = useState<string | null>(null);

  const firstName = userName?.trim().split(/\s+/)[0] || null;

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
    const cards = studies.reduce((sum, s) => sum + (s.flashcard_count || 0), 0);
    const quizzes = studies.reduce((sum, s) => sum + (s.quiz_count || 0), 0);
    return { complete, processing, failed, cards, quizzes, total: studies.length };
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
    if (folderId) list = list.filter((s) => s.folder_id === folderId);
    if (filter !== "all") list = list.filter((s) => s.status === filter);
    return list;
  }, [studies, filter, folderId]);

  const tip = TIPS[new Date().getDate() % TIPS.length];

  function openNew(type?: ContentType) {
    setInitialType(type ?? null);
    setOpen(true);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setInitialType(null);
  }

  return (
    <>
      <section className="relative overflow-hidden border border-border/70 bg-card/40">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 120% at 100% 0%, hsl(var(--primary) / 0.12), transparent 55%), radial-gradient(ellipse 60% 80% at 0% 100%, hsl(210 40% 50% / 0.06), transparent 50%)",
          }}
        />
        <div className="relative flex flex-col gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl space-y-3">
            <p className="text-sm font-medium text-primary">Library</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {firstName ? `Welcome back, ${firstName}` : "Your studies"}
            </h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Upload, record, or paste a YouTube link — StudySync builds notes,
              flashcards, quizzes, chat, and podcasts.
            </p>
            <div className="flex flex-wrap gap-3 pt-1 text-sm">
              <Link href="/library" className="text-primary hover:underline">
                Premade library
              </Link>
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
                {plan === "pro" ? "Pro plan" : "Upgrade"}
              </Link>
              {dueToday > 0 ? (
                <span className="text-muted-foreground">
                  {dueToday} card{dueToday === 1 ? "" : "s"} due today
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-10">
            {studies.length > 0 ? (
              <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-5">
                {[
                  { label: "Studies", value: stats.total },
                  { label: "Ready", value: stats.complete },
                  { label: "Due", value: dueToday },
                  { label: "Cards", value: stats.cards },
                  { label: "Quiz Qs", value: stats.quizzes },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </dt>
                    <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <Button
              size="lg"
              onClick={() => openNew()}
              aria-label="Create new study"
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
              New Study
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Start from
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Jump straight into YouTube, recording, or file upload.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {QUICK_START.map(({ type, label, hint, icon: Icon }) => (
            <li key={type}>
              <button
                type="button"
                onClick={() => openNew(type)}
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
              </button>
            </li>
          ))}
        </ul>
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
          {continueStudy ? (
            <section className="mt-10 border border-border/70 bg-card/50">
              <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div className="max-w-2xl space-y-2">
                  <p className="text-sm font-medium text-primary">
                    Continue studying
                  </p>
                  <h2 className="font-display text-2xl font-semibold tracking-tight">
                    {continueStudy.title}
                  </h2>
                  <p className="line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">
                    {summaryByStudy.get(continueStudy.id) ||
                      `${continueStudy.flashcard_count} flashcards and ${continueStudy.quiz_count ?? 0} quiz questions ready for active recall.`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={`/study/${continueStudy.id}`}>
                      Open notes
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/study/${continueStudy.id}`}>Practice cards</Link>
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

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
                      <div className="min-w-0">
                        <p className="truncate font-medium">{study.title}</p>
                        <div className="mt-2 h-1 w-40 max-w-full overflow-hidden bg-muted sm:w-56">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${Math.min(100, study.processing_progress)}%`,
                            }}
                          />
                        </div>
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
                    className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{study.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {study.error_message || "Processing failed"}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/study/${study.id}`}>View</Link>
                    </Button>
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
                      "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                      filter === item.id
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
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

          <section className="mt-12 border-t border-border/70 pt-8">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Today’s tip
            </p>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-foreground/90">
              {tip}
            </p>
          </section>
        </>
      )}

      <NewStudyModal
        open={open}
        onOpenChange={handleOpenChange}
        initialContentType={initialType}
      />
    </>
  );
}
