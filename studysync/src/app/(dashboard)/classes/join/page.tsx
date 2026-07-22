"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@/types/api";

function JoinInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(payload: { code?: string; token?: string }) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/classes/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as ApiResponse<{
      class_id?: string;
      class?: { id: string };
      classes?: { id: string };
    }>;
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    const id =
      json.data.class?.id ||
      json.data.classes?.id ||
      json.data.class_id;
    router.push(id ? `/classes/${id}` : "/classes");
  }

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) void join({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="mx-auto max-w-md space-y-6 py-10">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Join a class
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the join code from your teacher, or open an invite link.
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          aria-label="Join code"
        />
        <Button
          type="button"
          disabled={busy || !code.trim()}
          onClick={() => void join({ code: code.trim() })}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Join
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function JoinClassPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <JoinInner />
    </Suspense>
  );
}
