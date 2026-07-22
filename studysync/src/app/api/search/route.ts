import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import type { SearchHit } from "@/types/search";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return apiSuccess([] as SearchHit[]);

  const lower = q.toLowerCase();
  const pattern = `%${q.replace(/[%_]/g, "")}%`;

  const { data: studies, error: studiesError } = await supabase
    .from("studies")
    .select("id, title, status")
    .eq("user_id", user.id)
    .ilike("title", pattern)
    .order("updated_at", { ascending: false })
    .limit(8);

  if (studiesError) return apiError(studiesError.message, 500);

  const hits: SearchHit[] = (studies ?? []).map((s) => ({
    kind: "study" as const,
    study_id: s.id,
    title: s.title,
    snippet: s.status,
    href: `/study/${s.id}`,
  }));

  const { data: owned } = await supabase
    .from("studies")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("status", "complete");

  const ownedList = owned ?? [];
  const ownedIds = ownedList.map((s) => s.id);
  const titleById = new Map(ownedList.map((s) => [s.id, s.title]));

  if (ownedIds.length > 0) {
    const [{ data: notes }, { data: cards }] = await Promise.all([
      supabase
        .from("notes")
        .select("study_id, summary, content")
        .in("study_id", ownedIds)
        .limit(100),
      supabase
        .from("flashcards")
        .select("id, study_id, question, answer")
        .in("study_id", ownedIds)
        .limit(200),
    ]);

    for (const n of notes ?? []) {
      const summary = n.summary ?? "";
      const content = n.content ?? "";
      if (
        !summary.toLowerCase().includes(lower) &&
        !content.toLowerCase().includes(lower)
      ) {
        continue;
      }
      const hay = summary || content;
      const idx = hay.toLowerCase().indexOf(lower);
      const snippet =
        idx >= 0
          ? hay.slice(Math.max(0, idx - 24), idx + q.length + 40).trim()
          : hay.slice(0, 80);
      hits.push({
        kind: "note",
        study_id: n.study_id,
        title: titleById.get(n.study_id) ?? "Notes",
        snippet,
        href: `/study/${n.study_id}?tab=notes`,
      });
      if (hits.filter((h) => h.kind === "note").length >= 6) break;
    }

    let cardCount = 0;
    for (const c of cards ?? []) {
      const question = c.question ?? "";
      const answer = c.answer ?? "";
      if (
        !question.toLowerCase().includes(lower) &&
        !answer.toLowerCase().includes(lower)
      ) {
        continue;
      }
      hits.push({
        kind: "flashcard",
        study_id: c.study_id,
        title: titleById.get(c.study_id) ?? "Flashcards",
        snippet: question.slice(0, 100),
        href: `/study/${c.study_id}?tab=flashcards`,
      });
      cardCount += 1;
      if (cardCount >= 6) break;
    }
  }

  return apiSuccess(hits.slice(0, 18));
}
