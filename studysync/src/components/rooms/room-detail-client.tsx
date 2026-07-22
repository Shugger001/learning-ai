"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudyRoomPresence } from "@/hooks/use-study-room-presence";
import { QuizBattlePanel } from "@/components/rooms/quiz-battle-panel";
import type { ApiResponse } from "@/types/api";
import type { StudyRoom } from "@/types/database";

type RoomPayload = StudyRoom & {
  isHost: boolean;
  studies?: {
    id: string;
    title: string;
    status: string;
    flashcard_count: number;
  } | null;
};

export function RoomDetailClient() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code;
  const [room, setRoom] = useState<RoomPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { peers, selfId } = useStudyRoomPresence({
    roomId: room?.id,
    enabled: Boolean(room?.id),
    tab: "lobby",
  });

  useEffect(() => {
    void fetch(`/api/rooms/${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((json: ApiResponse<RoomPayload>) => {
        if (!json.success) {
          setError(json.error);
          return;
        }
        setRoom(json.data);
      })
      .catch(() => setError("Could not load room"));
  }, [code]);

  async function copyLink() {
    if (!room) return;
    const url = `${window.location.origin}/rooms/${room.join_code}`;
    await navigator.clipboard.writeText(url);
  }

  async function closeRoom() {
    if (!room) return;
    setBusy(true);
    await fetch(`/api/rooms/${room.join_code}`, { method: "DELETE" });
    setBusy(false);
    router.push("/rooms");
  }

  if (!room && !error) {
    return <p className="text-sm text-muted-foreground">Loading room…</p>;
  }

  if (!room) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error ?? "Room not found"}
      </p>
    );
  }

  const others = peers.filter((p) => p.id !== selfId);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Study room
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {room.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Code <span className="font-medium text-foreground">{room.join_code}</span>
          {" · "}
          {room.studies?.title ?? "Study pack"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link
            href={`/study/${room.study_id}?room=${room.join_code}&tab=flashcards`}
          >
            Enter study session
          </Link>
        </Button>
        <Button type="button" variant="outline" onClick={() => void copyLink()}>
          Copy invite link
        </Button>
        <Button asChild variant="outline">
          <Link href="/rooms">All rooms</Link>
        </Button>
        {room.isHost ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            disabled={busy}
            onClick={() => void closeRoom()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Close room
          </Button>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Who’s here
        </h2>
        {peers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Waiting for peers…</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {peers.map((p) => (
              <li
                key={p.id}
                className="border border-border/70 px-3 py-1.5 text-sm"
                style={{ borderLeftColor: p.color, borderLeftWidth: 3 }}
              >
                {p.name}
                {p.id === selfId ? " (you)" : ""}
                <span className="ml-2 text-xs text-muted-foreground">
                  {p.tab}
                  {p.focusedQuestion
                    ? ` · ${p.focusedQuestion.slice(0, 40)}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {others.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {others.length} other{others.length === 1 ? "" : "s"} in the lobby or
            study.
          </p>
        ) : null}
      </section>

      <QuizBattlePanel roomCode={room.join_code} isHost={room.isHost} />
    </div>
  );
}
