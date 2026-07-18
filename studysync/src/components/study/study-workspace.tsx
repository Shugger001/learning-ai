"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link2, Link2Off } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotesPanel } from "@/components/study/notes-panel";
import { FlashcardsPanel } from "@/components/study/flashcards-panel";
import { QuizPanel } from "@/components/study/quiz-panel";
import { MindMapPanel } from "@/components/study/mindmap-panel";
import { ChatPanel } from "@/components/study/chat-panel";
import { PodcastPanel } from "@/components/study/podcast-panel";
import { ProcessingView } from "@/components/study/processing-view";
import { useStudySessionStore } from "@/stores/study-session";
import type { ApiResponse } from "@/types/api";
import type { StudyWithMaterials } from "@/types/database";

export function StudyWorkspace({ study }: { study: StudyWithMaterials }) {
  const setActiveStudyId = useStudySessionStore((s) => s.setActiveStudyId);
  const activeTab = useStudySessionStore((s) => s.activeTab);
  const setActiveTab = useStudySessionStore((s) => s.setActiveTab);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    setActiveStudyId(study.id);
  }, [study.id, setActiveStudyId]);

  useEffect(() => {
    if (study.share_token) {
      setShareUrl(`${window.location.origin}/share/${study.share_token}`);
    } else {
      setShareUrl(null);
    }
  }, [study.share_token]);

  async function enableShare() {
    const res = await fetch(`/api/studies/${study.id}/share`, { method: "POST" });
    const json = (await res.json()) as ApiResponse<{ share_token: string }>;
    if (json.success) {
      setShareUrl(`${window.location.origin}/share/${json.data.share_token}`);
    }
  }

  async function disableShare() {
    await fetch(`/api/studies/${study.id}/share`, { method: "DELETE" });
    setShareUrl(null);
  }

  if (study.status === "processing") {
    return <ProcessingView study={study} />;
  }

  if (study.status === "error") {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-20 text-center">
        <Badge variant="destructive">Error</Badge>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Processing failed
        </h1>
        <p className="text-muted-foreground">
          {study.error_message ||
            "Something went wrong while generating materials."}
        </p>
      </div>
    );
  }

  const kindLabel =
    study.content_type === "youtube"
      ? "YouTube"
      : study.content_type === "pdf" && /\.pptx?$/i.test(study.file_url ?? "")
        ? "PPTX"
        : study.content_type;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-8"
    >
      <div className="space-y-3 border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="secondary" className="capitalize">
            {kindLabel}
          </Badge>
          <div className="flex flex-wrap items-center gap-2">
            {shareUrl ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void navigator.clipboard.writeText(shareUrl)}
                >
                  <Link2 className="h-4 w-4" />
                  Copy share link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void disableShare()}
                >
                  <Link2Off className="h-4 w-4" />
                  Unshare
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void enableShare()}
              >
                <Link2 className="h-4 w-4" />
                Share
              </Button>
            )}
          </div>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {study.title}
        </h1>
        {study.source_url ? (
          <a
            href={study.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Open source
          </a>
        ) : null}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(
            v as
              | "notes"
              | "flashcards"
              | "quiz"
              | "mindmap"
              | "chat"
              | "podcast"
          )
        }
      >
        <TabsList aria-label="Study materials" className="flex-wrap">
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="quiz">Quiz</TabsTrigger>
          <TabsTrigger value="mindmap">Mind Map</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="podcast">Podcast</TabsTrigger>
        </TabsList>
        <TabsContent value="notes">
          <NotesPanel note={study.notes} />
        </TabsContent>
        <TabsContent value="flashcards">
          <FlashcardsPanel flashcards={study.flashcards} />
        </TabsContent>
        <TabsContent value="quiz">
          <QuizPanel studyId={study.id} quizzes={study.quizzes} />
        </TabsContent>
        <TabsContent value="mindmap">
          <MindMapPanel mindMap={study.notes?.mind_map ?? null} />
        </TabsContent>
        <TabsContent value="chat">
          <ChatPanel studyId={study.id} />
        </TabsContent>
        <TabsContent value="podcast">
          <PodcastPanel studyId={study.id} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
