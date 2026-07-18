"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingProductMock } from "@/components/landing/product-mock";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1456513080880-7d93aaa2daf8?auto=format&fit=crop&w=2400&q=80";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function LandingPage() {
  return (
    <div className="relative min-h-screen">
      <section className="relative isolate min-h-[100svh] overflow-hidden">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.04 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.4, ease: EASE }}
        >
          <Image
            src={HERO_IMAGE}
            alt="Open books and study notes on a desk"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222_47%_6%)] via-[hsl(222_40%_8%/0.72)] to-[hsl(222_40%_10%/0.45)]" />
        </motion.div>

        <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="font-display text-lg font-semibold tracking-tight text-white">
            StudySync
          </span>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-white/90 hover:bg-white/10 hover:text-white"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-white text-[hsl(222_47%_8%)] hover:bg-white/90"
            >
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-end px-4 pb-16 pt-24 sm:px-6 sm:pb-24">
          <motion.div
            className="max-w-2xl space-y-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
          >
            <p className="font-display text-5xl font-semibold leading-[0.95] tracking-tight text-white sm:text-7xl md:text-8xl">
              StudySync
            </p>
            <h1 className="max-w-xl text-xl font-medium leading-snug text-white/90 sm:text-2xl">
              Lectures become lasting memory.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-white/70 sm:text-lg">
              Upload, record, or paste a YouTube link—then study with notes,
              flashcards, chat, and podcasts built for active recall.
            </p>
            <motion.div
              className="flex flex-wrap gap-3 pt-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
            >
              <Button
                asChild
                size="lg"
                className="h-12 bg-white px-7 text-[hsl(222_47%_8%)] hover:bg-white/90"
              >
                <Link href="/signup">
                  Start studying
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 border-white/30 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/login">I have an account</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <motion.div
          className="max-w-xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            From lecture to practice in one pass
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            StudySync structures what you upload into the surfaces that make
            recall stick—without the busywork.
          </p>
        </motion.div>

        <ol className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-10">
          {[
            {
              step: "01",
              title: "Capture once",
              body: "YouTube, live recording, PDF, slides, video, or text—ingested and cleaned automatically.",
            },
            {
              step: "02",
              title: "Get a study pack",
              body: "Notes, flashcards, quizzes, mind map, chat, and an optional podcast from the same material.",
            },
            {
              step: "03",
              title: "Practice deeply",
              body: "Spaced recall, mixed quiz types, and edit anything so your deck stays accurate.",
            },
          ].map((item, i) => (
            <motion.li
              key={item.step}
              className="relative space-y-3 border-t border-border pt-6"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
            >
              <span className="font-display text-sm font-semibold text-primary">
                {item.step}
              </span>
              <h3 className="font-display text-xl font-semibold tracking-tight">
                {item.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* Full-bleed product proof — not a card grid */}
      <section className="relative overflow-hidden border-y border-border/70 bg-[hsl(222_47%_7%)] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 80% 20%, hsl(174 48% 32% / 0.35), transparent 55%), radial-gradient(ellipse 50% 60% at 10% 90%, hsl(210 40% 40% / 0.2), transparent 50%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-28">
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: EASE }}
          >
            <p className="text-sm font-medium text-[hsl(174_45%_62%)]">
              Inside a study
            </p>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Review cards. Ask the material. Listen on the go.
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-white/65">
              One workspace for notes, spaced flashcards, quizzes, chat, and
              podcasts—so the next action is always obvious.
            </p>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          >
            <LandingProductMock />
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-8 sm:px-6">
          <span className="font-display text-sm font-semibold tracking-tight">
            StudySync
          </span>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <span className="hidden sm:inline">Built for lasting recall</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
