"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Separator } from "@/components/ui/separator";

const BG_IMAGE =
  "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=2400&q=80";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function SignupPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-14 sm:px-8">
      <Image
        src={BG_IMAGE}
        alt=""
        fill
        className="object-cover"
        sizes="100vw"
        priority
        aria-hidden
      />
      <div className="absolute inset-0 bg-[hsl(168_45%_6%/0.72)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[hsl(168_45%_5%/0.92)] via-[hsl(168_40%_8%/0.55)] to-[hsl(168_42%_10%/0.35)]" />
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 50% 80%, hsl(38 55% 52% / 0.14), transparent 60%)",
        }}
      />

      <motion.div
        className="relative z-10 w-full max-w-md space-y-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        <div className="space-y-3 text-center sm:text-left">
          <p className="flex items-center justify-center gap-2.5 font-display text-3xl font-semibold tracking-tight text-white sm:justify-start">
            <span className="brand-mark" aria-hidden />
            StudySync
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
            Start studying smarter
          </h1>
          <p className="text-white/65">
            Create an account and turn your next lecture into practice.
          </p>
        </div>

        <div className="space-y-6 rounded-2xl border border-white/40 bg-card/92 p-6 shadow-premium backdrop-blur-md sm:p-8">
          <OAuthButtons />
          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              or email
            </span>
          </div>
          <EmailAuthForm mode="signup" />
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
