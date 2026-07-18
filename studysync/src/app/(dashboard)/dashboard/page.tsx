import { createClient } from "@/lib/supabase/server";
import {
  DashboardClient,
  type StudySummary,
} from "@/components/dashboard/dashboard-client";
import type { Study } from "@/types/database";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: studies }, { data: profile }] = await Promise.all([
    supabase
      .from("studies")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user!.id)
      .single(),
  ]);

  const studyRows = (studies as Study[]) ?? [];
  const studyIds = studyRows.map((s) => s.id);

  let summaries: StudySummary[] = [];
  if (studyIds.length > 0) {
    const { data: notes } = await supabase
      .from("notes")
      .select("study_id, summary")
      .in("study_id", studyIds);
    summaries = (notes as StudySummary[]) ?? [];
  }

  const userName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    null;

  return (
    <DashboardClient
      studies={studyRows}
      summaries={summaries}
      userName={userName}
    />
  );
}
