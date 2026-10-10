/** @effect-diagnostics unstableApiUsage:skip-file */
import { Data, Effect, Queue, Schedule, Terminal } from "effect";
import { Prompt } from "effect/cli";
import * as Ansi from "effect-boxes/Ansi";
import * as Box from "effect-boxes/Box";
import * as Cmd from "effect-boxes/Cmd";
import { Layer, Stack } from "effect-boxes/Layout";
import * as Renderer from "effect-boxes/Renderer";

const palette = {
  text: Ansi.colorHex("#DCE5EF"),
  muted: Ansi.colorHex("#8493A5"),
  road: Ansi.colorHex("#A4B0BF"),
  frog: Ansi.colorHex("#B5EE87"),
  grass: Ansi.colorHex("#8EC49B"),
  water: Ansi.colorHex("#79BED6"),
  amber: Ansi.colorHex("#F2C879"),
  coral: Ansi.colorHex("#EF8B92"),
  cyan: Ansi.colorHex("#7DCDD6"),
  lilac: Ansi.colorHex("#C3A5EB"),
  roadBackground: Ansi.bgColorHex("#293341"),
  grassBackground: Ansi.bgColorHex("#173D2B"),
  waterBackground: Ansi.bgColorHex("#143B56"),
  dialogBackground: Ansi.bgColorHex("#172231"),
};

const width = 60;
const height = 17;
const carWidth = 6;
const period = width + carWidth;
const lanes = [
  { row: 3, direction: 1, offset: 0, style: palette.amber },
  { row: 6, direction: -1, offset: 8, style: palette.coral },
  { row: 9, direction: 1, offset: 16, style: palette.cyan },
  { row: 12, direction: -1, offset: 24, style: palette.lilac },
] as const;

export interface SceneState {
  readonly x: number;
  readonly y: number;
  readonly tick: number;
  readonly frogZ: -2 | 0 | 2 | 6;
  readonly debug: boolean;
  readonly paused: boolean;
  readonly outcome: "playing" | "lost" | "won";
}

export const initialState: SceneState = {
  x: 30,
  y: 15,
  tick: 0,
  frogZ: 2,
  paused: true,
  debug: false,
  outcome: "playing",
};
const nextDepth = (depth: SceneState["frogZ"]): SceneState["frogZ"] =>
  depth === -2 ? 0 : depth === 0 ? 2 : depth === 2 ? 6 : -2;
const depthLabel = (depth: SceneState["frogZ"]): string =>
  depth === -2
    ? "Below terrain"
    : depth === 0
      ? "Below cars"
      : depth === 2
        ? "Above cars"
        : "Above dialog";

const Action = Data.taggedEnum<Prompt.ActionDefinition>();

const carsAt = (tick: number) =>
  lanes.flatMap((lane) => {
    const phase =
      (((lane.offset + lane.direction * tick) % period) + period) % period;
    return [0, 22, 44].map((offset) => ({
      x: ((phase + offset) % period) - carWidth,
      y: lane.row,
      style: lane.style,
    }));
  });

const settle = (state: SceneState): SceneState => {
  if (state.outcome !== "playing") return state;
  const hazards = carsAt(state.tick);
  const hit = hazards.some(
    (car) =>
      car.y === state.y && state.x < car.x + carWidth && state.x + 3 > car.x
  );
  return {
    ...state,
    outcome: hit && !state.debug ? "lost" : state.y === 0 ? "won" : "playing",
  };
};

const ground = Box.vcat(
  Array.from({ length: height }, (_, row) => {
    const grass = row === 0 || row >= 13;
    const river = row === 1 || row === 2;
    const content =
      row === 0
        ? `${"─".repeat(27)} GOAL ${"─".repeat(27)}`
        : row === height - 1
          ? `${"─".repeat(26)} START ${"─".repeat(27)}`
          : river
            ? `${"~ ".repeat(13)}│──────│${" ~".repeat(13)}`
            : grass
              ? "  ,  ".repeat(12)
              : lanes.some((lane) => lane.row === row)
                ? "─── ".repeat(width / 4)
                : " ".repeat(width);
    return Box.text(content).pipe(
      Box.annotate(
        Ansi.combine(
          grass ? palette.grass : river ? palette.water : palette.road,
          grass
            ? palette.grassBackground
            : river
              ? palette.waterBackground
              : palette.roadBackground
        )
      )
    );
  }),
  Box.left
);

export const scene = (state: SceneState): Stack<Ansi.AnsiStyle> => {
  const cars = carsAt(state.tick).map((car) =>
    Layer.make(
      Box.text("[o==o]").pipe(
        Box.annotate(Ansi.combine(car.style, palette.roadBackground))
      ),
      {
        x: car.x,
        y: car.y,
        z: 1,
      }
    )
  );
  const popover = Box.vcat(
    [
      Box.text(state.outcome === "won" ? "Winner" : "Game Over"),
      Box.text(
        state.outcome === "won"
          ? "You crossed every lane!"
          : "A car hit the frog."
      ),
      Box.text("Arrows + z: inspect layers"),
      Box.text("Enter or r: play again"),
      Box.text("q: exit"),
    ],
    Box.left
  ).pipe(
    Box.pad(1, 2),
    Box.border("rounded"),
    Box.annotate(
      Ansi.combine(
        state.outcome === "won" ? palette.frog : palette.coral,
        Ansi.bold,
        palette.dialogBackground
      )
    )
  );
  return Stack.make(
    [
      Layer.make(
        Box.text("o_o").pipe(
          Box.annotate(
            Ansi.combine(
              palette.frog,
              Ansi.bold,
              state.y >= 13 || state.y === 0
                ? palette.grassBackground
                : state.y <= 2
                  ? palette.waterBackground
                  : palette.roadBackground
            )
          )
        ),
        {
          x: state.x,
          y: state.y,
          z: state.frogZ,
        }
      ),
      Layer.make(ground, { z: -1 }),
      ...cars,
      ...(state.outcome === "playing"
        ? []
        : [
            Layer.make(popover, {
              x: Math.floor((width - popover.cols) / 2),
              y: Math.floor((height - popover.rows) / 2),
              z: 5,
            }),
          ]),
    ],
    { width, height }
  );
};

// Static sheets show draw order without duplicating the game animation.
export const layerDiagram = (state: SceneState): Box.Box<Ansi.AnsiStyle> => {
  const planes = [
    {
      name: "Popover",
      z: 5,
      style: state.outcome === "playing" ? palette.muted : palette.amber,
    },
    {
      name: "Frog",
      z: state.frogZ,
      style: Ansi.combine(palette.frog, Ansi.bold),
    },
    { name: "Cars", z: 1, style: palette.cyan },
    { name: "Terrain", z: -1, style: palette.muted },
  ].sort((self, that) => that.z - self.z);
  const canvas = Array.from({ length: 19 }, () =>
    Array.from({ length: 40 }, () => ({ char: " ", style: palette.muted }))
  );
  const write = (
    x: number,
    y: number,
    text: string,
    style: Ansi.AnsiAnnotation
  ) => {
    for (const [offset, char] of [...text].entries()) {
      const row = canvas[y];
      if (row && x + offset < 40) row[x + offset] = { char, style };
    }
  };
  for (let rank = planes.length - 1; rank >= 0; rank--) {
    const plane = planes[rank];
    if (!plane) continue;
    const x = 0;
    const y = rank * 4;
    write(x + 4, y, `╭${"─".repeat(20)}╮`, plane.style);
    write(x + 3, y + 1, `╱${" ".repeat(20)}╱`, plane.style);
    write(x + 2, y + 2, `╰${"─".repeat(20)}╯`, plane.style);
    if (rank < planes.length - 1) {
      write(x + 4, y + 3, "│", palette.muted);
      write(x + 23, y + 3, "│", palette.muted);
    }
    const symbol =
      plane.name === "Frog"
        ? "●"
        : plane.name === "Cars"
          ? "▪ ▪ ▪"
          : plane.name === "Terrain"
            ? "┄┄┄┄┄┄┄"
            : state.outcome === "won"
              ? "Winner"
              : state.outcome === "lost"
                ? "Game Over"
                : "";
    write(x + 10, y + 1, symbol, plane.style);
    write(28, y + 1, `${plane.name} z=${plane.z}`, plane.style);
    if (plane.name === "Popover" && state.outcome === "playing")
      write(28, y + 2, "(inactive)", plane.style);
  }
  return Box.vcat(
    canvas.map((row) =>
      Box.hcat(
        row.map((cell) => Box.text(cell.char).pipe(Box.annotate(cell.style))),
        Box.top
      )
    ),
    Box.left
  );
};

export const processInput = (
  input: Prompt.ProcessInput<void>,
  state: SceneState
): Prompt.Action<SceneState, void> => {
  if (input._tag === "Event") {
    return Action.NextFrame({
      state:
        state.paused || state.outcome !== "playing"
          ? state
          : settle({ ...state, tick: (state.tick + 1) % period }),
    });
  }
  const key = input.input.key.name;
  if (state.outcome !== "playing") {
    if (key === "r" || key === "return" || key === "enter") {
      return Action.NextFrame({ state: initialState });
    }
  }
  switch (key) {
    case "q":
    case "escape":
      return Action.Submit({ value: undefined });
    case "up":
      return Action.NextFrame({
        state: settle({ ...state, y: Math.max(0, state.y - 1) }),
      });
    case "down":
      return Action.NextFrame({
        state: settle({ ...state, y: Math.min(height - 1, state.y + 1) }),
      });
    case "left":
      return Action.NextFrame({
        state: settle({ ...state, x: Math.max(0, state.x - 1) }),
      });
    case "right":
      return Action.NextFrame({
        state: settle({ ...state, x: Math.min(width - 3, state.x + 1) }),
      });
    case "z":
      return Action.NextFrame({
        state: settle({
          ...state,
          frogZ: nextDepth(state.frogZ),
        }),
      });
    case "return":
    case "enter":
    case "space":
      return Action.NextFrame({ state: { ...state, paused: !state.paused } });
    case "d":
      return Action.NextFrame({ state: { ...state, debug: !state.debug } });
    case "r":
      return Action.NextFrame({ state: initialState });
    default:
      return Action.Beep();
  }
};

export const renderScene = (state: SceneState) =>
  Effect.gen(function* () {
    const frame = yield* Renderer.frame(scene(state), {
      preserveWhitespace: true,
    });
    const board = Box.vcat(
      [
        Box.text(
          state.outcome !== "playing"
            ? "Round finished - arrows + z still work"
            : state.paused
              ? "PAUSED - press Space or Enter to start"
              : "PLAYING - reach GOAL; Space or Enter pauses"
        ).pipe(
          Box.annotate(
            Ansi.combine(Ansi.bold, state.paused ? palette.amber : palette.frog)
          )
        ),
        Box.text(frame.output).pipe(
          Box.border("rounded", { annotation: palette.muted })
        ),
      ],
      Box.left
    );
    const diagram = Box.vcat(
      [
        Box.text("Layer stack: higher z draws on top").pipe(
          Box.annotate(Ansi.combine(palette.text, Ansi.bold))
        ),
        layerDiagram(state),
      ],
      Box.left
    );
    const output = Box.vcat(
      [
        Box.text("Frogger: play the board, inspect the stack").pipe(
          Box.annotate(Ansi.combine(palette.text, Ansi.bold))
        ),
        Box.hsep([board, diagram], 3, Box.top),
        Box.text(
          "Play: arrows move | Space / Enter pause | r restart | q / Esc exit"
        ),
        Box.text(
          `Inspect: z cycles draw order | d: collisions ${state.debug ? "OFF" : "ON"} | Higher z does not prevent collisions.`
        ),
        Box.text(
          `Frog: ${depthLabel(state.frogZ)} (z=${state.frogZ}) | Next: ${depthLabel(nextDepth(state.frogZ))} (z=${nextDepth(state.frogZ)})`
        ).pipe(Box.annotate(Ansi.combine(palette.frog, Ansi.bold))),
        Box.text(
          "Terrain includes grass, road and river. River and bridge are scenery."
        ).pipe(Box.annotate(palette.muted)),
      ],
      Box.left
    );
    return Box.renderPrettySync(output);
  }).pipe(Effect.provide(Renderer.AnsiRendererLive));

export const main = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;
  const columns = yield* terminal.columns;
  const rows = yield* terminal.rows;
  const preview = Box.text(yield* renderScene(initialState));
  const requiredColumns = preview.cols + 1;
  const requiredRows = preview.rows + 1;
  if (columns < requiredColumns || rows < requiredRows) {
    yield* terminal.display(
      `Resize to at least ${requiredColumns} columns and ${requiredRows} rows, then run again.\n`
    );
    return;
  }
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
  const ticks = yield* Queue.sliding<void>(1);
  yield* Queue.offer(ticks, undefined).pipe(
    Effect.repeat(Schedule.spaced("200 millis")),
    Effect.forkScoped
  );
  yield* Prompt.Custom<SceneState, void, void>(
    initialState,
    Queue.asDequeue(ticks),
    {
      render: (_state, action) =>
        Action.$match(action, {
          Beep: () => Effect.succeed(""),
          NextFrame: ({ state }) =>
            renderScene(state).pipe(
              Effect.map(
                (output) =>
                  Box.renderPrettySync(Cmd.home) +
                  output
                    .split("\n")
                    .join(`${Box.renderPrettySync(Cmd.eraseEndLine)}\n`) +
                  Box.renderPrettySync(Cmd.eraseEndLine)
              ),
              Effect.orDie
            ),
          Submit: () => Effect.succeed(""),
        }),
      process: (input, state) => Effect.succeed(processInput(input, state)),
      clear: () => Effect.succeed(""),
    }
  );
}).pipe(Effect.scoped);
