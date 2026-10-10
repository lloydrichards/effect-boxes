#!/usr/bin/env bun

import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { createProcessor } from "@mdx-js/mdx";
import { FancyAnsi, stripAnsi } from "fancy-ansi";
import remarkGfm from "remark-gfm";
import * as ts from "typescript-6";
import { visit } from "unist-util-visit";
import { prepareTerminalPreview } from "../app/lib/terminal-preview";
import { pages } from "../app/nav.config";
import { checkCmdExamples } from "./check-cmd-examples";
import { checkSelectPrompt } from "./check-select-prompt";

const docsRoot = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(docsRoot, "app/content");
const sourceRoot = path.resolve(docsRoot, "../../packages/effect-boxes/src");
const processor = createProcessor({ remarkPlugins: [remarkGfm] });
const combinedColors =
  "\u001b[0;38;2;255;255;255;48;2;23;74;120m│ blue │\u001b[0m\n\u001b[38;5;231;48;5;24m indexed \u001b[0m";
const preparedColors = prepareTerminalPreview(combinedColors);
const previewHtml = new FancyAnsi().toHtml(preparedColors);
assert.equal(stripAnsi(preparedColors), stripAnsi(combinedColors));
assert.ok(previewHtml.includes("color:rgb(255,255,255)"));
assert.ok(previewHtml.includes("background-color:rgb(23,74,120)"));
assert.ok(previewHtml.includes("background-color:rgb(0,95,135)"));
assert.ok(
  !previewHtml.includes("font-size") && !previewHtml.includes("opacity")
);
const cacheRoot = path.join(docsRoot, ".cache");
await mkdir(cacheRoot, { recursive: true });
const workDir = await mkdtemp(path.join(cacheRoot, "doc-examples-"));

const rewriteImports = (code: string): string =>
  code
    .replace(
      /(["'])effect-boxes\/(\w+)\1/g,
      (_, quote, module) =>
        `${quote}${path.join(sourceRoot, `${module}.ts`)}${quote}`
    )
    .replace(
      /(["'])effect-boxes\1/g,
      (_, quote) => `${quote}${path.join(sourceRoot, "index.ts")}${quote}`
    );

// UI imports belong to the MDX renderer, not to the runnable preview values.
const previewModule = (code: string): string => {
  const source = ts.createSourceFile(
    "preview.ts",
    code,
    ts.ScriptTarget.ES2022
  );
  return source.statements
    .filter(
      (statement) =>
        !(
          ts.isImportDeclaration(statement) &&
          ts.isStringLiteral(statement.moduleSpecifier) &&
          statement.moduleSpecifier.text.startsWith("~/")
        )
    )
    .map((statement) => statement.getFullText(source))
    .join("\n");
};

interface Document {
  code: string[];
  module: string;
}

const documents = new Map<string, Document>();
const snippets: string[] = [];
const checked: string[] = [];
const previewChecks: Array<{
  file: string;
  code: string;
  preview: string;
  result: string;
}> = [];
const pendingFiles = new Map<string, string>();
const runFile = promisify(execFile);

const findCode = (file: string, needle: string): string => {
  const document = documents.get(file);
  const code = document?.code.find((block) => block.includes(needle));
  if (!code) throw new Error(`${file}: missing example containing ${needle}`);
  return code;
};

const runExample = async (
  code: string,
  expression: string
): Promise<unknown> => {
  const file = path.join(workDir, "runtime.ts");
  await writeFile(
    file,
    `${rewriteImports(code)}\nprocess.stdout.write(JSON.stringify(${expression}));\n`
  );
  const { stdout } = await runFile(process.execPath, [file], {
    cwd: docsRoot,
    timeout: 15_000,
  });
  // Example console output precedes the final JSON line.
  const lastLine = stdout.trim().split("\n").at(-1);
  if (!lastLine) throw new Error("Example returned no output");
  return JSON.parse(lastLine);
};

try {
  for (const page of pages) {
    const relative = page.href === "/" ? "index" : page.href.slice(1);
    const file = `${relative}.mdx`;
    const content = await readFile(path.join(contentRoot, file), "utf8");
    const tree = (() => {
      try {
        return processor.parse({ value: content, path: file });
      } catch (cause) {
        throw new Error(`Could not parse ${file}`, { cause });
      }
    })();
    const code: string[] = [];
    const module: string[] = [];
    const headings: string[] = [];
    visit(tree, (node) => {
      if (
        node.type === "code" &&
        /^(ts|typescript|tsx)$/.test(node.lang ?? "")
      ) {
        assert.ok(
          !/^\s*(`{3,}|~{3,})/m.test(node.value),
          `${file}: nested code fence`
        );
        code.push(node.value);
        const snippet = path.join(
          workDir,
          `${relative.replaceAll("/", "-")}-${code.length}.ts`
        );
        snippets.push(snippet);
        // A code block is a module even when it contains no import.
        const text = `${rewriteImports(node.value)}\nexport {};\n`;
        pendingFiles.set(snippet, text);
        if (node.meta?.split(/\s+/).includes("check")) checked.push(snippet);
        const preview = node.meta?.match(/(?:^|\s)preview=(\w+)(?:\s|$)/)?.[1];
        const result = node.meta?.match(/(?:^|\s)result=(\w+)(?:\s|$)/)?.[1];
        if (preview || result) {
          assert.ok(
            preview && result,
            `${file}: preview and result are both required`
          );
          assert.ok(
            node.meta?.split(/\s+/).includes("check"),
            `${file}: preview example must be type-checked`
          );
          previewChecks.push({ file, code: node.value, preview, result });
        }
      }
      if (node.type === "mdxjsEsm") module.push(node.value);
      if (node.type === "heading" && node.depth === 1) {
        headings.push(
          node.children
            .map((child) => ("value" in child ? child.value : ""))
            .join("")
        );
      }
    });
    assert.deepEqual(
      headings,
      [page.label],
      `${file}: title differs from page metadata`
    );
    documents.set(file, { code, module: module.join("\n") });
  }

  const options: ts.CompilerOptions = {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    allowImportingTsExtensions: true,
    types: [],
    ignoreDeprecations: "6.0",
  };
  const host = ts.createCompilerHost(options);
  const read = host.readFile;
  const exists = host.fileExists;
  host.readFile = (file) => pendingFiles.get(file) ?? read(file);
  host.fileExists = (file) => pendingFiles.has(file) || exists(file);
  const program = ts.createProgram(snippets, options, host);
  const diagnostics = [
    ...program.getSyntacticDiagnostics(),
    ...checked.flatMap((file) => {
      const source = program.getSourceFile(file);
      if (!source) throw new Error(`Missing snippet ${file}`);
      return program.getSemanticDiagnostics(source);
    }),
  ];
  if (diagnostics.length) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => docsRoot,
        getNewLine: () => "\n",
      })
    );
  }

  const previewValues = new Map<string, unknown>();
  for (const comparison of previewChecks) {
    const key = `${comparison.file}:${comparison.preview}`;
    if (!previewValues.has(key)) {
      const document = documents.get(comparison.file);
      assert.ok(document, `${comparison.file}: missing preview module`);
      previewValues.set(
        key,
        await runExample(previewModule(document.module), comparison.preview)
      );
    }
    const output = await runExample(comparison.code, comparison.result);
    assert.equal(
      typeof output,
      "string",
      `${key}: example must render a string`
    );
    assert.equal(
      output,
      previewValues.get(key),
      `${key}: displayed example differs from preview`
    );
  }

  for (const [needle, expression, expected] of [
    ["const split = Flex.row", "[split.cols, split.rows]", [65, 5]],
    ["const page = Flex.col", "[page.cols, page.rows]", [65, 12]],
    [
      "const dashboard = Container.make",
      "[dashboard.cols, dashboard.rows]",
      [65, 10],
    ],
  ] as const) {
    assert.deepEqual(
      await runExample(findCode("guides/using-layout.mdx", needle), expression),
      expected,
      `Layout example dimensions: ${needle}`
    );
  }

  const html = findCode("guides/using-html.mdx", "const html =");
  assert.equal(
    await runExample(html, "html"),
    "<h1>\nHello World\n</h1>\n<p>\nWelcome to the docs.\n</p>"
  );
  assert.equal(
    await runExample(
      'import * as Box from "effect-boxes/Box"; import * as Html from "effect-boxes/Html"; import * as Renderer from "effect-boxes/Renderer"; import { Effect } from "effect"; const value = Box.text("a & b").pipe(Box.annotate(Html.div({title: "a & b"})));',
      "Effect.runSync(Box.render(value).pipe(Effect.provide(Renderer.HtmlRendererLive)))"
    ),
    '<div title="a &amp; b">\na &amp; b\n</div>'
  );
  for (const file of ["index.mdx", "getting-started.mdx"]) {
    const greeting = findCode(file, "console.log");
    const printed = await runExample(
      `const printed: unknown[] = []; const console = { log: (value: unknown): void => { printed.push(value); } };\n${greeting}`,
      "printed"
    );
    assert.ok(Array.isArray(printed), `${file}: no console output`);
    assert.equal(printed.length, 1);
    assert.equal(
      typeof printed[0],
      "string",
      `${file}: greeting must print a string`
    );
    assert.ok(printed[0].includes("Hello, World!"));
  }
  const cmdDocument = documents.get("guides/using-cmd.mdx");
  assert.ok(cmdDocument, "Missing Cmd guide");
  await checkCmdExamples(
    findCode("guides/using-cmd.mdx", "const progressFrame"),
    findCode("guides/using-cmd.mdx", "const app ="),
    runExample,
    previewModule(cmdDocument.module),
    findCode("guides/using-reactive.mdx", "NodeRuntime.runMain")
  );
  const selectDocument = documents.get("tutorials/select-prompt.mdx");
  assert.ok(selectDocument, "Missing Select prompt tutorial");
  const completeSelect = selectDocument.code.at(-1);
  assert.ok(completeSelect, "Missing complete Select prompt example");
  await checkSelectPrompt(
    completeSelect,
    previewModule(selectDocument.module),
    runExample
  );
  const progressRecipe = findCode(
    "guides/common-patterns.mdx",
    "const progressBar"
  );
  assert.deepEqual(
    await runExample(
      progressRecipe,
      "[-5, 0, 50, 200].map((progress) => Box.renderPlainSync(progressBar(progress, 100, 4)))"
    ),
    ["░░░░ 0%", "░░░░ 0%", "██░░ 50%", "████ 100%"],
    "Progress must clamp values to its allocated width"
  );
  assert.deepEqual(
    await runExample(
      progressRecipe,
      "({ noTotal: Box.renderPlainSync(progressBar(1, 0, 4)), noWidth: Box.renderPlainSync(progressBar(50, 100, 0)) })"
    ),
    { noTotal: "░░░░ 0%", noWidth: " 50%" },
    "Progress must define zero-total and zero-width behavior"
  );
  assert.deepEqual(
    await runExample(
      findCode("guides/common-patterns.mdx", "const dashboard ="),
      '({ rows: dashboard.rows, cols: dashboard.cols, activityVisible: Box.renderPlainSync(dashboard).includes("All checks passed") })'
    ),
    { rows: 12, cols: 65, activityVisible: true },
    "Dashboard must fit its dimensions and retain the activity panel"
  );
  console.log(
    `Checked ${pages.length} page titles, ${snippets.length} TypeScript fences, ${checked.length} standalone snippet types, ${previewChecks.length} declared preview comparisons, and runnable output/terminal behavior checks.`
  );
} finally {
  await rm(workDir, { recursive: true, force: true });
}
