"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ApiResponse } from "@/types/api";
import type { ChatMessage } from "@/types/database";

const SUGGESTIONS = [
  "Explain the main idea in simple terms",
  "What should I memorize for a quiz?",
  "Give me a practice question with the answer",
];

export function ChatPanel({ studyId }: { studyId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch(`/api/chat?study_id=${studyId}`)
      .then((r) => r.json())
      .then((json: ApiResponse<ChatMessage[]>) => {
        if (json.success) setMessages(json.data);
      });
  }, [studyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(questionOverride?: string) {
    const question = (questionOverride ?? input).trim();
    if (!question || loading) return;
    setInput("");
    setLoading(true);
    setError(null);
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        study_id: studyId,
        user_id: "",
        role: "user",
        content: question,
        created_at: new Date().toISOString(),
      },
    ]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ study_id: studyId, message: question }),
    });
    const json = (await res.json()) as ApiResponse<ChatMessage>;
    setLoading(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setMessages((prev) => [...prev, json.data]);
  }

  return (
    <div className="flex h-[min(70vh,640px)] flex-col border border-border/70 bg-card/40">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ask anything about this study — concepts, definitions, or practice
              explanations.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void send(prompt)}
                  className="border border-border/70 px-3 py-1.5 text-left text-xs text-foreground/80 transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-8 rounded-md bg-primary/10 px-3 py-2 text-sm"
                : "mr-8 rounded-md border border-border/60 bg-background px-3 py-2 text-sm leading-relaxed"
            }
          >
            {m.role === "assistant" ? (
              <div className="prose-sm dark:prose-invert [&_p]:my-2">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            ) : (
              m.content
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {error ? (
        <p className="px-4 text-sm text-destructive" role="alert">
          {error}{" "}
          {error.includes("Upgrade") ? (
            <a href="/pricing" className="underline">
              View pricing
            </a>
          ) : null}
        </p>
      ) : null}
      <div className="flex gap-2 border-t border-border/60 p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this lecture…"
          className="min-h-[44px] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button type="button" onClick={() => void send()} disabled={loading}>
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
