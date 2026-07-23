"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import type { ApiResponse } from "@/types/api";

type BillingPayload = {
  free: number;
  pro: number;
  withStripe: number;
  recentPro: {
    user_id: string;
    full_name: string | null;
    stripe_customer_id: string | null;
    updated_at: string;
  }[];
  nearLimit: {
    user_id: string;
    full_name: string | null;
    uploads_used: number;
    chat_used: number;
    podcasts_used: number;
  }[];
  env: {
    stripeConfigured: boolean;
    priceConfigured: boolean;
    webhookConfigured: boolean;
  };
};

export function AdminBillingClient() {
  const [data, setData] = useState<BillingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch("/api/admin/billing");
    const json = (await res.json()) as ApiResponse<BillingPayload>;
    if (!json.success) {
      setError(json.error);
      return;
    }
    setData(json.data);
  }

  useEffect(() => {
    void load();
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading billing…</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-accent">Billing</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Revenue pulse
          </h1>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="border border-border/70 bg-card/50 p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pro</p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
            <AnimatedNumber value={data.pro} />
          </p>
        </div>
        <div className="border border-border/70 bg-card/50 p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Free</p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
            <AnimatedNumber value={data.free} />
          </p>
        </div>
        <div className="border border-border/70 bg-card/50 p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Stripe customers
          </p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
            <AnimatedNumber value={data.withStripe} />
          </p>
        </div>
      </section>

      <section className="border border-border/70 bg-card/40 p-4">
        <h2 className="font-display text-lg font-semibold">Stripe wiring</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          {(
            [
              ["Secret key", data.env.stripeConfigured],
              ["Price ID", data.env.priceConfigured],
              ["Webhook secret", data.env.webhookConfigured],
            ] as const
          ).map(([label, ok]) => (
            <li key={label} className="flex items-center justify-between border border-border/50 px-3 py-2">
              <span>{label}</span>
              <span className={ok ? "text-emerald-700" : "text-destructive"}>
                {ok ? "OK" : "Missing"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border border-border/70 bg-card/40 p-4">
          <h2 className="font-display text-lg font-semibold">Recent Pro</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.recentPro.map((u) => (
              <li key={u.user_id} className="flex justify-between gap-2 border-b border-border/40 py-2">
                <a href={`/admin/users/${u.user_id}`} className="hover:underline">
                  {u.full_name || u.user_id.slice(0, 8)}
                </a>
                <span className="text-xs text-muted-foreground">
                  {new Date(u.updated_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-border/70 bg-card/40 p-4">
          <h2 className="font-display text-lg font-semibold">Free users near limits</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.nearLimit.length === 0 ? (
              <li className="text-muted-foreground">None flagged</li>
            ) : (
              data.nearLimit.map((u) => (
                <li key={u.user_id} className="border-b border-border/40 py-2">
                  <a href={`/admin/users/${u.user_id}`} className="font-medium hover:underline">
                    {u.full_name || u.user_id.slice(0, 8)}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {u.uploads_used} uploads · {u.chat_used} chat · {u.podcasts_used}{" "}
                    podcasts
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
