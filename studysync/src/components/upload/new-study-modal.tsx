"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  FileAudio,
  FileText,
  Loader2,
  Type,
  Upload,
  Video,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import type { ApiResponse } from "@/types/api";
import type { ContentType, DetailLevel, Study } from "@/types/database";

interface NewStudyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONTENT_TYPES: {
  type: ContentType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accept: Record<string, string[]>;
}[] = [
  {
    type: "video",
    label: "Video",
    icon: Video,
    accept: { "video/*": [".mp4", ".webm", ".mov"] },
  },
  {
    type: "pdf",
    label: "PDF",
    icon: FileText,
    accept: { "application/pdf": [".pdf"] },
  },
  {
    type: "audio",
    label: "Audio",
    icon: FileAudio,
    accept: { "audio/*": [".mp3", ".wav", ".m4a"] },
  },
  {
    type: "text",
    label: "Text",
    icon: Type,
    accept: {},
  },
];

export function NewStudyModal({ open, onOpenChange }: NewStudyModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState("");
  const [title, setTitle] = useState("");
  const [flashcardCount, setFlashcardCount] = useState<10 | 20 | 50>(20);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("detailed");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useMemo(() => {
    const match = CONTENT_TYPES.find((c) => c.type === contentType);
    return match?.accept ?? {};
  }, [contentType]);

  const onDrop = useCallback((accepted: File[]) => {
    const next = accepted[0];
    if (!next) return;
    setFile(next);
    if (!title) {
      setTitle(next.name.replace(/\.[^.]+$/, ""));
    }
  }, [title]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: Object.keys(accept).length ? accept : undefined,
    disabled: contentType === "text",
  });

  function reset() {
    setStep(1);
    setContentType(null);
    setFile(null);
    setTextContent("");
    setTitle("");
    setFlashcardCount(20);
    setDetailLevel("detailed");
    setSubmitting(false);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSubmit() {
    if (!contentType) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append(
      "meta",
      JSON.stringify({
        title: title || "Untitled Study",
        content_type: contentType,
        flashcard_count: flashcardCount,
        detail_level: detailLevel,
        text_content: contentType === "text" ? textContent : undefined,
      })
    );

    if (file) {
      formData.append("file", file);
    }

    try {
      const res = await fetch("/api/studies", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as ApiResponse<Study>;

      if (!json.success) {
        setError(json.error);
        setSubmitting(false);
        return;
      }

      handleOpenChange(false);
      router.push(`/study/${json.data.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const canNextFromStep2 =
    contentType === "text"
      ? textContent.trim().length > 20
      : Boolean(file);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl" aria-describedby="new-study-desc">
        <DialogHeader>
          <DialogTitle>New Study</DialogTitle>
          <DialogDescription id="new-study-desc">
            Step {step} of 3 — turn a lecture into flashcards, notes, and quizzes.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid grid-cols-2 gap-3" role="listbox" aria-label="Content type">
            {CONTENT_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                role="option"
                aria-selected={contentType === type}
                onClick={() => setContentType(type)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-5 text-sm font-medium transition-colors hover:bg-accent",
                  contentType === type && "border-foreground bg-accent"
                )}
              >
                <Icon className="h-6 w-6" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            {contentType === "text" ? (
              <div className="space-y-2">
                <Label htmlFor="paste">Paste lecture text</Label>
                <Textarea
                  id="paste"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Paste notes, transcript, or reading…"
                  className="min-h-[180px]"
                />
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center transition-colors",
                  isDragActive ? "border-foreground bg-accent" : "hover:bg-muted/40"
                )}
              >
                <input {...getInputProps()} aria-label="Upload lecture file" />
                <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
                <div>
                  <p className="font-medium">
                    {file ? file.name : "Drag & drop your file"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Study title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Biology Lecture 4"
              />
            </div>
            <div className="space-y-2">
              <Label>Number of flashcards</Label>
              <div className="flex gap-2">
                {([10, 20, 50] as const).map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={flashcardCount === n ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFlashcardCount(n)}
                    aria-pressed={flashcardCount === n}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Detail level</Label>
              <div className="flex gap-2">
                {(["concise", "detailed"] as const).map((level) => (
                  <Button
                    key={level}
                    type="button"
                    variant={detailLevel === level ? "default" : "outline"}
                    size="sm"
                    className="capitalize"
                    onClick={() => setDetailLevel(level)}
                    aria-pressed={detailLevel === level}
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={submitting}
            >
              Back
            </Button>
          ) : null}
          {step < 3 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 1 && !contentType) || (step === 2 && !canNextFromStep2)
              }
            >
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Creating…
                </>
              ) : (
                "Generate study materials"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
