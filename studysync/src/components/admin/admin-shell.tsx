"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  CreditCard,
  Gauge,
  LayoutDashboard,
  Library,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/studies", label: "Studies", icon: Library },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/health", label: "Health", icon: Activity },
] as const;

export function AdminShell({
  children,
  email,
  name,
}: {
  children: React.ReactNode;
  email?: string | null;
  name?: string | null;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_hsl(var(--mist))_0%,_hsl(var(--background))_55%)]">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 font-display text-sm font-semibold tracking-tight"
            >
              <Shield className="h-4 w-4 text-accent" />
              Command
            </Link>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              StudySync ops
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard">
                <Gauge className="h-4 w-4" />
                App
              </Link>
            </Button>
            <ThemeToggle />
            <span className="hidden max-w-[10rem] truncate text-xs text-muted-foreground sm:inline">
              {name || email}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[13rem_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Admin">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/admin"
                  ? pathname === "/admin"
                  : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-2 whitespace-nowrap border px-3 py-2 text-sm transition-colors",
                    active
                      ? "border-primary/40 bg-primary text-primary-foreground"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="min-w-0"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
