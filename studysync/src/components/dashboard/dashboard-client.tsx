"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { NewStudyModal } from "@/components/upload/new-study-modal";
import { StudyCard } from "@/components/dashboard/study-card";
import { Button } from "@/components/ui/button";
import type { Study } from "@/types/database";

export function DashboardClient({ studies }: { studies: Study[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your studies</h1>
          <p className="mt-1 text-muted-foreground">
            Upload a lecture and get notes, flashcards, quizzes, and a mind map.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} aria-label="Create new study">
          <Plus className="h-4 w-4" />
          New Study
        </Button>
      </div>

      {studies.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-20 text-center"
        >
          <h2 className="text-lg font-medium">No studies yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Drop a PDF or lecture video to generate your first active-recall pack.
          </p>
          <Button className="mt-6" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New Study
          </Button>
        </motion.div>
      ) : (
        <motion.ul
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05 } },
          }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {studies.map((study) => (
            <motion.li
              key={study.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 },
              }}
            >
              <StudyCard study={study} />
            </motion.li>
          ))}
        </motion.ul>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="New Study"
      >
        <Plus className="h-6 w-6" />
      </button>

      <NewStudyModal open={open} onOpenChange={setOpen} />
    </>
  );
}
