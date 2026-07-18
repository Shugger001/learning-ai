"use client";

import Link from "next/link";
import { FileAudio, FileText, Type, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ContentType, Study, StudyStatus } from "@/types/database";

const ICONS: Record<ContentType, React.ComponentType<{ className?: string }>> = {
  video: Video,
  pdf: FileText,
  audio: FileAudio,
  text: Type,
};

function statusVariant(status: StudyStatus): "secondary" | "success" | "destructive" {
  if (status === "complete") return "success";
  if (status === "error") return "destructive";
  return "secondary";
}

export function StudyCard({ study }: { study: Study }) {
  const Icon = ICONS[study.content_type];
  const kindLabel =
    study.content_type === "pdf" && /\.pptx?$/i.test(study.file_url ?? "")
      ? "PPTX"
      : study.content_type;

  return (
    <Link href={`/study/${study.id}`} className="group block h-full">
      <article className="flex h-full flex-col border border-border/70 bg-card/60 p-5 transition-colors duration-200 group-hover:border-primary/35 group-hover:bg-accent/40">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex h-9 w-9 items-center justify-center border border-border/60 bg-muted/50 text-muted-foreground">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
          <Badge variant={statusVariant(study.status)} className="capitalize">
            {study.status}
          </Badge>
        </div>
        <h2 className="font-display line-clamp-2 text-lg font-semibold leading-snug tracking-tight">
          {study.title}
        </h2>
        <p className="mt-auto pt-4 text-xs text-muted-foreground">
          {new Date(study.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {" · "}
          <span className="capitalize">{kindLabel}</span>
        </p>
      </article>
    </Link>
  );
}
