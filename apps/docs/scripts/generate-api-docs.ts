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
import { createProcessor } from "@mdx-js/mdx";
import {
  Array as Arr,
  Console,
  Effect,
  FileSystem,
  Path,
  pipe,
  String as Str,
} from "effect";
import { format } from "prettier";
import remarkGfm from "remark-gfm";

import {
  escapeLineForMdx,
  finalizeApiContent,
  normalizeExampleFences,
  validateModuleFiles,
} from "./api-docs-generation";

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
    (text) => text.replace(/^# (\w+)\.ts overview$/m, "# $1"),
    escapeMdxUnsafe,
    finalizeApiContent
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
  const apiDir = path.join(root, "apps/docs/app/content/api");
  const staging = yield* fs.makeTempDirectoryScoped({
    directory: pkg,
    prefix: ".docgen-",
  });
  const sourceDir = path.join(staging, "src");
  const docgenOut = path.join(staging, "output/modules");
  const stagedApi = path.join(staging, "api");
  const config = JSON.parse(
    yield* fs.readFileString(path.join(pkg, "docgen.json"))
  );
  yield* fs.copyFile(
    path.join(pkg, "package.json"),
    path.join(staging, "package.json")
  );
  yield* fs.writeFileString(
    path.join(staging, "docgen.json"),
    JSON.stringify({
      ...config,
      srcDir: "src",
      outDir: "output",
      parseCompilerOptions: "../tsconfig.docgen.json",
      examplesCompilerOptions: {
        strict: true,
        skipLibCheck: true,
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        paths: { "effect-boxes/*": ["../../src/*"] },
      },
    })
  );

  // Docgen wraps @example text in its own fence. Normalize only the temporary
  // source copy so the published JSDoc keeps conventional fenced examples.
  yield* fs.copy(path.join(pkg, "src"), sourceDir);
  const sources = yield* fs.readDirectory(sourceDir);
  yield* Effect.forEach(
    sources.filter((file) => file.endsWith(".ts")),
    (file) =>
      Effect.gen(function* () {
        const filePath = path.join(sourceDir, file);
        const source = yield* fs.readFileString(filePath);
        yield* fs.writeFileString(filePath, normalizeExampleFences(source));
      }),
    { discard: true }
  );

  // Run docgen in the staged package; explicit CLI source links avoid docgen's
  // homepage-derived links (this version ignores srcLink in docgen.json).
  yield* Console.log("Running @effect/docgen...");

  const pathEnv = [
    path.join(pkg, "node_modules/.bin"),
    path.join(root, "node_modules/.bin"),
    process.env.PATH ?? "",
  ].join(":");

  const result = yield* Effect.tryPromise({
    try: () => {
      const proc = Bun.spawn(
        [
          "docgen",
          "--srcLink",
          "https://github.com/lloydrichards/effect-boxes/blob/main/packages/effect-boxes/src/",
        ],
        {
          cwd: staging,
          env: { ...process.env, PATH: pathEnv },
          stdout: "pipe",
          stderr: "pipe",
        }
      );
      return proc.exited.then(async (code) => ({
        code,
        stdout: await new Response(proc.stdout).text(),
        stderr: await new Response(proc.stderr).text(),
      }));
    },
    catch: (e) => ({ _tag: "DocgenSpawnError" as const, cause: e }),
  });

  if (result.stdout) yield* Console.log(result.stdout);
  if (result.stderr) yield* Console.error(result.stderr);
  if (result.code !== 0) {
    return yield* Effect.fail(
      new Error(
        `Docgen failed with exit code ${result.code}; existing API pages were preserved.`
      )
    );
  }

  const allFiles = yield* fs.readDirectory(docgenOut);
  yield* Effect.try(() => validateModuleFiles(allFiles));
  const mdFiles = allFiles.filter((file) => file.endsWith(".ts.md"));
  yield* fs.makeDirectory(stagedApi);
  const mdxParser = createProcessor({ remarkPlugins: [remarkGfm] });
  yield* Effect.forEach(
    mdFiles,
    (file) =>
      Effect.gen(function* () {
        const content = yield* fs.readFileString(path.join(docgenOut, file));
        const outputName = toOutputName(file);
        const mdx = yield* Effect.tryPromise(() =>
          format(transformContent(content), { parser: "mdx" })
        );
        yield* Effect.try(() => mdxParser.parse(mdx));
        yield* fs.writeFileString(path.join(stagedApi, outputName), mdx);
      }),
    { discard: true }
  );

  // Publish the complete directory only after every module has been generated.
  // Keep a backup until the rename succeeds so filesystem failures can roll back.
  const previousApi = path.join(staging, "previous-api");
  const hadApi = yield* fs.exists(apiDir);
  if (hadApi) yield* fs.rename(apiDir, previousApi);
  yield* fs.rename(stagedApi, apiDir).pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        if (hadApi) yield* fs.rename(previousApi, apiDir);
        return yield* Effect.fail(error);
      })
    )
  );
  yield* Console.log(`Published ${mdFiles.length} API pages.`);

  yield* Console.log("API docs generation complete.");
}).pipe(Effect.scoped, Effect.provide(BunServices.layer));

BunRuntime.runMain(program);
