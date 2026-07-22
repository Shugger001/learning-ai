import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Navbar } from "@/components/layout/navbar";
import { StudyWorkspace } from "@/components/study/study-workspace";
import { Button } from "@/components/ui/button";
import type { StudyWithMaterials } from "@/types/database";

interface PageProps {
  params: { id: string };
  searchParams?: { room?: string };
}

export default async function StudyPage({ params, searchParams }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .single();

  let study =
    (
      await supabase
        .from("studies")
        .select("*")
        .eq("id", params.id)
        .eq("user_id", user.id)
        .maybeSingle()
    ).data ?? null;

  // Room guests: allow read-only study access when room code matches this pack
  const roomCode = searchParams?.room?.trim().toUpperCase();
  if (!study && roomCode) {
    try {
      const admin = createAdminClient();
      const { data: room } = await admin
        .from("study_rooms")
        .select("id, study_id, is_active")
        .eq("join_code", roomCode)
        .eq("study_id", params.id)
        .eq("is_active", true)
        .maybeSingle();
      if (room) {
        const { data: shared } = await admin
          .from("studies")
          .select("*")
          .eq("id", params.id)
          .maybeSingle();
        study = shared;
      }
    } catch {
      // admin/env missing — fall through to notFound
    }
  }

  if (!study) {
    notFound();
  }

  const reader = study.user_id === user.id ? supabase : createAdminClient();

  const [{ data: flashcards }, { data: quizzes }, { data: notes }] =
    await Promise.all([
      reader
        .from("flashcards")
        .select("*")
        .eq("study_id", params.id)
        .order("position", { ascending: true }),
      reader
        .from("quizzes")
        .select("*")
        .eq("study_id", params.id)
        .order("position", { ascending: true }),
      reader.from("notes").select("*").eq("study_id", params.id).maybeSingle(),
    ]);

  const materials: StudyWithMaterials = {
    ...study,
    flashcards: flashcards ?? [],
    quizzes: quizzes ?? [],
    notes: notes ?? null,
  };

  return (
    <div className="min-h-screen">
      <Navbar
        userEmail={user.email}
        userName={
          profile?.full_name ||
          (user.user_metadata?.full_name as string | undefined) ||
          null
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
        <Suspense
          fallback={
            <div className="text-sm text-muted-foreground">Loading…</div>
          }
        >
          <StudyWorkspace study={materials} />
        </Suspense>
      </main>
    </div>
  );
}
