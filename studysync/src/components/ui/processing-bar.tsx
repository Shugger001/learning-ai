"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

const EASE = [0.22, 1, 0.36, 1] as const;

export function ProcessingBar({
  value,
  className,
  shimmer = true,
}: {
  value: number;
  className?: string;
  shimmer?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div
      className={cn("relative h-1.5 w-full overflow-hidden bg-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="relative h-full bg-primary"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.55, ease: EASE }}
      >
        {shimmer && pct < 100 ? (
          <div
            className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/35 to-transparent"
            aria-hidden
          />
        ) : null}
      </motion.div>
    </div>
  );
}
