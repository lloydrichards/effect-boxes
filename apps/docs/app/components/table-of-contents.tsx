import { ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Input } from "~/components/ui/input";
import { useActiveHeading } from "~/hooks/use-active-heading";
import type { TOCItem } from "~/lib/remark-toc-export";
import { cn } from "~/lib/utils";

interface TableOfContentsProps {
  toc: TOCItem[];
  /** Render only the desktop right-rail variant */
  desktopOnly?: boolean;
  searchable?: boolean;
}

export function TableOfContents({
  toc,
  desktopOnly,
  searchable,
}: TableOfContentsProps) {
  const [query, setQuery] = useState("");
  const ids = useMemo(() => toc.map((item) => item.id), [toc]);
  const activeId = useActiveHeading(ids);
  const filtered = toc.filter((item) =>
    item.value.toLowerCase().includes(query.trim().toLowerCase())
  );
  const search = searchable ? (
    <>
      <Input
        type="search"
        aria-label="Find a symbol on this page"
        placeholder="Find a symbol"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mb-3 min-h-11"
      />
      {filtered.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          No matching symbols.
        </p>
      )}
    </>
  ) : null;

  if (toc.length === 0) return null;

  if (desktopOnly) {
    return (
      <nav
        aria-label="On this page"
        className="hidden xl:block fixed top-16 right-8 max-h-[calc(100vh-4rem)] w-48 overflow-y-auto scrollbar-none"
      >
        <p className="mb-3 font-heading text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
          On this page
        </p>
        {search}
        <TOCList toc={filtered} activeId={activeId} />
      </nav>
    );
  }

  // Mobile-only: collapsible above content
  return <MobileTOC toc={filtered} activeId={activeId} search={search} />;
}

function MobileTOC({
  toc,
  activeId,
  search,
}: {
  toc: TOCItem[];
  activeId: string;
  search: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="xl:hidden mb-6 border rounded-md px-4 py-2"
    >
      <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between text-sm font-semibold">
        On this page
        <ChevronRight
          className={cn("h-4 w-4 transition-transform", open && "rotate-90")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <nav aria-label="On this page">
          {search}
          <TOCList
            toc={toc}
            activeId={activeId}
            onClick={() => setOpen(false)}
          />
        </nav>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface TOCNode {
  item: TOCItem;
  children: TOCNode[];
}

/** Convert flat TOC array into a nested tree */
function buildTree(items: TOCItem[]): TOCNode[] {
  const root: TOCNode[] = [];
  const stack: TOCNode[] = [];

  for (const item of items) {
    const node: TOCNode = { item, children: [] };

    // Pop stack until we find a parent with lower depth
    while (
      stack.length > 0 &&
      (stack[stack.length - 1]?.item.depth || 0) >= item.depth
    ) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1]?.children.push(node);
    }

    stack.push(node);
  }

  return root;
}

function TOCList({
  toc,
  activeId,
  onClick,
}: {
  toc: TOCItem[];
  activeId: string;
  onClick?: () => void;
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: "start", behavior: "smooth" });
        history.replaceState(history.state, "", `#${id}`);
      }
      onClick?.();
    },
    [onClick]
  );

  const tree = useMemo(() => buildTree(toc), [toc]);

  return (
    <ul className="text-sm">
      {tree.map((node) => (
        <TOCNodeItem
          key={node.item.id}
          node={node}
          activeId={activeId}
          onClickLink={handleClick}
        />
      ))}
    </ul>
  );
}

function TOCNodeItem({
  node,
  activeId,
  onClickLink,
}: {
  node: TOCNode;
  activeId: string;
  onClickLink: (e: React.MouseEvent<HTMLAnchorElement>, id: string) => void;
}) {
  const { item, children } = node;
  const isActive = item.id === activeId;

  return (
    <li>
      <a
        aria-current={isActive ? "location" : undefined}
        href={`#${item.id}`}
        onClick={(e) => onClickLink(e, item.id)}
        className={cn(
          "flex items-center min-h-11 xl:min-h-0 py-1 transition-colors duration-150 hover:text-foreground",
          isActive ? "text-primary font-medium" : "text-muted-foreground"
        )}
      >
        {item.value}
      </a>
      {children.length > 0 && (
        <ul className="ml-3 border-l border-border pl-3 space-y-0.5">
          {children.map((child) => (
            <TOCNodeItem
              key={child.item.id}
              node={child}
              activeId={activeId}
              onClickLink={onClickLink}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
