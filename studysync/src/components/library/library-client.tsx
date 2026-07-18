"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import type { ApiResponse } from "@/types/api";
import type { LibraryItem, Study } from "@/types/database";

type LibraryListItem = Pick<
  LibraryItem,
  "id" | "title" | "subject" | "description" | "created_at"
>;

export function LibraryClient({ items }: { items: LibraryListItem[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addToLibrary(itemId: string) {
    setLoadingId(itemId);
    setError(null);
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId }),
    });
    const json = (await res.json()) as ApiResponse<Study>;
    setLoadingId(null);
    if (!json.success) {
      setError(json.error);
      return;
    }
    router.push(`/study/${json.data.id}`);
    router.refresh();
  }

  if (!items.length) {
    return (
      <motion.p className="text-sm text-muted-foreground" {...fadeUp}>
        No premade packs yet. Run the Turbo parity migration to seed the library.
      </motion.p>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <motion.ul
        className="grid gap-4 sm:grid-cols-2"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {items.map((item) => (
          <motion.li
            key={item.id}
            variants={staggerItem}
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex flex-col border border-border/70 bg-card/50 p-5"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center border border-border/60 text-muted-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              {item.subject}
            </p>
            <h2 className="font-display mt-1 text-lg font-semibold tracking-tight">
              {item.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              {item.description || "Premade study pack"}
            </p>
            <Button
              className="mt-5"
              variant="outline"
              disabled={loadingId === item.id}
              onClick={() => void addToLibrary(item.id)}
            >
              {loadingId === item.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Add to my library
            </Button>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
