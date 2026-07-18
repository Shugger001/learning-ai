"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { QuizPanel } from "@/components/study/quiz-panel";
import { cn } from "@/lib/utils/cn";
import type { Flashcard, Note, Quiz, Study } from "@/types/database";
import "katex/dist/katex.min.css";

export interface ShareStudyPayload {
  study: Pick<Study, "id" | "title" | "content_type" | "status" | "share_token">;
  notes: Note | null;
  flashcards: Flashcard[];
  quizzes: Quiz[];
}

function ShareFlashcards({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) {
    return (
      <p className="text-sm text-muted-foreground">No flashcards in this share.</p>
    );
  }

  const card = cards[Math.min(index, cards.length - 1)];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Card {index + 1} of {cards.length} · tap to flip
      </p>
      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        className={cn(
          "flex min-h-[12rem] w-full items-center justify-center border border-border/70 bg-card/50 p-8 text-center transition-colors hover:bg-accent/30"
        )}
      >
        <p className="font-display text-lg font-semibold leading-snug tracking-tight sm:text-xl">
          {flipped ? card.answer : card.question}
        </p>
      </button>
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={index === 0}
          onClick={() => {
            setIndex((i) => Math.max(0, i - 1));
            setFlipped(false);
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={index >= cards.length - 1}
          onClick={() => {
            setIndex((i) => Math.min(cards.length - 1, i + 1));
            setFlipped(false);
          }}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ShareStudyView({ data }: { data: ShareStudyPayload }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium text-primary">Shared study</p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
        {data.study.title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Flip cards and take the quiz — scores stay on this device only.
      </p>

      <Tabs defaultValue="notes" className="mt-8">
        <TabsList aria-label="Shared materials" className="flex-wrap">
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="quiz">Quiz</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-6 space-y-6">
          {data.notes?.summary ? (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Summary
              </h2>
              <p className="leading-relaxed text-foreground/90">
                {data.notes.summary}
              </p>
            </section>
          ) : null}
          {data.notes?.content ? (
            <section className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {data.notes.content}
              </ReactMarkdown>
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">No notes shared.</p>
          )}
        </TabsContent>

        <TabsContent value="cards" className="mt-6">
          <ShareFlashcards cards={data.flashcards ?? []} />
        </TabsContent>

        <TabsContent value="quiz" className="mt-6">
          <QuizPanel
            studyId={data.study.id}
            quizzes={data.quizzes ?? []}
            readOnly
          />
        </TabsContent>
      </Tabs>

      <p className="mt-12 text-sm text-muted-foreground">
        Want your own pack?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Create a StudySync account
        </Link>
      </p>
    </main>
  );
}
