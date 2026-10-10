import { strict as assert } from "node:assert";
import * as ts from "typescript-6";

type RunExample = (code: string, expression: string) => Promise<unknown>;

const withoutRunner = (code: string): string => {
  const source = ts.createSourceFile(
    "example.ts",
    code,
    ts.ScriptTarget.ES2022
  );
  return source.statements
    .filter(
      (statement) =>
        !(
          ts.isExpressionStatement(statement) &&
          ts.isCallExpression(statement.expression) &&
          statement.expression.expression.getText(source) ===
            "NodeRuntime.runMain"
        )
    )
    .map((statement) => statement.getFullText(source))
    .join("\n");
};

const terminalCapture = `
const writes: string[] = [];
const capturedTerminal = Terminal.make({
  columns: Effect.succeed(80),
  rows: Effect.succeed(24),
  readInput: Effect.die("Unexpected input read"),
  readLine: Effect.die("Unexpected line read"),
  display: (text) => Effect.sync(() => { writes.push(text); }),
});
`;

/** Exercise the actual documented programs with captured terminal output. */
export const checkCmdExamples = async (
  progress: string,
  screen: string,
  runExample: RunExample,
  previewModule: string,
  reactive: string
): Promise<void> => {
  const pause = 'Effect.sleep("500 millis")';
  assert.ok(progress.includes(pause), "Missing progress example pause");
  assert.ok(screen.includes(pause), "Missing full-screen example pause");

  const progressWrites = await runExample(
    `${withoutRunner(progress).replace(pause, "Effect.void")}
${terminalCapture}
await Effect.runPromise(program.pipe(Effect.provideService(Terminal.Terminal, capturedTerminal)));`,
    "writes"
  );
  assert.deepEqual(
    progressWrites,
    [
      "Downloading...\nProgress: 0%\nPlease wait",
      "\u001b[2K\u001b[1A\u001b[2K\u001b[1A\u001b[2K\u001b[GDownloading...\nProgress: 100%\nDone!",
      "\n",
    ],
    "Progress writes must replace exactly three lines without extra newlines"
  );

  assert.deepEqual(
    await runExample(
      withoutRunner(progress),
      "[Box.renderPrettySync(progressFrame(0)), Box.renderPrettySync(progressFrame(100))]"
    ),
    await runExample(previewModule, "[outProgressInitial, outProgressFinal]"),
    "Progress snapshots must match the frames written by the program"
  );
  assert.equal(await runExample(previewModule, "outScreen"), "Status: running");

  const reactiveWrites = await runExample(
    `${withoutRunner(reactive).replaceAll(pause, "Effect.void")}
${terminalCapture}
await Effect.runPromise(program.pipe(Effect.provideService(Terminal.Terminal, capturedTerminal)));`,
    "({ writes, rows: selected.rows, cols: selected.cols })"
  );
  assert.deepEqual(
    reactiveWrites,
    {
      writes: [
        "\u001b[?1049h\u001b[?25l\u001b[2J\u001b[H\u001b[H",
        "  File\n  Edit\n  View",
        "\u001b[2;1H\u001b[1m> Edit  \u001b[0m",
        "\u001b[?1049l\u001b[?25h",
      ],
      rows: 1,
      cols: 8,
    },
    "Reactive update must move to the second row and replace exactly eight columns"
  );

  for (const outcome of ["success", "failure", "interruption"] as const) {
    const body =
      outcome === "success"
        ? "Effect.void"
        : outcome === "failure"
          ? 'Effect.fail("documented body failed")'
          : "Effect.interrupt";
    const observed = await runExample(
      `import * as GuideExit from "effect/Exit";
${withoutRunner(screen).replace(pause, body)}
${terminalCapture}
const exit = await Effect.runPromiseExit(app.pipe(Effect.provideService(Terminal.Terminal, capturedTerminal)));`,
      "({ writes, succeeded: GuideExit.isSuccess(exit) })"
    );
    assert.deepEqual(
      observed,
      {
        writes: [
          "\u001b[?1049h\u001b[?25l\u001b[2J\u001b[H",
          "\u001b[HStatus: running",
          "\u001b[?1049l\u001b[?25h",
        ],
        succeeded: outcome === "success",
      },
      `Full-screen cleanup must run after ${outcome}`
    );
  }
};
