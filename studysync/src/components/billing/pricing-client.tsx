"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FREE_LIMITS } from "@/lib/billing/limits";
import { EASE, fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import type { ApiResponse } from "@/types/api";
import type { PlanType } from "@/types/database";

interface PricingClientProps {
  plan: PlanType;
}

export function PricingClient({ plan }: PricingClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upgrade() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/billing/checkout", { method: "POST" });
    const json = (await res.json()) as ApiResponse<{
      mode: string;
      url: string | null;
      message?: string;
    }>;
    setLoading(false);
    if (!json.success) {
      setMessage(json.error);
      return;
    }
    if (json.data.url) {
      window.location.href = json.data.url;
      return;
    }
    setMessage(json.data.message ?? "Upgraded to Pro.");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <motion.div className="space-y-3 text-center" {...fadeUp}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Pricing
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Study without limits
        </h1>
        <p className="text-[15px] text-muted-foreground">
          Free covers getting started with a 30-day usage window. Pro unlocks
          unlimited uploads, chat, and podcasts.
        </p>
      </motion.div>

      <motion.div
        className="grid gap-4 sm:grid-cols-2"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.article
          variants={staggerItem}
          whileHover={{ y: -4 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="border border-border/70 bg-card/40 p-6"
        >
          <h2 className="font-display text-xl font-semibold">Free</h2>
          <p className="mt-1 text-sm text-muted-foreground">For trying StudySync</p>
          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {FREE_LIMITS.uploads} uploads / 30 days
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {FREE_LIMITS.chat} chat messages / 30 days
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {FREE_LIMITS.podcasts} podcasts / 30 days
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Notes, flashcards, quizzes, mind maps
            </li>
          </ul>
          <p className="mt-6 text-sm font-medium">
            {plan === "free" ? "Current plan" : "Included"}
          </p>
        </motion.article>

        <motion.article
          variants={staggerItem}
          whileHover={{ y: -4 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="border border-primary/40 bg-primary/5 p-6"
        >
          <div className="flex items-center gap-2">
            <motion.span
              animate={{ rotate: [0, 12, -8, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="h-4 w-4 text-primary" />
            </motion.span>
            <h2 className="font-display text-xl font-semibold">Pro</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Unlimited learning loop</p>
          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Unlimited uploads
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Unlimited study chat
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Unlimited AI podcasts
            </li>
          </ul>
          {plan === "pro" ? (
            <p className="mt-6 text-sm font-medium text-primary">You&apos;re on Pro</p>
          ) : (
            <Button
              className="mt-6 w-full"
              onClick={() => void upgrade()}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Upgrade to Pro
            </Button>
          )}
        </motion.article>
      </motion.div>

      {message ? (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="text-center text-sm text-muted-foreground"
          role="status"
        >
          {message}
        </motion.p>
      ) : null}
    </div>
  );
}
