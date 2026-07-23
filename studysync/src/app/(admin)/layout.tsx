import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/require-admin";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/dashboard");
  }

  return (
    <AdminShell
      email={session.user.email}
      name={
        session.profile.full_name ||
        (session.user.user_metadata?.full_name as string | undefined) ||
        null
      }
    >
      {children}
    </AdminShell>
  );
}
