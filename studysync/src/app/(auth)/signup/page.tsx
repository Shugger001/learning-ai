"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Separator } from "@/components/ui/separator";

const SIDE_IMAGE =
  "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1600&q=80";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function SignupPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[hsl(158_40%_12%)] lg:block">
        <Image
          src={SIDE_IMAGE}
          alt="Open books prepared for studying"
          fill
          className="object-cover opacity-90"
          sizes="50vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(158_45%_8%/0.95)] via-[hsl(158_40%_10%/0.4)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <div className="signal-bar mb-4" aria-hidden />
          <p className="font-display text-4xl font-semibold tracking-tight text-white">
            StudySync
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">
            Upload a lecture. Leave with notes, flashcards, and quizzes.
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
            <p className="font-display text-3xl font-semibold tracking-tight text-foreground lg:hidden">
              StudySync
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Start studying smarter
            </h1>
            <p className="text-muted-foreground">
              Create an account and turn your next lecture into practice.
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
      </div>
    </main>
  );
}
