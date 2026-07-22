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
      <section className="relative isolate min-h-[100svh] overflow-hidden bg-[hsl(162_55%_10%)]">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.8, ease: EASE }}
        >
          <Image
            src={HERO_IMAGE}
            alt="Student studying with notebooks under warm desk light"
            fill
            priority
            className="object-cover object-[center_28%]"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(162_55%_7%/0.94)] via-[hsl(162_50%_9%/0.78)] to-[hsl(162_40%_12%/0.28)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(162_55%_5%/0.9)] via-transparent to-[hsl(162_45%_10%/0.3)]" />
        </motion.div>

        {/* Signal slash accent */}
        <motion.div
          className="pointer-events-none absolute -right-8 top-24 h-[120%] w-1 origin-top bg-signal/80 sm:right-[18%] sm:w-1.5"
          aria-hidden
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.35, ease: EASE }}
          style={{ transform: "rotate(12deg)" }}
        />

        <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-white">
            <span className="brand-mark" aria-hidden />
            StudySync
          </span>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-white/85 hover:bg-white/10 hover:text-white"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-signal text-accent-foreground hover:bg-signal/90"
            >
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-end px-4 pb-20 pt-24 sm:px-6 sm:pb-28">
          <motion.div
            className="max-w-2xl space-y-6"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
          >
            <p className="font-display text-[clamp(3.75rem,13vw,8rem)] font-bold leading-[0.85] tracking-tight text-white">
              StudySync
            </p>
            <motion.div
              className="signal-bar"
              aria-hidden
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.55, delay: 0.45, ease: EASE }}
              style={{ transformOrigin: "left" }}
            />
            <h1 className="max-w-lg text-xl font-medium leading-snug text-white/92 sm:text-2xl">
              Lectures become lasting memory.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-white/62 sm:text-lg">
              Upload once. Practice with notes, flashcards, quizzes, chat, and
              podcasts built for recall.
            </p>
            <motion.div
              className="flex flex-wrap gap-3 pt-2"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.5, ease: EASE }}
            >
              <Button
                asChild
                size="lg"
                className="h-12 bg-signal px-8 text-accent-foreground shadow-[4px_4px_0_hsl(162_55%_6%)] hover:bg-signal/90 hover:shadow-[2px_2px_0_hsl(162_55%_6%)]"
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
                className="h-12 border-white/30 bg-transparent px-8 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/login">I have an account</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <motion.div
          className="max-w-xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <p className="page-kicker">How it works</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Capture. Structure. Practice.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            One pass from lecture to active recall—without building decks by
            hand.
          </p>
        </motion.div>

        <ol className="mt-16 grid gap-0 sm:grid-cols-3">
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
              className="relative space-y-4 border-t border-border py-8 sm:border-l sm:border-t-0 sm:px-8 sm:py-2 sm:first:border-l-0 sm:first:pl-0"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: EASE }}
            >
              <span className="font-display text-5xl font-bold text-signal/40">
                {item.step}
              </span>
              <h3 className="font-display text-xl font-bold tracking-tight">
                {item.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="relative overflow-hidden bg-[hsl(162_55%_10%)] text-white">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 55% 70% at 88% 15%, hsl(40 96% 50% / 0.22), transparent 55%), radial-gradient(ellipse 40% 50% at 5% 90%, hsl(198 45% 35% / 0.18), transparent 50%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-28">
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: EASE }}
          >
            <div className="signal-bar" aria-hidden />
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Review. Ask. Listen.
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-white/65">
              One workspace for notes, spaced flashcards, quizzes, chat, and
              podcasts—so the next action is always obvious.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: 0.08, ease: EASE }}
          >
            <LandingProductMock />
          </motion.div>
        </div>
      </section>

      <footer className="ink-rule bg-background/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 sm:px-6">
          <div>
            <p className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
              <span className="brand-mark" aria-hidden />
              StudySync
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Built for lasting recall
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/pricing"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Pricing
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1 font-bold text-primary"
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
