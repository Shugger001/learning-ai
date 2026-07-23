"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { cn } from "@/lib/utils/cn";
import { enqueueOfflineRating } from "@/lib/pwa/offline-review-queue";
import { useToast } from "@/components/ui/toast";
import type { ApiResponse } from "@/types/api";
import type { Flashcard, OcclusionRect } from "@/types/database";

interface FlashcardsPanelProps {
  flashcards: Flashcard[];
  /** Compact mode for dashboard mini-review (no edit). */
  compact?: boolean;
  onRated?: () => void;
  /** Filter deck to cards matching this query (mind map jump). */
  focusQuery?: string | null;
  /** Report current card for study-room presence. */
  onFocusCard?: (card: Flashcard | null) => void;
  /** Jump to a peer's focused card id when set. */
  followCardId?: string | null;
}

type SrsRating = "again" | "hard" | "good" | "easy";

const EASE = [0.22, 1, 0.36, 1] as const;

export function FlashcardsPanel({
  flashcards: initial,
  compact = false,
  onRated,
  focusQuery = null,
  onFocusCard,
  followCardId = null,
}: FlashcardsPanelProps) {
  const [cards, setCards] = useState(initial);
  const [dueOnly, setDueOnly] = useState(!compact && !focusQuery);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(1);
  const [revealedOcclusions, setRevealedOcclusions] = useState<string[]>([]);
  const { pushXp } = useToast();

  const focusedCards = useMemo(() => {
    if (!focusQuery?.trim()) return null;
    const q = focusQuery.toLowerCase();
    return cards.filter(
      (c) =>
        c.question.toLowerCase().includes(q) ||
        c.answer.toLowerCase().includes(q)
    );
  }, [cards, focusQuery]);

  const dueCount = useMemo(() => {
    const now = Date.now();
    return cards.filter((c) => new Date(c.due_at || 0).getTime() <= now).length;
  }, [cards]);

  const dueCards = useMemo(() => {
    const now = Date.now();
    return cards.filter((c) => new Date(c.due_at || 0).getTime() <= now);
  }, [cards]);

  const queue = focusedCards ?? (dueOnly ? dueCards : cards);
  const caughtUp =
    !focusQuery && dueOnly && dueCards.length === 0 && cards.length > 0;

  useEffect(() => {
    setIndex(0);
    setFlipped(false);
    setRevealedOcclusions([]);
    if (focusQuery) setDueOnly(false);
  }, [focusQuery]);

  useEffect(() => {
    if (!followCardId) return;
    const idx = cards.findIndex((c) => c.id === followCardId);
    if (idx >= 0) {
      setDueOnly(false);
      setIndex(idx);
      setFlipped(false);
    }
  }, [followCardId, cards]);

  useEffect(() => {
    if (!onFocusCard) return;
    const safe = Math.min(index, Math.max(0, queue.length - 1));
    onFocusCard(queue[safe] ?? null);
    // Intentionally omit queue identity; index + length cover focus changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, queue.length, onFocusCard]);

  useEffect(() => {
    setRevealedOcclusions([]);
    setFlipped(false);
  }, [index]);

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

  if (focusQuery && (!focusedCards || focusedCards.length === 0)) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-8 text-center">
        <p className="font-display text-xl font-semibold tracking-tight">
          No cards match “{focusQuery}”
        </p>
        <p className="text-sm text-muted-foreground">
          Try another mind-map node or browse the full deck.
        </p>
      </div>
    );
  }

  const safeIndex = Math.min(index, Math.max(0, queue.length - 1));
  const card = queue[safeIndex];
  if (!card) return null;

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
      const json = (await res.json()) as ApiResponse<
        Flashcard & {
          awards?: { gained?: number; level?: number; badges?: string[] };
        }
      >;
      if (json.success) {
        const { awards, ...cardData } = json.data;
        pushXp(awards);
        if (!compact) {
          setCards((prev) =>
            prev.map((c) => (c.id === card.id ? { ...c, ...cardData } : c))
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
        image_url: card.image_url || null,
        occlusion: card.occlusion ?? [],
      }),
    });
    setSaving(false);
    if ((await res.json()).success) setEditing(false);
  }

  const occlusions: OcclusionRect[] = Array.isArray(card.occlusion)
    ? card.occlusion
    : [];

  function addOcclusionBox() {
    const next: OcclusionRect = {
      id: `o-${Math.random().toString(36).slice(2, 8)}`,
      x: 20,
      y: 20,
      w: 30,
      h: 18,
    };
    setCards((prev) =>
      prev.map((c) =>
        c.id === card.id
          ? { ...c, occlusion: [...(c.occlusion ?? []), next] }
          : c
      )
    );
  }

  return (
    <div className={cn("mx-auto max-w-xl space-y-6", compact && "max-w-md")}>
      {focusQuery ? (
        <p className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Focused on mind-map topic:{" "}
          <span className="font-medium text-foreground">{focusQuery}</span>
        </p>
      ) : null}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Card {safeIndex + 1} of {queue.length}
          {dueOnly && !focusQuery ? ` · ${dueCount} due` : ""}
        </span>
        {!compact && !focusQuery ? (
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
                  {card.image_url ? (
                    <div
                      className="relative mb-4 overflow-hidden border border-border/60"
                      onClick={(e) => {
                        if (editing) e.stopPropagation();
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={card.image_url}
                        alt=""
                        className="max-h-56 w-full object-contain"
                      />
                      {occlusions.map((box) => {
                        const revealed =
                          flipped || revealedOcclusions.includes(box.id);
                        return (
                          <button
                            key={box.id}
                            type="button"
                            className={cn(
                              "absolute border border-white/40",
                              revealed
                                ? "bg-transparent"
                                : "bg-foreground/90"
                            )}
                            style={{
                              left: `${box.x}%`,
                              top: `${box.y}%`,
                              width: `${box.w}%`,
                              height: `${box.h}%`,
                            }}
                            aria-label={
                              revealed ? "Revealed region" : "Reveal region"
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (editing) {
                                setCards((prev) =>
                                  prev.map((c) =>
                                    c.id === card.id
                                      ? {
                                          ...c,
                                          occlusion: (c.occlusion ?? []).filter(
                                            (o) => o.id !== box.id
                                          ),
                                        }
                                      : c
                                  )
                                );
                                return;
                              }
                              setRevealedOcclusions((ids) =>
                                ids.includes(box.id) ? ids : [...ids, box.id]
                              );
                            }}
                          />
                        );
                      })}
                    </div>
                  ) : null}
                  {editing ? (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <Textarea
                        value={card.question}
                        onChange={(e) =>
                          setCards((prev) =>
                            prev.map((c) =>
                              c.id === card.id
                                ? { ...c, question: e.target.value }
                                : c
                            )
                          )
                        }
                        className="min-h-[100px]"
                      />
                      <Input
                        value={card.image_url ?? ""}
                        placeholder="Image URL for occlusion (optional)"
                        onChange={(e) =>
                          setCards((prev) =>
                            prev.map((c) =>
                              c.id === card.id
                                ? { ...c, image_url: e.target.value || null }
                                : c
                            )
                          )
                        }
                      />
                      {card.image_url ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={addOcclusionBox}
                        >
                          Add hide box
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="font-display text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
                      <MarkdownMath>{card.question}</MarkdownMath>
                    </div>
                  )}
                  {!editing ? (
                    <p className="mt-8 text-xs text-muted-foreground">
                      {card.image_url
                        ? "Tap a box to reveal · tap card for answer"
                        : "Tap to reveal"}
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
