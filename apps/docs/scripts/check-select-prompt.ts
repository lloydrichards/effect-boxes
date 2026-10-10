import assert from "node:assert/strict";
import ts from "typescript-6";

/** Checks the documented prompt without reading from the user's terminal. */
export const checkSelectPrompt = async (
  complete: string,
  previewModule: string,
  runExample: (code: string, expression: string) => Promise<unknown>
): Promise<void> => {
  const source = ts.createSourceFile(
    "SelectPrompt.ts",
    complete,
    ts.ScriptTarget.ES2022
  );
  const isRuntimeCall = (node: ts.Node): boolean =>
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "NodeRuntime" &&
    node.expression.name.text === "runMain";
  let runtimeCalls = 0;
  const inspect = (node: ts.Node): void => {
    if (isRuntimeCall(node)) runtimeCalls += 1;
    assert.ok(
      !ts.isAsExpression(node) &&
        !ts.isTypeAssertionExpression(node) &&
        !ts.isNonNullExpression(node) &&
        node.kind !== ts.SyntaxKind.AnyKeyword,
      "Select prompt: complete example must not bypass type checking"
    );
    ts.forEachChild(node, inspect);
  };
  inspect(source);
  const calls = source.statements.filter(
    (node) => ts.isExpressionStatement(node) && isRuntimeCall(node.expression)
  );
  assert.equal(
    runtimeCalls,
    1,
    "Select prompt: exactly one runtime call is required"
  );
  assert.equal(
    calls.length,
    1,
    "Select prompt: runtime call must be top-level"
  );
  const helpers = source.statements
    .filter((node) => !calls.includes(node))
    .map((node) => node.getFullText(source))
    .join("\n");
  assert.deepEqual(
    await runExample(helpers, "Box.renderPrettySync(renderLayout(0, false))"),
    await runExample(previewModule, "preview"),
    "Select prompt: complete example differs from the visible preview"
  );

  await runExample(
    `${helpers}
import assert from "node:assert/strict";
import { Cause, Option, Queue } from "effect";

const keyInput = (name: string): Terminal.UserInput => ({
  input: Option.none(),
  key: { name, ctrl: false, meta: false, shift: false },
});
const checkCallbacks = Effect.gen(function* () {
  assert.deepEqual(yield* handlers.process(keyInput("down"), choices.length - 1),
    Action.NextFrame({ state: 0 }));
  assert.deepEqual(yield* handlers.process(keyInput("up"), 0),
    Action.NextFrame({ state: choices.length - 1 }));
  assert.deepEqual(yield* handlers.process(keyInput("return"), 1),
    Action.Submit({ value: "vue" }));
  assert.deepEqual(yield* handlers.process(keyInput("x"), 1),
    Action.NextFrame({ state: 1 }));
  assert.deepEqual(yield* handlers.process(keyInput("return"), -1), Action.Beep());
  assert.equal(yield* handlers.render(0, Action.Beep()), "\\u0007",
    "Beep must not paint another copy of the menu");
});

const capture = <A, E>(keys: ReadonlyArray<string>, workflow: Effect.Effect<A, E, Prompt.Environment>) =>
  Effect.gen(function* () {
    const queue = yield* Queue.make<Terminal.UserInput, Cause.Done>();
    yield* Queue.offerAll(queue, keys.map(keyInput));
    yield* Queue.end(queue);
    const frames: string[] = [];
    const terminal = Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      readInput: Effect.succeed(queue),
      readLine: Effect.fail(new Terminal.QuitError({})),
      display: (text) => Effect.sync(() => { frames.push(text); }),
    });
    const value = yield* workflow.pipe(
      Effect.provideService(Terminal.Terminal, terminal)
    );
    return { value, frames };
  });

const checked = await Effect.runPromise(Effect.gen(function* () {
  yield* checkCallbacks;
  const initial = yield* handlers.render(0, Action.NextFrame({ state: 0 }));
  const clear = Box.renderPrettySync(Cmd.clearLines(renderLayout(0, false).rows + 1));
  assert.ok(initial.endsWith(Box.renderPrettySync(Cmd.cursorNextLine(1))),
    "Active prompt must leave the cursor below the menu");
  for (const [keys, cursor, value] of [
    [["down", "return"], 1, "vue"],
    [["up", "return"], 2, "svelte"],
    [["return"], 0, "react"],
    [["return"], 0, "react"],
  ] satisfies ReadonlyArray<readonly [ReadonlyArray<string>, number, string]>) {
    const result = yield* capture(keys, select);
    assert.equal(result.value, value, "Prompt loop returned the wrong choice");
    assert.equal(result.frames[0], initial, "Repeated prompt retained old render state");
    for (const redraw of result.frames.slice(1, -1)) {
      assert.ok(redraw.startsWith(clear), "Redraw must clear the previous menu and cursor row");
    }
    const submitted = yield* handlers.render(cursor, Action.Submit({ value }));
    assert.ok(result.frames.some((frame) => frame.endsWith(submitted)),
      "Prompt loop did not render the selected confirmation");
    assert.equal(result.frames.at(-1), Box.renderPrettySync(Cmd.cursorShow),
      "Prompt loop did not restore cursor visibility");
  }
  const cancelled = yield* capture([], program);
  assert.equal(cancelled.frames[0], initial);
  assert.ok(cancelled.frames.includes(Box.renderPrettySync(Cmd.cursorShow)),
    "Cancelled prompt did not restore cursor visibility");
  assert.equal(cancelled.frames.at(-1), "Cancelled.\\r\\n",
    "Ended input queue did not reach the documented cancellation handler");
  return true;
}).pipe(Effect.provide(NodeServices.layer)));
`,
    "checked"
  );
};
