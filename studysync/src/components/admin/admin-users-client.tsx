"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@/types/api";

type UserRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  plan: string;
  credits: number;
  uploads_used: number;
  chat_used: number;
  podcasts_used: number;
  current_streak: number;
  xp: number;
  level: number;
  is_admin?: boolean;
  created_at: string;
  last_study_date: string | null;
};

export function AdminUsersClient() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("all");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: "25",
      plan,
    });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/users?${params}`);
    const json = (await res.json()) as ApiResponse<{
      users: UserRow[];
      total: number;
    }>;
    setLoading(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setUsers(json.data.users);
    setTotal(json.data.total);
  }, [page, plan, q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-accent">Users</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Directory
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} profiles · search, filter, and open a dossier
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Search name / email…"
          className="max-w-xs"
        />
        <select
          className="h-10 border border-input bg-background px-2 text-sm"
          value={plan}
          onChange={(e) => {
            setPage(1);
            setPlan(e.target.value);
          }}
        >
          <option value="all">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Search
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto border border-border/70">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border/60 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Usage</th>
              <th className="px-3 py-2 font-medium">XP</th>
              <th className="px-3 py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                  No users match
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.user_id}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => router.push(`/admin/users/${u.user_id}`)}
                >
                  <td className="px-3 py-2.5">
                    <div className="font-medium">
                      {u.full_name || "Unnamed"}
                      {u.is_admin ? (
                        <span className="ml-2 text-[10px] uppercase text-accent">
                          admin
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.email || u.user_id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 capitalize">{u.plan}</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs text-muted-foreground">
                    {u.uploads_used}u · {u.chat_used}c · {u.podcasts_used}p
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    L{u.level} · {u.xp}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Prev
        </Button>
        <span className="text-xs text-muted-foreground">Page {page}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={users.length < 25}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
        <Link href="/admin" className="ml-auto text-xs text-primary hover:underline">
          Overview
        </Link>
      </div>
    </div>
  );
}
