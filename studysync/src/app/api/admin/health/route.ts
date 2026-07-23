import { requireAdmin, isAdminContext } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/response";

export async function GET() {
  const ctx = await requireAdmin();
  if (!isAdminContext(ctx)) return ctx;
  const { admin } = ctx;

  const stuckCutoff = new Date(Date.now() - 30 * 60_000).toISOString();

  const [
    processingRes,
    stuckRes,
    errorsRes,
    podcastsRes,
    roomsRes,
    { data: latestErrors },
  ] = await Promise.all([
    admin
      .from("studies")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing"),
    admin
      .from("studies")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing")
      .lt("updated_at", stuckCutoff),
    admin
      .from("studies")
      .select("id", { count: "exact", head: true })
      .eq("status", "error"),
    admin
      .from("podcasts")
      .select("id", { count: "exact", head: true })
      .eq("status", "processing"),
    admin
      .from("study_rooms")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    admin
      .from("studies")
      .select("id, title, error_message, updated_at")
      .eq("status", "error")
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  return apiSuccess({
    generatedAt: new Date().toISOString(),
    queue: {
      processing: processingRes.count ?? 0,
      stuck: stuckRes.count ?? 0,
      errors: errorsRes.count ?? 0,
      podcastsBusy: podcastsRes.error ? 0 : podcastsRes.count ?? 0,
      activeRooms: roomsRes.error ? 0 : roomsRes.count ?? 0,
    },
    env: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      resend: Boolean(process.env.RESEND_API_KEY),
      cronSecret: Boolean(process.env.CRON_SECRET),
      adminEmails: Boolean(process.env.ADMIN_EMAILS),
    },
    latestErrors: latestErrors ?? [],
  });
}
