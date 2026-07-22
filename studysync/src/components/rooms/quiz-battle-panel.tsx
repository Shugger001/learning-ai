"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { cn } from "@/lib/utils/cn";
import type { ApiResponse } from "@/types/api";
import type { Quiz } from "@/types/database";

type Battle = {
  id: string;
  ends_at: string;
  duration_sec: number;
  host_id: string;
};

type ScoreRow = {
  userId: string;
  name: string;
  score: number;
  answered: number;
  done: boolean;
};

export function QuizBattlePanel({
  roomCode,
  isHost,
}: {
  roomCode: string;
  isHost: boolean;
}) {
  const [battle, setBattle] = useState<Battle | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [done, setDone] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const xpAwardedRef = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [board, setBoard] = useState<ScoreRow[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [selfName, setSelfName] = useState("You");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/battle`);
    const json = (await res.json()) as ApiResponse<{
      battle: Battle | null;
      quizzes: Quiz[];
    }>;
    if (!json.success) {
      setError(json.error);
      return;
    }
    setError(null);
    setBattle(json.data.battle);
    setQuizzes(json.data.quizzes ?? []);
    if (json.data.battle) {
      const left = Math.max(
        0,
        Math.ceil(
          (new Date(json.data.battle.ends_at).getTime() - Date.now()) / 1000
        )
      );
      setSecondsLeft(left);
      setIndex(0);
      setScore(0);
      setAnswered(0);
      setDone(false);
      setPicked(null);
    }
  }, [roomCode]);

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), 8000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    if (!battle) return;
    const t = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((new Date(battle.ends_at).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(left);
      if (left <= 0) setDone(true);
    }, 500);
    return () => clearInterval(t);
  }, [battle]);

  const publishScore = useCallback(
    async (next: { score: number; answered: number; done: boolean }) => {
      const channel = channelRef.current;
      if (!channel) return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setSelfId(user.id);
      const name =
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Player";
      setSelfName(name);
      await channel.track({
        user_id: user.id,
        name,
        score: next.score,
        answered: next.answered,
        done: next.done,
      });
    },
    []
  );

  useEffect(() => {
    if (!battle) return;
    const supabase = createClient();
    let cancelled = false;
    const channel = supabase.channel(`quiz-battle:${battle.id}`, {
      config: { presence: { key: crypto.randomUUID() } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<
          string,
          {
            user_id: string;
            name: string;
            score?: number;
            answered?: number;
            done?: boolean;
          }[]
        >;
        const rows: ScoreRow[] = [];
        const seen = new Set<string>();
        for (const [k, list] of Object.entries(state)) {
          const row = list[0];
          if (!row) continue;
          const id = row.user_id || k;
          if (seen.has(id)) continue;
          seen.add(id);
          rows.push({
            userId: id,
            name: row.name || "Player",
            score: Number(row.score ?? 0),
            answered: Number(row.answered ?? 0),
            done: Boolean(row.done),
          });
        }
        rows.sort((a, b) => b.score - a.score || b.answered - a.answered);
        if (!cancelled) setBoard(rows);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await publishScore({ score: 0, answered: 0, done: false });
        }
      });

    return () => {
      cancelled = true;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
    // Subscribe once per battle id; scores publish via publishScore().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.id, publishScore]);

  useEffect(() => {
    if (!battle) return;
    void publishScore({ score, answered, done });
  }, [battle, score, answered, done, publishScore]);

  useEffect(() => {
    if (!done || xpAwardedRef.current) return;
    xpAwardedRef.current = true;
    void fetch("/api/xp/battle", { method: "POST" }).catch(() => undefined);
  }, [done]);

  async function startBattle() {
    setBusy(true);
    setError(null);
    xpAwardedRef.current = false;
    const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/battle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration_sec: 120, count: 8 }),
    });
    const json = (await res.json()) as ApiResponse<{
      battle: Battle;
      quizzes: Quiz[];
    }>;
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setBattle(json.data.battle);
    setQuizzes(json.data.quizzes);
    setIndex(0);
    setScore(0);
    setAnswered(0);
    setDone(false);
    setPicked(null);
    setSecondsLeft(json.data.battle.duration_sec);
  }

  const current = quizzes[index];
  const options = useMemo(() => {
    if (!current) return [] as string[];
    return current.options?.length
      ? current.options
      : [current.correct_answer].filter(Boolean);
  }, [current]);

  function answer(choice: string) {
    if (!current || picked || done || secondsLeft <= 0) return;
    setPicked(choice);
    const correct =
      choice.trim().toLowerCase() ===
      String(current.correct_answer).trim().toLowerCase();
    const nextScore = score + (correct ? 1 : 0);
    const nextAnswered = answered + 1;
    setScore(nextScore);
    setAnswered(nextAnswered);
    window.setTimeout(() => {
      setPicked(null);
      if (index + 1 >= quizzes.length) setDone(true);
      else setIndex((i) => i + 1);
    }, 450);
  }

  return (
    <section className="space-y-4 border border-border/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
            <Swords className="h-5 w-5 text-primary" />
            Quiz battle
          </h2>
          <p className="text-xs text-muted-foreground">
            Timed multiplayer · live scoreboard
          </p>
        </div>
        {isHost ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void startBattle()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {battle ? "Restart battle" : "Start battle"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!battle ? (
        <p className="text-sm text-muted-foreground">
          {isHost
            ? "Start a 2-minute battle when everyone’s ready."
            : "Waiting for the host to start a battle…"}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>
                Q {Math.min(index + 1, quizzes.length)}/{quizzes.length}
              </span>
              <span className="font-medium tabular-nums">
                {Math.floor(secondsLeft / 60)}:
                {(secondsLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
            {done || secondsLeft <= 0 ? (
              <div className="space-y-2 py-6 text-center">
                <Trophy className="mx-auto h-8 w-8 text-primary" />
                <p className="font-display text-xl font-semibold">
                  Battle over · {score}/{answered} correct
                </p>
              </div>
            ) : current ? (
              <div className="space-y-3">
                <div className="font-medium">
                  <MarkdownMath>{current.question}</MarkdownMath>
                </div>
                <div className="grid gap-2">
                  {options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => answer(opt)}
                      className={cn(
                        "border border-border/70 px-3 py-2 text-left text-sm hover:border-primary/40",
                        picked === opt && "border-primary bg-primary/10"
                      )}
                    >
                      <MarkdownMath>{opt}</MarkdownMath>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Scoreboard
            </p>
            <ul className="divide-y divide-border/60 border border-border/70 text-sm">
              {(board.length
                ? board
                : [
                    {
                      userId: selfId ?? "you",
                      name: selfName,
                      score,
                      answered,
                      done,
                    },
                  ]
              ).map((row, i) => (
                <li
                  key={row.userId}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span>
                    {i + 1}. {row.name}
                    {row.userId === selfId ? " (you)" : ""}
                    {row.done ? " ✓" : ""}
                  </span>
                  <span className="tabular-nums font-medium">
                    {row.score}
                    <span className="text-muted-foreground">
                      /{row.answered}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
