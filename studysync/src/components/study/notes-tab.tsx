"use client";

import { useState } from "react";
import { Check, Copy, Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Note } from "@/types/database";
import type { ApiResponse } from "@/types/api";

interface NotesTabProps {
  note: Note | null;
  onUpdated: (note: Note) => void;
}

export function NotesTab({ note, onUpdated }: NotesTabProps) {
  const [content, setContent] = useState(note?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyNotes() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportMarkdown() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "studysync-notes.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>StudySync Notes</title>
      <style>body{font-family:system-ui;max-width:720px;margin:40px auto;line-height:1.6;white-space:pre-wrap}</style>
      </head><body>${content.replace(/</g, "&lt;")}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function save() {
    if (!note) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const json = (await res.json()) as ApiResponse<Note>;

    if (!json.success) {
      setError(json.error);
      setSaving(false);
      return;
    }

    onUpdated(json.data);
    setSaving(false);
  }

  if (!note) {
    return (
      <p className="text-sm text-muted-foreground">
        Notes will appear when processing completes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {note.summary ? (
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Summary
          </p>
          <p className="mt-2 text-sm leading-relaxed">{note.summary}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copyNotes}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={exportMarkdown}>
          <Download className="h-4 w-4" />
          Markdown
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={exportPdf}>
          <Download className="h-4 w-4" />
          PDF
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[420px] font-mono text-sm leading-relaxed"
        aria-label="Study notes"
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
