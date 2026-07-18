import { createClient } from "@/lib/supabase/server";
import { LibraryClient } from "@/components/library/library-client";
import type { LibraryItem } from "@/types/database";

export default async function LibraryPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("library_items")
    .select("id, title, subject, description, created_at")
    .order("subject");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="signal-bar" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Premade library
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Browse study packs
        </h1>
        <p className="max-w-xl text-[15px] text-muted-foreground">
          Clone a ready-made guide into your library and generate notes,
          flashcards, and quizzes automatically.
        </p>
      </div>
      <LibraryClient
        items={
          (data as Pick<
            LibraryItem,
            "id" | "title" | "subject" | "description" | "created_at"
          >[]) ?? []
        }
      />
    </div>
  );
}
