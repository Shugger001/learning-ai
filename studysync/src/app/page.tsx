"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingProductMock } from "@/components/landing/product-mock";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=2400&q=80";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <section className="relative isolate min-h-[100svh] overflow-hidden bg-[hsl(168_42%_9%)]">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2.2, ease: EASE }}
        >
          <Image
            src={HERO_IMAGE}
            alt="Student studying with notebooks under warm desk light"
            fill
            priority
            className="object-cover object-[center_28%]"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(168_45%_6%/0.92)] via-[hsl(168_40%_8%/0.72)] to-[hsl(168_30%_12%/0.35)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(168_45%_5%/0.88)] via-transparent to-[hsl(168_40%_8%/0.35)]" />
          <div
            className="absolute inset-0 opacity-40"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 50% 40% at 70% 30%, hsl(38 55% 52% / 0.18), transparent 60%)",
            }}
          />
        </motion.div>

        <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight text-white">
            <span className="brand-mark" aria-hidden />
            StudySync
          </span>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-end px-4 pb-24 pt-24 sm:px-6 sm:pb-32">
          <motion.div
            className="max-w-2xl space-y-7"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.15, ease: EASE }}
          >
            <p className="font-display text-[clamp(3.5rem,11vw,7.25rem)] font-semibold leading-[0.9] tracking-tight text-white">
              StudySync
            </p>
            <motion.div
              className="signal-bar"
              aria-hidden
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
              style={{ transformOrigin: "left" }}
            />
            <h1 className="max-w-lg text-xl font-normal leading-relaxed text-white/88 sm:text-2xl sm:leading-relaxed">
              Lectures become lasting memory.
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-white/55 sm:text-base">
              Upload once. Practice with notes, flashcards, quizzes, chat, and
              podcasts built for recall.
            </p>
            <motion.div
              className="flex flex-wrap gap-3 pt-1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55, ease: EASE }}
            >
              <Button asChild size="lg" variant="secondary">
                <Link href="/signup">
                  Start studying
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-white/20 bg-white/5 text-white backdrop-blur-sm hover:bg-white/10 hover:text-white"
              >
                <Link href="/login">I have an account</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 py-28 sm:px-6 sm:py-36">
        <motion.div
          className="max-w-xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <p className="page-kicker">How it works</p>
          <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
            Capture. Structure. Practice.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            One pass from lecture to active recall—without building decks by
            hand.
          </p>
        </motion.div>

        <ol className="mt-20 grid gap-8 sm:grid-cols-3 sm:gap-10">
          {[
            {
              step: "01",
              title: "Capture once",
              body: "YouTube, live recording, PDF, slides, video, or text—cleaned automatically.",
            },
            {
              step: "02",
              title: "Get a study pack",
              body: "Notes, flashcards, quizzes, mind map, chat, and an optional podcast.",
            },
            {
              step: "03",
              title: "Practice deeply",
              body: "Spaced recall, mixed quiz types, and edit anything so your deck stays true.",
            },
          ].map((item, i) => (
            <motion.li
              key={item.step}
              className="space-y-4 rounded-2xl border border-border/50 bg-card/60 p-6 shadow-soft sm:p-7"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: EASE }}
            >
              <span className="font-display text-4xl font-semibold text-signal/50">
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

      <section className="relative overflow-hidden bg-[hsl(168_42%_9%)] text-white">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 55% 60% at 85% 20%, hsl(38 55% 52% / 0.16), transparent 55%), radial-gradient(ellipse 40% 50% at 5% 90%, hsl(200 30% 35% / 0.12), transparent 50%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-32">
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <div className="signal-bar" aria-hidden />
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Review. Ask. Listen.
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-white/60">
              One workspace for notes, spaced flashcards, quizzes, chat, and
              podcasts—so the next action is always obvious.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.75, delay: 0.08, ease: EASE }}
          >
            <LandingProductMock />
          </motion.div>
        </div>
      </section>

      <footer className="ink-rule bg-background/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-12 sm:px-6">
          <div>
            <p className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
              <span className="brand-mark" aria-hidden />
              StudySync
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Built for lasting recall
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/pricing"
              className="font-medium text-foreground/80 underline-offset-4 transition hover:text-foreground hover:underline"
            >
              Pricing
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 font-semibold text-primary"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
