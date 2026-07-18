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
    <div className="border border-white/15 bg-white/[0.04] p-5 backdrop-blur-sm sm:p-7">
      <div className="mb-5 flex gap-2 text-xs font-medium tracking-wide text-white/50">
        {["Notes", "Flashcards", "Quiz", "Chat"].map((tab, i) => (
          <span
            key={tab}
            className={
              i === 1
                ? "relative border-b border-[hsl(174_45%_55%)] pb-1 text-white"
                : "pb-1"
            }
          >
            {tab}
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
          className="relative flex min-h-[11rem] flex-col items-center justify-center border border-white/20 bg-[hsl(222_40%_10%)] px-6 py-10 text-center shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] [transform-style:preserve-3d]"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <div
            className="absolute inset-0 flex flex-col items-center justify-center px-6 py-10"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-xs uppercase tracking-wider text-white/40">Front</p>
            <p className="font-display mt-3 text-lg font-semibold leading-snug tracking-tight sm:text-xl">
              {DEMO.front}
            </p>
            <p className="mt-6 text-xs text-white/45">Tap to reveal</p>
          </div>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center px-6 py-10"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <p className="text-xs uppercase tracking-wider text-white/40">Back</p>
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
                ? "relative border border-[hsl(174_45%_45%)] px-2.5 py-1 text-xs text-[hsl(174_45%_72%)]"
                : "border border-white/15 px-2.5 py-1 text-xs text-white/45"
            }
          >
            {label}
            <AnimatePresence>
              {i === rating ? (
                <motion.span
                  layoutId="landing-rating-underline"
                  className="absolute inset-x-1 -bottom-px h-px bg-[hsl(174_45%_55%)]"
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
