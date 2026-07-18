"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  ShareStudyView,
  type ShareStudyPayload,
} from "@/components/share/share-study-view";
import type { ApiResponse } from "@/types/api";

export default function SharePage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<ShareStudyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/share/${params.token}`);
      const json = (await res.json()) as ApiResponse<ShareStudyPayload>;
      if (!json.success) {
        setError(json.error);
        return;
      }
      setData(json.data);
    })();
  }, [params.token]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16">
        <h1 className="font-display text-2xl font-semibold">Link unavailable</h1>
        <p className="mt-2 text-muted-foreground">{error}</p>
        <Link href="/" className="mt-6 text-sm text-primary hover:underline">
          Go to StudySync
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return <ShareStudyView data={data} />;
}
