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
      <div className="relative hidden overflow-hidden bg-[hsl(162_55%_10%)] lg:block">
        <Image
          src={SIDE_IMAGE}
          alt="Student writing notes at a desk"
          fill
          className="object-cover object-[center_25%] opacity-90"
          sizes="50vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(162_55%_7%/0.96)] via-[hsl(162_50%_9%/0.5)] to-transparent" />
        <motion.div
          className="absolute right-10 top-0 h-full w-1 bg-signal/70"
          aria-hidden
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
          style={{ transformOrigin: "top" }}
        />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <div className="signal-bar mb-4" aria-hidden />
          <p className="flex items-center gap-2.5 font-display text-4xl font-bold tracking-tight text-white">
            <span className="brand-mark" aria-hidden />
            StudySync
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">
            Sign in to continue turning lectures into active recall.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <motion.div
          className="w-full max-w-md space-y-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-foreground lg:hidden">
              <span className="brand-mark" aria-hidden />
              StudySync
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Welcome back
            </h1>
            <p className="text-muted-foreground">
              Continue where your last study left off.
            </p>
          </div>

          <div className="space-y-6">
            <OAuthButtons />
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                or email
              </span>
            </div>
            <EmailAuthForm mode="login" />
            <p className="text-center text-sm text-muted-foreground">
              New here?{" "}
              <Link
                href="/signup"
                className="font-bold text-primary underline-offset-4 hover:underline"
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
