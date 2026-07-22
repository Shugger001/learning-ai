"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils/cn";
import "katex/dist/katex.min.css";

export function MarkdownMath({
  children,
  className,
  inline = false,
}: {
  children: string;
  className?: string;
  /** Prefer inline-looking styles for quiz options / flashcard lines */
  inline?: boolean;
}) {
  return (
    <div
      className={cn(
        "[&_.katex]:text-[1.05em] [&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto",
        inline
          ? "[&_p]:m-0 [&_p]:inline"
          : "[&_p]:my-1.5 [&_p]:leading-relaxed",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children || ""}
      </ReactMarkdown>
    </div>
  );
}
