"use client";

import { AnsiHtml } from "fancy-ansi/react";
import { prepareTerminalPreview } from "~/lib/terminal-preview";
import { cn } from "~/lib/utils";

const vscodePalette = {
  "--ansi-black": "#1a1a2e",
  "--ansi-red": "#cd3131",
  "--ansi-green": "#0dbc79",
  "--ansi-yellow": "#e5e510",
  "--ansi-blue": "#2473c8",
  "--ansi-magenta": "#bc3fbc",
  "--ansi-cyan": "#11a7cd",
  "--ansi-white": "#e5e5e5",
  "--ansi-bright-black": "#666666",
  "--ansi-bright-red": "#f14c4c",
  "--ansi-bright-green": "#23d18b",
  "--ansi-bright-yellow": "#f5f543",
  "--ansi-bright-blue": "#3b8dea",
  "--ansi-bright-magenta": "#d670d6",
  "--ansi-bright-cyan": "#29b7db",
  "--ansi-bright-white": "#e5e5e5",
} as React.CSSProperties;

interface AnsiTerminalProps {
  input: string;
  title?: string;
  className?: string;
}

export const AnsiTerminal = ({
  input,
  title,
  className,
}: AnsiTerminalProps) => (
  <div
    className={cn(
      "my-6 overflow-hidden border border-code-block-border bg-code-block",
      className
    )}
  >
    {/* Title bar */}
    <div className="flex items-center gap-2 bg-code-block px-3 py-2 border-b border-code-block-border">
      <div className="flex gap-1.5">
        <span className="size-2.5 rounded-full bg-destructive/70" />
        <span className="size-2.5 rounded-full bg-warning/70" />
        <span className="size-2.5 rounded-full bg-success/70" />
      </div>
      {title && (
        <span className="ml-2 font-heading text-xs text-muted-foreground">
          {title}
        </span>
      )}
    </div>
    {/* Terminal body */}
    <pre className="font-terminal overflow-x-auto bg-code-block p-4 text-sm leading-[1.2] text-code-block-foreground">
      <AnsiHtml text={prepareTerminalPreview(input)} style={vscodePalette} />
    </pre>
  </div>
);
