import {
  index,
  prefix,
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

export default [
  index("content/index.mdx"),
  route("getting-started", "content/getting-started.mdx"),
  route("what-is-box", "content/what-is-box.mdx"),
  route("architecture", "content/architecture.mdx"),
  ...prefix("tutorials", [
    route("directory-tree", "content/tutorials/directory-tree.mdx"),
    route("select-prompt", "content/tutorials/select-prompt.mdx"),
  ]),
  ...prefix("guides", [
    route("using-box", "content/guides/using-box.mdx"),
    route("using-annotation", "content/guides/using-annotation.mdx"),
    route("using-ansi", "content/guides/using-ansi.mdx"),
    route("using-layout", "content/guides/using-layout.mdx"),
    route("stacking-boxes", "content/guides/stacking-boxes.mdx"),
    route("using-cmd", "content/guides/using-cmd.mdx"),
    route("using-reactive", "content/guides/using-reactive.mdx"),
    route("using-html", "content/guides/using-html.mdx"),
    route("rendering", "content/guides/rendering.mdx"),
    route("common-patterns", "content/guides/common-patterns.mdx"),
  ]),
  ...prefix("api", [
    route("box", "content/api/box.mdx"),
    route("annotation", "content/api/annotation.mdx"),
    route("ansi", "content/api/ansi.mdx"),
    route("cmd", "content/api/cmd.mdx"),
    route("html", "content/api/html.mdx"),
    route("layout", "content/api/layout.mdx"),
    route("reactive", "content/api/reactive.mdx"),
    route("renderer", "content/api/renderer.mdx"),
    route("frameencoder", "content/api/frameencoder.mdx"),
  ]),
] satisfies RouteConfig;
