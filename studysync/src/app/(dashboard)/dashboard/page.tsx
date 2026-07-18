import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import type { Study } from "@/types/database";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("studies")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return <DashboardClient studies={(data as Study[]) ?? []} />;
}
