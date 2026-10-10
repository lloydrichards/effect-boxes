import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Link, useLocation } from "react-router";
import { getPage, pages } from "~/nav.config";

const REPO_URL = "https://github.com/lloydrichards/effect-boxes";
const CONTENT_BASE = "blob/main/apps/docs/app/content";

/** Flattened nav items in reading order */
const flatNav = pages;

function getContentPath(pathname: string): string {
  if (pathname === "/") return "index.mdx";
  return `${pathname.slice(1)}.mdx`;
}

export function DocFooter() {
  const { pathname } = useLocation();
  const currentPath = getPage(pathname)?.href ?? pathname.replace(/\/$/, "");

  const currentIndex = flatNav.findIndex((item) => item.href === currentPath);
  const prev = currentIndex > 0 ? flatNav[currentIndex - 1] : null;
  const next =
    currentIndex >= 0 && currentIndex < flatNav.length - 1
      ? flatNav[currentIndex + 1]
      : null;

  const editUrl = `${REPO_URL}/${CONTENT_BASE}/${getContentPath(currentPath)}`;

  return (
    <footer className="mt-16 border-t border-border/50 pt-6">
      <nav
        aria-label="Previous and next pages"
        className="flex items-center justify-between"
      >
        <div>
          {prev && (
            <Link
              to={prev.href}
              className="inline-flex max-md:min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="size-4" />
              {prev.label}
            </Link>
          )}
        </div>
        <div>
          {next && (
            <Link
              to={next.href}
              className="inline-flex max-md:min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {next.label}
              <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
      </nav>
      <div className="mt-4 flex justify-end">
        <a
          href={editUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-md:min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View this page on GitHub
          <ExternalLink className="size-3" />
        </a>
      </div>
    </footer>
  );
}
