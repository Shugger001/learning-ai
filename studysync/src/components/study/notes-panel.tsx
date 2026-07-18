"use client";

import { useState } from "react";
import { Check, Copy, Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ApiResponse } from "@/types/api";
import type { Note } from "@/types/database";

interface NotesPanelProps {
  note: Note | null;
}

export function NotesPanel({ note }: NotesPanelProps) {
  const [content, setContent] = useState(note?.content ?? "");
  const [summary, setSummary] = useState(note?.summary ?? "");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!note) {
    return (
      <p className="text-sm text-muted-foreground">No notes generated yet.</p>
    );
  }

  async function copyAll() {
    const text = `# Summary\n\n${summary}\n\n# Notes\n\n${content}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportMarkdown() {
    const blob = new Blob(
      [`# Summary\n\n${summary}\n\n# Notes\n\n${content}`],
      { type: "text/markdown;charset=utf-8" }
    );
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
      <style>body{font-family:system-ui;padding:32px;line-height:1.5;white-space:pre-wrap}</style>
      </head><body>
      <h1>Summary</h1><p>${summary.replace(/</g, "&lt;")}</p>
      <h1>Notes</h1><pre>${content.replace(/</g, "&lt;")}</pre>
      <script>window.onload=()=>{window.print()}</script>
      </body></html>
    `);
    printWindow.document.close();
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/notes/${note!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, summary }),
    });
    const json = (await res.json()) as ApiResponse<Note>;
    setSaving(false);
    setMessage(json.success ? "Saved" : json.error);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copyAll}>
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

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Summary</h2>
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="min-h-[100px]"
          aria-label="Summary notes"
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Notes</h2>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[320px] font-mono text-sm"
          aria-label="Detailed notes"
        />
      </section>

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
