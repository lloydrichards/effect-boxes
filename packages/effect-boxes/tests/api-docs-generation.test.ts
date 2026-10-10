import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { Cause, Effect, Exit, FileSystem } from "effect";
import { describe, expect, it } from "vitest";
import {
  escapeLineForMdx,
  finalizeApiContent,
  normalizeExampleFences,
  validateModuleFiles,
} from "../../../apps/docs/scripts/api-docs-generation";
import { publishApi } from "../../../apps/docs/scripts/api-docs-publication";

describe("API documentation generation", () => {
  it("makes overview sections siblings of categories and links local references", () => {
    const source =
      "# Box\n### Common tasks\nUse `text` and `Options`. Already [`text`](#text).\n```ts\nconst x = `text`;\n```\n## constructors\n### text\n### Options (interface)\n### Options (interface)";
    const generated = finalizeApiContent(source);
    expect(generated).toContain("# Box\n## Common tasks");
    expect(generated).toContain(
      "Use [`text`](#text) and [`Options`](#options-interface)."
    );
    expect(generated).toContain("Already [`text`](#text).");
    expect(generated).toContain("const x = `text`;");
  });
  it("preserves inline code containing nested generics and quotes prose generics", () => {
    const inline = "`Effect<ReadonlyArray<string>, FrameEncodingError>`";
    expect(escapeLineForMdx(inline)).toBe(inline);
    expect(
      escapeLineForMdx(
        "Return Effect<ReadonlyArray<string>, FrameEncodingError> for each row."
      )
    ).toBe(`Return ${inline} for each row.`);
    expect(escapeLineForMdx("Use ``Box<A>`` with {@link FrameEncoder}.")).toBe(
      "Use ``Box<A>`` with `FrameEncoder`."
    );
  });
  it("leaves one executable fence after docgen wraps a JSDoc example", () => {
    const source = [
      "/**",
      " * Module overview",
      " * ```typescript",
      " * overview()",
      " * ```",
      " * @example",
      " * ```typescript",
      " * example()",
      " * ```",
      " * @category utilities",
      " */",
      "const literal = `\n```typescript\n`;",
    ].join("\n");
    const normalized = normalizeExampleFences(source);
    expect(normalized.split("\n")).toHaveLength(source.split("\n").length);
    expect(normalized).toContain(" * ```typescript\n * overview()\n * ```");
    expect(normalized).toContain(
      " * @example\n *\n * example()\n *\n * @category utilities"
    );
    expect(normalized).toContain("const literal = `\n```typescript\n`;");
    expect(normalizeExampleFences(normalized)).toBe(normalized);
  });

  it("rejects missing modules and unexpected internal modules", () => {
    const files = [
      "Annotation",
      "Ansi",
      "Box",
      "Cmd",
      "FrameEncoder",
      "Html",
      "Layout",
      "Reactive",
      "Renderer",
    ].map((name) => `${name}.ts.md`);
    expect(() => validateModuleFiles([...files, "index.md"])).not.toThrow();
    expect(() =>
      validateModuleFiles(files.filter((name) => name !== "Box.ts.md"))
    ).toThrow("Missing: Box.ts.md");
    expect(() => validateModuleFiles([...files, "resolver.ts.md"])).toThrow(
      "unexpected: resolver.ts.md"
    );
    expect(() => validateModuleFiles([])).toThrow("Incomplete API output");
  });
});

describe("API publication", () => {
  it.each([
    ["a docgen failure", "exit 42", "Docgen failed with exit code 42"],
    [
      "incomplete successful output",
      "mkdir -p output/modules; printf '# Box.ts overview\\n' > output/modules/Box.ts.md",
      "Incomplete API output",
    ],
    [
      "invalid MDX in a complete output set",
      "mkdir -p output/modules; for module in Annotation Ansi Box Cmd FrameEncoder Html Layout Reactive Renderer; do printf '# Module\\nUnclosed <Tag' > output/modules/$module.ts.md; done",
      "Unexpected end of file",
    ],
  ])("preserves existing pages after %s", (_label, command, expectedError) => {
    const root = mkdtempSync(join(tmpdir(), "api-docs-test-"));
    const repository = resolve(import.meta.dirname, "../../..");
    try {
      const scripts = join(root, "apps/docs/scripts");
      const pkg = join(root, "packages/effect-boxes");
      const api = join(root, "apps/docs/app/content/api");
      mkdirSync(scripts, { recursive: true });
      mkdirSync(join(pkg, "src"), { recursive: true });
      mkdirSync(join(pkg, "node_modules/.bin"), { recursive: true });
      mkdirSync(api, { recursive: true });
      symlinkSync(
        join(repository, "node_modules"),
        join(root, "node_modules"),
        "dir"
      );
      symlinkSync(
        join(repository, "apps/docs/node_modules"),
        join(root, "apps/docs/node_modules"),
        "dir"
      );
      for (const file of [
        "generate-api-docs.ts",
        "api-docs-generation.ts",
        "api-docs-publication.ts",
      ]) {
        cpSync(
          join(repository, "apps/docs/scripts", file),
          join(scripts, file)
        );
      }
      writeFileSync(join(pkg, "src/Box.ts"), "export const box = 1;");
      writeFileSync(
        join(pkg, "package.json"),
        '{"name":"fixture","homepage":"https://example.com"}'
      );
      writeFileSync(join(pkg, "docgen.json"), "{}");
      writeFileSync(
        join(pkg, "node_modules/.bin/docgen"),
        `#!/bin/sh\n${command}\n`,
        { mode: 0o755 }
      );
      writeFileSync(join(api, "existing.mdx"), "Previous complete API page");
      const result = spawnSync(
        "bun",
        ["--no-install", join(scripts, "generate-api-docs.ts")],
        {
          encoding: "utf8",
        }
      );
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain(expectedError);
      expect(readFileSync(join(api, "existing.mdx"), "utf8")).toBe(
        "Previous complete API page"
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("API directory replacement", () => {
  it.each(["interruption", "replacement failure"])(
    "restores previous pages after %s and scope cleanup",
    async (failure) => {
      const root = mkdtempSync(join(tmpdir(), "api-publication-test-"));
      const api = join(root, "api");
      mkdirSync(api);
      writeFileSync(join(api, "existing.mdx"), "Previous complete API page");
      try {
        const exit = await Effect.runPromiseExit(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const staging = yield* fs.makeTempDirectoryScoped({
              directory: root,
            });
            const stagedApi = join(staging, "api");
            const previousApi = join(staging, "previous-api");
            yield* fs.makeDirectory(stagedApi);
            yield* fs.writeFileString(
              join(stagedApi, "new.mdx"),
              "New complete API page"
            );
            const publicationFs = FileSystem.FileSystem.of({
              ...fs,
              rename: (from, to) => {
                if (failure === "interruption" && from === api) {
                  return fs
                    .rename(from, to)
                    .pipe(Effect.andThen(Effect.interrupt));
                }
                if (failure === "replacement failure" && from === stagedApi) {
                  return fs.rename(join(staging, "missing"), to);
                }
                return fs.rename(from, to);
              },
            });
            yield* publishApi(publicationFs, stagedApi, api, previousApi);
          }).pipe(Effect.scoped, Effect.provide(BunFileSystem.layer))
        );
        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          expect(Cause.hasInterrupts(exit.cause)).toBe(
            failure === "interruption"
          );
        }
        expect(readFileSync(join(api, "existing.mdx"), "utf8")).toBe(
          "Previous complete API page"
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
});
