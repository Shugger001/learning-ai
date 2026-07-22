"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@/types/api";

interface InviteRow {
  id: string;
  email: string;
  role: "viewer" | "commenter";
  token: string;
  accepted_at: string | null;
  created_at: string;
  invite_url?: string;
  share_token?: string;
}

export function ShareInvitePanel({
  studyId,
  onShareEnabled,
}: {
  studyId: string;
  onShareEnabled?: (shareUrl: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "commenter">("commenter");
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/studies/${studyId}/invites`);
    const json = (await res.json()) as ApiResponse<InviteRow[]>;
    if (json.success) setInvites(json.data);
  }

  useEffect(() => {
    void load();
  }, [studyId]);

  async function sendInvite() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/studies/${studyId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    const json = (await res.json()) as ApiResponse<InviteRow>;
    setLoading(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setEmail("");
    setMessage(`Invite ready for ${json.data.email}`);
    if (json.data.invite_url) {
      await navigator.clipboard.writeText(json.data.invite_url);
      setMessage(`Invite link copied for ${json.data.email}`);
    }
    if (json.data.share_token && onShareEnabled) {
      onShareEnabled(
        `${window.location.origin}/share/${json.data.share_token}`
      );
    }
    await load();
  }

  async function removeInvite(id: string) {
    await fetch(`/api/studies/${studyId}/invites?id=${id}`, {
      method: "DELETE",
    });
    await load();
  }

  return (
    <div className="space-y-3 border border-border/70 bg-card/40 p-4">
      <div>
        <p className="text-sm font-medium">Invite by email</p>
        <p className="text-xs text-muted-foreground">
          Creates a share link and copies an invite URL you can send.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="classmate@school.edu"
          className="min-w-[12rem] flex-1"
          aria-label="Invite email"
        />
        <select
          className="h-10 border border-input bg-background px-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as "viewer" | "commenter")}
          aria-label="Invite role"
        >
          <option value="commenter">Can comment</option>
          <option value="viewer">View only</option>
        </select>
        <Button
          type="button"
          size="sm"
          disabled={loading || !email.trim()}
          onClick={() => void sendInvite()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          Invite
        </Button>
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
      {invites.length > 0 ? (
        <ul className="space-y-2 border-t border-border/60 pt-3">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>
                {invite.email}
                <span className="ml-2 text-xs text-muted-foreground">
                  {invite.role}
                  {invite.accepted_at ? " · joined" : " · pending"}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => void removeInvite(invite.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
