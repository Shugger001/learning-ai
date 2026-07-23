"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Accessibility,
  BookOpen,
  GraduationCap,
  Layers,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_LEARNING_NEEDS,
  LEARNER_BANDS,
  type LearningNeeds,
} from "@/lib/learner/bands";
import { cn } from "@/lib/utils/cn";
import type { ApiResponse } from "@/types/api";
import type { LearnerBand, Study } from "@/types/database";

const PRODUCT_STEPS = [
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
] as const;

type StepId = "band" | "needs" | (typeof PRODUCT_STEPS)[number]["id"];

const NEED_TOGGLES: {
  key: keyof LearningNeeds;
  label: string;
  hint: string;
}[] = [
  {
    key: "simplified_language",
    label: "Simpler language",
    hint: "Shorter sentences and everyday words in AI materials",
  },
  {
    key: "dyslexia_friendly",
    label: "Dyslexia-friendly reading",
    hint: "More spacing and a clearer typeface",
  },
  {
    key: "focus_assist",
    label: "Focus assist",
    hint: "Calmer chrome and larger tap targets",
  },
  {
    key: "reduced_motion",
    label: "Reduce motion",
    hint: "Minimize animations and transitions",
  },
];

export function FirstRunTour({
  open,
  studyCount,
  onClose,
  onSampleStarted,
  onLearnerSaved,
}: {
  open: boolean;
  studyCount: number;
  onClose: () => void;
  onSampleStarted?: (study: Study) => void;
  onLearnerSaved?: (payload: {
    learner_band: LearnerBand;
    learning_needs: LearningNeeds;
  }) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [band, setBand] = useState<LearnerBand | null>(null);
  const [needs, setNeeds] = useState<LearningNeeds>({
    ...DEFAULT_LEARNING_NEEDS,
  });

  const steps: { id: StepId; title: string; body: string; icon: typeof Upload }[] =
    [
      {
        id: "band",
        title: "Who are you studying as?",
        body: "We’ll match notes, quizzes, and the tutor to your level. You can change this anytime on Progress.",
        icon: GraduationCap,
      },
      {
        id: "needs",
        title: "Make StudySync easier for you",
        body: "Optional — pick anything that helps. Skip if you’re not sure.",
        icon: Accessibility,
      },
      ...PRODUCT_STEPS.map((s) => ({
        id: s.id as StepId,
        title: s.title,
        body: s.body,
        icon: s.icon,
      })),
    ];

  useEffect(() => {
    if (open) {
      setStep(0);
      setError(null);
    }
  }, [open]);

  async function saveLearnerProfile() {
    if (!band) return false;
    const res = await fetch("/api/settings/learner-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learner_band: band, learning_needs: needs }),
    });
    const json = (await res.json()) as ApiResponse<{
      learner_band: LearnerBand | null;
      learning_needs: LearningNeeds;
    }>;
    if (!json.success) {
      setError(json.error);
      return false;
    }
    onLearnerSaved?.({
      learner_band: band,
      learning_needs: json.data.learning_needs,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("studysync:learner-profile", {
          detail: {
            learner_band: band,
            learning_needs: json.data.learning_needs,
          },
        })
      );
    }
    return true;
  }

  async function complete() {
    if (band) {
      await saveLearnerProfile();
    }
    await fetch("/api/onboarding/complete", { method: "POST" });
    onClose();
  }

  async function goNext() {
    setError(null);
    if (steps[step]?.id === "band") {
      if (!band) {
        setError("Pick a level to continue.");
        return;
      }
    }
    if (steps[step]?.id === "needs") {
      setBusy(true);
      const ok = await saveLearnerProfile();
      setBusy(false);
      if (!ok) return;
    }
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }

  async function startSample() {
    setBusy(true);
    setError(null);
    if (band) {
      const ok = await saveLearnerProfile();
      if (!ok) {
        setBusy(false);
        return;
      }
    }
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
      listJson.data.find((i) =>
        /memory|psychology|kinetics|stoich/i.test(i.title)
      ) ?? listJson.data[0];
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

  const current = steps[step]!;
  const Icon = current.icon;
  const productStepIndex = step - 2;

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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void complete()}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Step {step + 1} of {steps.length}
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight">
            {current.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {current.body}
          </p>

          {current.id === "band" ? (
            <div className="mt-5 grid gap-2">
              {LEARNER_BANDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBand(b.id)}
                  className={cn(
                    "rounded-md border px-3 py-2.5 text-left transition-colors",
                    band === b.id
                      ? "border-primary bg-primary/10"
                      : "border-border/70 hover:border-border"
                  )}
                >
                  <span className="block text-sm font-semibold">{b.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {b.hint}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {current.id === "needs" ? (
            <div className="mt-5 space-y-3">
              {NEED_TOGGLES.map((t) => (
                <label
                  key={t.key}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={needs[t.key]}
                    onChange={(e) =>
                      setNeeds((n) => ({ ...n, [t.key]: e.target.checked }))
                    }
                  />
                  <span>
                    <span className="block text-sm font-semibold">{t.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          {current.id === "upload" && studyCount === 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void startSample()}
              >
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
              disabled={step === 0 || busy}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
            {step < steps.length - 1 ? (
              <div className="flex gap-2">
                {current.id === "needs" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || !band}
                    onClick={() => void goNext()}
                  >
                    Skip
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || (current.id === "band" && !band)}
                  onClick={() => void goNext()}
                >
                  Next
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void complete()}
              >
                Got it
              </Button>
            )}
          </div>
          {productStepIndex >= 0 ? (
            <p className="sr-only">Product tip {productStepIndex + 1}</p>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
