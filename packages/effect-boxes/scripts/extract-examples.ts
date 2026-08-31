#!/usr/bin/env bun

/**
 * extract-examples.ts
 *
 * Extracts all @example code blocks from public modules into individual .ts files
 * under docs/examples/, along with a tsconfig.json for type-checking them.
 *
 * Usage:
 *   bun run scripts/extract-examples.ts       # extract examples
 *   tsc --noEmit -p docs/examples/tsconfig.json  # type-check them
 */

import { BunRuntime, BunServices } from "@effect/platform-bun";
import {
  Array as Arr,
  Console,
  Effect,
  FileSystem,
  Option,
  Path,
} from "effect";
import * as ts from "typescript-6";

const PUBLIC_MODULES = [
  "src/Annotation.ts",
  "src/Ansi.ts",
  "src/Box.ts",
  "src/Cmd.ts",
  "src/Html.ts",
  "src/Layout.ts",
  "src/Reactive.ts",
  "src/Renderer.ts",
];

// --- Effect helpers ---

const getExportName = (
  statement: ts.Statement,
  sourceFile: ts.SourceFile
): Option.Option<string> => {
  const hasExport =
    ts.canHaveModifiers(statement) &&
    ts
      .getModifiers(statement)
      ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  if (!hasExport) return Option.none();

  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement)
  ) {
    return Option.fromNullishOr(statement.name?.text);
  }
  if (ts.isVariableStatement(statement)) {
    return Option.fromNullishOr(
      statement.declarationList.declarations[0]?.name.getText(sourceFile)
    );
  }
  return Option.none();
};

const extractCodeBlocks = (rawDoc: string) => {
  const fencePattern = /```(?:ts|tsx|typescript)?\s*\n([\s\S]*?)```/g;
  return [...rawDoc.matchAll(fencePattern)].map((match) =>
    (match[1] ?? "")
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, ""))
      .join("\n")
      .trim()
  );
};

const extractExamplesFromStatement = (
  statement: ts.Statement,
  sourceFile: ts.SourceFile,
  fileText: string,
  moduleName: string
) =>
  Option.match(getExportName(statement, sourceFile), {
    onNone: () => [],
    onSome: (name) => {
      const jsDocs =
        (statement as unknown as { jsDoc?: ts.JSDoc[] }).jsDoc ?? [];

      return Arr.flatMap(jsDocs, (doc) => {
        const rawDoc = fileText.slice(doc.getFullStart(), doc.getEnd());
        const blocks = extractCodeBlocks(rawDoc);
        return blocks.map((code, index) => ({
          module: moduleName,
          exportName: name,
          index,
          code: code.replace(
            /from\s+["']effect-boxes\/(\w+)["']/g,
            (_match, mod) => `from '../../src/${mod}'`
          ),
        }));
      });
    },
  });

// --- Main program ---

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const root = process.cwd();
  const outDir = path.join(root, "docs", "examples");

  // Clean and recreate output dir
  if (yield* fs.exists(outDir)) {
    yield* fs.remove(outDir, { recursive: true });
  }
  yield* fs.makeDirectory(outDir, { recursive: true });

  // Extract examples from each module
  const nested = yield* Effect.forEach(PUBLIC_MODULES, (modulePath) =>
    Effect.gen(function* () {
      const fullPath = path.join(root, modulePath);
      if (!(yield* fs.exists(fullPath))) return [];

      const fileText = yield* fs.readFileString(fullPath);
      const sourceFile = ts.createSourceFile(
        fullPath,
        fileText,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );

      return Arr.flatMap(Array.from(sourceFile.statements), (statement) =>
        extractExamplesFromStatement(
          statement,
          sourceFile,
          fileText,
          path.basename(modulePath).replace(/\.ts$/, "")
        )
      );
    })
  );

  // Write each example as a separate .ts file
  // Use a counter map to avoid case-insensitive filename collisions
  // (e.g. Reactive-Reactive-0.ts vs Reactive-reactive-0.ts on macOS/Windows)
  const examples = Arr.flatten(nested);
  const seenLower = new Map<string, number>();
  yield* Effect.forEach(
    examples,
    (ex) => {
      const baseName = `${ex.module}-${ex.exportName}-${ex.index}`;
      const lowerKey = baseName.toLowerCase();
      const count = seenLower.get(lowerKey) ?? 0;
      seenLower.set(lowerKey, count + 1);
      const fileName = count > 0 ? `${baseName}_${count}.ts` : `${baseName}.ts`;
      return fs.writeFileString(path.join(outDir, fileName), `${ex.code}\n`);
    },
    { discard: true }
  );

  // Write tsconfig for type-checking examples
  const tsconfig = {
    compilerOptions: {
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      moduleResolution: "Bundler",
      module: "ESNext",
      target: "ES2022",
      lib: ["ES2022", "DOM"],
      paths: {
        "effect-boxes/*": ["../../src/*"],
      },
    },
    include: ["./**/*.ts"],
  };

  yield* fs.writeFileString(
    path.join(outDir, "tsconfig.json"),
    `${JSON.stringify(tsconfig, null, 2)}\n`
  );

  yield* Console.log(
    `Extracted ${Arr.flatten(nested).length} example(s) to docs/examples/`
  );
}).pipe(Effect.provide(BunServices.layer));

BunRuntime.runMain(program);
