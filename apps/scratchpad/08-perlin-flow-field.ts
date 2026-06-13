import { BunServices } from "@effect/platform-bun";
import {
  Clock,
  Data,
  Effect,
  Match,
  pipe,
  Queue,
  Schedule,
  Terminal,
} from "effect";
import { Prompt } from "effect/unstable/cli";
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
  color: Ansi.AnsiAnnotation;
};

type FlowFieldState = {
  walkers: Walker[];
};

const colors = [
  Ansi.cyan,
  Ansi.green,
  Ansi.magenta,
  Ansi.yellow,
  Ansi.blue,
  Ansi.red,
  Ansi.white,
];

// Flow field config
const noiseScale = 0.08;
const timeSpeed = 0.00015;
const strength = 0.3;
const MaxSpeed = 0.9;

const Action = Data.taggedEnum<Prompt.ActionDefinition>();

// --------------------------
// Main
// --------------------------
export const main = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;
  const termWidth = yield* terminal.columns;
  const termHeight = process.stdout.rows ?? 24;

  // Reserve space for border (2) and title line (1)
  const displayW = termWidth - 2;
  const innerW = Math.floor(displayW / 2);
  const innerH = termHeight - 3;

  // Scale walker count to grid area (roughly 1 per 60 cells, min 10)
  const walkerCount = Math.max(10, Math.floor((innerW * innerH) / 60));

  // Initialize walkers with empty trails
  const initialWalkers: Walker[] = Array.from(
    { length: walkerCount },
    (_, i) => ({
      pos: v(Math.random() * innerW, Math.random() * innerH),
      vel: v(0, 0),
      trail: [],
      color: colors[i % colors.length] ?? Ansi.cyan,
    })
  );

  // Pure simulation step — closed over grid dimensions
  const stepWalkers = (ms: number, state: FlowFieldState): FlowFieldState => {
    const t = ms * timeSpeed;
    const newWalkers = state.walkers.map((walker) => {
      const nx = walker.pos.x * noiseScale;
      const ny = walker.pos.y * noiseScale;
      const angle = perlinNoise(nx + t, ny + t) * Math.PI * 2;

      const force = v(Math.cos(angle) * strength, Math.sin(angle) * strength);
      const newVel = limit(add(walker.vel, force), MaxSpeed);
      const newPos = wrap(add(walker.pos, newVel), innerW, innerH);

      const newTrail = [
        { pos: walker.pos, age: 0 },
        ...walker.trail.map((tp) => ({ ...tp, age: tp.age + 1 })),
      ].filter((tp) => tp.age < TrailLength);

      return { ...walker, pos: newPos, vel: newVel, trail: newTrail };
    });
    return { walkers: newWalkers };
  };

  // Pure frame renderer — closed over displayW
  const renderFrame = (state: FlowFieldState): string => {
    const renderCmds: Box.Box<Ansi.AnsiStyle>[] = [];

    for (const w of state.walkers) {
      for (const tp of [...w.trail].reverse()) {
        const ch = trailChars[tp.age] ?? " ";
        const style =
          tp.age >= 6 ? Ansi.combine(w.color, Ansi.dim) : Ansi.combine(w.color);
        renderCmds.push(
          pipe(
            Cmd.cursorTo(
              Math.min(Math.floor(tp.pos.x) * 2, displayW - 2) + 1,
              Math.floor(tp.pos.y) + 1
            ),
            Box.combine<Ansi.AnsiStyle>(
              Box.text(ch + ch).pipe(Box.annotate(style))
            )
          )
        );
      }

      renderCmds.push(
        pipe(
          Cmd.cursorTo(
            Math.min(Math.floor(w.pos.x) * 2, displayW - 2) + 1,
            Math.floor(w.pos.y) + 1
          ),
          Box.combine<Ansi.AnsiStyle>(
            Box.text("\u2588\u2588").pipe(
              Box.annotate(Ansi.combine(w.color, Ansi.bold))
            )
          )
        )
      );
    }

    return pipe(
      Cmd.home,
      Box.combine<Ansi.AnsiStyle>(Box.combineAll(renderCmds)),
      Box.renderPrettySync
    );
  };

  // Create tick queue and spawn a producer fiber that emits timestamps at ~60fps
  const tickQueue = yield* Queue.make<number>();
  yield* Clock.currentTimeMillis.pipe(
    Effect.flatMap((now) => Queue.offer(tickQueue, now)),
    Effect.repeat(Schedule.spaced("16 millis")),
    Effect.forkScoped
  );

  // Build the prompt
  let entered = false;

  const prompt = Prompt.custom<FlowFieldState, void, number>(
    { walkers: initialWalkers },
    Queue.asDequeue(tickQueue),
    {
      render: (_state, action) =>
        Effect.succeed(
          Action.$match(action, {
            Beep: () => "",

            NextFrame: ({ state: nextState }) => {
              const frame = renderFrame(nextState);
              if (!entered) {
                entered = true;
                const border = Box.emptyBox(innerH, displayW).pipe(
                  Box.border("single"),
                  Box.vAppend(
                    Box.hsep(
                      [
                        Box.text("Flow Field").pipe(Box.annotate(Ansi.bold)),
                        Box.text(`${walkerCount} walkers`).pipe(
                          Box.annotate(Ansi.dim)
                        ),
                        Box.text("any key to exit").pipe(
                          Box.annotate(Ansi.dim)
                        ),
                      ],
                      1,
                      Box.top
                    )
                  ),
                  Box.renderPrettySync
                );
                return (
                  Box.renderPrettySync(
                    Box.combineAll([Cmd.altScreenEnter, Cmd.cursorHide])
                  ) +
                  border +
                  frame
                );
              }
              return frame;
            },

            Submit: () =>
              Box.renderPrettySync(
                Box.combineAll([Cmd.altScreenLeave, Cmd.cursorShow])
              ),
          })
        ),

      process: (input, state) =>
        Effect.succeed(
          Match.value(input).pipe(
            Match.tag("Input", () => Action.Submit({ value: undefined })),
            Match.tag("Event", ({ value: timestamp }) =>
              Action.NextFrame({ state: stepWalkers(timestamp, state) })
            ),
            Match.exhaustive
          )
        ),

      clear: () => Effect.succeed(""),
    }
  );

  yield* Prompt.run(prompt);
}).pipe(Effect.scoped, Effect.provide(BunServices.layer));
