"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PresencePeer = {
  id: string;
  name: string;
  color: string;
  editing: boolean;
};

const COLORS = ["#1f6f54", "#c45c26", "#2f5d8c", "#7a3e9d", "#b45309"];

function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i) * 17) % COLORS.length;
  }
  return COLORS[hash] ?? COLORS[0];
}

/** Live presence avatars on a study's notes channel. */
export function useNotesPresence(params: {
  studyId: string | null | undefined;
  enabled?: boolean;
  editing?: boolean;
  displayName?: string | null;
}) {
  const { studyId, enabled = true, editing = false, displayName } = params;
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !studyId) return;
    const supabase = createClient();
    let cancelled = false;
    const presenceKey = crypto.randomUUID();

    const channel = supabase.channel(`notes-presence:${studyId}`, {
      config: { presence: { key: presenceKey } },
    });

    async function track(isEditing: boolean) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setSelfId(user.id);
      await channel.track({
        user_id: user.id,
        name:
          displayName ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Student",
        editing: isEditing,
      });
    }

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<
          string,
          { user_id: string; name: string; editing: boolean }[]
        >;
        const next: PresencePeer[] = [];
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
            editing: Boolean(row.editing),
          });
        }
        if (!cancelled) setPeers(next);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await track(editing);
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [studyId, enabled, editing, displayName]);

  return { peers, selfId };
}
