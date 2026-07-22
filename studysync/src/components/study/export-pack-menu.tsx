"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportFlashcardsAnki,
  exportFlashcardsCsv,
  exportNotesMarkdown,
  exportNotesPdf,
  exportQuizPrintable,
  exportStudyPack,
} from "@/lib/export/pack";
import type { StudyWithMaterials } from "@/types/database";

export function ExportPackMenu({ study }: { study: StudyWithMaterials }) {
  const [packing, setPacking] = useState(false);
  const note = study.notes;
  const cards = study.flashcards ?? [];
  const quizzes = study.quizzes ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          {packing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Notes</DropdownMenuLabel>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => exportNotesMarkdown(study.title, note)}
        >
          Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => exportNotesPdf(study.title, note)}
        >
          PDF (print)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Flashcards</DropdownMenuLabel>
        <DropdownMenuItem
          className="cursor-pointer"
          disabled={cards.length === 0}
          onClick={() => exportFlashcardsCsv(study.title, cards)}
        >
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          disabled={cards.length === 0}
          onClick={() => exportFlashcardsAnki(study.title, cards)}
        >
          Anki TSV (.txt)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Quiz</DropdownMenuLabel>
        <DropdownMenuItem
          className="cursor-pointer"
          disabled={quizzes.length === 0}
          onClick={() => exportQuizPrintable(study.title, quizzes)}
        >
          Printable practice
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          disabled={packing}
          onClick={() => {
            setPacking(true);
            void exportStudyPack({
              title: study.title,
              note,
              flashcards: cards,
              quizzes,
            }).finally(() => setPacking(false));
          }}
        >
          Full pack (.zip)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
