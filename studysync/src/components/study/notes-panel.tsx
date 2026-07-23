"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { motion } from "framer-motion";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo2,
  Redo2,
  Check,
  Copy,
  Download,
  Pencil,
  Save,
  Eye,
  ChevronDown,
  Strikethrough,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { cn } from "@/lib/utils/cn";
import { fadeUp } from "@/lib/motion";
import { exportNotesMarkdown, exportNotesPdf } from "@/lib/export/pack";
import { polishNotesMarkdown, polishSummary } from "@/lib/ai/polish-notes";
import { useNotesPresence } from "@/hooks/use-notes-presence";
import { createClient } from "@/lib/supabase/client";
import type { ApiResponse } from "@/types/api";
import type { Note } from "@/types/database";

interface NotesPanelProps {
  note: Note | null;
  studyId?: string;
}

export function NotesPanel({ note, studyId }: NotesPanelProps) {
  const [content, setContent] = useState(
    polishNotesMarkdown(note?.content ?? "")
  );
  const [summary, setSummary] = useState(polishSummary(note?.summary ?? ""));
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { peers, selfId } = useNotesPresence({
    studyId,
    enabled: Boolean(studyId),
    editing,
  });
  const others = peers.filter((p) => p.id !== selfId);

  // Keep local state in sync when the study note identity changes (retry / refresh).
  // Do not depend on content/summary strings alone — that fights live edits & autosave.
  useEffect(() => {
    setContent(polishNotesMarkdown(note?.content ?? ""));
    setSummary(polishSummary(note?.summary ?? ""));
    setEditing(false);
  }, [note?.id]);

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

  // TipTap only while editing — preview uses MarkdownMath (avoids setContent ↔ onUpdate freeze).
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
      ],
      content: markdownToHtml(content),
      editable: true,
      immediatelyRender: false,
      onUpdate: ({ editor: ed }) => {
        setContent(htmlToMarkdownish(ed.getHTML()));
      },
      editorProps: {
        attributes: {
          class:
            "min-h-[320px] bg-card px-5 py-4 text-[16px] leading-[1.75] focus:outline-none prose prose-sm max-w-none dark:prose-invert",
        },
      },
    },
    // Recreate when entering edit so HTML matches latest markdown
    [editing]
  );

  useEffect(() => {
    if (!editing || !note) return;
    const timer = setTimeout(() => {
      void saveNote(content, summary, true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [content, summary, editing, note, saveNote]);

  // Live sync from collaborators (last-write-wins)
  useEffect(() => {
    if (!note?.id || !studyId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notes-row:${note.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notes",
          filter: `id=eq.${note.id}`,
        },
        (payload) => {
          setEditing((isEditing) => {
            if (isEditing) return isEditing;
            const next = payload.new as Note;
            setContent(next.content ?? "");
            setSummary(next.summary ?? "");
            return isEditing;
          });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [note?.id, studyId]);

  if (!note) {
    return (
      <motion.div className="space-y-3 py-8 text-center" {...fadeUp}>
        <p className="font-display text-lg font-semibold tracking-tight">
          Notes are on the way
        </p>
        <p className="text-sm text-muted-foreground">
          Once this study finishes processing, your study guide will show up
          here.
        </p>
      </motion.div>
    );
  }

  async function copyAll() {
    const text = `# Summary\n\n${summary}\n\n# Notes\n\n${content}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportMarkdown() {
    exportNotesMarkdown("StudySync Notes", { summary, content });
  }

  function exportPdf() {
    exportNotesPdf("StudySync Notes", { summary, content });
  }

  const dirty =
    content !== (note.content ?? "") || summary !== (note.summary ?? "");

  return (
    <motion.div className="space-y-8" {...fadeUp}>
      {others.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Studying together</span>
          {others.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-0.5 text-xs"
              title={p.editing ? "Editing" : "Viewing"}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: p.color }}
                aria-hidden
              />
              {p.name}
              {p.editing ? " · editing" : ""}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="page-kicker">Study guide</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Skim the overview, then dig into each section.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? (
              <Eye className="h-4 w-4" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
            {editing ? "Preview" : "Edit"}
          </Button>
          {editing || dirty ? (
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
            <DropdownMenuContent align="end">
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
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={exportMarkdown}
              >
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
      </div>

      <section className="overflow-hidden rounded-2xl border border-signal/25 bg-gradient-to-br from-[hsl(var(--signal)/0.12)] via-card to-card shadow-soft">
        <div className="border-b border-signal/15 px-5 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
            Big picture
          </p>
        </div>
        {editing ? (
          <div className="px-5 py-4 sm:px-6">
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="min-h-[110px] border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              aria-label="Summary notes"
            />
          </div>
        ) : (
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <MarkdownMath className="text-[16px] leading-[1.7] text-foreground/95 [&_p]:my-0">
              {summary || "No summary yet — open Edit to add one."}
            </MarkdownMath>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Your notes
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Read section by section — short and clear beats dense.
            </p>
          </div>
        </div>
        {editing ? (
          <div className="overflow-hidden rounded-2xl border border-border/60 shadow-soft">
            <NotesToolbar editor={editor} />
            <EditorContent editor={editor} />
          </div>
        ) : (
          <article
            className={cn(
              "notes-sheet rounded-2xl border border-border/60 bg-card/95 px-5 py-7 shadow-soft sm:px-8 sm:py-9",
              "text-[16px] leading-[1.75] text-foreground/90",
              "[&_h1]:mb-4 [&_h1]:mt-0 [&_h1]:font-display [&_h1]:text-[1.65rem] [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-foreground",
              "[&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:border-t [&_h2]:border-border/50 [&_h2]:pt-6 [&_h2]:font-display [&_h2]:text-[1.25rem] [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
              "[&_h2:first-child]:mt-0 [&_h2:first-child]:border-t-0 [&_h2:first-child]:pt-0",
              "[&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-[1.05rem] [&_h3]:font-semibold [&_h3]:text-foreground",
              "[&_p]:my-3.5 [&_p]:leading-[1.75]",
              "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
              "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5",
              "[&_li]:leading-[1.65] [&_li]:marker:text-primary/70",
              "[&_strong]:font-semibold [&_strong]:text-foreground",
              "[&_blockquote]:my-5 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-[3px] [&_blockquote]:border-signal [&_blockquote]:bg-muted/40 [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_blockquote]:pr-3 [&_blockquote]:not-italic",
              "[&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em]",
              "[&_hr]:my-8 [&_hr]:border-border/60"
            )}
          >
            <MarkdownMath>
              {content || "_No notes yet — try Edit to start writing._"}
            </MarkdownMath>
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

function NotesToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const tools: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    active?: boolean;
    run: () => void;
  }[] = [
    {
      label: "Undo",
      icon: Undo2,
      run: () => editor.chain().focus().undo().run(),
    },
    {
      label: "Redo",
      icon: Redo2,
      run: () => editor.chain().focus().redo().run(),
    },
    {
      label: "Bold",
      icon: Bold,
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Strikethrough",
      icon: Strikethrough,
      active: editor.isActive("strike"),
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "Heading 1",
      icon: Heading1,
      active: editor.isActive("heading", { level: 1 }),
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "Heading 2",
      icon: Heading2,
      active: editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Heading 3",
      icon: Heading3,
      active: editor.isActive("heading", { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "Bullet list",
      icon: List,
      active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Quote",
      icon: Quote,
      active: editor.isActive("blockquote"),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "Code",
      icon: Code,
      active: editor.isActive("code"),
      run: () => editor.chain().focus().toggleCode().run(),
    },
  ];

  return (
    <div className="flex flex-wrap gap-1 border-b border-border/60 bg-muted/30 p-2">
      {tools.map(({ label, icon: Icon, active, run }) => (
        <Button
          key={label}
          type="button"
          size="sm"
          variant={active ? "secondary" : "ghost"}
          className="h-8 w-8 px-0"
          aria-label={label}
          aria-pressed={active}
          onClick={run}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
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
  const withBlocks = escaped
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^> (.+)$/gm, "<blockquote><p>$1</p></blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, '<li data-ordered="1">$1</li>')
    .replace(/(<li data-ordered="1">[\s\S]*?<\/li>\n?)+/g, (block) =>
      `<ol>${block.replace(/ data-ordered="1"/g, "")}</ol>`
    )
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");

  return withBlocks
    .split(/\n{2,}/)
    .map((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return "";
      if (/^<(h[1-3]|ul|ol|blockquote)\b/i.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function htmlToMarkdownish(html: string) {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<blockquote[^>]*><p>(.*?)<\/p><\/blockquote>/gi, "> $1\n\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(/<s[^>]*>(.*?)<\/s>/gi, "~~$1~~")
    .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
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

