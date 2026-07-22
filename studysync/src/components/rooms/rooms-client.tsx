"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@/types/api";
import type { Study, StudyRoom } from "@/types/database";

type RoomRow = StudyRoom & {
  studies?: { id: string; title: string; status: string } | null;
};

export function RoomsClient() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [studies, setStudies] = useState<Study[]>([]);
  const [studyId, setStudyId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/rooms");
    const json = (await res.json()) as ApiResponse<RoomRow[]>;
    if (!json.success) {
      setError(json.error);
      return;
    }
    setError(null);
    setRooms(json.data);
  }

  useEffect(() => {
    void load();
    void fetch("/api/studies")
      .then((r) => r.json())
      .then((json: ApiResponse<Study[]>) => {
        if (json.success) {
          setStudies(json.data.filter((s) => s.status === "complete"));
        }
      })
      .catch(() => undefined);
  }, []);

  async function createRoom() {
    if (!studyId) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ study_id: studyId }),
    });
    const json = (await res.json()) as ApiResponse<RoomRow>;
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    router.push(`/rooms/${json.data.join_code}`);
  }

  async function joinRoom() {
    if (!joinCode.trim()) return;
    router.push(`/rooms/${joinCode.trim().toUpperCase()}`);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Live
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Study rooms
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Co-study a pack together. Peers see each other’s tab and focused card
          in real time.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 border border-border/70 bg-card/40 p-4">
          <h2 className="text-sm font-medium">Host a room</h2>
          <select
            className="h-10 w-full border border-input bg-background px-2 text-sm"
            value={studyId}
            onChange={(e) => setStudyId(e.target.value)}
          >
            <option value="">Pick a complete study…</option>
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <Button
            type="button"
            disabled={busy || !studyId}
            onClick={() => void createRoom()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Start room
          </Button>
        </div>
        <div className="space-y-3 border border-border/70 bg-card/40 p-4">
          <h2 className="text-sm font-medium">Join with code</h2>
          <div className="flex flex-wrap gap-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="max-w-[10rem] uppercase tracking-widest"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!joinCode.trim()}
              onClick={() => void joinRoom()}
            >
              Join
            </Button>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Your active rooms
        </h2>
        {rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active rooms yet.</p>
        ) : (
          <ul className="divide-y divide-border/60 border border-border/70">
            {rooms.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.studies?.title ?? "Study"} · code {r.join_code}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/rooms/${r.join_code}`}>Open</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
