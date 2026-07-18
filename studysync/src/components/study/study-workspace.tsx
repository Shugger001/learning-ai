"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { NotesPanel } from "@/components/study/notes-panel";
import { FlashcardsPanel } from "@/components/study/flashcards-panel";
import { QuizPanel } from "@/components/study/quiz-panel";
import { MindMapPanel } from "@/components/study/mindmap-panel";
import { ProcessingView } from "@/components/study/processing-view";
import { useStudySessionStore } from "@/stores/study-session";
import type { StudyWithMaterials } from "@/types/database";

export function StudyWorkspace({ study }: { study: StudyWithMaterials }) {
  const setActiveStudyId = useStudySessionStore((s) => s.setActiveStudyId);
  const activeTab = useStudySessionStore((s) => s.activeTab);
  const setActiveTab = useStudySessionStore((s) => s.setActiveTab);

  useEffect(() => {
    setActiveStudyId(study.id);
  }, [study.id, setActiveStudyId]);

  if (study.status === "processing") {
    return <ProcessingView study={study} />;
  }

  if (study.status === "error") {
    return (
      <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
        <Badge variant="destructive">Error</Badge>
        <h1 className="text-2xl font-semibold">Processing failed</h1>
        <p className="text-muted-foreground">
          {study.error_message || "Something went wrong while generating materials."}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <Badge variant="secondary" className="capitalize">
          {study.content_type}
        </Badge>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {study.title}
        </h1>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as "notes" | "flashcards" | "quiz" | "mindmap")
        }
      >
        <TabsList className="grid w-full grid-cols-4" aria-label="Study materials">
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="quiz">Quiz</TabsTrigger>
          <TabsTrigger value="mindmap">Mind Map</TabsTrigger>
        </TabsList>
        <TabsContent value="notes">
          <NotesPanel note={study.notes} />
        </TabsContent>
        <TabsContent value="flashcards">
          <FlashcardsPanel flashcards={study.flashcards} />
        </TabsContent>
        <TabsContent value="quiz">
          <QuizPanel quizzes={study.quizzes} />
        </TabsContent>
        <TabsContent value="mindmap">
          <MindMapPanel mindMap={study.notes?.mind_map ?? null} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
