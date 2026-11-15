/** @effect-diagnostics unstableApiUsage:skip-file */
import { Console, Effect, Option, Queue, Terminal } from "effect";
import * as Ansi from "effect-boxes/Ansi";
import * as Box from "effect-boxes/Box";
import * as Cmd from "effect-boxes/Cmd";

const total = 40;
const spinner = "⠋⠙⠹⠸⠼⠴⠦⠧";

const renderFrame = (size: Terminal.Size, step: number, redraw: boolean) => {
  const width = Math.min(47, Math.max(1, size.columns));
  const height = Math.min(4, Math.max(1, size.rows));
  const left = Math.floor((size.columns - width) / 2);
  const top = Math.floor((size.rows - height) / 2);
  const barRow = height >= 3 ? 1 : 0;
  const barWidth = width >= 6 ? width - 5 : width;
  const filled = Math.round((step / total) * barWidth);
  const previous = redraw ? 0 : Math.round(((step - 1) / total) * barWidth);
  const commands = redraw ? [Cmd.clearScreen] : [];
  const write = (
    col: number,
    row: number,
    text: string,
    style: Ansi.AnsiAnnotation
  ) => {
    commands.push(
      Cmd.cursorTo(left + col, top + row),
      Box.text(text).pipe(Box.annotate(style))
    );
  };

  if (redraw) {
    if (height >= 3)
      write(0, 0, "Partial Rerendering Demo".slice(0, width), Ansi.cyan);
    if (filled < barWidth)
      write(filled, barRow, "░".repeat(barWidth - filled), Ansi.white);
    if (height === 4)
      write(0, 3, "Press Ctrl+C to stop...".slice(0, width), Ansi.white);
  }
  if (filled > previous)
    write(previous, barRow, "█".repeat(filled - previous), Ansi.green);
  if (width > barWidth)
    write(
      barWidth + 1,
      barRow,
      `${Math.round((step / total) * 100)}%`.padStart(4),
      Ansi.blue
    );
  if (height >= 2) {
    write(0, barRow + 1, spinner.charAt(step % spinner.length), Ansi.blue);
    if (width >= 13) {
      if (redraw) write(2, barRow + 1, "Counter: ", Ansi.yellow);
      write(11, barRow + 1, String(step).padStart(2), Ansi.yellow);
    }
  }
  return Box.renderPrettySync(Box.combineAll(commands));
};

const animate = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;
  const sizes = yield* terminal.size;
  let size = yield* Queue.take(sizes);
  yield* Effect.acquireRelease(
    terminal.display(
      Box.renderPrettySync(Box.combine(Cmd.altScreenEnter, Cmd.cursorHide))
    ),
    () =>
      terminal
        .display(
          Box.renderPrettySync(Box.combine(Cmd.altScreenLeave, Cmd.cursorShow))
        )
        .pipe(Effect.orDie)
  );
  for (let step = 0; step <= total; step++) {
    const latest = yield* Queue.poll(sizes);
    if (Option.isSome(latest)) size = latest.value;
    yield* terminal.display(
      renderFrame(size, step, step === 0 || Option.isSome(latest))
    );
    yield* Effect.sleep("100 millis");
  }
}).pipe(Effect.scoped);

export const main = animate.pipe(
  Effect.andThen(
    Console.log(
      Box.renderPrettySync(
        Box.text("✅ Task completed successfully!").pipe(
          Box.annotate(Ansi.green)
        )
      )
    )
  )
);
