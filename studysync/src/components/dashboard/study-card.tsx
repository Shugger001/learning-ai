"use client";

import Link from "next/link";
import { FileAudio, FileText, Type, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <Link href={`/study/${study.id}`} className="group block h-full">
      <Card className="h-full border-border/60 transition-colors group-hover:border-foreground/30 group-hover:bg-accent/30">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
          <Badge variant={statusVariant(study.status)} className="capitalize">
            {study.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          <CardTitle className="line-clamp-2 text-base font-semibold leading-snug">
            {study.title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {new Date(study.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {" · "}
            <span className="capitalize">{study.content_type}</span>
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
