"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ApiResponse } from "@/types/api";

interface CommentRow {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export function ShareComments({ shareToken }: { shareToken: string }) {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/share/${shareToken}/comments`);
    const json = (await res.json()) as ApiResponse<CommentRow[]>;
    if (json.success) setComments(json.data);
  }

  useEffect(() => {
    void load();
  }, [shareToken]);

  async function post() {
    if (!body.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/share/${shareToken}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: body.trim(),
        author_name: name.trim() || undefined,
        invite_token: inviteToken || undefined,
      }),
    });
    const json = (await res.json()) as ApiResponse<CommentRow>;
    setLoading(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setBody("");
    setComments((prev) => [...prev, json.data]);
  }

  return (
    <section className="space-y-4 border-t border-border/60 pt-8">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Comments
        </h2>
        <p className="text-sm text-muted-foreground">
          Leave a note for the study owner
          {inviteToken ? " · invite unlocked" : ""}.
        </p>
      </div>

      <ul className="space-y-3">
        {comments.length === 0 ? (
          <li className="text-sm text-muted-foreground">No comments yet.</li>
        ) : (
          comments.map((c) => (
            <li
              key={c.id}
              className="border border-border/70 bg-card/40 px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{c.author_name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                {c.body}
              </p>
            </li>
          ))
        )}
      </ul>

      <div className="space-y-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          aria-label="Comment author name"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ask a question or leave feedback…"
          className="min-h-[90px]"
          aria-label="Comment body"
        />
        <Button
          type="button"
          size="sm"
          disabled={loading || !body.trim()}
          onClick={() => void post()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Post comment
        </Button>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
