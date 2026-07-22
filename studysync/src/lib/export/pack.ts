import JSZip from "jszip";
import { downloadBlob, slugifyFilename } from "@/lib/export/download";
import { escapeHtml, markdownToSimpleHtml, printHtmlDocument } from "@/lib/export/html";
import type { Flashcard, Note, Quiz } from "@/types/database";

type NoteExportSource = Pick<Note, "summary" | "content"> | null | undefined;

export function notesMarkdown(title: string, note: NoteExportSource) {
  const summary = note?.summary ?? "";
  const content = note?.content ?? "";
  return `# ${title}\n\n## Summary\n\n${summary}\n\n## Notes\n\n${content}\n`;
}

export function exportNotesMarkdown(title: string, note: NoteExportSource) {
  const slug = slugifyFilename(title);
  downloadBlob(
    `${slug}-notes.md`,
    new Blob([notesMarkdown(title, note)], {
      type: "text/markdown;charset=utf-8",
    })
  );
}

export function exportNotesPdf(title: string, note: NoteExportSource) {
  const summary = note?.summary ?? "";
  const content = note?.content ?? "";
  printHtmlDocument(
    `${title} — Notes`,
    `<p class="meta">StudySync</p>
     <h1>${escapeHtml(title)}</h1>
     <h2>Summary</h2><p>${escapeHtml(summary)}</p>
     <h2>Notes</h2>${markdownToSimpleHtml(content)}`
  );
}

function csvEscape(value: string) {
  const v = value.replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function flashcardsCsv(cards: Flashcard[]) {
  const rows = ["question,answer,difficulty"];
  for (const c of cards) {
    rows.push(
      [
        csvEscape(c.question ?? ""),
        csvEscape(c.answer ?? ""),
        csvEscape(c.difficulty ?? "medium"),
      ].join(",")
    );
  }
  return rows.join("\n") + "\n";
}

/** Anki-friendly tab-separated front/back (import as Text File). */
export function flashcardsAnkiTsv(cards: Flashcard[]) {
  return (
    cards
      .map(
        (c) =>
          `${(c.question ?? "").replace(/\t|\n/g, " ")}\t${(c.answer ?? "").replace(/\t|\n/g, " ")}`
      )
      .join("\n") + "\n"
  );
}

export function exportFlashcardsCsv(title: string, cards: Flashcard[]) {
  downloadBlob(
    `${slugifyFilename(title)}-flashcards.csv`,
    new Blob([flashcardsCsv(cards)], { type: "text/csv;charset=utf-8" })
  );
}

export function exportFlashcardsAnki(title: string, cards: Flashcard[]) {
  downloadBlob(
    `${slugifyFilename(title)}-anki.txt`,
    new Blob([flashcardsAnkiTsv(cards)], { type: "text/plain;charset=utf-8" })
  );
}

export function quizPrintHtml(title: string, quizzes: Quiz[]) {
  const questions = quizzes
    .map((q, i) => {
      const options = Array.isArray(q.options) ? q.options : [];
      const opts =
        q.quiz_type === "mcq" && options.length
          ? `<ol type="A">${options.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ol>`
          : `<p><em>${q.quiz_type === "fill_blank" ? "Fill in the blank" : "Short answer"}</em></p>`;
      return `<div class="q"><p><strong>${i + 1}.</strong> ${escapeHtml(q.question)}</p>${opts}</div>`;
    })
    .join("");

  const key = quizzes
    .map(
      (q, i) =>
        `<li><strong>${i + 1}.</strong> ${escapeHtml(q.correct_answer ?? "")}${
          q.explanation
            ? ` <span style="color:#666">— ${escapeHtml(q.explanation)}</span>`
            : ""
        }</li>`
    )
    .join("");

  return `<p class="meta">StudySync · printable practice</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">${quizzes.length} question${quizzes.length === 1 ? "" : "s"}</p>
    ${questions}
    <div class="answer-key">
      <h2>Answer key</h2>
      <ol>${key}</ol>
    </div>`;
}

export function exportQuizPrintable(title: string, quizzes: Quiz[]) {
  printHtmlDocument(`${title} — Quiz`, quizPrintHtml(title, quizzes));
}

export async function exportStudyPack(params: {
  title: string;
  note: NoteExportSource;
  flashcards: Flashcard[];
  quizzes: Quiz[];
}) {
  const { title, note, flashcards, quizzes } = params;
  const slug = slugifyFilename(title);
  const zip = new JSZip();
  zip.file("notes.md", notesMarkdown(title, note));
  zip.file("flashcards.csv", flashcardsCsv(flashcards));
  zip.file("anki-import.txt", flashcardsAnkiTsv(flashcards));
  zip.file("quiz.html", `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)} Quiz</title></head><body>${quizPrintHtml(title, quizzes)}</body></html>`);
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(`${slug}-studysync-pack.zip`, blob);
}
