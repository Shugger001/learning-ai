"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FREE_LIMITS } from "@/lib/billing/limits";
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
      <div className="space-y-3 text-center">
        <p className="text-sm font-medium text-primary">Pricing</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Study without limits
        </h1>
        <p className="text-[15px] text-muted-foreground">
          Free covers getting started. Pro unlocks unlimited uploads, chat, and
          podcasts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="border border-border/70 bg-card/40 p-6">
          <h2 className="font-display text-xl font-semibold">Free</h2>
          <p className="mt-1 text-sm text-muted-foreground">For trying StudySync</p>
          <ul className="mt-6 space-y-2 text-sm">
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {FREE_LIMITS.uploads} uploads / month
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {FREE_LIMITS.chat} chat messages
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {FREE_LIMITS.podcasts} podcasts
            </li>
          </ul>
          <p className="mt-6 text-sm font-medium">
            {plan === "free" ? "Current plan" : "Included"}
          </p>
        </article>

        <article className="border border-primary/40 bg-primary/5 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
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
            <Button className="mt-6 w-full" onClick={() => void upgrade()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Upgrade to Pro
            </Button>
          )}
        </article>
      </div>

      {message ? (
        <p className="text-center text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
