export type NavItem = {
  label: string;
  href: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const navigation: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Getting Started", href: "/getting-started" },
      { label: "What is Box?", href: "/what-is-box" },
      { label: "Architecture", href: "/architecture" },
    ],
  },
  {
    title: "Tutorials",
    items: [
      { label: "Directory Tree", href: "/tutorials/directory-tree" },
      { label: "Select Prompt", href: "/tutorials/select-prompt" },
    ],
  },
  {
    title: "Guides",
    items: [
      { label: "Using Box", href: "/guides/using-box" },
      { label: "Using Annotation", href: "/guides/using-annotation" },
      { label: "Using Ansi", href: "/guides/using-ansi" },
      { label: "Using Layout", href: "/guides/using-layout" },
      { label: "Stacking Boxes", href: "/guides/stacking-boxes" },
      { label: "Using Cmd", href: "/guides/using-cmd" },
      { label: "Using Reactive", href: "/guides/using-reactive" },
      { label: "Using Html", href: "/guides/using-html" },
      { label: "Rendering", href: "/guides/rendering" },
      { label: "Common Patterns", href: "/guides/common-patterns" },
    ],
  },
  {
    title: "API Reference",
    items: [
      { label: "Box", href: "/api/box" },
      { label: "Annotation", href: "/api/annotation" },
      { label: "Ansi", href: "/api/ansi" },
      { label: "Cmd", href: "/api/cmd" },
      { label: "Html", href: "/api/html" },
      { label: "Layout", href: "/api/layout" },
      { label: "Reactive", href: "/api/reactive" },
      { label: "Renderer", href: "/api/renderer" },
      { label: "FrameEncoder", href: "/api/frameencoder" },
    ],
  },
];
