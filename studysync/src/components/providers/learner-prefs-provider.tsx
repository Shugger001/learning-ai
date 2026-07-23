"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LEARNING_NEEDS,
  isLearnerBand,
  normalizeLearningNeeds,
  type LearningNeeds,
} from "@/lib/learner/bands";
import type { ApiResponse } from "@/types/api";
import type { LearnerBand } from "@/types/database";

type LearnerPrefs = {
  learnerBand: LearnerBand | null;
  learningNeeds: LearningNeeds;
  ready: boolean;
  refresh: () => Promise<void>;
};

const LearnerPrefsContext = createContext<LearnerPrefs>({
  learnerBand: null,
  learningNeeds: DEFAULT_LEARNING_NEEDS,
  ready: false,
  refresh: async () => undefined,
});

function applyDomAttrs(
  band: LearnerBand | null,
  needs: LearningNeeds
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (band) root.setAttribute("data-learner", band);
  else root.removeAttribute("data-learner");

  root.setAttribute(
    "data-needs",
    [
      needs.dyslexia_friendly ? "dyslexia" : "",
      needs.focus_assist ? "focus" : "",
      needs.reduced_motion ? "reduced-motion" : "",
      needs.simplified_language ? "simple" : "",
    ]
      .filter(Boolean)
      .join(" ") || "none"
  );

  root.classList.toggle("learner-dyslexia", needs.dyslexia_friendly);
  root.classList.toggle("learner-focus", needs.focus_assist);
  root.classList.toggle("learner-reduced-motion", needs.reduced_motion);
}

export function LearnerPrefsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [learnerBand, setLearnerBand] = useState<LearnerBand | null>(null);
  const [learningNeeds, setLearningNeeds] = useState<LearningNeeds>({
    ...DEFAULT_LEARNING_NEEDS,
  });
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/learner-profile");
      const json = (await res.json()) as ApiResponse<{
        learner_band: LearnerBand | null;
        learning_needs: LearningNeeds;
        migration_required?: boolean;
      }>;
      if (!json.success || json.data.migration_required) {
        setLearnerBand(null);
        setLearningNeeds({ ...DEFAULT_LEARNING_NEEDS });
        applyDomAttrs(null, DEFAULT_LEARNING_NEEDS);
        setReady(true);
        return;
      }
      const band = isLearnerBand(json.data.learner_band)
        ? json.data.learner_band
        : null;
      const needs = normalizeLearningNeeds(json.data.learning_needs);
      setLearnerBand(band);
      setLearningNeeds(needs);
      applyDomAttrs(band, needs);
    } catch {
      applyDomAttrs(null, DEFAULT_LEARNING_NEEDS);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onSaved(e: Event) {
      const detail = (e as CustomEvent).detail as
        | {
            learner_band: LearnerBand | null;
            learning_needs: LearningNeeds;
          }
        | undefined;
      if (!detail) {
        void refresh();
        return;
      }
      const band = isLearnerBand(detail.learner_band)
        ? detail.learner_band
        : null;
      const needs = normalizeLearningNeeds(detail.learning_needs);
      setLearnerBand(band);
      setLearningNeeds(needs);
      applyDomAttrs(band, needs);
    }
    window.addEventListener("studysync:learner-profile", onSaved);
    return () =>
      window.removeEventListener("studysync:learner-profile", onSaved);
  }, [refresh]);

  const value = useMemo(
    () => ({ learnerBand, learningNeeds, ready, refresh }),
    [learnerBand, learningNeeds, ready, refresh]
  );

  return (
    <LearnerPrefsContext.Provider value={value}>
      {children}
    </LearnerPrefsContext.Provider>
  );
}

export function useLearnerPrefs() {
  return useContext(LearnerPrefsContext);
}

/** True when user or OS prefers reduced motion. */
export function usePreferReducedMotion() {
  const { learningNeeds } = useLearnerPrefs();
  const [system, setSystem] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystem(mq.matches);
    const onChange = () => setSystem(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return learningNeeds.reduced_motion || system;
}
