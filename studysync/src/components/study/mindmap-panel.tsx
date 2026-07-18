"use client";

import dynamic from "next/dynamic";
import type { MindMapNode } from "@/types/database";

const Tree = dynamic(() => import("react-d3-tree"), { ssr: false });

interface MindMapPanelProps {
  mindMap: MindMapNode | null;
}

function toTreeData(node: MindMapNode): {
  name: string;
  children?: ReturnType<typeof toTreeData>[];
} {
  return {
    name: node.name,
    children: node.children?.map(toTreeData),
  };
}

export function MindMapPanel({ mindMap }: MindMapPanelProps) {
  if (!mindMap) {
    return (
      <p className="text-sm text-muted-foreground">No mind map generated yet.</p>
    );
  }

  const data = toTreeData(mindMap);

  return (
    <div
      className="h-[480px] w-full overflow-hidden rounded-lg border bg-muted/20"
      role="img"
      aria-label={`Mind map rooted at ${mindMap.name}`}
    >
      <Tree
        data={data}
        orientation="vertical"
        pathFunc="diagonal"
        translate={{ x: 280, y: 60 }}
        nodeSize={{ x: 160, y: 100 }}
        separation={{ siblings: 1.1, nonSiblings: 1.3 }}
        rootNodeClassName="mindmap-node"
        branchNodeClassName="mindmap-node"
        leafNodeClassName="mindmap-leaf"
      />
    </div>
  );
}
