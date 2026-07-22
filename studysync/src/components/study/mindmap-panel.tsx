"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Download, Plus, Save } from "lucide-react";
import { toPng } from "html-to-image";
import type { CustomNodeElementProps, RawNodeDatum } from "react-d3-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadBlob, slugifyFilename } from "@/lib/export/download";
import type { ApiResponse } from "@/types/api";
import type { Flashcard, MindMapNode, Note } from "@/types/database";

const Tree = dynamic(() => import("react-d3-tree"), { ssr: false });

interface MindMapPanelProps {
  mindMap: MindMapNode | null;
  noteId?: string | null;
  studyTitle?: string;
  flashcards?: Flashcard[];
  onJumpToCards?: (query: string) => void;
}

type TreeNode = RawNodeDatum & {
  __id?: string;
  __collapsed?: boolean;
};

function ensureIds(node: MindMapNode, prefix = "n"): MindMapNode {
  const id = node.id || `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    ...node,
    id,
    children: node.children?.map((c, i) => ensureIds(c, `${id}-${i}`)),
  };
}

function toTreeData(node: MindMapNode, focusPath: string[]): TreeNode {
  const focused = focusPath.includes(node.name);
  return {
    name: node.name,
    attributes: focused ? { focused: "1" } : undefined,
    __id: node.id,
    __collapsed: node.collapsed,
    children: node.collapsed
      ? undefined
      : node.children?.map((c) => toTreeData(c, focusPath)),
  };
}

function findPath(
  node: MindMapNode,
  target: string,
  trail: string[] = []
): string[] | null {
  const next = [...trail, node.name];
  if (node.name === target) return next;
  for (const child of node.children ?? []) {
    const found = findPath(child, target, next);
    if (found) return found;
  }
  return null;
}

function updateNode(
  node: MindMapNode,
  id: string,
  patch: Partial<MindMapNode>
): MindMapNode {
  if (node.id === id) return { ...node, ...patch };
  return {
    ...node,
    children: node.children?.map((c) => updateNode(c, id, patch)),
  };
}

function addChild(node: MindMapNode, parentId: string, name: string): MindMapNode {
  if (node.id === parentId) {
    const child = ensureIds({ name, children: [] });
    return {
      ...node,
      collapsed: false,
      children: [...(node.children ?? []), child],
    };
  }
  return {
    ...node,
    children: node.children?.map((c) => addChild(c, parentId, name)),
  };
}

function removeNode(node: MindMapNode, id: string): MindMapNode | null {
  if (node.id === id) return null;
  return {
    ...node,
    children: (node.children ?? [])
      .map((c) => removeNode(c, id))
      .filter(Boolean) as MindMapNode[],
  };
}

export function MindMapPanel({
  mindMap,
  noteId,
  studyTitle = "study",
  flashcards = [],
  onJumpToCards,
}: MindMapPanelProps) {
  const [tree, setTree] = useState<MindMapNode | null>(
    mindMap ? ensureIds(mindMap) : null
  );
  const [focusName, setFocusName] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const focusPath = useMemo(() => {
    if (!tree || !focusName) return [] as string[];
    return findPath(tree, focusName) ?? [focusName];
  }, [tree, focusName]);

  const relatedCards = useMemo(() => {
    if (!focusName) return [] as Flashcard[];
    const q = focusName.toLowerCase();
    return flashcards
      .filter(
        (c) =>
          c.question.toLowerCase().includes(q) ||
          c.answer.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [flashcards, focusName]);

  if (!tree) {
    return (
      <p className="text-sm text-muted-foreground">No mind map generated yet.</p>
    );
  }

  const data = toTreeData(tree, focusPath);
  const translate = focusName ? { x: 300, y: 120 } : { x: 280, y: 60 };

  async function save() {
    if (!noteId) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mind_map: tree }),
    });
    const json = (await res.json()) as ApiResponse<Note>;
    setSaving(false);
    setMessage(json.success ? "Mind map saved" : json.error);
  }

  async function exportPng() {
    if (!exportRef.current) return;
    const dataUrl = await toPng(exportRef.current, {
      cacheBust: true,
      backgroundColor: "#f7faf8",
      pixelRatio: 2,
    });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    downloadBlob(`${slugifyFilename(studyTitle)}-mindmap.png`, blob);
  }

  function renderNode({ nodeDatum, toggleNode }: CustomNodeElementProps) {
    const focused = String(nodeDatum.attributes?.focused ?? "") === "1";
    const id = (nodeDatum as TreeNode).__id;
    return (
      <g>
        <circle
          r={focused ? 14 : 10}
          fill={focused ? "hsl(var(--primary))" : "hsl(var(--muted))"}
          stroke="hsl(var(--border))"
          strokeWidth={1.5}
          style={{ cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            const name = nodeDatum.name;
            setFocusName((prev) => (prev === name ? null : name));
            if (id) {
              setSelectedId(id);
              setEditLabel(name);
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            toggleNode?.();
            if (id) {
              setTree((prev) =>
                prev
                  ? updateNode(prev, id, {
                      collapsed: !(nodeDatum as TreeNode).__collapsed,
                    })
                  : prev
              );
            }
          }}
        />
        <text
          fill="hsl(var(--foreground))"
          strokeWidth={0}
          x={18}
          y={4}
          style={{
            fontSize: focused ? 13 : 12,
            fontWeight: focused ? 600 : 400,
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setFocusName(nodeDatum.name);
            if (id) {
              setSelectedId(id);
              setEditLabel(nodeDatum.name);
            }
          }}
        >
          {nodeDatum.name}
        </text>
      </g>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Click to focus · double-click to collapse · edit selected node below
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void exportPng()}>
            <Download className="h-4 w-4" />
            PNG
          </Button>
          {noteId ? (
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </div>
      </div>

      {selectedId ? (
        <div className="flex flex-wrap items-end gap-2 border border-border/70 bg-card/40 p-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Node label</label>
            <Input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (!editLabel.trim()) return;
              setTree((prev) =>
                prev
                  ? updateNode(prev, selectedId, { name: editLabel.trim() })
                  : prev
              );
              setFocusName(editLabel.trim());
            }}
          >
            Rename
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setTree((prev) =>
                prev ? addChild(prev, selectedId, "New idea") : prev
              );
            }}
          >
            <Plus className="h-4 w-4" />
            Child
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              setTree((prev) => {
                if (!prev || prev.id === selectedId) return prev;
                return removeNode(prev, selectedId) ?? prev;
              });
              setSelectedId(null);
            }}
          >
            Delete
          </Button>
          {onJumpToCards && focusName ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onJumpToCards(focusName)}
            >
              Jump to cards
            </Button>
          ) : null}
        </div>
      ) : null}

      {relatedCards.length > 0 ? (
        <ul className="space-y-1 text-sm">
          <li className="text-xs uppercase tracking-wide text-muted-foreground">
            Related cards
          </li>
          {relatedCards.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="text-left hover:underline"
                onClick={() => onJumpToCards?.(c.question.slice(0, 40))}
              >
                {c.question}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}

      <motion.div
        ref={exportRef}
        className="h-[480px] w-full overflow-hidden rounded-lg border bg-muted/20"
        role="img"
        aria-label={`Mind map rooted at ${tree.name}`}
        animate={{ scale: focusName ? 1.04 : 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <Tree
          data={data}
          orientation="vertical"
          pathFunc="diagonal"
          translate={translate}
          nodeSize={{ x: 160, y: 100 }}
          separation={{ siblings: 1.1, nonSiblings: 1.3 }}
          renderCustomNodeElement={renderNode}
          collapsible
        />
      </motion.div>
    </div>
  );
}
