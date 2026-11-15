/** @effect-diagnostics unstableApiUsage:skip-file */
import { BunServices } from "@effect/platform-bun";
import { Clock, Data, Effect, Option, Queue, Schedule, Terminal } from "effect";
import { Prompt } from "effect/cli";
import * as Ansi from "effect-boxes/Ansi";
import * as Box from "effect-boxes/Box";
import * as Cmd from "effect-boxes/Cmd";

// --------------------------
// Vector utilities
// --------------------------
type Vec2 = { x: number; y: number };

const v = (x = 0, y = 0): Vec2 => ({ x, y });

const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

const limit = (vec: Vec2, maxLength: number): Vec2 => {
  const length = Math.hypot(vec.x, vec.y);
  if (length <= maxLength) {
    return vec;
  }
  const scale = maxLength / length;
  return { x: vec.x * scale, y: vec.y * scale };
};

const wrap = (pos: Vec2, width: number, height: number): Vec2 => ({
  x: ((pos.x % width) + width) % width,
  y: ((pos.y % height) + height) % height,
});

// --------------------------
// Gradient noise (proper Perlin-style)
// --------------------------

// Permutation table (shuffled 0-255, doubled to avoid wrapping)
const perm = (() => {
  const p = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
    36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120,
    234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
    88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71,
    134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133,
    230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161,
    1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130,
    116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250,
    124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227,
    47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
    154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
    108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34,
    242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14,
    239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121,
    50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243,
    141, 128, 195, 78, 66, 215, 61, 156, 180,
  ];
  return [...p, ...p];
})();

// 2D gradient vectors (8 directions)
const grad2 = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

const lerp = (a: number, b: number, t: number): number => a + t * (b - a);

const dot2 = (g: (typeof grad2)[number], x: number, y: number): number =>
  g[0] * x + g[1] * y;

const perlinNoise = (x: number, y: number): number => {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

  // Hash coordinates to gradient indices
  const aa = perm[perm[xi]! + yi]! & 7;
  const ba = perm[perm[xi + 1]! + yi]! & 7;
  const ab = perm[perm[xi]! + yi + 1]! & 7;
  const bb = perm[perm[xi + 1]! + yi + 1]! & 7;

  // Dot products with distance vectors
  const x1 = lerp(dot2(grad2[aa]!, xf, yf), dot2(grad2[ba]!, xf - 1, yf), u);
  const x2 = lerp(
    dot2(grad2[ab]!, xf, yf - 1),
    dot2(grad2[bb]!, xf - 1, yf - 1),
    u
  );

  return lerp(x1, x2, v);
};

// --------------------------
// Trail system
// --------------------------
const trailChars = [
  "\u2588",
  "\u2588",
  "\u2593",
  "\u2593",
  "\u2592",
  "\u2592",
  "\u2591",
  "\u2591",
  "\u00B7",
  "\u00B7",
  "\u00B7",
  "\u00B7",
  "\u00B7",
];
const TrailLength = trailChars.length;

type TrailPoint = { pos: Vec2; age: number };

type Walker = {
  pos: Vec2;
  vel: Vec2;
  trail: TrailPoint[];
  ink: ReturnType<typeof walkerInk>;
};

type Field = { width: number; height: number };
type FlowFieldState = {
  size: Terminal.Size;
  field: Field;
  walkers: Walker[];
};

function walkerInk(color: Ansi.AnsiAnnotation) {
  const bright = Ansi.getAnsiEscapeSequence(
    Ansi.combine(color, Ansi.bold).data
  );
  const normal = Ansi.getAnsiEscapeSequence(color.data);
  const dim = Ansi.getAnsiEscapeSequence(Ansi.combine(color, Ansi.dim).data);
  return {
    head: `${bright ?? ""}██\x1b[0m`,
    trail: trailChars.map(
      (ch, age) => `${(age >= 6 ? dim : normal) ?? ""}${ch}${ch}\x1b[0m`
    ),
  };
}
const palette = [
  walkerInk(Ansi.cyan),
  walkerInk(Ansi.green),
  walkerInk(Ansi.magenta),
  walkerInk(Ansi.yellow),
  walkerInk(Ansi.blue),
  walkerInk(Ansi.red),
  walkerInk(Ansi.white),
] as const;

// Flow field config
const noiseScale = 0.08;
const timeSpeed = 0.00015;
const strength = 0.3;
const MaxSpeed = 0.9;

const Action = Data.taggedEnum<Prompt.ActionDefinition>();

// --------------------------
// Main
// --------------------------
const fieldFor = ({ columns, rows }: Terminal.Size): Field | undefined =>
  columns >= 4 && rows >= 4
    ? { width: (columns - 2) / 2, height: rows - 3 }
    : undefined;

const walkerCount = (field: Field) =>
  Math.max(10, Math.floor((field.width * field.height) / 60));

const newWalker = (field: Field, index: number): Walker => ({
  pos: v(Math.random() * field.width, Math.random() * field.height),
  vel: v(),
  trail: [],
  ink: palette[index % palette.length] ?? palette[0],
});

function resize(state: FlowFieldState, size: Terminal.Size): FlowFieldState {
  const field = fieldFor(size);
  if (!field) return { ...state, size };
  if (field.width === state.field.width && field.height === state.field.height)
    return { ...state, size };
  const project = (pos: Vec2) =>
    v(
      (pos.x * field.width) / state.field.width,
      (pos.y * field.height) / state.field.height
    );
  const walkers = Array.from({ length: walkerCount(field) }, (_, i) => {
    const walker = state.walkers[i];
    return walker
      ? {
          ...walker,
          pos: project(walker.pos),
          trail: walker.trail.map((point) => ({
            ...point,
            pos: project(point.pos),
          })),
        }
      : newWalker(field, i);
  });
  return { size, field, walkers };
}

const stepWalkers = (ms: number, state: FlowFieldState): FlowFieldState => {
  const t = ms * timeSpeed;
  const newWalkers = state.walkers.map((walker) => {
    const nx = walker.pos.x * noiseScale;
    const ny = walker.pos.y * noiseScale;
    const angle = perlinNoise(nx + t, ny + t) * Math.PI * 2;

    const force = v(Math.cos(angle) * strength, Math.sin(angle) * strength);
    const newVel = limit(add(walker.vel, force), MaxSpeed);
    const newPos = wrap(
      add(walker.pos, newVel),
      state.field.width,
      state.field.height
    );

    const newTrail = [
      { pos: walker.pos, age: 0 },
      ...walker.trail.map((tp) => ({ ...tp, age: tp.age + 1 })),
    ].filter((tp) => tp.age < TrailLength);

    return { ...walker, pos: newPos, vel: newVel, trail: newTrail };
  });
  return { ...state, walkers: newWalkers };
};

const renderFrame = (state: FlowFieldState, redrawBorder: boolean): string => {
  const { columns, rows } = state.size;
  let out = redrawBorder ? Box.renderPrettySync(Cmd.clearScreen) : "";
  if (columns < 4 || rows < 4)
    return redrawBorder
      ? out + "Resize · any key exits".slice(0, Math.max(0, columns - 1))
      : "";
  if (redrawBorder) {
    const footer = `Flow Field · ${state.walkers.length} walkers · any key to exit`;
    out +=
      Box.emptyBox(rows - 3, columns - 2).pipe(
        Box.border("single"),
        Box.renderPrettySync
      ) +
      `\x1b[${rows};1H` +
      footer.slice(0, columns);
  }
  const moveTo = (pos: Vec2) =>
    `\x1b[${Math.floor(pos.y) + 2};${Math.min(Math.floor(pos.x) * 2, columns - 4) + 2}H`;
  for (const walker of state.walkers) {
    for (let i = walker.trail.length - 1; i >= 0; i--) {
      const point = walker.trail[i];
      if (point) out += moveTo(point.pos) + walker.ink.trail[point.age];
    }
    out += moveTo(walker.pos) + walker.ink.head;
  }
  return out;
};

export const main = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;
  const sizes = yield* terminal.size;
  const size = yield* Queue.take(sizes);
  const field = fieldFor(size) ?? { width: 1, height: 1 };
  const walkers = Array.from({ length: walkerCount(field) }, (_, i) =>
    newWalker(field, i)
  );
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
  const ticks = yield* Queue.sliding<number>(1);
  yield* Clock.currentTimeMillis.pipe(
    Effect.flatMap((now) => Queue.offer(ticks, now)),
    Effect.repeat(Schedule.spaced("16 millis")),
    Effect.forkScoped
  );
  let lastSize: Terminal.Size | undefined;
  yield* Prompt.Custom<FlowFieldState, void, number>(
    { size, field, walkers },
    ticks,
    {
      render: (_, action) =>
        Effect.sync(() => {
          if (action._tag !== "NextFrame") return "";
          const output = renderFrame(
            action.state,
            action.state.size !== lastSize
          );
          lastSize = action.state.size;
          return output;
        }),
      process: (input, state) =>
        Effect.gen(function* () {
          if (input._tag === "Input")
            return Action.Submit({ value: undefined });
          const latest = yield* Queue.poll(sizes);
          const current = Option.isSome(latest)
            ? resize(state, latest.value)
            : state;
          return Action.NextFrame({ state: stepWalkers(input.value, current) });
        }),
      clear: () => Effect.succeed(""),
    }
  );
}).pipe(Effect.scoped, Effect.provide(BunServices.layer));
