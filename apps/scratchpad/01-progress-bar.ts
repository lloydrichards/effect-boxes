import { Clock, Console, Effect, Option, Queue, Terminal } from "effect";
import * as Ansi from "effect-boxes/Ansi";
import * as Box from "effect-boxes/Box";
import * as Cmd from "effect-boxes/Cmd";
import * as Reactive from "effect-boxes/Reactive";

const total = 1000;

const progressRow = (counter: number, width: number) => {
  const ratio = counter / total;
  const label = `${Math.round(ratio * 100)}%`.padStart(4);
  const showLabel = width >= 6;
  const barWidth = showLabel ? width - 5 : width;
  const filled = Math.round(ratio * barWidth);
  const color =
    counter === total
      ? Ansi.green
      : Ansi.colorRGB(
          Math.round(255 * (1 - ratio)),
          Math.round(255 * ratio),
          0
        );
  return Box.hcat(
    [
      Box.text("█".repeat(filled)).pipe(Box.annotate(color)),
      Box.text("░".repeat(barWidth - filled)),
      Box.text(showLabel ? ` ${label}` : "").pipe(Box.annotate(Ansi.blue)),
    ],
    Box.top
  );
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

  let positions: Reactive.PositionMap | undefined;
  for (let counter = 0; counter <= total; counter++) {
    const latest = yield* Queue.poll(sizes);
    if (
      Option.isSome(latest) &&
      (latest.value.columns !== size.columns || latest.value.rows !== size.rows)
    ) {
      size = latest.value;
      positions = undefined;
    }
    const framed = size.columns >= 10 && size.rows >= 3;
    const width = Math.max(1, size.columns);
    const bar = progressRow(counter, framed ? width - 2 : width);
    const barHeight = framed ? 3 : 1;
    const now = yield* Clock.currentTimeMillis;
    const status = counter === total ? "completed" : "running";
    const statusLine = Box.text(
      `Counter: ${counter}  |  Status: ${status}  |  ${new Date(now).toLocaleTimeString()}`.slice(
        0,
        width
      )
    );

    if (!positions) {
      const row = bar.pipe(Reactive.makeReactive("progress-bar"));
      const lines = [framed ? row.pipe(Box.border("rounded")) : row];
      if (size.rows > barHeight)
        lines.push(statusLine.pipe(Reactive.makeReactive("status-bar")));
      if (size.rows > barHeight + 1)
        lines.push(Box.text("Press Ctrl+C to stop...".slice(0, width)));
      const layout = Box.vcat(lines, Box.left);
      positions = Reactive.getPositions(layout);
      yield* terminal.display(
        Box.renderPrettySync(Cmd.clearScreen) + Box.renderPrettySync(layout)
      );
    } else {
      const updates = [];
      for (const [id, content] of [
        ["progress-bar", bar],
        ["status-bar", statusLine],
      ] as const) {
        const cursor = Reactive.cursorToReactive(positions, id);
        if (Option.isSome(cursor)) {
          updates.push(cursor.value);
          if (id === "status-bar") updates.push(Cmd.eraseLine);
          updates.push(content);
        }
      }
      yield* terminal.display(Box.renderPrettySync(Box.combineAll(updates)));
    }
    if (counter < total) yield* Effect.sleep("10 millis");
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
