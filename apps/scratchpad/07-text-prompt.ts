/** @effect-diagnostics unstableApiUsage:skip-file */
import { BunServices } from "@effect/platform-bun";
import {
  Console,
  Data,
  Effect,
  HashMap,
  Option,
  Queue,
  Stream,
  Terminal,
} from "effect";
import { Prompt } from "effect/cli";
import * as Ansi from "effect-boxes/Ansi";
import * as Box from "effect-boxes/Box";
import * as Cmd from "effect-boxes/Cmd";
import { Place } from "effect-boxes/Layout";
import * as Reactive from "effect-boxes/Reactive";

const Action = Data.taggedEnum<Prompt.ActionDefinition>();
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const splitGraphemes = (value: string) =>
  Array.from(segmenter.segment(value), (part) => part.segment);

type TextPromptState = {
  readonly glyphs: readonly string[];
  readonly cursor: number; // insertion index between graphemes
  readonly leftColumn: number; // first terminal cell in the viewport
  readonly size: Terminal.Size;
};

const bordered = (size: Terminal.Size) => size.columns >= 10 && size.rows >= 5;
const fieldWidth = (size: Terminal.Size) =>
  Math.max(1, size.columns - (bordered(size) ? 6 : 0));

function fitCursor(state: TextPromptState): TextPromptState {
  const { glyphs, cursor, size } = state;
  const width = fieldWidth(size);
  const col = Box.line(glyphs.slice(0, cursor).join("")).cols;
  const caretWidth = Math.min(
    width,
    Math.max(1, Box.line(glyphs[cursor] ?? "").cols)
  );
  const leftColumn = Math.max(
    0,
    col + caretWidth - width,
    Math.min(state.leftColumn, col, Box.line(glyphs.join("")).cols + 1 - width)
  );
  return { ...state, leftColumn };
}

function edit(
  state: TextPromptState,
  from: number,
  to: number,
  insert: string
) {
  const before = state.glyphs.slice(0, from).join("") + insert;
  // Inserting or removing text can join graphemes across the edit.
  const glyphs = splitGraphemes(before + state.glyphs.slice(to).join(""));
  let offset = 0;
  let cursor = 0;
  for (const glyph of glyphs) {
    if (offset >= before.length) break;
    offset += glyph.length;
    cursor++;
  }
  return Action.NextFrame({ state: fitCursor({ ...state, glyphs, cursor }) });
}

function processInput(
  input: Prompt.ProcessInput<Terminal.Size>,
  state: TextPromptState
): Prompt.Action<TextPromptState, string> {
  if (input._tag === "Event") {
    return Action.NextFrame({
      state: fitCursor({ ...state, size: input.value }),
    });
  }
  const { glyphs, cursor } = state;
  const previous = Math.max(0, cursor - 1);
  const next = Math.min(glyphs.length, cursor + 1);
  const moveTo = (target: number) =>
    Action.NextFrame({ state: fitCursor({ ...state, cursor: target }) });
  switch (input.input.key.name) {
    case "left":
      return moveTo(previous);
    case "right":
      return moveTo(next);
    case "home":
      return moveTo(0);
    case "end":
      return moveTo(glyphs.length);
    case "backspace":
      return edit(state, previous, cursor, "");
    case "delete":
      return edit(state, cursor, next, "");
    case "enter":
    case "return":
      return Action.Submit({ value: glyphs.join("") });
    default: {
      const text = Option.getOrElse(input.input.input, () => "");
      if (
        !text ||
        input.input.key.ctrl ||
        input.input.key.meta ||
        /\p{Cc}/u.test(text)
      )
        return Action.Beep();
      return edit(state, cursor, cursor, text);
    }
  }
}

function renderEditor(state: TextPromptState, message: string) {
  const { size, glyphs, cursor, leftColumn } = state;
  const width = fieldWidth(size);
  const field = Box.line(glyphs.join("")).pipe(
    Box.cropWidth(leftColumn, width),
    Box.alignHoriz(Box.left, width),
    Reactive.makeReactive("input-field")
  );
  const label = Box.line(`? ${message}`).pipe(
    Box.annotate(Ansi.cyan),
    Place.horizontal(size.columns, "left")
  );
  const row = bordered(size)
    ? Box.hsep([Box.char(">"), field], 1, Box.top).pipe(
        Box.pad(0, 1),
        Box.border("rounded")
      )
    : field;
  const lines = size.rows >= 2 ? [label, row] : [row];
  const layout = Box.vcat(
    [
      ...lines,
      ...(bordered(size)
        ? [
            Box.line("←/→ move · Home/End · Enter submit").pipe(
              Box.annotate(Ansi.dim),
              Place.horizontal(size.columns, "left")
            ),
          ]
        : []),
    ],
    Box.left
  );
  const position = Option.getOrThrow(
    HashMap.get(Reactive.getPositions(layout), "input-field")
  );
  const caret =
    position.col + Box.line(glyphs.slice(0, cursor).join("")).cols - leftColumn;
  return (
    Box.renderPrettySync(Cmd.clearScreen) +
    Box.renderPrettySync(layout).replaceAll("\n", "\r\n") +
    Box.renderPrettySync(Cmd.cursorTo(caret, position.row))
  );
}

export const BoxInput = ({
  message,
  default: defaultValue = "",
}: Prompt.TextOptions) =>
  Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal;
    const value = yield* Effect.gen(function* () {
      const sizes = yield* terminal.size;
      const size = yield* Queue.take(sizes);
      const changes = yield* Queue.sliding<Terminal.Size>(1);
      yield* Stream.fromQueue(sizes).pipe(
        Stream.runForEach((next) => Queue.offer(changes, next)),
        Effect.forkScoped
      );
      yield* Effect.acquireRelease(
        terminal.display(
          Box.renderPrettySync(Box.combine(Cmd.altScreenEnter, Cmd.cursorShow))
        ),
        () =>
          terminal
            .display(
              Box.renderPrettySync(
                Box.combine(Cmd.altScreenLeave, Cmd.cursorShow)
              )
            )
            .pipe(Effect.orDie)
      );
      const glyphs = splitGraphemes(defaultValue);
      const initial = fitCursor({
        glyphs,
        cursor: glyphs.length,
        leftColumn: 0,
        size,
      });
      return yield* Prompt.Custom<TextPromptState, string, Terminal.Size>(
        initial,
        changes,
        {
          render: (_, action) =>
            Effect.sync(() =>
              action._tag === "NextFrame"
                ? renderEditor(action.state, message)
                : ""
            ),
          process: (input, state) => Effect.succeed(processInput(input, state)),
          clear: () => Effect.succeed(""),
        }
      );
    }).pipe(Effect.scoped);
    yield* terminal.display(
      `${Box.renderPrettySync(
        Box.hsep(
          [
            Box.line("✔").pipe(Box.annotate(Ansi.green)),
            Box.line(message).pipe(Box.annotate(Ansi.bold)),
            Box.line(value).pipe(Box.annotate(Ansi.cyan)),
          ],
          1,
          Box.top
        )
      )}\n`
    );
    return value;
  });

export const main = Effect.gen(function* () {
  const name = yield* BoxInput({ message: "What is your name?" });
  const food = yield* BoxInput({
    message: "What is your favorite food?",
    default: "Pizza",
  });

  yield* Console.log(
    Box.renderPrettySync(
      Box.combineAll([
        Box.text("Hello "),
        Box.text(name).pipe(Box.annotate(Ansi.green)),
        Box.text("! Your favorite food is "),
        Box.text(food).pipe(Box.annotate(Ansi.green)),
      ]).pipe(Box.pad(1, 2), Box.border("rounded"))
    )
  );
}).pipe(Effect.provide(BunServices.layer));
