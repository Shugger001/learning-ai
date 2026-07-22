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
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
    ],
    content: markdownToHtml(content),
    editable: editing,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      setContent(htmlToMarkdownish(ed.getHTML()));
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[320px] bg-card px-4 py-3 text-[15px] leading-relaxed focus:outline-none prose prose-sm max-w-none dark:prose-invert",
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
    exportNotesMarkdown("StudySync Notes", { summary, content });
  }

  function exportPdf() {
    exportNotesPdf("StudySync Notes", { summary, content });
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
            <MarkdownMath className="text-[15px] text-foreground/90">
              {summary || "No summary yet."}
            </MarkdownMath>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Notes</h2>
        {editing ? (
          <div className="overflow-hidden rounded-lg border border-border/60">
            <NotesToolbar editor={editor} />
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
              "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic",
              "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm"
            )}
          >
            <MarkdownMath>{content || "_No notes yet._"}</MarkdownMath>
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
  return escaped
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^\> (.+)$/gm, "<blockquote><p>$1</p></blockquote>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li data-ordered=\"1\">$1</li>")
    .replace(/(<li data-ordered=\"1\">.*<\/li>\n?)+/g, (block) =>
      `<ol>${block.replace(/ data-ordered=\"1\"/g, "")}</ol>`
    )
    .replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hulob])/gm, (line) =>
      line.startsWith("<") ? line : `<p>${line}</p>`
    );
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

