"use client";

import { useEffect, useState } from "react";
import { Loader2, Podcast as PodcastIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";
import type { Podcast } from "@/types/database";

export function PodcastPanel({ studyId }: { studyId: string }) {
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/podcast?study_id=${studyId}`)
      .then((r) => r.json())
      .then((json: ApiResponse<Podcast | null>) => {
        if (json.success) setPodcast(json.data);
      });
  }, [studyId]);

  async function generate() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/podcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ study_id: studyId }),
    });
    const json = (await res.json()) as ApiResponse<Podcast>;
    setLoading(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setPodcast(json.data);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Study podcast
        </h2>
        <p className="text-sm text-muted-foreground">
          Turn this pack into a two-host audio review you can play anywhere.
        </p>
      </div>

      {!podcast || podcast.status !== "complete" ? (
        <Button onClick={() => void generate()} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="animate-spin" /> Generating…
            </>
          ) : (
            <>
              <PodcastIcon className="h-4 w-4" /> Generate podcast
            </>
          )}
        </Button>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {podcast?.status === "complete" ? (
        <div className="space-y-4 border border-border/70 bg-card/40 p-5">
          {podcast.audio_url ? (
            <audio controls className="w-full" src={podcast.audio_url}>
              Your browser does not support audio.
            </audio>
          ) : (
            <p className="text-sm text-muted-foreground">
              Script ready. Add OPENAI_API_KEY to enable TTS audio.
            </p>
          )}
          {podcast.script ? (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {podcast.script}
            </pre>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void generate()}>
            Regenerate
          </Button>
        </div>
      ) : null}
    </div>
  );
}
