import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/Box.ts",
    "src/Annotation.ts",
    "src/Ansi.ts",
    "src/Cmd.ts",
    "src/Reactive.ts",
    "src/Html.ts",
    "src/Renderer.ts",
    "src/Layout.ts",
  ],
  format: ["esm"],
  outExtensions: () => ({ js: ".js" }),
  target: "es2022",
  dts: false,
  sourcemap: false,
  deps: {
    neverBundle: ["effect"],
  },
});
