import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess } from "@/lib/api/response";
import {
  cloneTeacherPack,
  syncStudentPack,
} from "@/lib/classes/deck-sync";

interface RouteParams {
  params: { id: string; assignmentId: string };
}

/** Open (or create) a student-owned pack copy, sync teacher updates, return study id. */
export async function POST(_request: Request, { params }: RouteParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized", 401);

  const { data: membership } = await supabase
    .from("class_members")
    .select("id, role")
    .eq("class_id", params.id)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .maybeSingle();

  const { data: ownedClass } = await supabase
    .from("classes")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!membership && !ownedClass) {
    return apiError("Not a member of this class", 403);
  }

  const { data: assignment } = await supabase
    .from("class_assignments")
    .select("id, study_id, title, class_id")
    .eq("id", params.assignmentId)
    .eq("class_id", params.id)
    .maybeSingle();
  if (!assignment) return apiError("Assignment not found", 404);

  // Teachers open the source pack directly
  if (ownedClass) {
    return apiSuccess({
      studyId: assignment.study_id,
      synced: false,
      isCopy: false,
    });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return apiError("Server misconfigured", 500);
  }

  const { data: existing, error: copyErr } = await admin
    .from("assignment_copies")
    .select("*")
    .eq("assignment_id", assignment.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (copyErr) {
    if (
      copyErr.message.includes("assignment_copies") ||
      copyErr.code === "PGRST205" ||
      copyErr.code === "42P01"
    ) {
      return apiError(
        "Deck sync needs APPLY_XP_EXAM_SYNC.sql — run it in Supabase SQL Editor.",
        503
      );
    }
    return apiError(copyErr.message, 500);
  }

  let studentStudyId = existing?.study_id as string | undefined;
  let created = false;

  if (!studentStudyId) {
    try {
      const copy = await cloneTeacherPack({
        admin,
        teacherStudyId: assignment.study_id,
        studentUserId: user.id,
        title: assignment.title,
      });
      studentStudyId = copy.id;
      created = true;
      const { data: teacher } = await admin
        .from("studies")
        .select("pack_version")
        .eq("id", assignment.study_id)
        .maybeSingle();
      await admin.from("assignment_copies").insert({
        assignment_id: assignment.id,
        user_id: user.id,
        study_id: copy.id,
        synced_at: new Date().toISOString(),
        teacher_pack_version: Number(teacher?.pack_version ?? 1),
      });
    } catch (e) {
      return apiError(
        e instanceof Error ? e.message : "Failed to create pack copy",
        500
      );
    }
  } else {
    try {
      const result = await syncStudentPack({
        admin,
        teacherStudyId: assignment.study_id,
        studentStudyId,
      });
      await admin
        .from("assignment_copies")
        .update({
          synced_at: new Date().toISOString(),
          teacher_pack_version: result.packVersion,
        })
        .eq("assignment_id", assignment.id)
        .eq("user_id", user.id);
    } catch (e) {
      return apiError(
        e instanceof Error ? e.message : "Failed to sync pack",
        500
      );
    }
  }

  return apiSuccess({
    studyId: studentStudyId,
    synced: true,
    created,
    isCopy: true,
  });
}
