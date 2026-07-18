"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";

export function PageReveal({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={fadeUp.initial}
      animate={fadeUp.animate}
      transition={fadeUp.transition}
    >
      {children}
    </motion.div>
  );
}
