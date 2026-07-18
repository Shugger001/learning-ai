import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  DashboardClient,
  type StudySummary,
} from "@/components/dashboard/dashboard-client";
import type { Folder, PlanType, Study } from "@/types/database";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: studies }, { data: profile }, foldersRes] = await Promise.all([
    supabase
      .from("studies")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("full_name, plan")
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("folders")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: true }),
  ]);

  const studyRows = (studies as Study[]) ?? [];
  const studyIds = studyRows.map((s) => s.id);
  const folders = foldersRes.error
    ? []
    : ((foldersRes.data as Folder[]) ?? []);

  let summaries: StudySummary[] = [];
  let dueToday = 0;

  if (studyIds.length > 0) {
    const [{ data: notes }, dueRes] = await Promise.all([
      supabase.from("notes").select("study_id, summary").in("study_id", studyIds),
      supabase
        .from("flashcards")
        .select("id")
        .in("study_id", studyIds)
        .lte("due_at", new Date().toISOString()),
    ]);
    summaries = (notes as StudySummary[]) ?? [];
    dueToday = dueRes.error ? 0 : (dueRes.data?.length ?? 0);
  }

  const userName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    null;

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <DashboardClient
        studies={studyRows}
        summaries={summaries}
        folders={folders}
        dueToday={dueToday}
        plan={(profile?.plan as PlanType) ?? "free"}
        userName={userName}
      />
    </Suspense>
  );
}
