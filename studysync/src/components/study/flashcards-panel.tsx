"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { cn } from "@/lib/utils/cn";
import { enqueueOfflineRating } from "@/lib/pwa/offline-review-queue";
import type { ApiResponse } from "@/types/api";
import type { Flashcard } from "@/types/database";

interface FlashcardsPanelProps {
  flashcards: Flashcard[];
  /** Compact mode for dashboard mini-review (no edit). */
  compact?: boolean;
  onRated?: () => void;
}

type SrsRating = "again" | "hard" | "good" | "easy";

const EASE = [0.22, 1, 0.36, 1] as const;

export function FlashcardsPanel({
  flashcards: initial,
  compact = false,
  onRated,
}: FlashcardsPanelProps) {
  const [cards, setCards] = useState(initial);
  const [dueOnly, setDueOnly] = useState(!compact);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(1);

  const dueCount = useMemo(() => {
    const now = Date.now();
    return cards.filter((c) => new Date(c.due_at || 0).getTime() <= now).length;
  }, [cards]);

  const dueCards = useMemo(() => {
    const now = Date.now();
    return cards.filter((c) => new Date(c.due_at || 0).getTime() <= now);
  }, [cards]);

  const queue = dueOnly ? dueCards : cards;
  const caughtUp = dueOnly && dueCards.length === 0 && cards.length > 0;

  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-8 text-center">
        <p className="font-display text-xl font-semibold tracking-tight">
          {compact ? "Caught up for now" : "No flashcards generated yet."}
        </p>
        {compact ? (
          <p className="text-sm text-muted-foreground">
            Nice work - come back when more cards are due.
          </p>
        ) : null}
      </div>
    );
  }

  if (caughtUp) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10 text-center">
        <p className="font-display text-2xl font-semibold tracking-tight">
          All caught up
        </p>
        <p className="text-sm text-muted-foreground">
          No cards due right now. Browse the full deck or come back later.
        </p>
        {!compact ? (
          <Button
            type="button"
            onClick={() => {
              setDueOnly(false);
              setIndex(0);
              setFlipped(false);
            }}
          >
            Show all cards
          </Button>
        ) : null}
      </div>
    );
  }

  const safeIndex = Math.min(index, Math.max(0, queue.length - 1));
  const card = queue[safeIndex];

  async function rate(srs_rating: SrsRating) {
    const advanceLocal = () => {
      setDirection(1);
      if (compact) {
        setCards((prev) => prev.filter((c) => c.id !== card.id));
        setFlipped(false);
        setIndex(0);
      } else {
        setFlipped(false);
        setIndex((i) => Math.min(queue.length - 1, i + 1));
      }
      onRated?.();
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueOfflineRating({
        flashcardId: card.id,
        srs_rating,
        queuedAt: new Date().toISOString(),
      });
      advanceLocal();
      return;
    }

    try {
      const res = await fetch(`/api/flashcards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ srs_rating }),
      });
      const json = (await res.json()) as ApiResponse<Flashcard>;
      if (json.success) {
        if (!compact) {
          setCards((prev) =>
            prev.map((c) => (c.id === card.id ? { ...c, ...json.data } : c))
          );
        }
        advanceLocal();
        return;
      }
    } catch {
      enqueueOfflineRating({
        flashcardId: card.id,
        srs_rating,
        queuedAt: new Date().toISOString(),
      });
      advanceLocal();
    }
  }

  async function saveEdits() {
    setSaving(true);
    const res = await fetch(`/api/flashcards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: card.question,
        answer: card.answer,
      }),
    });
    setSaving(false);
    if ((await res.json()).success) setEditing(false);
  }

  return (
    <div className={cn("mx-auto max-w-xl space-y-6", compact && "max-w-md")}>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Card {safeIndex + 1} of {queue.length}
          {dueOnly ? ` · ${dueCount} due` : ""}
        </span>
        {!compact ? (
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => {
              setDueOnly((v) => !v);
              setIndex(0);
              setFlipped(false);
            }}
          >
            {dueOnly ? "Show all cards" : "Study due only"}
          </button>
        ) : null}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={card.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -56 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <button
              type="button"
              className="relative w-full [perspective:1400px]"
              onClick={() => !editing && setFlipped((f) => !f)}
              aria-label={flipped ? "Show question" : "Flip to answer"}
            >
              <motion.div
                className={cn(
                  "relative w-full border border-border/70 bg-card p-8 text-left shadow-[0_20px_50px_-28px_rgba(15,23,42,0.45)] [transform-style:preserve-3d]",
                  compact ? "min-h-[220px]" : "min-h-[280px] sm:min-h-[320px]"
                )}
                animate={{ rotateY: flipped ? 180 : 0, scale: flipped ? 1.02 : 1 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <div
                  className={cn(
                    "absolute inset-0 flex flex-col justify-center p-8 sm:p-10",
                    flipped && "pointer-events-none"
                  )}
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Question
                  </p>
                  {editing ? (
                    <Textarea
                      value={card.question}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setCards((prev) =>
                          prev.map((c) =>
                            c.id === card.id
                              ? { ...c, question: e.target.value }
                              : c
                          )
                        )
                      }
                      className="min-h-[140px]"
                    />
                  ) : (
                    <div className="font-display text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
                      <MarkdownMath>{card.question}</MarkdownMath>
                    </div>
                  )}
                  {!editing ? (
                    <p className="mt-8 text-xs text-muted-foreground">
                      Tap to reveal
                    </p>
                  ) : null}
                </div>
                <div
                  className="absolute inset-0 flex flex-col justify-center p-8 sm:p-10"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Answer
                  </p>
                  {editing ? (
                    <Textarea
                      value={card.answer}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setCards((prev) =>
                          prev.map((c) =>
                            c.id === card.id
                              ? { ...c, answer: e.target.value }
                              : c
                          )
                        )
                      }
                      className="min-h-[140px]"
                    />
                  ) : (
                    <div className="text-lg leading-relaxed sm:text-xl">
                      <MarkdownMath>{card.answer}</MarkdownMath>
                    </div>
                  )}
                </div>
              </motion.div>
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {!compact ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDirection(-1);
              setFlipped(false);
              setIndex((i) => Math.max(0, i - 1));
            }}
            disabled={safeIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={() => void rate("again")}
        >
          Again
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => void rate("hard")}
        >
          Hard
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-primary/50 text-primary"
          onClick={() => void rate("good")}
        >
          Good
        </Button>
        <Button type="button" size="sm" onClick={() => void rate("easy")}>
          Easy
        </Button>
        {!compact ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDirection(1);
              setFlipped(false);
              setIndex((i) => Math.min(queue.length - 1, i + 1));
            }}
            disabled={safeIndex >= queue.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {!compact ? (
        <div className="flex justify-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? "Cancel edit" : "Edit card"}
          </Button>
          {editing ? (
            <Button
              type="button"
              size="sm"
              onClick={() => void saveEdits()}
              disabled={saving}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
