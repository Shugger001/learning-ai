import { createClient } from "@/lib/supabase/server";
import { CompareClient } from "@/components/compare/compare-client";
import type { Study } from "@/types/database";

export default async function ComparePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: studies } = await supabase
    .from("studies")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Compare studies
        </h1>
        <p className="mt-1 text-muted-foreground">
          Side-by-side mastery, due load, and shared concepts for midterm prep.
        </p>
      </div>
      <CompareClient studies={(studies as Study[]) ?? []} />
    </div>
  );
}
