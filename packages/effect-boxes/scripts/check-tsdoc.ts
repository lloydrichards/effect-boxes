#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { TSDocConfiguration, TSDocParser } from "@microsoft/tsdoc";
import { TSDocConfigFile } from "@microsoft/tsdoc-config";
import { Array as A, Console, Effect, Option, Order, pipe } from "effect";
import * as ts from "typescript-6";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Severity = "error" | "warning";

type TsDocIssue = {
  readonly severity: Severity;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly code: string;
  readonly message: string;
  readonly name: string;
};

type IssueLocation = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly name: string;
};

type JsDocScanResult = {
  readonly hasCategory: boolean;
  readonly hasExample: boolean;
  readonly hasInternal: boolean;
  readonly categories: ReadonlyArray<string>;
  readonly issues: ReadonlyArray<TsDocIssue>;
};

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const ROOT = process.cwd();
const STRICT =
  process.argv.includes("--strict") || process.env.TSDOC_STRICT === "1";

const PUBLIC_MODULES = [
  "src/Annotation.ts",
  "src/Ansi.ts",
  "src/Box.ts",
  "src/Cmd.ts",
  "src/Html.ts",
  "src/Layout.ts",
  "src/Reactive.ts",
  "src/Renderer.ts",
] as const;

const EXAMPLE_REQUIRED_CATEGORIES_WHITELIST = [
  "constructors",
  "guards",
] as const;

// -----------------------------------------------------------------------------
// AST helpers
// -----------------------------------------------------------------------------

const isExported = (statement: ts.Statement): boolean =>
  ts.canHaveModifiers(statement)
    ? (ts
        .getModifiers(statement)
        ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false)
    : false;

const isNamedDeclaration = (
  statement: ts.Statement
): statement is
  | ts.FunctionDeclaration
  | ts.ClassDeclaration
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.EnumDeclaration =>
  ts.isFunctionDeclaration(statement) ||
  ts.isClassDeclaration(statement) ||
  ts.isInterfaceDeclaration(statement) ||
  ts.isTypeAliasDeclaration(statement) ||
  ts.isEnumDeclaration(statement);

const getName = (
  statement: ts.Statement,
  sourceFile: ts.SourceFile
): Option.Option<string> => {
  if (isNamedDeclaration(statement)) {
    return Option.fromNullishOr(statement.name?.text);
  }
  if (ts.isVariableStatement(statement)) {
    return Option.fromNullishOr(
      statement.declarationList.declarations[0]?.name.getText(sourceFile)
    );
  }
  return Option.none();
};

const getJsDocs = (statement: ts.Statement): ReadonlyArray<ts.JSDoc> =>
  (statement as ts.Statement & { readonly jsDoc?: ReadonlyArray<ts.JSDoc> })
    .jsDoc ?? [];

const isCallableExport = (statement: ts.Statement): boolean => {
  if (ts.isFunctionDeclaration(statement)) return true;
  if (!ts.isVariableStatement(statement)) return false;

  const typeNode = statement.declarationList.declarations[0]?.type;
  if (!typeNode) return false;
  if (ts.isFunctionTypeNode(typeNode)) return true;
  if (ts.isTypeLiteralNode(typeNode)) {
    return typeNode.members.some(ts.isCallSignatureDeclaration);
  }
  return false;
};

const isPublicExport = (s: ts.Statement): boolean =>
  isExported(s) && !ts.isExportDeclaration(s) && !ts.isExportAssignment(s);

// -----------------------------------------------------------------------------
// Regex helpers
// -----------------------------------------------------------------------------

const execAll = (
  pattern: RegExp,
  text: string
): ReadonlyArray<RegExpExecArray> => {
  const results: Array<RegExpExecArray> = [];
  for (;;) {
    const match = pattern.exec(text);
    if (match === null) break;
    results.push(match);
  }
  return results;
};

// -----------------------------------------------------------------------------
// Code fence extraction and validation
// -----------------------------------------------------------------------------

const extractCodeFences = (rawDoc: string): ReadonlyArray<string> =>
  pipe(
    execAll(/```(?:ts|tsx|typescript)?\s*\n([\s\S]*?)```/g, rawDoc),
    A.map((match) =>
      typeof match[1] === "string"
        ? Option.some(
            match[1]
              .split("\n")
              .map((line) => line.replace(/^\s*\*\s?/, ""))
              .join("\n")
              .trim()
          )
        : Option.none()
    ),
    A.getSomes
  );

const validateSnippetSyntax = (snippet: string): ReadonlyArray<string> => {
  const fileName = "__example__.ts";
  const compilerHost: ts.CompilerHost = {
    getSourceFile: (name) =>
      name === fileName
        ? ts.createSourceFile(
            name,
            snippet,
            ts.ScriptTarget.Latest,
            true,
            ts.ScriptKind.TS
          )
        : undefined,
    getDefaultLibFileName: () => "lib.d.ts",
    writeFile: () => {},
    getCurrentDirectory: () => "/",
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (name) => name === fileName,
    readFile: () => undefined,
  };

  const program = ts.createProgram(
    [fileName],
    {
      noEmit: true,
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
    compilerHost
  );

  return pipe(
    Array.from(program.getSyntacticDiagnostics()),
    A.map(
      (d) =>
        `Syntax error: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`
    )
  );
};

const validateSnippetExports = (
  snippet: string,
  exportMap: Map<string, Set<string>>
): ReadonlyArray<string> => {
  const importPattern =
    /import\s+\*\s+as\s+(\w+)\s+from\s+"effect-boxes\/(\w+)"/g;

  const aliasToModule = pipe(
    execAll(importPattern, snippet),
    A.map(
      (m): Option.Option<readonly [string, string]> =>
        m[1] && m[2] ? Option.some([m[1], m[2]] as const) : Option.none()
    ),
    A.getSomes,
    (pairs) => new Map(pairs)
  );

  return pipe(
    Array.from(aliasToModule.entries()),
    A.flatMap(([alias, moduleName]) => {
      const moduleExports = exportMap.get(moduleName);
      if (!moduleExports) {
        return [`Unknown module "effect-boxes/${moduleName}" in import.`];
      }

      const refPattern = new RegExp(`\\b${alias}\\.(\\w+)`, "g");
      const symbols = pipe(
        execAll(refPattern, snippet),
        A.map(
          (m): Option.Option<string> =>
            m[1] ? Option.some(m[1]) : Option.none()
        ),
        A.getSomes,
        (arr) => new Set(arr)
      );

      return pipe(
        Array.from(symbols),
        A.filter((symbol) => !moduleExports.has(symbol)),
        A.map(
          (symbol) =>
            `"${alias}.${symbol}" is not exported from "effect-boxes/${moduleName}".`
        )
      );
    })
  );
};

// -----------------------------------------------------------------------------
// Export map
// -----------------------------------------------------------------------------

const buildExportMap = (
  filePaths: ReadonlyArray<string>
): Map<string, Set<string>> => {
  const exportMap = new Map<string, Set<string>>();

  for (const filePath of filePaths) {
    const moduleName = basename(filePath, ".ts");
    const fileText = readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      fileText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    const exports = pipe(
      Array.from(sourceFile.statements),
      A.filter(isPublicExport),
      A.map((s) => getName(s, sourceFile)),
      A.getSomes,
      (names) => new Set(names)
    );

    exportMap.set(moduleName, exports);
  }

  return exportMap;
};

// -----------------------------------------------------------------------------
// TSDoc parser
// -----------------------------------------------------------------------------

const makeParser = (): TSDocParser => {
  const config = TSDocConfigFile.loadForFolder(ROOT);
  if (config.hasErrors) {
    throw new Error(`Failed to load tsdoc.json\n${config.getErrorSummary()}`);
  }
  const configuration = new TSDocConfiguration();
  config.configureParser(configuration);
  return new TSDocParser(configuration);
};

// -----------------------------------------------------------------------------
// JSDoc scanning - extract metadata and issues from a single JSDoc block
// -----------------------------------------------------------------------------

const scanJsDoc = (
  doc: ts.JSDoc,
  fileText: string,
  sourceFile: ts.SourceFile,
  baseLoc: IssueLocation,
  parser: TSDocParser,
  exportMap: Map<string, Set<string>>
): JsDocScanResult => {
  const start = doc.getFullStart();
  const rawDoc = fileText.slice(start, doc.getEnd());
  const context = parser.parseString(rawDoc);

  // Parse errors from TSDoc
  const parseErrors: Array<TsDocIssue> = context.log.messages.map((message) => {
    const pos = start + message.textRange.pos;
    const loc = ts.getLineAndCharacterOfPosition(sourceFile, pos);
    return {
      severity: "error" as const,
      file: baseLoc.file,
      line: loc.line + 1,
      column: loc.character + 1,
      code: message.messageId,
      message: message.unformattedText,
      name: baseLoc.name,
    };
  });

  // Collect tag presence
  const tags = doc.tags ?? [];
  const tagNames = new Set(tags.map((tag) => String(tag.tagName.escapedText)));
  const hasCategory = tagNames.has("category");
  const hasExample = tagNames.has("example");
  const hasInternal = tagNames.has("internal");

  // Extract @category values via regex
  const categories = pipe(
    execAll(/@category\s+([^\s*]+)/g, rawDoc),
    A.map(
      (m): Option.Option<string> =>
        typeof m[1] === "string" ? Option.some(m[1]) : Option.none()
    ),
    A.getSomes
  );

  // Validate code fences
  const snippetErrors = pipe(
    extractCodeFences(rawDoc),
    A.flatMap((snippet) => [
      ...validateSnippetSyntax(snippet).map(
        (msg): TsDocIssue => ({
          severity: "error",
          ...baseLoc,
          code: "DOC300",
          message: `Example code: ${msg}`,
        })
      ),
      ...validateSnippetExports(snippet, exportMap).map(
        (msg): TsDocIssue => ({
          severity: "error",
          ...baseLoc,
          code: "DOC310",
          message: `Example code: ${msg}`,
        })
      ),
    ])
  );

  return {
    hasCategory,
    hasExample,
    hasInternal,
    categories,
    issues: [...parseErrors, ...snippetErrors],
  };
};

// Merge multiple JsDocScanResults into one
const mergeJsDocResults = (
  results: ReadonlyArray<JsDocScanResult>
): JsDocScanResult => ({
  hasCategory: results.some((r) => r.hasCategory),
  hasExample: results.some((r) => r.hasExample),
  hasInternal: results.some((r) => r.hasInternal),
  categories: results.flatMap((r) => r.categories),
  issues: results.flatMap((r) => r.issues),
});

// -----------------------------------------------------------------------------
// Statement-level validation rules
// -----------------------------------------------------------------------------

const validateStatement = (
  statement: ts.Statement,
  merged: JsDocScanResult,
  loc: IssueLocation
): ReadonlyArray<TsDocIssue> => {
  const issues: Array<TsDocIssue> = [];

  // Missing @category
  if (!merged.hasCategory) {
    issues.push({
      severity: "warning",
      ...loc,
      code: "DOC110",
      message: "Missing @category tag on public export.",
    });
  }

  // Multiple @category tags
  if (merged.hasCategory && merged.categories.length > 1) {
    issues.push({
      severity: "warning",
      ...loc,
      code: "DOC111",
      message: "Multiple @category tags found on a single export.",
    });
  }

  // Missing @example on callable exports in certain categories
  const requiresExample =
    isCallableExport(statement) &&
    merged.categories.some(
      (c) => !A.contains(EXAMPLE_REQUIRED_CATEGORIES_WHITELIST, c)
    );

  if (requiresExample && !merged.hasExample) {
    issues.push({
      severity: "warning",
      ...loc,
      code: "DOC120",
      message: "Missing @example on callable public export.",
    });
  }

  // @internal on public export
  if (merged.hasInternal) {
    issues.push({
      severity: "warning",
      ...loc,
      code: "DOC130",
      message: "Public export uses @internal tag.",
    });
  }

  return issues;
};

// -----------------------------------------------------------------------------
// File scanner
// -----------------------------------------------------------------------------

const scanSourceFile = (
  filePath: string,
  parser: TSDocParser,
  exportMap: Map<string, Set<string>>
): ReadonlyArray<TsDocIssue> => {
  const fileText = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    fileText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const relativePath = filePath.slice(ROOT.length + 1).replace(/\\/g, "/");

  return pipe(
    Array.from(sourceFile.statements),
    A.filter(isPublicExport),
    A.flatMap((statement) => {
      const name = pipe(
        getName(statement, sourceFile),
        Option.getOrElse(() => "<unnamed>")
      );
      const pos = ts.getLineAndCharacterOfPosition(
        sourceFile,
        statement.getStart(sourceFile)
      );
      const loc: IssueLocation = {
        file: relativePath,
        line: pos.line + 1,
        column: pos.character + 1,
        name,
      };

      const jsDocs = getJsDocs(statement);

      if (jsDocs.length === 0) {
        return [
          {
            severity: "warning" as const,
            ...loc,
            code: "DOC100",
            message: "Missing JSDoc on public export.",
          },
        ];
      }

      const merged = mergeJsDocResults(
        jsDocs.map((doc) =>
          scanJsDoc(doc, fileText, sourceFile, loc, parser, exportMap)
        )
      );

      return [...merged.issues, ...validateStatement(statement, merged, loc)];
    })
  );
};

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------

const formatIssue = (issue: TsDocIssue): string =>
  `${issue.file}:${issue.line}:${
    issue.column
  } ${issue.severity.toUpperCase()} [${issue.code}] ${issue.message} (export: ${
    issue.name
  })`;

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

const main = Effect.gen(function* () {
  const parser = makeParser();

  const files = pipe(
    PUBLIC_MODULES,
    A.map((rel) => join(ROOT, rel)),
    A.filter(existsSync)
  );

  const issues = pipe(
    files,
    A.flatMap((f) => scanSourceFile(f, parser, buildExportMap(files))),
    A.sort(
      Order.combineAll([
        Order.mapInput(Order.String, (i: TsDocIssue) => i.file),
        Order.mapInput(Order.Number, (i: TsDocIssue) => i.line),
        Order.mapInput(Order.Number, (i: TsDocIssue) => i.column),
        Order.mapInput(Order.String, (i: TsDocIssue) => i.code),
      ])
    )
  );

  const errors = A.filter(issues, (i) => i.severity === "error");
  const warnings = A.filter(issues, (i) => i.severity === "warning");

  if (issues.length === 0) {
    yield* Console.log(
      `TSDoc check passed (${files.length} public module(s) scanned).`
    );
    return 0;
  }

  const status =
    errors.length > 0 || (STRICT && warnings.length > 0) ? "failed" : "passed";

  yield* Console.log(
    `TSDoc check ${status} with ${errors.length} error(s) and ${warnings.length} warning(s) (${files.length} public module(s) scanned).`
  );

  for (const issue of issues) {
    yield* (issue.severity === "error" ? Console.error : Console.log)(
      formatIssue(issue)
    );
  }

  if (errors.length > 0) return 1;
  if (STRICT && warnings.length > 0) return 1;
  return 0;
});

Effect.runPromise(main).then(
  (code) => process.exit(code),
  (error) => {
    console.error("TSDoc check failed:", error);
    process.exit(2);
  }
);
