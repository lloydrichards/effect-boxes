"use client";

import { useCallback, useRef } from "react";
import { CopyButton } from "~/components/copy-button";
import { cn } from "~/lib/utils";

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  children: React.ReactNode;
}

export function CodeBlock({ className, children, ...props }: CodeBlockProps) {
  const preRef = useRef<HTMLPreElement>(null);

  const getValue = useCallback(() => {
    if (!preRef.current) return "";
    return preRef.current.textContent ?? "";
  }, []);

  return (
    <div className="group relative mb-4">
      <pre
        ref={preRef}
        className={cn(
          "syntax-code-block bg-code-block text-code-block-foreground border border-code-block-border overflow-x-auto py-4 font-mono text-[13px] sm:text-sm leading-[1.5] tabular-nums",
          className
        )}
        {...props}
      >
        {children}
      </pre>
      <CopyButton getValue={getValue} className="code-copy bg-code-block/95" />
    </div>
  );
}
