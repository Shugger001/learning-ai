import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  DashboardClient,
  type StudySummary,
} from "@/components/dashboard/dashboard-client";
import { remainingUsage } from "@/lib/billing/limits";
import type { Folder, PlanType, Study } from "@/types/database";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: studies }, profileRes, foldersRes] = await Promise.all([
    supabase
      .from("studies")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select(
        "full_name, plan, uploads_used, chat_used, podcasts_used, usage_reset_at, onboarding_completed, xp, level"
      )
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("folders")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: true }),
  ]);

  // Older projects may not have usage_reset_at yet - fall back without it.
  let profile = profileRes.data as {
    full_name: string | null;
    plan: string | null;
    uploads_used: number | null;
    chat_used: number | null;
    podcasts_used: number | null;
    usage_reset_at?: string | null;
    onboarding_completed?: boolean | null;
    xp?: number | null;
    level?: number | null;
  } | null;
  if (
    profileRes.error?.message?.includes("usage_reset_at") ||
    profileRes.error?.message?.includes("onboarding_completed") ||
    profileRes.error?.message?.includes("xp") ||
    profileRes.error?.message?.includes("level")
  ) {
    const fallback = await supabase
      .from("profiles")
      .select("full_name, plan, uploads_used, chat_used, podcasts_used")
      .eq("user_id", user!.id)
      .single();
    profile = fallback.data;
  }

  const studyRows = ((studies as Study[]) ?? []).map((s) => ({
    ...s,
    is_favorite: Boolean(s.is_favorite),
  }));
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

  const usage = remainingUsage(profile);

  const onboardingCompleted =
    profileRes.error?.message?.includes("onboarding_completed")
      ? studyRows.length > 0
      : Boolean(profile?.onboarding_completed);

  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <DashboardClient
        studies={studyRows}
        summaries={summaries}
        folders={folders}
        dueToday={dueToday}
        plan={(profile?.plan as PlanType) ?? "free"}
        usage={usage}
        userName={userName}
        onboardingCompleted={onboardingCompleted}
        xp={Number(profile?.xp ?? 0)}
        level={Number(profile?.level ?? 1)}
      />
    </Suspense>
  );
}
