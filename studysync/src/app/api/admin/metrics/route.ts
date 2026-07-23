import { requireAdmin, isAdminContext } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/response";

export async function GET() {
  const ctx = await requireAdmin();
  if (!isAdminContext(ctx)) return ctx;
  const { admin } = ctx;

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const weekAgoDate = weekAgo.slice(0, 10);

  const [
    profilesRes,
    proRes,
    studiesRes,
    completeRes,
    processingRes,
    errorRes,
    recentStudiesRes,
    activityRes,
    classesRes,
    roomsRes,
    attemptsRes,
    podcastsRes,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("plan", "pro"),
    admin.from("studies").select("id", { count: "exact", head: true }),
    admin
      .from("studies")
      .select("id", { count: "exact", head: true })
      .eq("status", "complete"),
    admin
      .from("studies")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing"),
    admin
      .from("studies")
      .select("id", { count: "exact", head: true })
      .eq("status", "error"),
    admin
      .from("studies")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo),
    admin
      .from("study_activity")
      .select("user_id, cards_reviewed, quizzes_taken, minutes_studied, activity_date")
      .gte("activity_date", weekAgoDate),
    admin.from("classes").select("id", { count: "exact", head: true }),
    admin
      .from("study_rooms")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    admin
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    admin
      .from("podcasts")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing"),
  ]);

  const activity = activityRes.error ? [] : activityRes.data ?? [];
  const dauSet = new Set(
    activity
      .filter((a) => a.activity_date === now.toISOString().slice(0, 10))
      .map((a) => a.user_id)
  );
  const wauSet = new Set(activity.map((a) => a.user_id));
  const cardsWeek = activity.reduce(
    (s, a) => s + Number(a.cards_reviewed ?? 0),
    0
  );
  const quizzesWeek = activity.reduce(
    (s, a) => s + Number(a.quizzes_taken ?? 0),
    0
  );
  const minutesWeek = activity.reduce(
    (s, a) => s + Number(a.minutes_studied ?? 0),
    0
  );

  // Content type mix
  const { data: typeRows } = await admin
    .from("studies")
    .select("content_type")
    .limit(5000);
  const byType: Record<string, number> = {};
  for (const row of typeRows ?? []) {
    const t = String(row.content_type ?? "unknown");
    byType[t] = (byType[t] ?? 0) + 1;
  }

  // Recent errors
  const { data: recentErrors } = await admin
    .from("studies")
    .select("id, title, error_message, updated_at, user_id, content_type")
    .eq("status", "error")
    .order("updated_at", { ascending: false })
    .limit(8);

  // Stuck processing (>30 min)
  const stuckCutoff = new Date(now.getTime() - 30 * 60_000).toISOString();
  const { data: stuck } = await admin
    .from("studies")
    .select("id, title, processing_progress, updated_at, user_id")
    .eq("status", "processing")
    .lt("updated_at", stuckCutoff)
    .order("updated_at", { ascending: true })
    .limit(8);

  const users = profilesRes.count ?? 0;
  const pro = proRes.count ?? 0;

  return apiSuccess({
    generatedAt: now.toISOString(),
    users: {
      total: users,
      pro,
      free: Math.max(0, users - pro),
      proRate: users ? Math.round((pro / users) * 1000) / 10 : 0,
    },
    studies: {
      total: studiesRes.count ?? 0,
      complete: completeRes.count ?? 0,
      processing: processingRes.count ?? 0,
      error: errorRes.count ?? 0,
      createdLast24h: recentStudiesRes.count ?? 0,
      byType,
    },
    engagement: {
      dau: dauSet.size,
      wau: wauSet.size,
      cardsWeek,
      quizzesWeek,
      minutesWeek,
      quizAttemptsWeek: attemptsRes.error ? 0 : attemptsRes.count ?? 0,
    },
    ops: {
      classes: classesRes.error ? 0 : classesRes.count ?? 0,
      activeRooms: roomsRes.error ? 0 : roomsRes.count ?? 0,
      podcastsProcessing: podcastsRes.error ? 0 : podcastsRes.count ?? 0,
    },
    recentErrors: recentErrors ?? [],
    stuckProcessing: stuck ?? [],
  });
}
