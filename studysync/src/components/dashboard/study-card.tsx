"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  FileAudio,
  FileText,
  FolderOpen,
  Presentation,
  Type,
  Video,
  Clapperboard,
  Loader2,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import { resolveStudyFilePaths } from "@/lib/studies/files";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { ProcessingBar } from "@/components/ui/processing-bar";
import type { ApiResponse } from "@/types/api";
import type { ContentType, Study } from "@/types/database";

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function kindFromStudy(study: Study): {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
} {
  const paths = resolveStudyFilePaths(study.file_url);
  const isPptx =
    study.content_type === "pdf" &&
    paths.some((p) => /\.pptx?$/i.test(p));

  if (isPptx) {
    return { label: "PowerPoint", icon: Presentation };
  }

  const map: Record<
    ContentType,
    { label: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    video: { label: "Video", icon: Video },
    pdf: { label: "PDF", icon: FileText },
    audio: { label: "Audio", icon: FileAudio },
    text: { label: "Text", icon: Type },
    youtube: { label: "YouTube", icon: Clapperboard },
    notion: { label: "Notion", icon: FolderOpen },
  };

  return map[study.content_type] ?? { label: "Study", icon: FileText };
}

function statusLabel(status: Study["status"]) {
  if (status === "complete") return "Ready";
  if (status === "processing") return "Generating";
  return "Failed";
}

export function StudyCard({
  study,
  summary,
  onDeleted,
  onRetried,
  onUpdated,
}: {
  study: Study;
  summary?: string;
  onDeleted?: (id: string) => void;
  onRetried?: (study: Study) => void;
  onUpdated?: (study: Study) => void;
}) {
  const router = useRouter();
  const { label, icon: Icon } = kindFromStudy(study);
  const status = statusLabel(study.status);
  const date = new Date(study.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const [busy, setBusy] = useState<"retry" | "delete" | "favorite" | null>(
    null
  );

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy("favorite");
    const res = await fetch(`/api/studies/${study.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: !study.is_favorite }),
    });
    const json = (await res.json()) as ApiResponse<Study>;
    setBusy(null);
    if (json.success) onUpdated?.(json.data);
  }

  async function retry(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy("retry");
    const res = await fetch(`/api/studies/${study.id}/retry`, { method: "POST" });
    const json = (await res.json()) as ApiResponse<Study>;
    setBusy(null);
    if (json.success) {
      onRetried?.(json.data);
      router.push(`/study/${study.id}`);
      router.refresh();
    }
  }

  async function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete “${study.title}”? This cannot be undone.`)) {
      return;
    }
    setBusy("delete");
    const res = await fetch(`/api/studies/${study.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    setBusy(null);
    if (json.success) {
      onDeleted?.(study.id);
      router.refresh();
    }
  }

  return (
    <motion.div
      className="group relative h-full"
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      <Link href={`/study/${study.id}`} className="block h-full">
        <article
          className={cn(
            "relative flex h-full min-h-[12.5rem] flex-col overflow-hidden border border-border/80 bg-card/60 p-5",
            "shadow-[3px_3px_0_hsl(var(--foreground)/0.04)] transition-all duration-200",
            "group-hover:border-primary/50 group-hover:bg-card group-hover:shadow-[4px_4px_0_hsl(var(--signal)/0.35)]"
          )}
        >
          <div
            className="absolute inset-y-0 left-0 w-[3px] bg-signal opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          />

          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-border/60 bg-muted/40 text-muted-foreground">
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="flex items-center gap-2">
              {study.is_favorite ? (
                <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-label="Favorite" />
              ) : null}
              <span
                className={cn(
                  "text-xs font-medium tracking-wide",
                  study.status === "complete" && "text-success",
                  study.status === "processing" && "text-primary",
                  study.status === "error" && "text-destructive"
                )}
              >
                {status}
              </span>
            </div>
          </div>

          <h2 className="font-display line-clamp-2 text-lg font-semibold leading-snug tracking-tight">
            {study.title}
          </h2>

          {study.status === "processing" ? (
            <div className="mt-4 space-y-2">
              <ProcessingBar value={study.processing_progress} />
              <p className="text-xs text-muted-foreground">
                {study.processing_progress}% complete
              </p>
            </div>
          ) : summary ? (
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {summary}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {study.flashcard_count} flashcards
              {study.quiz_count != null ? ` · ${study.quiz_count} quiz` : null}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between pt-5 text-xs text-muted-foreground">
            <span>
              {label} · {date}
              {study.status === "complete" ? (
                <>
                  {" "}
                  · updated {relativeTime(study.updated_at)}
                </>
              ) : null}
            </span>
            <span className="inline-flex items-center gap-0.5 font-medium text-foreground/70 opacity-0 transition-opacity group-hover:opacity-100">
              Open
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
        </article>
      </Link>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="absolute right-2 top-2 h-8 w-8 bg-background/90 p-0 opacity-0 transition-opacity group-hover:opacity-100"
        disabled={busy !== null}
        aria-label={study.is_favorite ? "Unpin favorite" : "Pin favorite"}
        onClick={(e) => void toggleFavorite(e)}
      >
        {busy === "favorite" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Star
            className={cn(
              "h-3.5 w-3.5",
              study.is_favorite && "fill-primary text-primary"
            )}
          />
        )}
      </Button>

      {study.status === "error" ? (
        <div className="absolute bottom-3 right-3 flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 bg-background/95"
            disabled={busy !== null}
            onClick={(e) => void retry(e)}
          >
            {busy === "retry" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Retry
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-destructive"
            disabled={busy !== null}
            onClick={(e) => void remove(e)}
          >
            {busy === "delete" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      ) : null}
    </motion.div>
  );
}
