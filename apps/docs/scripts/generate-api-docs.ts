#!/usr/bin/env bun

/**
 * generate-api-docs.ts
 *
 * Runs @effect/docgen on the effect-boxes package, then transforms the output
 * into MDX files for the docs app at apps/docs/app/content/api/.
 *
 * Intended to run as a prebuild step in apps/docs.
 */

import { BunRuntime, BunServices } from "@effect/platform-bun";
import {
  Array as Arr,
  Console,
  Effect,
  FileSystem,
  Path,
  pipe,
  String as Str,
} from "effect";

// --- Pure helpers ---

const stripFrontmatter = (content: string): string =>
  content.replace(/^---[\s\S]*?---\n*/, "");

const replaceTocHeader = (content: string): string =>
  content.replace(
    /<h2 class="text-delta">Table of contents<\/h2>/,
    "## Table of contents"
  );

/** Remove docgen's inline contents section (heading + list + separator). */
const stripInlineToc = (content: string): string =>
  content.replace(
    /^## (?:Table of contents|Exports Grouped by Category)\n(?:\n|[ \t]*-[^\n]*\n)*---\n*/m,
    ""
  );

const escapeLineForMdx = (line: string): string =>
  pipe(
    line,
    (l) => l.replace(/\{@link\s+([^}]+)\}/g, "`$1`"),
    (l) =>
      l.replace(
        /(?<!`)(\w+)<([^>]+)>(?!`)/g,
        (_, name, params) => `\`${name}<${params}>\``
      )
  );

const escapeMdxUnsafe = (content: string): string =>
  pipe(
    content.split("\n"),
    Arr.mapAccum(false, (inCodeBlock, line) => {
      if (line.startsWith("```")) return [!inCodeBlock, line];
      if (inCodeBlock) return [inCodeBlock, line];
      return [inCodeBlock, escapeLineForMdx(line)];
    }),
    ([_, lines]) => lines.join("\n")
  );

/** Bump all headings down one level (h1→h2, h2→h3, etc.) */
const bumpHeadings = (content: string): string =>
  content.replace(/^(#{1,5}) /gm, "#$1 ");

/** Promote the first heading to h1 (page title) */
const promoteFirstHeading = (content: string): string =>
  content.replace(/^#{2,6} /m, "# ");

const transformContent = (content: string): string =>
  pipe(
    content,
    stripFrontmatter,
    replaceTocHeader,
    stripInlineToc,
    bumpHeadings,
    promoteFirstHeading,
    escapeMdxUnsafe
  );

const toOutputName = (file: string): string =>
  pipe(
    file,
    Str.replace(/\.ts\.md$/, ""),
    Str.toLowerCase,
    (name) => `${name}.mdx`
  );

// --- Main program ---

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const root = path.resolve(import.meta.dirname, "../../..");
  const pkg = path.join(root, "packages/effect-boxes");
  const docgenOut = path.join(pkg, "docs/modules");
  const apiDir = path.join(root, "apps/docs/app/content/api");

  // 1. Run docgen in the effect-boxes package
  yield* Console.log("Running @effect/docgen...");

  const pathEnv = [
    path.join(pkg, "node_modules/.bin"),
    path.join(root, "node_modules/.bin"),
    process.env.PATH ?? "",
  ].join(":");

  const result = yield* Effect.tryPromise({
    try: () => {
      const proc = Bun.spawn(["docgen"], {
        cwd: pkg,
        env: { ...process.env, PATH: pathEnv },
        stdout: "pipe",
        stderr: "pipe",
      });
      return proc.exited.then(async (code) => ({
        code,
        stdout: await new Response(proc.stdout).text(),
        stderr: await new Response(proc.stderr).text(),
      }));
    },
    catch: (e) => ({ _tag: "DocgenSpawnError" as const, cause: e }),
  });

  if (result.code !== 0) {
    yield* Console.log(`Warning: docgen exited with code ${result.code}`);
    if (result.stderr) yield* Console.log(result.stderr);
    if (result.stdout) yield* Console.log(result.stdout);
  }

  // 2. Ensure output directory exists
  yield* fs.makeDirectory(docgenOut, { recursive: true });
  yield* fs.makeDirectory(apiDir, { recursive: true });

  // 3. Read and transform each generated .md into .mdx
  const allFiles = yield* fs.readDirectory(docgenOut);

  const mdFiles = pipe(
    allFiles,
    Arr.filter((f) => f.endsWith(".ts.md") && f !== "index.md")
  );

  if (mdFiles.length === 0) {
    yield* Console.log("No docgen output found, skipping API docs generation.");
    return;
  }

  yield* Effect.forEach(
    mdFiles,
    (file) =>
      Effect.gen(function* () {
        const content = yield* fs.readFileString(path.join(docgenOut, file));
        const mdxSafe = transformContent(content);
        const outputName = toOutputName(path.basename(file));
        const outPath = path.join(apiDir, outputName);

        yield* fs.writeFileString(outPath, mdxSafe);
        yield* Console.log(`  Written: ${outputName}`);
      }),
    { discard: true }
  );

  yield* Console.log("API docs generation complete.");
}).pipe(Effect.provide(BunServices.layer));

BunRuntime.runMain(program);
