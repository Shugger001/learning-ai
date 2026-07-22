"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GlobalSearch } from "@/components/search/global-search";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";
import { EASE } from "@/lib/motion";

interface NavbarProps {
  userEmail?: string | null;
  userName?: string | null;
}

const PRIMARY_LINKS = [
  { href: "/review", label: "Review" },
  { href: "/plan", label: "Plan" },
  { href: "/classes", label: "Classes" },
  { href: "/progress", label: "Progress" },
] as const;

export function Navbar({ userEmail, userName }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <motion.header
      className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="h-0.5 w-full bg-signal" aria-hidden />
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
          aria-label="StudySync home"
        >
          <span className="brand-mark" aria-hidden />
          StudySync
        </Link>

        <nav
          className="hidden items-center gap-0.5 md:flex"
          aria-label="Primary"
        >
          {PRIMARY_LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-2.5 py-1.5 text-sm font-semibold tracking-tight transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <GlobalSearch />
          <Button asChild size="sm" className="shrink-0 bg-signal text-accent-foreground hover:bg-signal/90">
            <Link href="/dashboard?new=1">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </Link>
          </Button>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Open account menu">
                {userName?.split(" ")[0] || userEmail?.split("@")[0] || "Account"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{userName || "Student"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {userEmail}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer md:hidden">
                <Link href="/review">Review</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer md:hidden">
                <Link href="/plan">Plan</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer md:hidden">
                <Link href="/classes">Classes</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer md:hidden">
                <Link href="/progress">Progress</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/rooms">Study rooms</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/calendar">Calendar</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/exam">Exam campaigns</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/library">Premade library</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/pricing">Pricing</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.header>
  );
}
