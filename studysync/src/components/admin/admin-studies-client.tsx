"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@/types/api";

type StudyRow = {
  id: string;
  user_id: string;
  title: string;
  status: string;
  content_type: string;
  processing_progress: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function AdminStudiesInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [q, setQ] = useState("");
  const [studies, setStudies] = useState<StudyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: "25",
      status,
    });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/studies?${params}`);
    const json = (await res.json()) as ApiResponse<{
      studies: StudyRow[];
      total: number;
    }>;
    if (!json.success) {
      setError(json.error);
      return;
    }
    setStudies(json.data.studies);
    setTotal(json.data.total);
  }, [page, status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function retry(id: string) {
    setRetrying(id);
    await fetch(`/api/admin/studies/${id}/retry`, { method: "POST" });
    setRetrying(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-accent">Studies</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Processing ops
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} matching · retry stuck or failed packs
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Filter title…"
          className="max-w-xs"
        />
        <select
          className="h-10 border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="all">All</option>
          <option value="processing">Processing</option>
          <option value="complete">Complete</option>
          <option value="error">Error</option>
        </select>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto border border-border/70">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-border/60 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {studies.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2.5">
                  <Link href={`/study/${s.id}`} className="font-medium hover:underline">
                    {s.title}
                  </Link>
                  {s.error_message ? (
                    <p className="max-w-md truncate text-xs text-destructive">
                      {s.error_message}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 capitalize">
                  {s.status}
                  {s.status === "processing"
                    ? ` ${s.processing_progress}%`
                    : ""}
                </td>
                <td className="px-3 py-2.5 capitalize text-muted-foreground">
                  {s.content_type}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {new Date(s.updated_at).toLocaleString()}
                </td>
                <td className="px-3 py-2.5">
                  {(s.status === "error" || s.status === "processing") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={retrying === s.id}
                      onClick={() => void retry(s.id)}
                    >
                      {retrying === s.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Retry
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Prev
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={studies.length < 25}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function AdminStudiesClient() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AdminStudiesInner />
    </Suspense>
  );
}
