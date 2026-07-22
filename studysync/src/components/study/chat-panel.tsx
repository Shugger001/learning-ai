"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { Loader2, Mic, MicOff, Send, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import { EASE } from "@/lib/motion";
import type { ApiResponse } from "@/types/api";
import type { ChatMessage } from "@/types/database";

const CHAT_SUGGESTIONS = [
  "Explain the main idea in simple terms",
  "What should I memorize for a quiz?",
  "Give me a practice question with the answer",
];

const TUTOR_SUGGESTIONS = [
  "Quiz me on my weakest cards",
  "Ask me a Socratic question about the hard parts",
  "I got this wrong before — walk me through it",
];

export function ChatPanel({ studyId }: { studyId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"chat" | "tutor">("chat");
  const [voiceOut, setVoiceOut] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void fetch(`/api/chat?study_id=${studyId}`)
      .then((r) => r.json())
      .then((json: ApiResponse<ChatMessage[]>) => {
        if (json.success) setMessages(json.data);
      });
  }, [studyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingId]);

  async function speak(text: string) {
    if (!voiceOut || !text.trim()) return;
    try {
      const res = await fetch("/api/chat/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      await audio.play();
    } catch {
      // ignore TTS failures
    }
  }

  async function send(questionOverride?: string) {
    const question = (questionOverride ?? input).trim();
    if (!question || loading) return;
    setInput("");
    setLoading(true);
    setError(null);

    const tempAssistantId = crypto.randomUUID();
    setStreamingId(tempAssistantId);
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
      {
        id: tempAssistantId,
        study_id: studyId,
        user_id: "",
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      },
    ]);

    let finalAssistantText = "";

    try {
      const res = await fetch("/api/chat?stream=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          study_id: studyId,
          message: question,
          mode,
        }),
      });

      if (!res.ok || !res.body) {
        const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
        setError(json && !json.success ? json.error : "Chat failed");
        setMessages((prev) => prev.filter((m) => m.id !== tempAssistantId));
        setLoading(false);
        setStreamingId(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6)) as {
            token?: string;
            done?: boolean;
            message?: ChatMessage;
            error?: string;
          };

          if (payload.error) {
            setError(payload.error);
            setMessages((prev) => prev.filter((m) => m.id !== tempAssistantId));
            break;
          }

          if (payload.token) {
            finalAssistantText += payload.token;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, content: m.content + payload.token }
                  : m
              )
            );
          }

          if (payload.done && payload.message) {
            finalAssistantText = payload.message.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId ? payload.message! : m
              )
            );
          }
        }
      }
    } catch {
      setError("Chat failed");
      setMessages((prev) => prev.filter((m) => m.id !== tempAssistantId));
    }

    setLoading(false);
    setStreamingId(null);
    if (mode === "tutor" && finalAssistantText) {
      void speak(finalAssistantText);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void finishRecording();
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setError(null);
    } catch {
      setError("Microphone permission is required for voice answers.");
    }
  }

  async function finishRecording() {
    setRecording(false);
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (!blob.size) return;
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, `answer-${Date.now()}.webm`);
      const res = await fetch("/api/chat/transcribe", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as ApiResponse<{ text: string }>;
      if (!json.success) {
        setError(json.error);
        return;
      }
      const text = json.data.text.trim();
      if (text) await send(text);
      else setError("Couldn’t hear that — try again.");
    } catch {
      setError("Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  const suggestions = mode === "tutor" ? TUTOR_SUGGESTIONS : CHAT_SUGGESTIONS;

  return (
    <div className="flex h-[min(70vh,640px)] flex-col border border-border/70 bg-card/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === "chat" ? "default" : "ghost"}
            onClick={() => setMode("chat")}
          >
            Q&A
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "tutor" ? "default" : "ghost"}
            onClick={() => setMode("tutor")}
          >
            AI tutor
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setVoiceOut((v) => !v)}
            aria-label={voiceOut ? "Mute tutor voice" : "Enable tutor voice"}
          >
            {voiceOut ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            {mode === "tutor"
              ? "Socratic · voice ready"
              : "Answers from this study"}
          </p>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {mode === "tutor"
                ? "Speak or type answers. I’ll quiz weak spots and talk back when voice is on."
                : "Ask anything about this study — concepts, definitions, or practice explanations."}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((prompt) => (
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
        ) : (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void send(prompt)}
                className="border border-border/70 px-2 py-1 text-left text-[11px] text-muted-foreground hover:text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: EASE }}
            className={
              m.role === "user"
                ? "ml-8 rounded-md bg-primary/10 px-3 py-2 text-sm"
                : "mr-8 rounded-md border border-border/60 bg-background px-3 py-2 text-sm leading-relaxed"
            }
          >
            {m.role === "assistant" ? (
              <div className="prose-sm dark:prose-invert [&_p]:my-2">
                <ReactMarkdown>{m.content || " "}</ReactMarkdown>
                {streamingId === m.id ? (
                  <span
                    className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-primary align-middle"
                    aria-hidden
                  />
                ) : null}
              </div>
            ) : (
              m.content
            )}
          </motion.div>
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
        <Button
          type="button"
          variant={recording ? "destructive" : "outline"}
          size="icon"
          disabled={loading || transcribing}
          onClick={() =>
            recording ? stopRecording() : void startRecording()
          }
          aria-label={recording ? "Stop recording" : "Speak answer"}
        >
          {transcribing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : recording ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === "tutor"
              ? "Answer the tutor or hold the mic…"
              : "Ask about this lecture…"
          }
          className={cn("min-h-[44px] resize-none")}
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
