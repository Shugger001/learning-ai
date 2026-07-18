"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { CustomNodeElementProps } from "react-d3-tree";
import { Button } from "@/components/ui/button";
import type { MindMapNode } from "@/types/database";

const Tree = dynamic(() => import("react-d3-tree"), { ssr: false });

interface MindMapPanelProps {
  mindMap: MindMapNode | null;
}

type TreeNode = {
  name: string;
  attributes?: { focused?: string };
  children?: TreeNode[];
};

function toTreeData(node: MindMapNode, focusPath: string[]): TreeNode {
  const focused = focusPath.includes(node.name);
  return {
    name: node.name,
    attributes: focused ? { focused: "1" } : undefined,
    children: node.children?.map((c) => toTreeData(c, focusPath)),
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

function renderNode({ nodeDatum }: CustomNodeElementProps) {
  const focused = String(nodeDatum.attributes?.focused ?? "") === "1";
  return (
    <g>
      <circle
        r={focused ? 14 : 10}
        fill={focused ? "hsl(var(--primary))" : "hsl(var(--muted))"}
        stroke="hsl(var(--border))"
        strokeWidth={1.5}
        style={{ cursor: "pointer" }}
      />
      <text
        fill="hsl(var(--foreground))"
        strokeWidth={0}
        x={18}
        y={4}
        style={{ fontSize: focused ? 13 : 12, fontWeight: focused ? 600 : 400 }}
      >
        {nodeDatum.name}
      </text>
    </g>
  );
}

export function MindMapPanel({ mindMap }: MindMapPanelProps) {
  const [focusName, setFocusName] = useState<string | null>(null);

  const focusPath = useMemo(() => {
    if (!mindMap || !focusName) return [] as string[];
    return findPath(mindMap, focusName) ?? [focusName];
  }, [mindMap, focusName]);

  if (!mindMap) {
    return (
      <p className="text-sm text-muted-foreground">No mind map generated yet.</p>
    );
  }

  const data = toTreeData(mindMap, focusPath);
  const translate = focusName ? { x: 300, y: 120 } : { x: 280, y: 60 };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {focusName
            ? `Focused on “${focusName}” - click again or reset to zoom out.`
            : "Click a node to focus its path."}
        </p>
        {focusName ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFocusName(null)}
          >
            Reset view
          </Button>
        ) : null}
      </div>
      <motion.div
        className="h-[480px] w-full overflow-hidden rounded-lg border bg-muted/20"
        role="img"
        aria-label={`Mind map rooted at ${mindMap.name}`}
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
          onNodeClick={(node) => {
            const name = String(node.data.name);
            setFocusName((prev) => (prev === name ? null : name));
          }}
          pathClassFunc={(linkData) => {
            const targetName = String(linkData.target.data.name ?? "");
            return focusPath.includes(targetName)
              ? "mindmap-path-focus"
              : "mindmap-path";
          }}
        />
      </motion.div>
    </div>
  );
}
