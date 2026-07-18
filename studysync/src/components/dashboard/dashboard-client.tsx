"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { NewStudyModal } from "@/components/upload/new-study-modal";
import { StudyCard } from "@/components/dashboard/study-card";
import { Button } from "@/components/ui/button";
import type { Study } from "@/types/database";

interface DashboardClientProps {
  studies: Study[];
  userName?: string | null;
}

export function DashboardClient({ studies, userName }: DashboardClientProps) {
  const [open, setOpen] = useState(false);

  const firstName =
    userName?.trim().split(/\s+/)[0] ||
    null;

  const stats = useMemo(() => {
    const complete = studies.filter((s) => s.status === "complete").length;
    const processing = studies.filter((s) => s.status === "processing").length;
    const cards = studies.reduce((sum, s) => sum + (s.flashcard_count || 0), 0);
    return { complete, processing, cards, total: studies.length };
  }, [studies]);

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
              Upload a lecture and StudySync builds notes, flashcards, and
              quizzes ready for active recall.
            </p>
          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-8">
            {studies.length > 0 ? (
              <dl className="grid grid-cols-3 gap-6 text-left">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Studies
                  </dt>
                  <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">
                    {stats.total}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Ready
                  </dt>
                  <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">
                    {stats.complete}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Cards
                  </dt>
                  <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">
                    {stats.cards}
                  </dd>
                </div>
              </dl>
            ) : null}
            <Button
              size="lg"
              onClick={() => setOpen(true)}
              aria-label="Create new study"
              className="shrink-0"
            >
              <Plus className="h-4 w-4" />
              New Study
            </Button>
          </div>
        </div>
      </section>

      {studies.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 flex flex-col items-start border border-dashed border-border/80 px-6 py-16 sm:px-10"
        >
          <p className="text-sm font-medium text-primary">Get started</p>
          <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            Begin with one lecture
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Drop a PDF, PowerPoint, video, or audio file. StudySync will turn it
            into a study pack in minutes.
          </p>
          <Button className="mt-8" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Upload lecture
          </Button>
        </motion.div>
      ) : (
        <div className="mt-10 space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Recent
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a pack to review notes, cards, and quizzes.
              </p>
            </div>
            {stats.processing > 0 ? (
              <p className="text-sm text-muted-foreground">
                {stats.processing} generating…
              </p>
            ) : null}
          </div>

          <motion.ul
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.06 } },
            }}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {studies.map((study) => (
              <motion.li
                key={study.id}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <StudyCard study={study} />
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
                onClick={() => setOpen(true)}
                className="group flex h-full min-h-[11.5rem] w-full flex-col items-start justify-between border border-dashed border-border/80 bg-transparent p-5 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
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
        </div>
      )}

      <NewStudyModal open={open} onOpenChange={setOpen} />
    </>
  );
}
