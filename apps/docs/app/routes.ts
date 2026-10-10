import { index, route, type RouteConfig } from "@react-router/dev/routes";
import { pages } from "./nav.config";

export default pages.map((page) =>
  page.href === "/"
    ? index("content/index.mdx")
    : route(page.href.slice(1), `content${page.href}.mdx`)
) satisfies RouteConfig;
