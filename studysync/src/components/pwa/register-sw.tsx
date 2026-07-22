"use client";

import { useEffect, useState } from "react";
import { flushOfflineQueue, readOfflineQueue } from "@/lib/pwa/offline-review-queue";

export function RegisterServiceWorker() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register("/sw.js")
      .catch(() => undefined);

    function refreshPending() {
      setPending(readOfflineQueue().length);
    }

    async function onOnline() {
      await flushOfflineQueue();
      refreshPending();
    }

    refreshPending();
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", refreshPending);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", refreshPending);
    };
  }, []);

  if (pending <= 0) return null;

  return (
    <div className="fixed bottom-3 left-1/2 z-50 -translate-x-1/2 border border-border/80 bg-card px-3 py-1.5 text-xs shadow-md">
      {pending} offline review{pending === 1 ? "" : "s"} will sync when online
    </div>
  );
}
