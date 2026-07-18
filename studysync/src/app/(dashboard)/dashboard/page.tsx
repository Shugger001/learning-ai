import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
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

  const userName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    null;

  return (
    <DashboardClient
      studies={(studies as Study[]) ?? []}
      userName={userName}
    />
  );
}
