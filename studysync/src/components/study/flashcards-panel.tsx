"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import type { ApiResponse } from "@/types/api";
import type { Flashcard, FlashcardDifficulty } from "@/types/database";

interface FlashcardsPanelProps {
  flashcards: Flashcard[];
}

export function FlashcardsPanel({ flashcards: initial }: FlashcardsPanelProps) {
  const [cards, setCards] = useState(initial);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No flashcards generated yet.</p>
    );
  }

  const card = cards[index];

  async function markDifficulty(difficulty: FlashcardDifficulty) {
    const res = await fetch(`/api/flashcards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty }),
    });
    const json = (await res.json()) as ApiResponse<Flashcard>;
    if (json.success) {
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, difficulty } : c))
      );
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
    if ((await res.json()).success) {
      setEditing(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Card {index + 1} of {cards.length}
        </span>
        <span className="capitalize">Marked: {card.difficulty}</span>
      </div>

      <button
        type="button"
        className="relative w-full [perspective:1200px]"
        onClick={() => !editing && setFlipped((f) => !f)}
        aria-label={flipped ? "Show question" : "Flip to answer"}
      >
        <motion.div
          className="relative min-h-[220px] w-full rounded-xl border bg-card p-8 text-left shadow-sm [transform-style:preserve-3d]"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.45 }}
        >
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-center p-8 backface-hidden",
              flipped && "pointer-events-none"
            )}
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Question
            </p>
            {editing ? (
              <Textarea
                value={card.question}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  setCards((prev) =>
                    prev.map((c, i) =>
                      i === index ? { ...c, question: e.target.value } : c
                    )
                  )
                }
                className="min-h-[120px]"
              />
            ) : (
              <p className="text-lg font-medium leading-relaxed">{card.question}</p>
            )}
          </div>
          <div
            className="absolute inset-0 flex flex-col justify-center p-8"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Answer
            </p>
            {editing ? (
              <Textarea
                value={card.answer}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  setCards((prev) =>
                    prev.map((c, i) =>
                      i === index ? { ...c, answer: e.target.value } : c
                    )
                  )
                }
                className="min-h-[120px]"
              />
            ) : (
              <p className="text-lg leading-relaxed">{card.answer}</p>
            )}
          </div>
        </motion.div>
      </button>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setFlipped(false);
            setIndex((i) => Math.max(0, i - 1));
          }}
          disabled={index === 0}
          aria-label="Previous card"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => markDifficulty("easy")}
        >
          Easy
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => markDifficulty("hard")}
        >
          Hard
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setFlipped(false);
            setIndex((i) => Math.min(cards.length - 1, i + 1));
          }}
          disabled={index === cards.length - 1}
          aria-label="Next card"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

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
          <Button type="button" size="sm" onClick={saveEdits} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
