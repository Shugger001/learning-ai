"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_LEARNING_NEEDS,
  LEARNER_BANDS,
  type LearningNeeds,
} from "@/lib/learner/bands";
import { cn } from "@/lib/utils/cn";
import type { ApiResponse } from "@/types/api";
import type { LearnerBand } from "@/types/database";

const NEED_ROWS: { key: keyof LearningNeeds; label: string }[] = [
  { key: "simplified_language", label: "Simpler language" },
  { key: "dyslexia_friendly", label: "Dyslexia-friendly reading" },
  { key: "focus_assist", label: "Focus assist" },
  { key: "reduced_motion", label: "Reduce motion" },
];

export function LearningProfileCard() {
  const [band, setBand] = useState<LearnerBand | null>(null);
  const [needs, setNeeds] = useState<LearningNeeds>({
    ...DEFAULT_LEARNING_NEEDS,
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    void fetch("/api/settings/learner-profile")
      .then((r) => r.json())
      .then(
        (
          json: ApiResponse<{
            learner_band: LearnerBand | null;
            learning_needs: LearningNeeds;
            migration_required?: boolean;
          }>
        ) => {
          if (!json.success) {
            setUnavailable(true);
            setLoaded(true);
            return;
          }
          if (json.data.migration_required) {
            setUnavailable(true);
            setLoaded(true);
            return;
          }
          setBand(json.data.learner_band);
          setNeeds(json.data.learning_needs);
          setLoaded(true);
        }
      )
      .catch(() => {
        setUnavailable(true);
        setLoaded(true);
      });
  }, []);

  async function save(nextBand: LearnerBand | null, nextNeeds: LearningNeeds) {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/settings/learner-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        learner_band: nextBand,
        learning_needs: nextNeeds,
      }),
    });
    const json = (await res.json()) as ApiResponse<{
      learner_band: LearnerBand | null;
      learning_needs: LearningNeeds;
    }>;
    setSaving(false);
    if (!json.success) {
      setMessage(json.error);
      return;
    }
    setBand(json.data.learner_band);
    setNeeds(json.data.learning_needs);
    setMessage("Learning profile saved");
    window.dispatchEvent(
      new CustomEvent("studysync:learner-profile", {
        detail: json.data,
      })
    );
  }

  if (!loaded) {
    return (
      <div className="border border-border/70 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        Loading learning profile…
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="border border-border/70 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        Learning profile needs{" "}
        <code className="text-xs">APPLY_LEARNER_PROFILE.sql</code> in Supabase.
      </div>
    );
  }

  return (
    <div className="space-y-4 border border-border/70 bg-card/40 p-4">
      <div>
        <p className="text-sm font-medium">Learning profile</p>
        <p className="text-xs text-muted-foreground">
          Age and level shape AI notes, quizzes, and the tutor. Accessibility
          toggles change how StudySync looks and moves.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {LEARNER_BANDS.map((b) => (
          <Button
            key={b.id}
            type="button"
            size="sm"
            variant={band === b.id ? "default" : "outline"}
            disabled={saving}
            onClick={() => void save(b.id, needs)}
          >
            {b.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {NEED_ROWS.map((row) => (
          <label
            key={row.key}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm",
              needs[row.key] && "border-primary/40 bg-primary/5"
            )}
          >
            <input
              type="checkbox"
              checked={needs[row.key]}
              disabled={saving || !band}
              onChange={(e) => {
                const next = { ...needs, [row.key]: e.target.checked };
                setNeeds(next);
                if (band) void save(band, next);
              }}
            />
            {row.label}
          </label>
        ))}
      </div>

      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
