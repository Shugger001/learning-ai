"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { Study } from "@/types/database";

interface ProcessingViewProps {
  study: Study;
}

export function ProcessingView({ study }: ProcessingViewProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`study-${study.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "studies",
          filter: `id=eq.${study.id}`,
        },
        (payload) => {
          const next = payload.new as Study;
          if (next.status === "complete" || next.status === "error") {
            router.refresh();
          }
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      router.refresh();
    }, 4000);

    void fetch("/api/process-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ study_id: study.id }),
    });

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [study.id, router]);

  const etaMinutes = Math.max(
    1,
    Math.ceil((100 - study.processing_progress) / 25)
  );

  return (
    <div className="mx-auto max-w-xl space-y-10 py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center border border-border bg-muted/40">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      </div>
      <div className="space-y-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Generating your study pack
        </h1>
        <p className="text-muted-foreground">
          Extracting content and building notes, flashcards, and quizzes.
          Estimated time: ~{etaMinutes} min
        </p>
      </div>
      <div className="space-y-2 text-left">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span aria-live="polite">{study.processing_progress}%</span>
        </div>
        <Progress
          value={study.processing_progress}
          aria-label="Processing progress"
        />
      </div>
      <div className="space-y-3 pt-2" aria-hidden>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <Skeleton className="mt-6 h-32 w-full" />
      </div>
    </div>
  );
}
