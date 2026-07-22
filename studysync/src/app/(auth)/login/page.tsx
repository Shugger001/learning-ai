"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Separator } from "@/components/ui/separator";

const SIDE_IMAGE =
  "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1600&q=80";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[hsl(168_42%_9%)] lg:block">
        <Image
          src={SIDE_IMAGE}
          alt="Student writing notes at a desk"
          fill
          className="object-cover object-[center_25%] opacity-90"
          sizes="50vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(168_45%_6%/0.94)] via-[hsl(168_40%_8%/0.45)] to-transparent" />
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 30% 70%, hsl(38 55% 52% / 0.12), transparent 55%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <div className="signal-bar mb-5" aria-hidden />
          <p className="flex items-center gap-2.5 font-display text-4xl font-semibold tracking-tight text-white">
            <span className="brand-mark" aria-hidden />
            StudySync
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
            Sign in to continue turning lectures into active recall.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-14 sm:px-8">
        <motion.div
          className="w-full max-w-md space-y-9"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="space-y-3">
            <p className="flex items-center gap-2.5 font-display text-3xl font-semibold tracking-tight text-foreground lg:hidden">
              <span className="brand-mark" aria-hidden />
              StudySync
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="text-muted-foreground">
              Continue where your last study left off.
            </p>
          </div>

          <div className="space-y-6 rounded-2xl border border-border/60 bg-card/70 p-6 shadow-premium sm:p-8">
            <OAuthButtons />
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                or email
              </span>
            </div>
            <EmailAuthForm mode="login" />
            <p className="text-center text-sm text-muted-foreground">
              New here?{" "}
              <Link
                href="/signup"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Create an account
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
