import { BunServices } from "@effect/platform-bun";
import {
  Console,
  Data,
  Effect,
  HashMap,
  Match,
  Option,
  type Terminal,
} from "effect";
import { Prompt } from "effect/cli";
import * as Ansi from "effect-boxes/Ansi";
import * as Box from "effect-boxes/Box";
import * as Cmd from "effect-boxes/Cmd";
import * as Reactive from "effect-boxes/Reactive";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type TextPromptState = {
  readonly cursor: number;
  readonly value: string;
};

// Create Action tagged enum for Prompt.custom
const Action = Data.taggedEnum<Prompt.ActionDefinition>();

// ----------------------------------------------------------------------------
// Cursor Helpers
// ----------------------------------------------------------------------------

const relativeCursorMove = <A>(
  layout: Box.Box<A>,
  reactiveId: string,
  cursorOffset = 0
): Option.Option<{ rowsUp: number; col: number }> => {
  const positions = Reactive.getPositions(layout);
  const pos = HashMap.get(positions, reactiveId);
  return Option.map(pos, (p) => ({
    rowsUp: layout.rows - p.row - 1,
    col: p.col + cursorOffset,
  }));
};

// ----------------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------------

const renderLayout = (
  state: TextPromptState,
  message: string,
  submitted: boolean
): Box.Box<Ansi.AnsiStyle | Reactive.Reactive> => {
  const prefix = submitted
    ? Box.text("✔").pipe(Box.annotate(Ansi.green))
    : Box.text("?").pipe(Box.annotate(Ansi.cyan));

  const label = Box.text(message).pipe(Box.annotate(Ansi.bold));

  if (submitted) {
    // After submission, render input on same line as message with checkmark
    return Box.hsep(
      [prefix, label, Box.text(state.value).pipe(Box.annotate(Ansi.cyan))],
      1,
      Box.top
    );
  }

  // Before submission, render input in separate box below message
  const valueDisplay = (
    state.value.length > 0
      ? Box.text(state.value).pipe(Box.annotate(Ansi.white))
      : Box.text(" ").pipe(Box.annotate(Ansi.dim))
  ).pipe(Reactive.makeReactive("input-field"));

  return Box.vcat(
    [
      Box.hsep<Ansi.AnsiStyle | Reactive.Reactive>(
        [prefix, label.pipe(Box.annotate(Ansi.cyan))],
        1,
        Box.top
      ).pipe(Box.moveRight(2)),
      Box.hsep<Ansi.AnsiStyle | Reactive.Reactive>(
        [Box.char(">"), valueDisplay],
        1,
        Box.top
      ).pipe(
        Box.alignHoriz(Box.left, 60),
        Box.pad(0, 1),
        Box.border("rounded")
      ),
      Box.punctuateH(
        [Box.text("←/→ cursor"), Box.text("enter to submit")],
        Box.left,
        Box.text(" • ")
      ).pipe(Box.moveRight(2), Box.annotate(Ansi.dim)),
    ],

    Box.left
  );
};

// ----------------------------------------------------------------------------
// BoxInput using Prompt.custom
// ----------------------------------------------------------------------------

export const BoxInput = ({
  message,
  default: defaultValue = "",
}: Prompt.TextOptions): Prompt.Prompt<string> => {
  const initialState: TextPromptState = {
    cursor: defaultValue.length,
    value: defaultValue,
  };

  return Prompt.Custom<TextPromptState, string>(initialState, {
    render: Effect.fnUntraced(function* (
      state: TextPromptState,
      action: Prompt.Action<TextPromptState, string>
    ) {
      const rendered = yield* Action.$match(action, {
        Beep: () => Effect.succeed(Box.nullBox),

        NextFrame: Effect.fnUntraced(function* ({ state: nextState }) {
          const layout = renderLayout(nextState, message, false);
          const move = relativeCursorMove(
            layout,
            "input-field",
            nextState.cursor
          );

          if (Option.isSome(move)) {
            return Box.combineAll([
              layout,
              Cmd.cursorPrevLine(move.value.rowsUp),
              Cmd.cursorForward(move.value.col),
            ]);
          }
          return layout;
        }),

        Submit: Effect.fnUntraced(function* ({ value }) {
          return renderLayout({ ...state, value }, message, true).pipe(
            Box.vAppend<Ansi.AnsiStyle | Reactive.Reactive>(Box.text(""))
          );
        }),
      });

      return yield* Box.renderPretty(rendered);
    }),

    process: Effect.fnUntraced(function* (
      input: Terminal.UserInput,
      state: TextPromptState
    ) {
      return Match.value(input.key.name).pipe(
        Match.when("backspace", () => {
          if (state.cursor <= 0) return Action.Beep();
          const before = state.value.slice(0, state.cursor - 1);
          const after = state.value.slice(state.cursor);
          return Action.NextFrame({
            state: { cursor: state.cursor - 1, value: before + after },
          });
        }),
        Match.when("left", () => {
          if (state.cursor <= 0) return Action.Beep();
          return Action.NextFrame({
            state: { ...state, cursor: state.cursor - 1 },
          });
        }),
        Match.when("right", () => {
          if (state.cursor >= state.value.length) return Action.Beep();
          return Action.NextFrame({
            state: { ...state, cursor: state.cursor + 1 },
          });
        }),
        Match.whenOr("enter", "return", () =>
          Action.Submit({ value: state.value })
        ),
        Match.orElse(() => {
          if (Option.isSome(input.input) && input.input.value.length === 1) {
            const char = input.input.value;
            const before = state.value.slice(0, state.cursor);
            const after = state.value.slice(state.cursor);
            return Action.NextFrame({
              state: {
                cursor: state.cursor + 1,
                value: before + char + after,
              },
            });
          }
          return Action.Beep();
        })
      );
    }),

    clear: Effect.fnUntraced(function* (
      state: TextPromptState,
      _action: Prompt.Action<TextPromptState, string>
    ) {
      const layout = renderLayout(state, message, false);
      const move = relativeCursorMove(layout, "input-field", state.cursor);

      return yield* Box.renderPretty(
        Option.isSome(move)
          ? Box.combine(
              Cmd.cursorNextLine(move.value.rowsUp),
              Cmd.clearLines(layout.rows)
            )
          : Cmd.clearLines(layout.rows)
      );
    }),
  });
};

// ----------------------------------------------------------------------------
// Demo
// ----------------------------------------------------------------------------

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
