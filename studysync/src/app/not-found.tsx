"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fadeUp } from "@/lib/motion";

export default function NotFound() {
  return (
    <motion.main
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center"
      {...fadeUp}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        404
      </p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="text-sm text-muted-foreground">
        That study or page doesn&apos;t exist.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </motion.main>
  );
}
