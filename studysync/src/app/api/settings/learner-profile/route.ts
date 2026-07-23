import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  isLearnerBand,
  normalizeLearningNeeds,
  DEFAULT_LEARNING_NEEDS,
} from "@/lib/learner/bands";
import { z } from "zod";

const needsSchema = z.object({
  simplified_language: z.boolean().optional(),
  dyslexia_friendly: z.boolean().optional(),
  focus_assist: z.boolean().optional(),
  reduced_motion: z.boolean().optional(),
});

const patchSchema = z.object({
  learner_band: z
    .enum(["elementary", "middle", "high_school", "college", "adult"])
    .nullable()
    .optional(),
  learning_needs: needsSchema.optional(),
});

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data, error } = await supabase
    .from("profiles")
    .select("learner_band, learning_needs")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes("learner_band") ||
      error.message.includes("learning_needs") ||
      error.code === "PGRST204"
    ) {
      return apiSuccess({
        learner_band: null,
        learning_needs: DEFAULT_LEARNING_NEEDS,
        migration_required: true,
      });
    }
    return apiError(error.message, 500);
  }

  const band = isLearnerBand(data?.learner_band) ? data.learner_band : null;

  return apiSuccess({
    learner_band: band,
    learning_needs: normalizeLearningNeeds(data?.learning_needs),
  });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("learning_needs")
    .eq("user_id", user.id)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.learner_band !== undefined) {
    patch.learner_band = parsed.data.learner_band;
  }

  if (parsed.data.learning_needs) {
    const merged = {
      ...normalizeLearningNeeds(existing?.learning_needs),
      ...parsed.data.learning_needs,
    };
    patch.learning_needs = merged;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("user_id", user.id)
    .select("learner_band, learning_needs")
    .single();

  if (error) {
    if (
      error.message.includes("learner_band") ||
      error.message.includes("learning_needs") ||
      error.code === "PGRST204"
    ) {
      return apiError(
        "Learner profile needs APPLY_LEARNER_PROFILE.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(error.message, 500);
  }

  return apiSuccess({
    learner_band: isLearnerBand(data.learner_band) ? data.learner_band : null,
    learning_needs: normalizeLearningNeeds(data.learning_needs),
  });
}
