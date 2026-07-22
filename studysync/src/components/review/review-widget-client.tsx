"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import { FlashcardsPanel } from "@/components/study/flashcards-panel";
import { Button } from "@/components/ui/button";
import {
  cacheDuePayload,
  flushOfflineQueue,
  readDueCache,
} from "@/lib/pwa/offline-review-queue";
import type { ApiResponse } from "@/types/api";
import type { Flashcard } from "@/types/database";
import type { ReviewTodayPayload } from "@/types/review";

/** Ultra-compact home-screen review surface (PWA shortcut target). */
export function ReviewWidgetClient({
  initial,
}: {
  initial: ReviewTodayPayload;
}) {
  const [dueCards, setDueCards] = useState<Flashcard[]>(initial.dueCards);
  const [dueCount, setDueCount] = useState(initial.dueCount);

  useEffect(() => {
    void flushOfflineQueue();
    cacheDuePayload(initial);
  }, [initial]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/review/today");
      const json = (await res.json()) as ApiResponse<ReviewTodayPayload>;
      if (!json.success) return;
      setDueCards(json.data.dueCards);
      setDueCount(json.data.dueCount);
      cacheDuePayload(json.data);
    } catch {
      const cached = readDueCache<ReviewTodayPayload>();
      if (cached) {
        setDueCards(cached.dueCards);
        setDueCount(cached.dueCount);
      }
    }
  }, []);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Quick review
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {dueCount} due
          </h1>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/review">Full review</Link>
        </Button>
      </div>

      {dueCards.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <Layers className="h-8 w-8 text-muted-foreground" />
          <p className="font-display text-xl font-semibold tracking-tight">
            Caught up
          </p>
          <p className="text-sm text-muted-foreground">
            No cards due right now. Check back later.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      ) : (
        <FlashcardsPanel
          flashcards={dueCards}
          compact
          onRated={() => void refresh()}
        />
      )}
    </div>
  );
}
