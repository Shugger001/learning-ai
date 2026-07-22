const QUEUE_KEY = "studysync_offline_srs_queue";
const DUE_CACHE_KEY = "studysync_due_cache";

export type OfflineSrsItem = {
  flashcardId: string;
  srs_rating: "again" | "hard" | "good" | "easy";
  queuedAt: string;
};

export function readOfflineQueue(): OfflineSrsItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineSrsItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeOfflineQueue(items: OfflineSrsItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function enqueueOfflineRating(item: OfflineSrsItem) {
  const queue = readOfflineQueue().filter((q) => q.flashcardId !== item.flashcardId);
  queue.push(item);
  writeOfflineQueue(queue);
}

export function cacheDuePayload(payload: unknown) {
  try {
    localStorage.setItem(
      DUE_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), payload })
    );
  } catch {
    // ignore quota
  }
}

export function readDueCache<T>(): T | null {
  try {
    const raw = localStorage.getItem(DUE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payload: T };
    return parsed.payload ?? null;
  } catch {
    return null;
  }
}

export async function flushOfflineQueue(): Promise<number> {
  if (typeof window === "undefined" || !navigator.onLine) return 0;
  const queue = readOfflineQueue();
  if (!queue.length) return 0;

  const remaining: OfflineSrsItem[] = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      const res = await fetch(`/api/flashcards/${item.flashcardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ srs_rating: item.srs_rating }),
      });
      if (!res.ok) {
        remaining.push(item);
        continue;
      }
      flushed += 1;
    } catch {
      remaining.push(item);
    }
  }

  writeOfflineQueue(remaining);
  return flushed;
}
