"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_LEARNING_NEEDS,
  LEARNER_BANDS,
  type LearningNeeds,
} from "@/lib/learner/bands";
import { cn } from "@/lib/utils/cn";
import type { ApiResponse } from "@/types/api";
import type { LearnerBand } from "@/types/database";

/**
 * One-time prompt for existing users who finished the product tour
 * before learner bands existed.
 */
export function LearnerProfilePrompt({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (payload: {
    learner_band: LearnerBand;
    learning_needs: LearningNeeds;
  }) => void;
}) {
  const [band, setBand] = useState<LearnerBand | null>(null);
  const [needs, setNeeds] = useState<LearningNeeds>({
    ...DEFAULT_LEARNING_NEEDS,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"band" | "needs">("band");

  useEffect(() => {
    if (open) {
      setPhase("band");
      setError(null);
    }
  }, [open]);

  async function save() {
    if (!band) {
      setError("Pick a level to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/settings/learner-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ learner_band: band, learning_needs: needs }),
    });
    const json = (await res.json()) as ApiResponse<{
      learner_band: LearnerBand | null;
      learning_needs: LearningNeeds;
    }>;
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    onSaved?.({
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
    onClose();
  }

  if (!open) return null;

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
          aria-label="Dismiss"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md border border-border/80 bg-card p-6 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-border/70 bg-muted/40">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="font-display mt-4 text-2xl font-semibold tracking-tight">
            {phase === "band"
              ? "Personalize your learning level"
              : "Optional learning aids"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {phase === "band"
              ? "StudySync adapts notes and the tutor to your age and level. Takes a few seconds."
              : "Turn on anything that helps — you can change this later on Progress."}
          </p>

          {phase === "band" ? (
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
          ) : (
            <div className="mt-5 space-y-3">
              {(
                [
                  ["simplified_language", "Simpler language"],
                  ["dyslexia_friendly", "Dyslexia-friendly reading"],
                  ["focus_assist", "Focus assist"],
                  ["reduced_motion", "Reduce motion"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-border/70 px-3 py-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={needs[key]}
                    onChange={(e) =>
                      setNeeds((n) => ({ ...n, [key]: e.target.checked }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          )}

          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            {phase === "needs" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void save()}
              >
                Skip aids
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={busy || (phase === "band" && !band)}
              onClick={() => {
                if (phase === "band") setPhase("needs");
                else void save();
              }}
            >
              {phase === "band" ? "Next" : busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
