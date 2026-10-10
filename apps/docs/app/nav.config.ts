export type DocPage = {
  label: string;
  href: string;
  description: string;
};

export type NavSection = {
  title: string;
  items: DocPage[];
};

/** Page labels, descriptions, and reading order shared by navigation and metadata. */
export const navigation: NavSection[] = [
  {
    title: "Start here",
    items: [
      {
        label: "What is Box?",
        href: "/what-is-box",
        description: "Understand rectangles, annotations, and output targets.",
      },
      {
        label: "Getting started",
        href: "/getting-started",
        description: "Install effect-boxes and render your first layout.",
      },
      {
        label: "Architecture",
        href: "/architecture",
        description: "Understand the box tree and renderer services.",
      },
      {
        label: "Common patterns",
        href: "/guides/common-patterns",
        description: "Apply reusable layouts to common terminal tasks.",
      },
    ],
  },
  {
    title: "Guides",
    items: [
      {
        label: "Using Box",
        href: "/guides/using-box",
        description: "Compose, align, and resize text boxes.",
      },
      {
        label: "Using Annotation",
        href: "/guides/using-annotation",
        description: "Attach metadata without changing layout.",
      },
      {
        label: "Using Ansi",
        href: "/guides/using-ansi",
        description: "Style terminal text with ANSI annotations.",
      },
      {
        label: "Rendering",
        href: "/guides/rendering",
        description: "Choose plain, ANSI, or HTML output.",
      },
      {
        label: "Using Layout",
        href: "/guides/using-layout",
        description: "Build rows, columns, grids, and tables.",
      },
    ],
  },
  {
    title: "Tutorials",
    items: [
      {
        label: "Directory tree",
        href: "/tutorials/directory-tree",
        description: "Build a styled directory tree.",
      },
      {
        label: "Select prompt",
        href: "/tutorials/select-prompt",
        description: "Build an interactive terminal selection menu.",
      },
    ],
  },
  {
    title: "Advanced",
    items: [
      {
        label: "Render overlapping boxes",
        href: "/guides/stacking-boxes",
        description: "Compose overlapping boxes with a chosen render order.",
      },
      {
        label: "Using Cmd",
        href: "/guides/using-cmd",
        description: "Control terminal cursors and clear output.",
      },
      {
        label: "Using Reactive",
        href: "/guides/using-reactive",
        description: "Track the positions of annotated boxes.",
      },
      {
        label: "Using Html",
        href: "/guides/using-html",
        description: "Render annotated layouts as HTML.",
      },
    ],
  },
  {
    title: "API reference",
    items: [
      {
        label: "Box",
        href: "/api/box",
        description: "Reference for the Box module.",
      },
      {
        label: "Annotation",
        href: "/api/annotation",
        description: "Reference for the Annotation module.",
      },
      {
        label: "Ansi",
        href: "/api/ansi",
        description: "Reference for the Ansi module.",
      },
      {
        label: "Cmd",
        href: "/api/cmd",
        description: "Reference for the Cmd module.",
      },
      {
        label: "Html",
        href: "/api/html",
        description: "Reference for the Html module.",
      },
      {
        label: "Layout",
        href: "/api/layout",
        description: "Reference for the Layout module.",
      },
      {
        label: "Reactive",
        href: "/api/reactive",
        description: "Reference for the Reactive module.",
      },
      {
        label: "Renderer",
        href: "/api/renderer",
        description: "Reference for the Renderer module.",
      },
      {
        label: "FrameEncoder",
        href: "/api/frameencoder",
        description: "Reference for the FrameEncoder module.",
      },
    ],
  },
];

export const pages: DocPage[] = [
  {
    label: "effect-boxes",
    href: "/",
    description: "Compose text layouts for terminals and HTML with Effect.",
  },
  ...navigation.flatMap((section) => section.items),
];

export function getPage(pathname: string): DocPage | undefined {
  return pages.find(
    (page) =>
      page.href === pathname.replace(/\/$/, "") ||
      (page.href === "/" && pathname === "/")
  );
}
