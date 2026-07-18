"use client";

import { useState } from "react";
import { FolderPlus, Folder as FolderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import type { ApiResponse } from "@/types/api";
import type { Folder, Study } from "@/types/database";

interface FolderBarProps {
  folders: Folder[];
  studies: Study[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onFoldersChange: (folders: Folder[]) => void;
  onStudyMoved: (study: Study) => void;
}

export function FolderBar({
  folders,
  studies,
  selectedFolderId,
  onSelectFolder,
  onFoldersChange,
  onStudyMoved,
}: FolderBarProps) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [assignStudyId, setAssignStudyId] = useState<string>("");

  async function createFolder() {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const json = (await res.json()) as ApiResponse<Folder>;
    setCreating(false);
    if (json.success) {
      onFoldersChange([...folders, json.data]);
      setName("");
    }
  }

  async function assignToFolder(folderId: string | null) {
    if (!assignStudyId) return;
    const res = await fetch("/api/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ study_id: assignStudyId, folder_id: folderId }),
    });
    const json = (await res.json()) as ApiResponse<Study>;
    if (json.success) {
      onStudyMoved(json.data);
      setAssignStudyId("");
    }
  }

  return (
    <section className="space-y-4 border border-border/70 bg-card/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Folders
          </h2>
          <p className="text-sm text-muted-foreground">
            Organize courses and filter your library.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New folder"
            className="w-40 sm:w-48"
            aria-label="New folder name"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={creating || !name.trim()}
            onClick={() => void createFolder()}
          >
            <FolderPlus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectFolder(null)}
          className={cn(
            "inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm transition-colors",
            selectedFolderId === null
              ? "border-foreground bg-accent"
              : "border-border/70 hover:bg-muted/40"
          )}
        >
          All
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => onSelectFolder(folder.id)}
            className={cn(
              "inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm transition-colors",
              selectedFolderId === folder.id
                ? "border-foreground bg-accent"
                : "border-border/70 hover:bg-muted/40"
            )}
          >
            <FolderIcon className="h-3.5 w-3.5" />
            {folder.name}
          </button>
        ))}
      </div>

      {studies.length > 0 && folders.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
          <select
            className="h-9 border border-input bg-background px-2 text-sm"
            value={assignStudyId}
            onChange={(e) => setAssignStudyId(e.target.value)}
            aria-label="Study to move"
          >
            <option value="">Move a study…</option>
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!assignStudyId}
            onClick={() => void assignToFolder(selectedFolderId)}
          >
            {selectedFolderId ? "Move here" : "Remove from folder"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
