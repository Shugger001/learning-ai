"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { BADGE_CATALOG } from "@/lib/progress/badges";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "xp" | "badge";
};

type ToastContextValue = {
  push: (toast: Omit<ToastItem, "id">) => void;
  pushXp: (awards?: {
    gained?: number;
    level?: number;
    badges?: string[];
  } | null) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems((prev) => [...prev.slice(-4), { ...toast, id }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const pushXp = useCallback(
    (awards?: { gained?: number; level?: number; badges?: string[] } | null) => {
      if (!awards) return;
      if (awards.gained && awards.gained > 0) {
        push({
          title: `+${awards.gained} XP`,
          description: awards.level ? `Level ${awards.level}` : undefined,
          variant: "xp",
        });
      }
      for (const key of awards.badges ?? []) {
        const badge = BADGE_CATALOG[key];
        push({
          title: badge?.title ?? "Achievement unlocked",
          description: badge?.description,
          variant: "badge",
        });
      }
    },
    [push]
  );

  const value = useMemo(() => ({ push, pushXp }), [push, pushXp]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto border border-border/80 bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold tracking-tight">
                    {t.variant === "badge" ? "★ " : ""}
                    {t.title}
                  </p>
                  {t.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Dismiss"
                  onClick={() =>
                    setItems((prev) => prev.filter((x) => x.id !== t.id))
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      push: () => undefined,
      pushXp: () => undefined,
    } satisfies ToastContextValue;
  }
  return ctx;
}
