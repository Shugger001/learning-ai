import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data: study } = await supabase
    .from("studies")
    .select("id, title, status")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!study) return apiError("Study not found", 404);

  const nowIso = new Date().toISOString();
  const [{ data: cards }, { data: attempt }, { data: campaigns }] =
    await Promise.all([
      supabase
        .from("flashcards")
        .select("id, ease, due_at, reps")
        .eq("study_id", params.id),
      supabase
        .from("quiz_attempts")
        .select("wrong_quiz_ids, score, total, created_at")
        .eq("study_id", params.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("exam_campaigns")
        .select("id, title, exam_at, study_ids")
        .eq("user_id", user.id),
    ]);

  const due = (cards ?? []).filter(
    (c) => new Date(c.due_at || 0).getTime() <= Date.now()
  ).length;
  const weak = (cards ?? []).filter((c) => Number(c.ease ?? 2.5) < 2.2).length;
  const wrong = Array.isArray(attempt?.wrong_quiz_ids)
    ? attempt!.wrong_quiz_ids.length
    : 0;

  const inCampaign = (campaigns ?? []).some((c) => {
    const ids = Array.isArray(c.study_ids) ? c.study_ids : [];
    return ids.includes(params.id);
  });

  type Action = {
    kind: string;
    label: string;
    href: string;
    reason: string;
  };

  const actions: Action[] = [];
  if (due > 0) {
    actions.push({
      kind: "review_due",
      label: `Review ${due} due card${due === 1 ? "" : "s"}`,
      href: `/study/${params.id}?tab=flashcards`,
      reason: "Spaced recall is waiting",
    });
  }
  if (weak > 0) {
    actions.push({
      kind: "weak_cards",
      label: `Strengthen ${weak} weak card${weak === 1 ? "" : "s"}`,
      href: `/study/${params.id}?tab=flashcards`,
      reason: "Low ease cards need another pass",
    });
  }
  if (wrong > 0) {
    actions.push({
      kind: "wrong_quiz",
      label: `Retry ${wrong} missed question${wrong === 1 ? "" : "s"}`,
      href: `/study/${params.id}?tab=quiz&wrong=1`,
      reason: "Last quiz left gaps",
    });
  }
  if (inCampaign) {
    actions.push({
      kind: "boss",
      label: "Boss quiz (exam mode)",
      href: `/study/${params.id}?tab=quiz&exam=1&boss=1`,
      reason: "This deck is in an exam campaign",
    });
  }
  actions.push({
    kind: "chat",
    label: "Ask the tutor",
    href: `/study/${params.id}?tab=chat`,
    reason: "Socratic help on sticky concepts",
  });
  actions.push({
    kind: "podcast",
    label: "Listen to a review podcast",
    href: `/study/${params.id}?tab=podcast`,
    reason: "Passive review while you move",
  });

  return apiSuccess({
    studyId: params.id,
    title: study.title,
    signals: { due, weak, wrong, inCampaign, asOf: nowIso },
    actions: actions.slice(0, 4),
  });
}
