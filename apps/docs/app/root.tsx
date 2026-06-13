import { MDXProvider } from "@mdx-js/react";
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatches,
} from "react-router";
import { AppSidebar } from "~/components/app-sidebar";
import { DocFooter } from "~/components/doc-footer";
import { GithubIcon } from "~/components/icons";
import { TableOfContents } from "~/components/table-of-contents";
import { ThemeToggle } from "~/components/theme-toggle";
import { proseComponents } from "~/components/tokens/prose-components";
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "~/components/ui/sidebar";
import type { TOCItem } from "~/lib/remark-toc-export";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500;700&display=swap",
  },
];

const themeScript = `
(function() {
  var theme = localStorage.getItem('theme');
  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
})();
`;

const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {umamiWebsiteId ? (
          <script
            defer
            src="https://umami.lloydrichards.dev/script.js"
            data-website-id={umamiWebsiteId}
          />
        ) : null}
        <Meta />
        <Links />
      </head>
      <body>
        <SidebarProvider>
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <SiteHeader />
            <main className="flex-1 w-full px-6 xl:px-12 xl:pr-[14rem] py-10">
              {children}
            </main>
          </div>
        </SidebarProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const matches = useMatches();
  const lastMatch = matches[matches.length - 1];
  // biome-ignore lint/suspicious/noExplicitAny: React Router's useMatches handle is untyped
  const toc: TOCItem[] = (lastMatch?.handle as any)?.toc ?? [];
  const hasToc = toc.length > 0;

  return (
    <MDXProvider components={proseComponents}>
      {hasToc && <TableOfContents toc={toc} />}
      <div className="mx-auto w-full max-w-[72ch]">
        <Outlet />
        <DocFooter />
      </div>
      {hasToc && <TableOfContents toc={toc} desktopOnly />}
    </MDXProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}

function SiteHeader() {
  const { state, isMobile } = useSidebar();
  const sidebarVisible = state === "expanded" && !isMobile;

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur-sm px-6 py-3">
      <SidebarTrigger />
      {!sidebarVisible && (
        <Link
          to="/"
          className="font-heading text-base font-bold tracking-[-0.02em]"
        >
          effect-boxes
        </Link>
      )}
      <div className="flex-1" />
      <a
        href="https://github.com/lloydrichards/effect-boxes"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="GitHub"
      >
        <GithubIcon className="size-5" />
      </a>
      <ThemeToggle />
    </header>
  );
}
