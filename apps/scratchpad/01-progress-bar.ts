import {
  Array,
  Clock,
  Effect,
  Option,
  pipe,
  Ref,
  Schedule,
  Stream,
  Terminal,
} from "effect";
import * as Ansi from "effect-boxes/Ansi";
import * as Box from "effect-boxes/Box";
import * as Cmd from "effect-boxes/Cmd";
import { Container, Flex } from "effect-boxes/Layout";
import * as Reactive from "effect-boxes/Reactive";

const display = (msg: string) => Effect.sync(() => process.stdout.write(msg));

const StatusBar = (
  status: string,
  counter: number,
  time: string,
  width: number
) =>
  Flex.row(
    [
      Flex.fixed(Box.text(`Status: ${status}`)),
      Flex.fixed(Box.text("  |  ")),
      Flex.fixed(Box.text(`Counter: ${counter}`)),
      Flex.fixed(Box.text("  |  ")),
      Flex.fixed(Box.text(`⏰ ${time}`)),
    ],
    width
  );

const ProgressBar = (progress: number, total: number, width: number) => {
  const ratio = Math.min(Math.max(progress / total, 0), 1);
  const filledLength = Math.round(ratio * width);
  const emptyLength = width - filledLength;

  const r = Math.round(255 * (1 - ratio));
  const g = Math.round(255 * ratio);
  const progressColor =
    progress === total ? Ansi.green : Ansi.colorRGB(r, g, 0);

  const filledBar = Box.text("█".repeat(filledLength)).pipe(
    Box.annotate(progressColor)
  );
  const emptyBar = Box.text("░".repeat(emptyLength));
  return pipe(
    filledBar,
    Box.hAppend<Ansi.AnsiStyle>(emptyBar),
    Box.truncate(width, Box.left)
  );
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

export const main = Effect.gen(function* () {
  // Clear screen and hide cursor for cleaner output
  yield* display(
    Box.renderPrettySync(Box.combine(Cmd.clearScreen, Cmd.cursorHide))
  );

  const terminal = yield* Terminal.Terminal;

  const Complete = 1000;
  const ContainerWidth = (yield* terminal.columns) - 2;
  // For reactive updates, pre-compute the progress bar width matching Container's inner math
  // Container padding [1,2] => innerWidth = 85 - 2(border) - 2*2(padding) = 79
  // percentBox = 5 + 2(border) = 7, gap = 2
  const ProgressBarInnerWidth = ContainerWidth - 2 - 4 - 7 - 2;

  const counterRef = yield* Ref.make(0);

  // First, create the display layout (what the user sees)
  const buildDisplayLayout = (counter: number, timestamp: number) => {
    const progress = Math.min(counter, Complete);
    const percentage = Math.round((progress / Complete) * 100);
    const timeStr = formatTime(timestamp);
    const status = counter >= Complete ? "completed" : "running";

    const top = Container.make(
      { width: ContainerWidth, padding: [1, 2] },
      (ctx) => {
        const percentBox = Box.text(
          `${percentage.toString().padStart(3)}%`
        ).pipe(
          Box.alignHoriz(Box.right, 5),
          Box.annotate(percentage === 100 ? Ansi.green : Ansi.blue),
          Reactive.makeReactive("percentage"),
          Box.border("rounded", {
            annotation: Ansi.green,
            sides: { left: false },
          })
        );
        // progress bar fills remaining space after percentage box
        const barWidth = ctx.innerWidth - Box.cols(percentBox) - 2;
        return Flex.row(
          [
            Flex.fixed(
              ProgressBar(counter, Complete, barWidth).pipe(
                Reactive.makeReactive("progress-bar"),
                Box.border("single")
              )
            ),
            Flex.fixed(percentBox),
          ],
          ctx.innerWidth,
          { align: Box.center1 }
        );
      }
    ).pipe(Box.border("rounded", { sides: { bottom: false } }));

    const bottom = Container.make({ width: ContainerWidth }, (ctx) =>
      StatusBar(status, counter, timeStr, ctx.innerWidth).pipe(
        Box.alignHoriz(Box.center1, ctx.innerWidth),
        Reactive.makeReactive("status-bar")
      )
    ).pipe(Box.border("single"));

    const footer = Flex.row(
      [
        Flex.fixed(Box.text("Press")),
        Flex.fixed(Box.text(" ")),
        Flex.fixed(Box.text("Ctrl+C").pipe(Box.annotate(Ansi.blue))),
        Flex.fixed(Box.text(" ")),
        Flex.fixed(Box.text("to stop...")),
      ],
      ContainerWidth
    );

    const layout = Box.vcat([top, bottom], Box.left);
    return Box.punctuateV([layout, footer], Box.top, Box.char(" "));
  };

  // Display the initial layout
  const initialTimestamp = yield* Clock.currentTimeMillis;
  const initialLayout = buildDisplayLayout(0, initialTimestamp);
  yield* display(Box.renderPrettySync(initialLayout));
  const positionMap = Reactive.getPositions(initialLayout);

  const tickStream = Stream.fromEffectRepeat(
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const counter = yield* Ref.updateAndGet(counterRef, (n) => n + 1);
      return { counter, timestamp: now };
    })
  ).pipe(
    Stream.schedule(Schedule.spaced("10 milli")),
    Stream.takeUntil(({ counter }) => counter >= Complete)
  );

  // Process each tick with dynamic updates using reactive positions
  yield* Stream.runForEach(tickStream, ({ counter, timestamp }) =>
    Effect.gen(function* () {
      const progress = Math.min(counter, Complete);
      const percentage = Math.round((progress / Complete) * 100);
      const timeStr = formatTime(timestamp);
      const status = counter >= Complete ? "completed" : "running";

      // Create update commands using position map and Array.filterMap
      const updates = pipe(
        [
          pipe(
            positionMap,
            Reactive.cursorToReactive("progress-bar"),
            Option.map((cursorCmd) => [
              cursorCmd,
              ProgressBar(counter, Complete, ProgressBarInnerWidth),
            ])
          ),
          pipe(
            positionMap,
            Reactive.cursorToReactive("percentage"),
            Option.map((cursorCmd) => [
              cursorCmd,
              Box.text(`${percentage.toString().padStart(3)}%`).pipe(
                Box.truncate(5, Box.right),
                Box.alignHoriz(Box.right, 5),
                Box.annotate(percentage === 100 ? Ansi.green : Ansi.blue)
              ),
            ])
          ),
          pipe(
            positionMap,
            Reactive.cursorToReactive("status-bar"),
            Option.map((cursorCmd) => [
              cursorCmd,
              StatusBar(status, counter, timeStr, ContainerWidth - 2).pipe(
                Box.truncate(ContainerWidth - 2, Box.center1),
                Box.alignHoriz(Box.center1, ContainerWidth - 2)
              ),
            ])
          ),
        ],
        // Filter out None values and flatten the update commands
        Array.filter(Option.isSome),
        Array.map((option) => option.value),
        Array.flatten
      );

      // Render all updates if we have any
      if (updates.length > 0) {
        yield* display(Box.renderPrettySync(Box.combineAll(updates)));
      }
    })
  );

  // Final completion message
  yield* display(
    pipe(
      Cmd.cursorShow,
      Box.combine(
        Box.text("✅ Task completed successfully!\n").pipe(
          Box.annotate(Ansi.green),
          Box.alignVert(Box.bottom, 5)
        )
      ),
      Box.renderPrettySync
    )
  );
});
