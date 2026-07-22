"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  completionPercent,
  gradeStatus,
  type GradeStatus,
} from "@/lib/classes/gradebook";
import { cn } from "@/lib/utils/cn";
import type { ApiResponse } from "@/types/api";
import type {
  AssignmentProgress,
  ClassAssignment,
  ClassMember,
  ClassRoom,
  Study,
} from "@/types/database";

type AssignmentRow = ClassAssignment & {
  studies?: {
    id: string;
    title: string;
    status: string;
    flashcard_count: number;
  } | null;
};

const STATUS_LABEL: Record<GradeStatus, string> = {
  done: "Done",
  stuck: "Stuck",
  overdue: "Overdue",
  in_progress: "In progress",
  not_started: "Not started",
  pending: "Pending",
};

function statusClass(status: GradeStatus) {
  switch (status) {
    case "done":
      return "text-emerald-700";
    case "stuck":
    case "overdue":
      return "text-destructive";
    case "in_progress":
      return "text-amber-700";
    default:
      return "text-muted-foreground";
  }
}

export function ClassDetailClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const classId = params.id;

  const [classroom, setClassroom] = useState<ClassRoom | null>(null);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [progress, setProgress] = useState<AssignmentProgress[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [studies, setStudies] = useState<Study[]>([]);
  const [email, setEmail] = useState("");
  const [studyId, setStudyId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/classes/${classId}`);
    const json = (await res.json()) as ApiResponse<{
      class: ClassRoom;
      members: ClassMember[];
      assignments: AssignmentRow[];
      progress: AssignmentProgress[];
      isOwner: boolean;
    }>;
    if (!json.success) {
      setError(json.error);
      return;
    }
    setClassroom(json.data.class);
    setMembers(json.data.members);
    setAssignments(json.data.assignments);
    setProgress(json.data.progress);
    setIsOwner(json.data.isOwner);
  }, [classId]);

  useEffect(() => {
    void load();
    void fetch("/api/studies")
      .then((r) => r.json())
      .then((json: ApiResponse<Study[]>) => {
        if (json.success) {
          setStudies(json.data.filter((s) => s.status === "complete"));
        }
      })
      .catch(() => undefined);
  }, [load]);

  const students = useMemo(
    () => members.filter((m) => m.role === "student"),
    [members]
  );

  function progressFor(assignmentId: string, userId: string | null) {
    if (!userId) return null;
    return progress.find(
      (p) => p.assignment_id === assignmentId && p.user_id === userId
    );
  }

  function cell(assignment: AssignmentRow, member: ClassMember) {
    const p = progressFor(assignment.id, member.user_id);
    const count = assignment.studies?.flashcard_count ?? 0;
    const reviewed = p?.cards_reviewed ?? 0;
    const pct = completionPercent(reviewed, count);
    const status = gradeStatus({
      acceptedAt: member.accepted_at,
      cardsReviewed: reviewed,
      flashcardCount: count,
      completedAt: p?.completed_at ?? null,
      lastReviewedAt: p?.last_reviewed_at ?? null,
      dueAt: assignment.due_at,
    });
    return { pct, status, reviewed };
  }

  const gradebookSummary = useMemo(() => {
    let done = 0;
    let stuck = 0;
    let overdue = 0;
    let total = 0;
    for (const a of assignments) {
      for (const m of students) {
        total += 1;
        const p = m.user_id
          ? progress.find(
              (row) =>
                row.assignment_id === a.id && row.user_id === m.user_id
            )
          : null;
        const status = gradeStatus({
          acceptedAt: m.accepted_at,
          cardsReviewed: p?.cards_reviewed ?? 0,
          flashcardCount: a.studies?.flashcard_count ?? 0,
          completedAt: p?.completed_at ?? null,
          lastReviewedAt: p?.last_reviewed_at ?? null,
          dueAt: a.due_at,
        });
        if (status === "done") done += 1;
        if (status === "stuck") stuck += 1;
        if (status === "overdue") overdue += 1;
      }
    }
    return { done, stuck, overdue, total };
  }, [assignments, students, progress]);

  async function invite() {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/classes/${classId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const json = (await res.json()) as ApiResponse<
      ClassMember & { invite_url?: string }
    >;
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setEmail("");
    if (json.data.invite_url) {
      await navigator.clipboard.writeText(json.data.invite_url);
      setMessage(`Invite link copied for ${json.data.email}`);
    }
    await load();
  }

  async function assign() {
    if (!studyId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/classes/${classId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        study_id: studyId,
        due_at: dueAt || null,
      }),
    });
    const json = (await res.json()) as ApiResponse<AssignmentRow>;
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setStudyId("");
    setDueAt("");
    await load();
  }

  async function updateDue(assignmentId: string, nextDue: string) {
    const res = await fetch(`/api/classes/${classId}/assignments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: assignmentId, due_at: nextDue || null }),
    });
    const json = (await res.json()) as ApiResponse<AssignmentRow>;
    if (!json.success) {
      setError(json.error);
      return;
    }
    await load();
  }

  async function removeMember(id: string) {
    await fetch(`/api/classes/${classId}/members?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function removeAssignment(id: string) {
    await fetch(`/api/classes/${classId}/assignments?id=${id}`, {
      method: "DELETE",
    });
    await load();
  }

  async function removeClass() {
    if (!classroom || !window.confirm(`Delete “${classroom.name}”?`)) return;
    await fetch(`/api/classes/${classId}`, { method: "DELETE" });
    router.push("/classes");
  }

  if (!classroom && !error) {
    return <p className="text-sm text-muted-foreground">Loading class…</p>;
  }

  if (!classroom) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error ?? "Class not found"}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Class
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {classroom.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Join code{" "}
              <span className="font-medium text-foreground">
                {classroom.join_code}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/classes">All classes</Link>
            </Button>
            {isOwner ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => void removeClass()}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}

      {isOwner ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 border border-border/70 bg-card/40 p-4">
            <h2 className="text-sm font-medium">Invite students</h2>
            <div className="flex flex-wrap gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@school.edu"
              />
              <Button
                type="button"
                disabled={busy || !email.trim()}
                onClick={() => void invite()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Invite
              </Button>
            </div>
          </div>
          <div className="space-y-3 border border-border/70 bg-card/40 p-4">
            <h2 className="text-sm font-medium">Assign a study pack</h2>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-10 min-w-[12rem] flex-1 border border-input bg-background px-2 text-sm"
                value={studyId}
                onChange={(e) => setStudyId(e.target.value)}
              >
                <option value="">Pick a complete study…</option>
                {studies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                className="w-[11rem]"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                aria-label="Due date"
              />
              <Button
                type="button"
                disabled={busy || !studyId}
                onClick={() => void assign()}
              >
                Assign
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isOwner && assignments.length > 0 && students.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Gradebook
              </h2>
              <p className="text-sm text-muted-foreground">
                {gradebookSummary.done} done · {gradebookSummary.stuck} stuck ·{" "}
                {gradebookSummary.overdue} overdue
                {gradebookSummary.total
                  ? ` · ${Math.round(
                      (gradebookSummary.done / gradebookSummary.total) * 100
                    )}% complete`
                  : ""}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto border border-border/70">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Student</th>
                  {assignments.map((a) => (
                    <th key={a.id} className="px-3 py-2 font-medium">
                      <div className="max-w-[9rem] truncate">
                        {a.title || a.studies?.title || "Pack"}
                      </div>
                      <div className="mt-1 normal-case tracking-normal">
                        <input
                          type="date"
                          className="h-7 w-[9rem] border border-input bg-background px-1 text-[11px]"
                          value={
                            a.due_at ? a.due_at.slice(0, 10) : ""
                          }
                          onChange={(e) =>
                            void updateDue(a.id, e.target.value)
                          }
                          aria-label={`Due date for ${a.title || "assignment"}`}
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {students.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{m.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.accepted_at ? "joined" : "pending"}
                      </div>
                    </td>
                    {assignments.map((a) => {
                      const { pct, status } = cell(a, m);
                      return (
                        <td key={a.id} className="px-3 py-2 align-top">
                          <div className="font-medium">{pct}%</div>
                          <div className={cn("text-xs", statusClass(status))}>
                            {STATUS_LABEL[status]}
                          </div>
                          <div className="mt-1 h-1.5 w-full max-w-[6rem] bg-muted">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Roster
        </h2>
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No students yet.</p>
        ) : (
          <ul className="divide-y divide-border/60 border border-border/70">
            {students.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span>
                  {m.email}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {m.accepted_at ? "joined" : "pending"}
                  </span>
                </span>
                {isOwner ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => void removeMember(m.id)}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Assignments
        </h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No packs assigned yet.</p>
        ) : (
          <ul className="space-y-4">
            {assignments.map((a) => {
              const title = a.title || a.studies?.title || "Study pack";
              const count = a.studies?.flashcard_count ?? 0;
              return (
                <li key={a.id} className="border border-border/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">
                        {count} cards
                        {a.due_at
                          ? ` · due ${new Date(a.due_at).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/study/${a.study_id}`}>Open</Link>
                      </Button>
                      {isOwner ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => void removeAssignment(a.id)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {isOwner ? (
                    <ul className="mt-3 space-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                      {students.map((m) => {
                        const { pct, status, reviewed } = cell(a, m);
                        return (
                          <li key={m.id} className="flex justify-between gap-2">
                            <span>{m.email}</span>
                            <span className={statusClass(status)}>
                              {STATUS_LABEL[status]} · {pct}% ({reviewed}/
                              {Math.max(1, count || 10)})
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
