"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/types/api";

function UnsubscribeInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Unsubscribing…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing unsubscribe token.");
      return;
    }
    void fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((json: ApiResponse<{ unsubscribed: boolean }>) => {
        if (json.success) {
          setStatus("ok");
          setMessage("You're unsubscribed from weekly recap emails.");
        } else {
          setStatus("error");
          setMessage(json.error);
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Could not unsubscribe. Try again from Progress.");
      });
  }, [token]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        Email
      </p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Weekly recap
      </h1>
      <p
        className={
          status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
        }
        role="status"
      >
        {message}
      </p>
      <div className="flex justify-center gap-2">
        <Button asChild variant="outline">
          <Link href="/progress">Email preferences</Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-center text-sm text-muted-foreground">
          Loading…
        </p>
      }
    >
      <UnsubscribeInner />
    </Suspense>
  );
}
