"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type RoomPeer = {
  id: string;
  name: string;
  color: string;
  tab: string;
  focusedCardId: string | null;
  focusedQuestion: string | null;
};

const COLORS = ["#1f6f54", "#c45c26", "#2f5d8c", "#7a3e9d", "#b45309"];

function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i) * 17) % COLORS.length;
  }
  return COLORS[hash] ?? COLORS[0];
}

/** Live co-study presence: shared tab + focused flashcard. */
export function useStudyRoomPresence(params: {
  roomId: string | null | undefined;
  enabled?: boolean;
  tab?: string;
  focusedCardId?: string | null;
  focusedQuestion?: string | null;
  displayName?: string | null;
}) {
  const {
    roomId,
    enabled = true,
    tab = "flashcards",
    focusedCardId = null,
    focusedQuestion = null,
    displayName,
  } = params;

  const [peers, setPeers] = useState<RoomPeer[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const track = useCallback(
    async (next: {
      tab: string;
      focusedCardId: string | null;
      focusedQuestion: string | null;
    }) => {
      const channel = channelRef.current;
      if (!channel) return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setSelfId(user.id);
      await channel.track({
        user_id: user.id,
        name:
          displayName ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Student",
        tab: next.tab,
        focused_card_id: next.focusedCardId,
        focused_question: next.focusedQuestion,
      });
    },
    [displayName]
  );

  useEffect(() => {
    if (!enabled || !roomId) return;
    const supabase = createClient();
    let cancelled = false;
    const presenceKey = crypto.randomUUID();

    const channel = supabase.channel(`study-room:${roomId}`, {
      config: { presence: { key: presenceKey } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<
          string,
          {
            user_id: string;
            name: string;
            tab?: string;
            focused_card_id?: string | null;
            focused_question?: string | null;
          }[]
        >;
        const next: RoomPeer[] = [];
        const seen = new Set<string>();
        for (const [key, rows] of Object.entries(state)) {
          const row = rows[0];
          if (!row) continue;
          const id = row.user_id || key;
          if (seen.has(id)) continue;
          seen.add(id);
          next.push({
            id,
            name: row.name || "Student",
            color: colorFor(id),
            tab: row.tab || "flashcards",
            focusedCardId: row.focused_card_id ?? null,
            focusedQuestion: row.focused_question ?? null,
          });
        }
        if (!cancelled) setPeers(next);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await track({ tab, focusedCardId, focusedQuestion });
        }
      });

    return () => {
      cancelled = true;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
    // Channel is created once per room; focus updates go through track().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, enabled]);

  useEffect(() => {
    if (!enabled || !roomId) return;
    void track({ tab, focusedCardId, focusedQuestion });
  }, [tab, focusedCardId, focusedQuestion, enabled, roomId, track]);

  return { peers, selfId };
}
