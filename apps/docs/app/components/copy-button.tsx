"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

interface CopyButtonProps {
  getValue: () => string;
  className?: string;
}

export function CopyButton({ getValue, className }: CopyButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const handleCopy = useCallback(async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPending(true);
    try {
      await navigator.clipboard.writeText(getValue());
      setStatus("copied");
    } catch {
      setStatus("failed");
    } finally {
      setPending(false);
    }
    timeoutRef.current = setTimeout(() => setStatus("idle"), 2000);
  }, [getValue]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={pending}
      className={cn(
        "absolute top-2 right-2 flex size-11 items-center justify-center text-code-block-foreground/70 hover:text-code-block-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-opacity duration-150 disabled:cursor-wait",
        className
      )}
      aria-label={
        status === "copied"
          ? "Copied"
          : status === "failed"
            ? "Copy failed. Try again"
            : "Copy code"
      }
    >
      <span className="sr-only" role="status">
        {status === "copied"
          ? "Code copied"
          : status === "failed"
            ? "Could not copy code. Select and copy the text manually."
            : ""}
      </span>
      {status === "copied" ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}
