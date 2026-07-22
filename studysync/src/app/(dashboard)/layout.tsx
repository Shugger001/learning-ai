import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/navbar";
import { PageReveal } from "@/components/layout/page-reveal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    redirect("/login");
  }

  let user = null;
  try {
    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch {
    redirect("/login");
  }

  if (!user) {
    redirect("/login");
  }

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .single();

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
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-11">
        <PageReveal>{children}</PageReveal>
      </main>
    </div>
  );
}
