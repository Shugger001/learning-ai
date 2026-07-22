"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  FolderOpen,
  Link2,
  Loader2,
  Mic,
  Square,
  Type,
  Upload,
  Video,
  Clapperboard,
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
import { createClient } from "@/lib/supabase/client";
import type { ApiResponse } from "@/types/api";
import type { ContentType, DetailLevel, Study } from "@/types/database";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 25;

interface NewStudyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContentType?: ContentType | null;
}

const CONTENT_TYPES: {
  type: ContentType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accept: Record<string, string[]>;
}[] = [
  {
    type: "youtube",
    label: "YouTube",
    icon: Clapperboard,
    accept: {},
  },
  {
    type: "audio",
    label: "Record / Audio",
    icon: Mic,
    accept: { "audio/*": [".mp3", ".wav", ".m4a", ".webm", ".ogg"] },
  },
  {
    type: "pdf",
    label: "PDF / PPTX",
    icon: FileText,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
        ".pptx",
      ],
      "application/vnd.ms-powerpoint": [".ppt", ".pptx"],
      "application/octet-stream": [".pdf", ".pptx", ".ppt"],
    },
  },
  {
    type: "notion",
    label: "Notion / Folder",
    icon: FolderOpen,
    accept: {
      "text/markdown": [".md"],
      "text/plain": [".txt", ".md"],
      "application/pdf": [".pdf"],
    },
  },
  {
    type: "video",
    label: "Video",
    icon: Video,
    accept: { "video/*": [".mp4", ".webm", ".mov"] },
  },
  {
    type: "text",
    label: "Text",
    icon: Type,
    accept: {},
  },
];

export function NewStudyModal({
  open,
  onOpenChange,
  initialContentType = null,
}: NewStudyModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [textContent, setTextContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [title, setTitle] = useState("");
  const [flashcardCount, setFlashcardCount] = useState<10 | 20 | 50>(20);
  const [quizCount, setQuizCount] = useState<5 | 10 | 15 | 20>(10);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("detailed");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initialContentType) {
      setContentType(initialContentType);
      setStep(2);
      setError(null);
    }
  }, [open, initialContentType]);

  const accept = useMemo(() => {
    const match = CONTENT_TYPES.find((c) => c.type === contentType);
    return match?.accept ?? {};
  }, [contentType]);

  const onDrop = useCallback(
    (
      accepted: File[],
      rejected: {
        file: File;
        errors: readonly { code: string; message: string }[];
      }[]
    ) => {
      setError(null);
      if (accepted.length) {
        setFiles((prev) => {
          const merged = [...prev, ...accepted].slice(0, MAX_FILES);
          return merged;
        });
        if (!title && accepted[0]) {
          setTitle(
            accepted.length === 1
              ? accepted[0].name.replace(/\.[^.]+$/, "")
              : "Combined lecture materials"
          );
        }
      }
      const rejection = rejected[0];
      if (rejection) {
        setError(`Could not load “${rejection.file.name}”.`);
      }
    },
    [title]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openFilePicker,
  } = useDropzone({
    onDrop,
    multiple: true,
    accept: Object.keys(accept).length ? accept : undefined,
    disabled:
      contentType === "text" ||
      contentType === "youtube" ||
      contentType === "notion",
    maxSize: MAX_FILE_BYTES,
    noClick: true,
    noKeyboard: true,
  });

  const folderInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep(1);
    setContentType(null);
    setFiles([]);
    setTextContent("");
    setYoutubeUrl("");
    setTitle("");
    setFlashcardCount(20);
    setQuizCount(10);
    setDetailLevel("detailed");
    setSubmitting(false);
    setError(null);
    setRecording(false);
    mediaRecorderRef.current?.stop();
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
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
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const recorded = new File([blob], `lecture-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        setFiles((prev) => [...prev, recorded].slice(0, MAX_FILES));
        if (!title) setTitle("Live lecture recording");
        setContentType("audio");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setError(null);
    } catch {
      setError("Microphone permission is required to record.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function uploadOneFile(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    file: File
  ) {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const lower = file.name.toLowerCase();
    let uploadContentType = file.type || "application/octet-stream";
    if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) {
      uploadContentType =
        "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    } else if (lower.endsWith(".pdf") && !uploadContentType.includes("pdf")) {
      uploadContentType = "application/pdf";
    }

    let { error: uploadError } = await supabase.storage
      .from("lectures")
      .upload(path, file, {
        contentType: uploadContentType,
        upsert: false,
      });

    if (uploadError) {
      const retry = await supabase.storage.from("lectures").upload(path, file, {
        contentType: "application/octet-stream",
        upsert: false,
      });
      uploadError = retry.error;
    }

    if (uploadError) {
      throw new Error(`${file.name}: ${uploadError.message}`);
    }
    return path;
  }

  async function handleSubmit() {
    if (!contentType) return;
    if (
      contentType !== "text" &&
      contentType !== "youtube" &&
      !(contentType === "notion" && textContent.trim()) &&
      files.length === 0
    ) {
      setError("Please upload files or paste Notion export text.");
      return;
    }
    const oversized = files.find((f) => f.size > MAX_FILE_BYTES);
    if (oversized) {
      setError(`“${oversized.name}” is too large. Use files under 50 MB each.`);
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      let filePaths: string[] | undefined;
      let combinedNotionText = textContent;

      if (contentType === "notion" && files.length > 0) {
        const mdFiles = files.filter((f) => /\.(md|txt)$/i.test(f.name));
        const pdfFiles = files.filter((f) => /\.pdf$/i.test(f.name));
        if (mdFiles.length > 0) {
          const parts: string[] = [];
          if (textContent.trim()) parts.push(textContent.trim());
          for (const file of mdFiles) {
            parts.push(`\n\n## ${file.name}\n\n${await file.text()}`);
          }
          combinedNotionText = parts.join("\n");
        }
        if (pdfFiles.length > 0) {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            setError("Please sign in again to upload.");
            setSubmitting(false);
            return;
          }
          filePaths = [];
          for (const file of pdfFiles) {
            filePaths.push(await uploadOneFile(supabase, user.id, file));
          }
        }
      } else if (
        files.length > 0 &&
        contentType !== "text" &&
        contentType !== "youtube"
      ) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("Please sign in again to upload.");
          setSubmitting(false);
          return;
        }

        filePaths = [];
        for (const file of files) {
          filePaths.push(await uploadOneFile(supabase, user.id, file));
        }
      }

      const effectiveType =
        contentType === "notion" &&
        filePaths?.length &&
        !combinedNotionText.trim()
          ? "pdf"
          : contentType;

      const res = await fetch("/api/studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled Study",
          content_type: effectiveType,
          flashcard_count: flashcardCount,
          quiz_count: quizCount,
          detail_level: detailLevel,
          text_content:
            effectiveType === "text" || effectiveType === "notion"
              ? combinedNotionText
              : undefined,
          source_url: contentType === "youtube" ? youtubeUrl : undefined,
          file_paths: filePaths,
        }),
      });
      const raw = await res.text();
      let json: ApiResponse<Study>;
      try {
        json = JSON.parse(raw) as ApiResponse<Study>;
      } catch {
        setError(
          `Server error (${res.status}). ${raw.slice(0, 160) || "Please try again."}`
        );
        setSubmitting(false);
        return;
      }
      if (!json.success) {
        setError(
          json.error.includes("Upgrade")
            ? `${json.error} Visit Pricing to go Pro.`
            : json.error
        );
        setSubmitting(false);
        return;
      }
      handleOpenChange(false);
      router.push(`/study/${json.data.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      setSubmitting(false);
    }
  }

  function onFolderPicked(list: FileList | null) {
    if (!list?.length) return;
    const picked = Array.from(list).filter((f) => {
      const n = f.name.toLowerCase();
      return (
        n.endsWith(".pdf") ||
        n.endsWith(".md") ||
        n.endsWith(".txt") ||
        n.endsWith(".pptx") ||
        n.endsWith(".ppt")
      );
    });
    if (!picked.length) {
      setError("No PDF, Markdown, or PPTX files found in that folder.");
      return;
    }
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_FILES));
    if (!title) {
      setTitle(
        picked.length === 1
          ? picked[0].name.replace(/\.[^.]+$/, "")
          : "Imported folder pack"
      );
    }
    setError(null);
  }

  const canNextFromStep2 =
    contentType === "text"
      ? textContent.trim().length > 20
      : contentType === "youtube"
        ? youtubeUrl.trim().length > 10
        : contentType === "notion"
          ? textContent.trim().length > 20 || files.length > 0
          : files.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl" aria-describedby="new-study-desc">
        <DialogHeader>
          <DialogTitle>New Study</DialogTitle>
          <DialogDescription id="new-study-desc">
            Step {step} of 3 - add one or more files, then configure your study pack.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-2 flex gap-1.5" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={cn(
                "h-1 flex-1 transition-colors",
                step >= n ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
        {step === 1 ? (
          <div className="grid grid-cols-2 gap-3" role="listbox">
            {CONTENT_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                role="option"
                aria-selected={contentType === type}
                onClick={() => setContentType(type)}
                className={cn(
                  "flex flex-col items-center gap-2 border p-5 text-sm font-medium transition-colors hover:bg-accent",
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
                  className="min-h-[180px]"
                />
              </div>
            ) : contentType === "youtube" ? (
              <div className="space-y-2">
                <Label htmlFor="yt">YouTube URL</Label>
                <div className="flex gap-2">
                  <Link2 className="mt-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="yt"
                    value={youtubeUrl}
                    onChange={(e) => {
                      setYoutubeUrl(e.target.value);
                      if (!title) setTitle("YouTube lecture");
                    }}
                    placeholder="https://www.youtube.com/watch?v=…"
                  />
                </div>
              </div>
            ) : contentType === "notion" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notion-paste">Paste Notion export (Markdown)</Label>
                  <Textarea
                    id="notion-paste"
                    value={textContent}
                    onChange={(e) => {
                      setTextContent(e.target.value);
                      if (!title) setTitle("Notion notes");
                    }}
                    className="min-h-[120px]"
                    placeholder="Export a Notion page as Markdown and paste it here…"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Or import a folder of Notion .md exports and/or PDFs (up to {MAX_FILES}).
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => folderInputRef.current?.click()}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Choose folder
                  </Button>
                  <input
                    ref={folderInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    // @ts-expect-error webkitdirectory is non-standard but widely supported
                    webkitdirectory=""
                    directory=""
                    onChange={(e) => {
                      onFolderPicked(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
                {files.length > 0 ? (
                  <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
                    {files.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between gap-3 border border-border/60 px-3 py-2"
                      >
                        <span className="truncate">{f.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(i)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <>
                {contentType === "audio" ? (
                  <div className="flex gap-2">
                    {!recording ? (
                      <Button type="button" variant="outline" onClick={() => void startRecording()}>
                        <Mic className="h-4 w-4" />
                        Record lecture
                      </Button>
                    ) : (
                      <Button type="button" variant="destructive" onClick={stopRecording}>
                        <Square className="h-4 w-4" />
                        Stop recording
                      </Button>
                    )}
                    <span className="self-center text-sm text-muted-foreground">
                      or upload an audio file below
                    </span>
                  </div>
                ) : null}
                {contentType === "pdf" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => folderInputRef.current?.click()}
                    >
                      <FolderOpen className="h-4 w-4" />
                      Import PDF folder
                    </Button>
                    <input
                      ref={folderInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      // @ts-expect-error webkitdirectory is non-standard but widely supported
                      webkitdirectory=""
                      directory=""
                      onChange={(e) => {
                        onFolderPicked(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </div>
                ) : null}
                <div
                  {...getRootProps()}
                  role="button"
                  tabIndex={0}
                  onClick={() => openFilePicker()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openFilePicker();
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed p-10 text-center transition-colors",
                    isDragActive ? "border-foreground bg-accent" : "hover:bg-muted/40"
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {files.length
                        ? `${files.length} file${files.length === 1 ? "" : "s"} selected`
                        : "Drag & drop files"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse · up to {MAX_FILES} files, 50 MB each
                    </p>
                  </div>
                </div>
                {files.length > 0 ? (
                  <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
                    {files.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between gap-3 border border-border/60 px-3 py-2"
                      >
                        <span className="truncate">{f.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(i)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
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
              />
            </div>
            <div className="space-y-2">
              <Label>Flashcards</Label>
              <div className="flex gap-2">
                {([10, 20, 50] as const).map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={flashcardCount === n ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFlashcardCount(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Quiz questions</Label>
              <div className="flex gap-2">
                {([5, 10, 15, 20] as const).map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={quizCount === n ? "default" : "outline"}
                    size="sm"
                    onClick={() => setQuizCount(n)}
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
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
          </motion.div>
        </AnimatePresence>

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
                  <Loader2 className="animate-spin" />
                  {files.length ? "Uploading…" : "Creating…"}
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
