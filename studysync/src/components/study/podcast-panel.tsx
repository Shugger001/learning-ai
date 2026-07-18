"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Podcast as PodcastIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";
import type { Podcast } from "@/types/database";

export function PodcastPanel({
  studyId,
  title,
}: {
  studyId: string;
  title?: string;
}) {
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Study podcast
        </h2>
        <p className="text-sm text-muted-foreground">
          Two hosts (distinct voices) summarize this pack for commute review.
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
        <div className="space-y-5 border border-border/70 bg-card/50 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Now playing
            </p>
            <p className="font-display mt-1 text-lg font-semibold tracking-tight">
              {title || "Study review"}
            </p>
          </div>

          {podcast.audio_url ? (
            <>
              <p className="text-xs text-muted-foreground">
                Dual-voice audio (Host A / Host B)
              </p>
              <audio controls className="w-full" src={podcast.audio_url}>
                Your browser does not support audio.
              </audio>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Script ready. Add OPENAI_API_KEY to enable dual-voice TTS audio.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {podcast.audio_url ? (
              <Button asChild variant="outline" size="sm">
                <a href={podcast.audio_url} download>
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void generate()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerate
            </Button>
          </div>

          {podcast.script ? (
            <details className="border-t border-border/60 pt-4">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                Show script
              </summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {podcast.script}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
