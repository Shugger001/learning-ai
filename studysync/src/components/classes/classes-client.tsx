"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fadeUp } from "@/lib/motion";
import type { ApiResponse } from "@/types/api";
import type { ClassRoom } from "@/types/database";

export function ClassesClient() {
  const router = useRouter();
  const [owned, setOwned] = useState<ClassRoom[]>([]);
  const [joined, setJoined] = useState<ClassRoom[]>([]);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/classes");
    const json = (await res.json()) as ApiResponse<{
      owned: ClassRoom[];
      joined: ClassRoom[];
    }>;
    setLoading(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setOwned(json.data.owned);
    setJoined(
      (json.data.joined as ClassRoom[]).filter(
        (c) => !json.data.owned.some((o) => o.id === c.id)
      )
    );
  }

  useEffect(() => {
    void load();
  }, []);

  async function createClass() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const json = (await res.json()) as ApiResponse<ClassRoom>;
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setName("");
    router.push(`/classes/${json.data.id}`);
  }

  async function join() {
    if (!joinCode.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/classes/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: joinCode.trim() }),
    });
    const json = (await res.json()) as ApiResponse<{ class_id?: string; classes?: ClassRoom; class?: ClassRoom }>;
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    const id =
      (json.data as { class?: ClassRoom }).class?.id ||
      (json.data as { classes?: ClassRoom }).classes?.id ||
      (json.data as { class_id?: string }).class_id;
    if (id) router.push(`/classes/${id}`);
    else await load();
  }

  return (
    <motion.div className="space-y-8" {...fadeUp}>
      <div className="space-y-2">
        <div className="signal-bar" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Teaching
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Classes
        </h1>
        <p className="max-w-xl text-[15px] text-muted-foreground">
          Create a class, assign study packs, and see who&apos;s reviewing.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 border border-border/70 bg-card/40 p-4">
          <h2 className="text-sm font-medium">Create a class</h2>
          <div className="flex flex-wrap gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="AP Bio — Period 2"
              aria-label="Class name"
            />
            <Button type="button" disabled={busy || !name.trim()} onClick={() => void createClass()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </div>
        </div>
        <div className="space-y-3 border border-border/70 bg-card/40 p-4">
          <h2 className="text-sm font-medium">Join with code</h2>
          <div className="flex flex-wrap gap-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              aria-label="Join code"
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy || !joinCode.trim()}
              onClick={() => void join()}
            >
              <Users className="h-4 w-4" />
              Join
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading classes…</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Teaching
            </h2>
            {owned.length === 0 ? (
              <p className="text-sm text-muted-foreground">No classes yet.</p>
            ) : (
              <ul className="divide-y divide-border/60 border border-border/70">
                {owned.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/classes/${c.id}`}
                      className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/40"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.join_code}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Enrolled
            </h2>
            {joined.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You haven&apos;t joined a class yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/60 border border-border/70">
                {joined.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/classes/${c.id}`}
                      className="block px-4 py-3 text-sm font-medium hover:bg-muted/40"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </motion.div>
  );
}
