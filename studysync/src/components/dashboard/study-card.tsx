"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  FileAudio,
  FileText,
  Presentation,
  Type,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ContentType, Study } from "@/types/database";

function kindFromStudy(study: Study): {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
} {
  const isPptx =
    study.content_type === "pdf" && /\.pptx?$/i.test(study.file_url ?? "");

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
  };

  return map[study.content_type];
}

function statusLabel(status: Study["status"]) {
  if (status === "complete") return "Ready";
  if (status === "processing") return "Generating";
  return "Failed";
}

export function StudyCard({ study }: { study: Study }) {
  const { label, icon: Icon } = kindFromStudy(study);
  const status = statusLabel(study.status);
  const date = new Date(study.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link href={`/study/${study.id}`} className="group block h-full">
      <article
        className={cn(
          "relative flex h-full min-h-[11.5rem] flex-col overflow-hidden border border-border/70 bg-card/50 p-5",
          "transition-colors duration-200 group-hover:border-primary/40 group-hover:bg-accent/25"
        )}
      >
        <div
          className="absolute inset-y-0 left-0 w-[2px] bg-primary/70 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />

        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex h-9 w-9 items-center justify-center border border-border/60 bg-muted/40 text-muted-foreground">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
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

        <h2 className="font-display line-clamp-2 text-lg font-semibold leading-snug tracking-tight">
          {study.title}
        </h2>

        {study.status === "processing" ? (
          <div className="mt-4 space-y-2">
            <div className="h-1 w-full overflow-hidden bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, study.processing_progress)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {study.processing_progress}% complete
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {study.flashcard_count} flashcards
            {study.quiz_count != null ? ` · ${study.quiz_count} quiz` : null}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-5 text-xs text-muted-foreground">
          <span>
            {label} · {date}
          </span>
          <span className="inline-flex items-center gap-0.5 font-medium text-foreground/70 opacity-0 transition-opacity group-hover:opacity-100">
            Open
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
      </article>
    </Link>
  );
}
