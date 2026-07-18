"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { motion } from "framer-motion";
import { Check, Copy, Download, Pencil, Save, Eye, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";
import { fadeUp } from "@/lib/motion";
import type { ApiResponse } from "@/types/api";
import type { Note } from "@/types/database";
import "katex/dist/katex.min.css";

interface NotesPanelProps {
  note: Note | null;
}

export function NotesPanel({ note }: NotesPanelProps) {
  const [content, setContent] = useState(note?.content ?? "");
  const [summary, setSummary] = useState(note?.summary ?? "");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const saveNote = useCallback(
    async (nextContent: string, nextSummary: string, silent = false) => {
      if (!note) return;
      if (!silent) setSaving(true);
      setMessage(null);
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: nextContent, summary: nextSummary }),
      });
      const json = (await res.json()) as ApiResponse<Note>;
      if (!silent) setSaving(false);
      setMessage(json.success ? (silent ? "Autosaved" : "Saved") : json.error);
      if (json.success && !silent) setEditing(false);
    },
    [note]
  );

  const editor = useEditor({
    extensions: [StarterKit],
    content: markdownToHtml(content),
    editable: editing,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const md = htmlToMarkdownish(html);
      setContent(md);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[280px] rounded-lg border border-border/60 bg-card px-4 py-3 text-[15px] leading-relaxed focus:outline-none prose prose-sm max-w-none dark:prose-invert",
      },
    },
  });

  useEffect(() => {
    editor?.setEditable(editing);
  }, [editing, editor]);

  useEffect(() => {
    if (!editing || !note) return;
    const timer = setTimeout(() => {
      void saveNote(content, summary, true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [content, summary, editing, note, saveNote]);

  if (!note) {
    return (
      <motion.p className="text-sm text-muted-foreground" {...fadeUp}>
        No notes generated yet.
      </motion.p>
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
      <style>
        body{font-family:Georgia,serif;padding:40px;line-height:1.65;color:#111;max-width:720px;margin:0 auto}
        h1,h2,h3{font-family:system-ui,sans-serif;line-height:1.25}
        h1{font-size:1.75rem} h2{font-size:1.25rem;margin-top:1.5em}
        ul{padding-left:1.25rem} li{margin:0.35em 0}
        p{margin:0.75em 0}
      </style>
      </head><body>
      <h1>Summary</h1><p>${escapeHtml(summary)}</p>
      <h1>Notes</h1>${markdownToSimpleHtml(content)}
      <script>window.onload=()=>{window.print()}</script>
      </body></html>
    `);
    printWindow.document.close();
  }

  const dirty =
    content !== (note.content ?? "") || summary !== (note.summary ?? "");

  return (
    <motion.div className="space-y-6" {...fadeUp}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (!editing && editor) {
              editor.commands.setContent(markdownToHtml(content));
            }
            setEditing((v) => !v);
          }}
        >
          {editing ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          {editing ? "Preview" : "Edit"}
        </Button>
        {(editing || dirty) ? (
          <Button
            type="button"
            size="sm"
            onClick={() => void saveNote(content, summary)}
            disabled={saving}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              Export
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => void copyAll()}
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy all"}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={exportMarkdown}>
              <Download className="mr-2 h-4 w-4" />
              Markdown
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={exportPdf}>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Summary</h2>
        {editing ? (
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="min-h-[100px]"
            aria-label="Summary notes"
          />
        ) : (
          <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-[15px] leading-relaxed text-foreground/90">
              {summary || "No summary yet."}
            </p>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Notes</h2>
        {editing ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                Bold
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                H2
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                List
              </Button>
            </div>
            <EditorContent editor={editor} />
          </div>
        ) : (
          <article
            className={cn(
              "rounded-lg border border-border/60 bg-card px-5 py-6 text-[15px] leading-relaxed",
              "[&_h1]:mb-3 [&_h1]:mt-0 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight",
              "[&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight",
              "[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold",
              "[&_p]:my-3 [&_p]:leading-relaxed [&_p]:text-foreground/90",
              "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
              "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5",
              "[&_li]:leading-relaxed [&_strong]:font-semibold",
              "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm",
              "[&_.katex]:text-[1.05em]"
            )}
          >
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {content || "_No notes yet._"}
            </ReactMarkdown>
          </article>
        )}
      </section>

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </motion.div>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markdownToHtml(md: string) {
  const escaped = escapeHtml(md);
  return escaped
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])/gm, (line) =>
      line.startsWith("<") ? line : `<p>${line}</p>`
    );
}

function htmlToMarkdownish(html: string) {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<\/?ul[^>]*>/gi, "\n")
    .replace(/<\/?ol[^>]*>/gi, "\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function markdownToSimpleHtml(md: string) {
  return escapeHtml(md)
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hul])/gm, (line) =>
      line.startsWith("<") ? line : `<p>${line}</p>`
    );
}
