"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import type { ApiResponse } from "@/types/api";
import type { SearchHit } from "@/types/search";

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setHits([]);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (timer.current) window.clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((json: ApiResponse<SearchHit[]>) => {
          if (json.success) setHits(json.data);
          else setHits([]);
        })
        .finally(() => setLoading(false));
    }, 220);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [q, open]);

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="hidden text-muted-foreground sm:inline-flex"
        onClick={() => setOpen(true)}
        aria-label="Search studies"
      >
        <Search className="h-4 w-4" />
        <span className="hidden lg:inline">Search</span>
        <kbd className="ml-1 hidden rounded border border-border/70 px-1 text-[10px] text-muted-foreground xl:inline">
          ⌘K
        </kbd>
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 px-4 pt-[12vh] backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close search"
        onClick={close}
      />
      <div className="relative z-10 w-full max-w-lg border border-border/80 bg-card shadow-lg">
        <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search studies, notes, cards…"
            className="border-0 shadow-none focus-visible:ring-0"
            aria-label="Search query"
          />
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {q.trim().length < 2 ? (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters
            </li>
          ) : hits.length === 0 && !loading ? (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">
              No matches
            </li>
          ) : (
            hits.map((hit) => (
              <li key={`${hit.kind}-${hit.study_id}-${hit.snippet}`}>
                <button
                  type="button"
                  className={cn(
                    "w-full border border-transparent px-3 py-2 text-left text-sm hover:border-border/70 hover:bg-muted/40"
                  )}
                  onClick={() => {
                    close();
                    router.push(hit.href);
                  }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {hit.kind}
                  </p>
                  <p className="font-medium">{hit.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {hit.snippet}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
