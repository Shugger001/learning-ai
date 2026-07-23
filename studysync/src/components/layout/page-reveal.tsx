"use client";

import { motion } from "framer-motion";
import { fadeUp, motionDuration } from "@/lib/motion";
import { usePreferReducedMotion } from "@/components/providers/learner-prefs-provider";

export function PageReveal({ children }: { children: React.ReactNode }) {
  const reduce = usePreferReducedMotion();
  const duration = reduce ? 0.01 : motionDuration(fadeUp.transition.duration);

  return (
    <motion.div
      initial={reduce ? false : fadeUp.initial}
      animate={fadeUp.animate}
      transition={{ ...fadeUp.transition, duration }}
    >
      {children}
    </motion.div>
  );
}
