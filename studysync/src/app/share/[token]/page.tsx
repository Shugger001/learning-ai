"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Loader2 } from "lucide-react";
import type { ApiResponse } from "@/types/api";
import type { Flashcard, Note, Quiz, Study } from "@/types/database";
import "katex/dist/katex.min.css";

interface SharePayload {
  study: Pick<Study, "id" | "title" | "content_type" | "status" | "share_token">;
  notes: Note | null;
  flashcards: Flashcard[];
  quizzes: Quiz[];
}

export default function SharePage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<SharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/share/${params.token}`);
      const json = (await res.json()) as ApiResponse<SharePayload>;
      if (!json.success) {
        setError(json.error);
        return;
      }
      setData(json.data);
    })();
  }, [params.token]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16">
        <h1 className="font-display text-2xl font-semibold">Link unavailable</h1>
        <p className="mt-2 text-muted-foreground">{error}</p>
        <Link href="/" className="mt-6 text-sm text-primary hover:underline">
          Go to StudySync
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm font-medium text-primary">Shared study · read-only</p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
        {data.study.title}
      </h1>

      {data.notes?.summary ? (
        <section className="mt-8 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Summary</h2>
          <p className="leading-relaxed text-foreground/90">{data.notes.summary}</p>
        </section>
      ) : null}

      {data.notes?.content ? (
        <section className="prose prose-sm mt-8 max-w-none dark:prose-invert">
          <h2 className="font-display text-xl font-semibold !text-foreground">Notes</h2>
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {data.notes.content}
          </ReactMarkdown>
        </section>
      ) : null}

      {data.flashcards?.length ? (
        <section className="mt-10 space-y-3">
          <h2 className="font-display text-xl font-semibold">Flashcards</h2>
          <ul className="space-y-3">
            {data.flashcards.slice(0, 20).map((card) => (
              <li key={card.id} className="border border-border/70 p-4 text-sm">
                <p className="font-medium">{card.question}</p>
                <p className="mt-2 text-muted-foreground">{card.answer}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.quizzes?.length ? (
        <section className="mt-10 space-y-3">
          <h2 className="font-display text-xl font-semibold">Quiz preview</h2>
          <ul className="space-y-3">
            {data.quizzes.slice(0, 10).map((q) => (
              <li key={q.id} className="border border-border/70 p-4 text-sm">
                <p className="font-medium">{q.question}</p>
                {q.explanation ? (
                  <p className="mt-2 text-muted-foreground">{q.explanation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-12 text-sm text-muted-foreground">
        Want your own pack?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Create a StudySync account
        </Link>
      </p>
    </main>
  );
}
