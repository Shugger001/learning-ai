"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;
const RATINGS = ["Again", "Hard", "Good", "Easy"] as const;

const DEMO = {
  front: "What causes the American Revolution?",
  back: "Taxation without representation, Enlightenment ideas, and a growing colonial identity.",
};

export function LandingProductMock() {
  const [flipped, setFlipped] = useState(false);
  const [rating, setRating] = useState(2);
  const [tabIdx, setTabIdx] = useState(1);
  const tabs = ["Notes", "Flashcards", "Quiz", "Chat"];

  useEffect(() => {
    const id = setInterval(() => {
      setTabIdx((i) => (i + 1) % tabs.length);
    }, 3200);
    return () => clearInterval(id);
  }, [tabs.length]);

  useEffect(() => {
    let cancelled = false;
    let flipTimer: ReturnType<typeof setTimeout>;
    let rateTimer: ReturnType<typeof setTimeout>;
    let resetTimer: ReturnType<typeof setTimeout>;

    function loop() {
      setFlipped(false);
      setRating(2);
      flipTimer = setTimeout(() => {
        if (cancelled) return;
        setFlipped(true);
        rateTimer = setTimeout(() => {
          if (cancelled) return;
          setRating(3);
          resetTimer = setTimeout(() => {
            if (cancelled) return;
            setFlipped(false);
            setTimeout(loop, 900);
          }, 1100);
        }, 1400);
      }, 1600);
    }

    loop();
    return () => {
      cancelled = true;
      clearTimeout(flipTimer);
      clearTimeout(rateTimer);
      clearTimeout(resetTimer);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-5 shadow-premium backdrop-blur-sm sm:p-7">
      <div className="mb-5 flex gap-3 text-xs font-semibold tracking-wide text-white/45">
        {tabs.map((tab, i) => (
          <span
            key={tab}
            className={i === tabIdx ? "relative pb-1 text-white" : "relative pb-1"}
          >
            {tab}
            {i === tabIdx ? (
              <motion.span
                layoutId="landing-mock-tab"
                className="absolute inset-x-0 -bottom-px h-0.5 bg-signal"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            ) : null}
          </span>
        ))}
      </div>

      <button
        type="button"
        className="relative mx-auto block w-full max-w-sm [perspective:1200px]"
        onClick={() => setFlipped((f) => !f)}
        aria-label="Demo flashcard"
      >
        <motion.div
          className="relative flex min-h-[11rem] flex-col items-center justify-center border border-white/15 bg-[hsl(158_35%_9%)] px-6 py-10 text-center [transform-style:preserve-3d]"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <div
            className="absolute inset-0 flex flex-col items-center justify-center px-6 py-10"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
              Front
            </p>
            <p className="font-display mt-3 text-lg font-semibold leading-snug tracking-tight sm:text-xl">
              {DEMO.front}
            </p>
            <p className="mt-6 text-xs text-white/40">Tap to reveal</p>
          </div>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center px-6 py-10"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
              Back
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-white/85">
              {DEMO.back}
            </p>
          </div>
        </motion.div>
      </button>

      <div className="mt-5 flex justify-center gap-2">
        {RATINGS.map((label, i) => (
          <span
            key={label}
            className={
              i === rating
                ? "relative border border-signal/60 px-2.5 py-1 text-xs text-signal"
                : "border border-white/15 px-2.5 py-1 text-xs text-white/40"
            }
          >
            {label}
            <AnimatePresence>
              {i === rating ? (
                <motion.span
                  layoutId="landing-rating-underline"
                  className="absolute inset-x-1 -bottom-px h-px bg-signal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                />
              ) : null}
            </AnimatePresence>
          </span>
        ))}
      </div>
    </div>
  );
}
