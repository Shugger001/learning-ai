"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Link2,
  Link2Off,
  Loader2,
  Mail,
  MessageCircle,
  Layers,
  ListChecks,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotesPanel } from "@/components/study/notes-panel";
import { FlashcardsPanel } from "@/components/study/flashcards-panel";
import { QuizPanel } from "@/components/study/quiz-panel";
import { MindMapPanel } from "@/components/study/mindmap-panel";
import { ChatPanel } from "@/components/study/chat-panel";
import { PodcastPanel } from "@/components/study/podcast-panel";
import { ProcessingView } from "@/components/study/processing-view";
import { ShareInvitePanel } from "@/components/share/share-invite-panel";
import { ExportPackMenu } from "@/components/study/export-pack-menu";
import { useStudySessionStore } from "@/stores/study-session";
import { resolveStudyFilePaths } from "@/lib/studies/files";
import type { ApiResponse } from "@/types/api";
import type { Study, StudyWithMaterials } from "@/types/database";

const EASE = [0.22, 1, 0.36, 1] as const;

type StudyTab =
  | "notes"
  | "flashcards"
  | "quiz"
  | "mindmap"
  | "chat"
  | "podcast";

const VALID_TABS: StudyTab[] = [
  "notes",
  "flashcards",
  "quiz",
  "mindmap",
  "chat",
  "podcast",
];

export function StudyWorkspace({ study }: { study: StudyWithMaterials }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setActiveStudyId = useStudySessionStore((s) => s.setActiveStudyId);
  const activeTab = useStudySessionStore((s) => s.activeTab);
  const setActiveTab = useStudySessionStore((s) => s.setActiveTab);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showInvites, setShowInvites] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState<"retry" | "delete" | null>(
    null
  );
  const [examWrongIds, setExamWrongIds] = useState<string[] | null>(null);

  const examMode = searchParams.get("exam") === "1";
  const examMinutes = Math.min(
    120,
    Math.max(5, Number(searchParams.get("minutes") || 20) || 20)
  );
  const wantWrong = searchParams.get("wrong") === "1";

  useEffect(() => {
    setActiveStudyId(study.id);
  }, [study.id, setActiveStudyId]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && VALID_TABS.includes(tab as StudyTab)) {
      setActiveTab(tab as StudyTab);
    }
  }, [searchParams, setActiveTab]);

  useEffect(() => {
    if (!wantWrong) {
      setExamWrongIds(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/studies/${study.id}/quiz-attempt`)
      .then((r) => r.json())
      .then((json: ApiResponse<{ wrong_quiz_ids?: string[] } | null>) => {
        if (cancelled || !json.success || !json.data) return;
        const ids = Array.isArray(json.data.wrong_quiz_ids)
          ? json.data.wrong_quiz_ids
          : [];
        setExamWrongIds(ids.length ? ids : null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [study.id, wantWrong]);

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

  async function retryStudy() {
    setLifecycleBusy("retry");
    const res = await fetch(`/api/studies/${study.id}/retry`, { method: "POST" });
    const json = (await res.json()) as ApiResponse<Study>;
    setLifecycleBusy(null);
    if (json.success) {
      router.refresh();
    }
  }

  async function deleteStudy() {
    if (!window.confirm(`Delete “${study.title}”? This cannot be undone.`)) {
      return;
    }
    setLifecycleBusy("delete");
    const res = await fetch(`/api/studies/${study.id}`, { method: "DELETE" });
    const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    setLifecycleBusy(null);
    if (json.success) {
      router.push("/dashboard");
      router.refresh();
    }
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
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Button
            type="button"
            onClick={() => void retryStudy()}
            disabled={lifecycleBusy !== null}
          >
            {lifecycleBusy === "retry" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Retry processing
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void deleteStudy()}
            disabled={lifecycleBusy !== null}
          >
            {lifecycleBusy === "delete" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete study
          </Button>
        </div>
      </div>
    );
  }

  const kindLabel =
    study.content_type === "youtube"
      ? "YouTube"
      : study.content_type === "pdf" &&
          resolveStudyFilePaths(study.file_url).some((p) => /\.pptx?$/i.test(p))
        ? "PPTX"
        : study.content_type;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <div className="space-y-4 border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="secondary" className="capitalize">
            {kindLabel}
          </Badge>
          <div className="flex flex-wrap items-center gap-1">
            <ExportPackMenu study={study} />
            {shareUrl ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => void navigator.clipboard.writeText(shareUrl)}
                >
                  <Link2 className="h-4 w-4" />
                  Copy link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setShowInvites((v) => !v)}
                >
                  <Mail className="h-4 w-4" />
                  Invite
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => void disableShare()}
                >
                  <Link2Off className="h-4 w-4" />
                  Unshare
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => void enableShare()}
                >
                  <Link2 className="h-4 w-4" />
                  Share
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setShowInvites(true)}
                >
                  <Mail className="h-4 w-4" />
                  Invite
                </Button>
              </>
            )}
          </div>
        </div>
        {showInvites ? (
          <ShareInvitePanel
            studyId={study.id}
            onShareEnabled={(url) => {
              setShareUrl(url);
              setShowInvites(true);
            }}
          />
        ) : null}
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {study.title}
        </h1>
        {study.source_url ? (
          <a
            href={study.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm text-primary hover:underline"
          >
            Open source
          </a>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            onClick={() => setActiveTab("flashcards")}
          >
            <Layers className="h-4 w-4" />
            Review cards
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setActiveTab("quiz")}
          >
            <ListChecks className="h-4 w-4" />
            Take quiz
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("tab", "quiz");
              params.set("exam", "1");
              params.set("minutes", "20");
              router.replace(`/study/${study.id}?${params.toString()}`, {
                scroll: false,
              });
              setActiveTab("quiz");
            }}
          >
            Exam mode
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setActiveTab("chat")}
          >
            <MessageCircle className="h-4 w-4" />
            Ask chat
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as StudyTab)}
      >
        <TabsList aria-label="Study materials" className="flex-wrap">
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="quiz">Quiz</TabsTrigger>
          <TabsTrigger value="mindmap">Mind Map</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="podcast">Podcast</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative mt-6 min-h-[12rem]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {activeTab === "notes" ? (
              <NotesPanel note={study.notes} />
            ) : null}
            {activeTab === "flashcards" ? (
              <FlashcardsPanel flashcards={study.flashcards} />
            ) : null}
            {activeTab === "quiz" ? (
              <QuizPanel
                studyId={study.id}
                quizzes={study.quizzes}
                examMode={examMode}
                examMinutes={examMinutes}
                initialReviewIds={examWrongIds}
              />
            ) : null}
            {activeTab === "mindmap" ? (
              <MindMapPanel mindMap={study.notes?.mind_map ?? null} />
            ) : null}
            {activeTab === "chat" ? <ChatPanel studyId={study.id} /> : null}
            {activeTab === "podcast" ? (
              <PodcastPanel studyId={study.id} title={study.title} />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
