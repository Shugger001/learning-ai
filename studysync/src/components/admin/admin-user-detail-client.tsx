"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@/types/api";
import type { Profile, Study } from "@/types/database";

export function AdminUserDetailClient({ userId }: { userId: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [studies, setStudies] = useState<
    Pick<
      Study,
      "id" | "title" | "status" | "content_type" | "created_at" | "error_message"
    >[]
  >([]);
  const [studyCount, setStudyCount] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`);
    const json = (await res.json()) as ApiResponse<{
      profile: Profile;
      email: string | null;
      studies: typeof studies;
      studyCount: number;
      attemptCount: number;
    }>;
    if (!json.success) {
      setError(json.error);
      return;
    }
    setProfile(json.data.profile);
    setEmail(json.data.email);
    setStudies(json.data.studies);
    setStudyCount(json.data.studyCount);
    setAttemptCount(json.data.attemptCount);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as ApiResponse<Profile>;
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setProfile(json.data);
    setMessage(okMsg);
  }

  if (error && !profile) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!profile) {
    return <p className="text-sm text-muted-foreground">Loading dossier…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/users" className="text-xs text-primary hover:underline">
          ← Users
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {profile.full_name || "Unnamed user"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {email || profile.user_id}
          {profile.is_admin ? " · admin" : ""}
        </p>
      </div>

      {message ? (
        <p className="text-sm text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Plan", value: profile.plan },
          { label: "Studies", value: String(studyCount) },
          { label: "Quiz attempts", value: String(attemptCount) },
          { label: "Level / XP", value: `${profile.level} / ${profile.xp}` },
        ].map((s) => (
          <div key={s.label} className="border border-border/70 bg-card/40 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-1 font-display text-xl font-semibold capitalize">
              {s.value}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-3 border border-border/70 bg-card/40 p-4">
        <h2 className="font-display text-lg font-semibold">God controls</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || profile.plan === "pro"}
            onClick={() => void patch({ plan: "pro" }, "Set to Pro")}
          >
            Grant Pro
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || profile.plan === "free"}
            onClick={() => void patch({ plan: "free" }, "Set to Free")}
          >
            Force Free
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void patch({ reset_usage: true }, "Usage reset")}
          >
            Reset usage
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void patch(
                { credits: Number(profile.credits ?? 0) + 10 },
                "+10 credits"
              )
            }
          >
            +10 credits
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || Boolean(profile.is_admin)}
            onClick={() => void patch({ is_admin: true }, "Admin granted")}
          >
            Make admin
          </Button>
        </div>
        <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            Usage: {profile.uploads_used} uploads · {profile.chat_used} chat ·{" "}
            {profile.podcasts_used} podcasts
          </div>
          <div>
            Streak {profile.current_streak} · Stripe{" "}
            {profile.stripe_customer_id ? "linked" : "—"}
          </div>
          <div className="sm:col-span-2">
            Credits{" "}
            <Input
              type="number"
              className="ml-2 inline-flex h-8 w-24"
              defaultValue={profile.credits}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n !== profile.credits) {
                  void patch({ credits: n }, "Credits updated");
                }
              }}
            />
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Recent studies</h2>
        <ul className="divide-y divide-border/50 border border-border/70">
          {studies.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">None</li>
          ) : (
            studies.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <div>
                  <Link href={`/study/${s.id}`} className="font-medium hover:underline">
                    {s.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {s.content_type} · {s.status}
                    {s.error_message ? ` · ${s.error_message}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
