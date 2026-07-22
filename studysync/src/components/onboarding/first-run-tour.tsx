"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Layers, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";
import type { Study } from "@/types/database";

const STEPS = [
  {
    id: "upload",
    title: "Add your first lecture",
    body: "Paste a YouTube link, record audio, or upload a PDF. StudySync builds notes, cards, and quizzes.",
    icon: Upload,
  },
  {
    id: "review",
    title: "Review with spaced recall",
    body: "Due cards and short quizzes live on Review. Calendar shows what’s coming this week.",
    icon: Layers,
  },
  {
    id: "share",
    title: "Share and study together",
    body: "Invite classmates to comment or co-edit notes. Progress tracks your streak.",
    icon: Sparkles,
  },
];

export function FirstRunTour({
  open,
  studyCount,
  onClose,
  onSampleStarted,
}: {
  open: boolean;
  studyCount: number;
  onClose: () => void;
  onSampleStarted?: (study: Study) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  async function complete() {
    await fetch("/api/onboarding/complete", { method: "POST" });
    onClose();
  }

  async function startSample() {
    setBusy(true);
    setError(null);
    const listRes = await fetch("/api/library");
    const listJson = (await listRes.json()) as ApiResponse<
      { id: string; title: string }[]
    >;
    if (!listJson.success || !listJson.data.length) {
      setBusy(false);
      setError("No library packs available yet.");
      return;
    }
    const preferred =
      listJson.data.find((i) => /memory|psychology|kinetics|stoich/i.test(i.title)) ??
      listJson.data[0];
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: preferred.id }),
    });
    const json = (await res.json()) as ApiResponse<Study>;
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    onSampleStarted?.(json.data);
    await complete();
    router.push(`/study/${json.data.id}`);
  }

  if (!open) return null;

  const current = STEPS[step]!;
  const Icon = current.icon;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-4 sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          type="button"
          className="absolute inset-0"
          aria-label="Dismiss tour"
          onClick={() => void complete()}
        />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md border border-border/80 bg-card p-6 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-border/70 bg-muted/40">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => void complete()}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            {current.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {current.body}
          </p>

          {step === 0 && studyCount === 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={() => void startSample()}>
                <BookOpen className="h-4 w-4" />
                {busy ? "Starting…" : "Try a sample pack"}
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard?new=1" onClick={() => void complete()}>
                  Upload my own
                </Link>
              </Button>
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => void complete()}>
                Got it
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
