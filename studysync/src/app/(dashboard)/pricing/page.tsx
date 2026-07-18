import { createClient } from "@/lib/supabase/server";
import { PricingClient } from "@/components/billing/pricing-client";
import type { PlanType } from "@/types/database";

export default async function PricingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("user_id", user!.id)
    .single();

  return <PricingClient plan={(profile?.plan as PlanType) ?? "free"} />;
}
