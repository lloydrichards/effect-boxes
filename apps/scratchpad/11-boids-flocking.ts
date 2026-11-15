/** @effect-diagnostics unstableApiUsage:skip-file */
import { BunServices } from "@effect/platform-bun";
import { Clock, Data, Effect, Option, Queue, Schedule, Terminal } from "effect";
import { Prompt } from "effect/cli";
import * as Ansi from "effect-boxes/Ansi";
import * as Box from "effect-boxes/Box";
import * as Cmd from "effect-boxes/Cmd";

type Vec2 = { x: number; y: number };

const v = (x = 0, y = 0): Vec2 => ({ x, y });
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
const mag = (a: Vec2): number => Math.hypot(a.x, a.y);

const normalize = (a: Vec2): Vec2 => {
  const m = mag(a);
  return m === 0 ? v() : { x: a.x / m, y: a.y / m };
};

const limit = (vec: Vec2, maxLength: number): Vec2 => {
  const m = mag(vec);
  return m <= maxLength ? vec : scale(vec, maxLength / m);
};

const setMag = (a: Vec2, m: number): Vec2 => scale(normalize(a), m);

const sumVecs = (...vecs: Vec2[]): Vec2 => {
  let x = 0;
  let y = 0;
  for (const vec of vecs) {
    x += vec.x;
    y += vec.y;
  }
  return { x, y };
};

const wrapDist = (a: Vec2, b: Vec2, w: number): Vec2 => {
  let dx = b.x - a.x;
  if (dx > w / 2) dx -= w;
  else if (dx < -w / 2) dx += w;
  return { x: dx, y: b.y - a.y };
};

const wrapClamp = (pos: Vec2, width: number, height: number): Vec2 => ({
  x: ((pos.x % width) + width) % width,
  y: Math.max(0, Math.min(pos.y, height - 1)),
});

type Boid = {
  pos: Vec2;
  vel: Vec2;
  color: Ansi.AnsiAnnotation;
};

const AspectRatio = 0.5; // terminal cells are ~2x taller than wide
const MaxSpeed = 1.0;
const MaxForce = 0.08;
const SeparationDist = 4.0;
const AlignmentDist = 8.0;
const CohesionDist = 8.0;
const SeparationWeight = 1.8;
const AlignmentWeight = 1.0;
const CohesionWeight = 1.0;
const BoundaryMargin = 5.0;
const BoundaryWeight = 1.5;

const separation = (boid: Boid, others: Boid[], w: number): Vec2 => {
  let steer = v();
  let count = 0;
  for (const other of others) {
    const diff = wrapDist(boid.pos, other.pos, w);
    const d = mag(diff);
    if (d > 0 && d < SeparationDist) {
      steer = add(steer, scale(normalize({ x: -diff.x, y: -diff.y }), 1 / d));
      count++;
    }
  }
  if (count > 0) {
    steer = scale(steer, 1 / count);
    if (mag(steer) > 0) {
      steer = limit(sub(setMag(steer, MaxSpeed), boid.vel), MaxForce * 1.2);
    }
  }
  return steer;
};

const alignment = (boid: Boid, others: Boid[], w: number): Vec2 => {
  let sum = v();
  let count = 0;
  for (const other of others) {
    const d = mag(wrapDist(boid.pos, other.pos, w));
    if (d > 0 && d < AlignmentDist) {
      sum = add(sum, other.vel);
      count++;
    }
  }
  if (count > 0) {
    sum = setMag(scale(sum, 1 / count), MaxSpeed);
    return limit(sub(sum, boid.vel), MaxForce);
  }
  return v();
};

const cohesion = (boid: Boid, others: Boid[], w: number): Vec2 => {
  let sum = v();
  let count = 0;
  for (const other of others) {
    const diff = wrapDist(boid.pos, other.pos, w);
    const d = mag(diff);
    if (d > 0 && d < CohesionDist) {
      sum = add(sum, diff);
      count++;
    }
  }
  if (count > 0) {
    sum = scale(sum, 1 / count);
    return limit(sub(setMag(sum, MaxSpeed), boid.vel), MaxForce);
  }
  return v();
};

const boundaryAvoidance = (boid: Boid, h: number): Vec2 => {
  if (boid.pos.y < BoundaryMargin) {
    return limit(sub(v(boid.vel.x, MaxSpeed), boid.vel), MaxForce);
  }
  if (boid.pos.y > h - BoundaryMargin) {
    return limit(sub(v(boid.vel.x, -MaxSpeed), boid.vel), MaxForce);
  }
  return v();
};

const dirChars = ["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"];

const headingToChar = (vel: Vec2): string => {
  if (mag(vel) < 0.01) return "•";
  const angle = Math.atan2(vel.y, vel.x);
  const idx = Math.round(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8;
  return dirChars[idx] ?? "•";
};

type Arena = { width: number; height: number };

const arenaFor = ({ columns, rows }: Terminal.Size): Arena | undefined =>
  columns >= 14 && rows >= 6
    ? { width: columns - 3, height: rows - 3 }
    : undefined;

type FlockState = {
  size: Terminal.Size;
  arena: Arena;
  boids: Boid[];
  fps: number;
  lastFrameTime: number;
};

function resizeFlock(state: FlockState, size: Terminal.Size): FlockState {
  const next = arenaFor(size);
  if (!next) return { ...state, size };
  if (next.width === state.arena.width && next.height === state.arena.height) {
    return { ...state, size };
  }
  return {
    ...state,
    size,
    arena: next,
    boids: state.boids.map((boid) => ({
      ...boid,
      pos: v(
        (boid.pos.x * next.width) / state.arena.width,
        (boid.pos.y * (next.height - 1)) / (state.arena.height - 1)
      ),
    })),
  };
}

const colors = [
  Ansi.cyan,
  Ansi.green,
  Ansi.magenta,
  Ansi.yellow,
  Ansi.blue,
  Ansi.white,
  Ansi.brightCyan,
  Ansi.brightGreen,
  Ansi.brightMagenta,
  Ansi.brightYellow,
];

const Action = Data.taggedEnum<Prompt.ActionDefinition>();

export const main = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;
  const sizes = yield* terminal.size;
  const size = yield* Queue.take(sizes);
  const arena = arenaFor(size) ?? { width: 60, height: 20 };

  const boidCount = Math.min(
    80,
    Math.max(15, Math.floor((arena.width * arena.height) / 40))
  );

  const initialBoids: Boid[] = Array.from({ length: boidCount }, (_, i) => ({
    pos: v(Math.random() * arena.width, Math.random() * (arena.height - 1)),
    vel: v((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
    color: colors[i % colors.length] ?? Ansi.cyan,
  }));

  const stepFlock = (state: FlockState): FlockState => {
    const { width: innerW, height: innerH } = state.arena;
    const newBoids = state.boids.map((boid) => {
      const others = state.boids.filter((b) => b !== boid);
      const sep = scale(separation(boid, others, innerW), SeparationWeight);
      const ali = scale(alignment(boid, others, innerW), AlignmentWeight);
      const coh = scale(cohesion(boid, others, innerW), CohesionWeight);
      const boundary = scale(boundaryAvoidance(boid, innerH), BoundaryWeight);

      const acc = sumVecs(sep, ali, coh, boundary);
      const newVel = limit(add(boid.vel, acc), MaxSpeed);
      const step = { x: newVel.x, y: newVel.y * AspectRatio };
      const newPos = wrapClamp(add(boid.pos, step), innerW, innerH);

      return { ...boid, pos: newPos, vel: newVel };
    });
    return { ...state, boids: newBoids };
  };

  const dimStyle = Ansi.getAnsiEscapeSequence(Ansi.combine(Ansi.dim).data);
  const resetCode = "\x1b[0m";

  const boidStyles = new Map<Ansi.AnsiAnnotation, string | null>();
  for (const c of colors) {
    boidStyles.set(
      c,
      Ansi.getAnsiEscapeSequence(Ansi.combine(c, Ansi.bold).data)
    );
  }

  const moveTo = (col: number, row: number): string => `\x1b[${row};${col}H`;

  let lastSize: Terminal.Size | undefined;
  const renderFrame = (state: FlockState): string => {
    const resized = state.size !== lastSize;
    lastSize = state.size;
    const { width: displayW, height: innerH } = state.arena;
    let out = resized ? "\x1b[H\x1b[2J" : "";
    if (!arenaFor(state.size)) {
      return resized
        ? out +
            "Resize · any key exits".slice(
              0,
              Math.max(0, state.size.columns - 1)
            )
        : "";
    }
    if (resized) {
      const label = `${boidCount} boids · any key exits`;
      const fullLabel = `Boids Flocking · ${label} · separation + alignment + cohesion`;
      out +=
        Box.emptyBox(innerH, displayW).pipe(
          Box.border("single"),
          Box.renderPrettySync
        ) +
        moveTo(1, innerH + 3) +
        (fullLabel.length <= displayW + 2
          ? fullLabel
          : label.slice(0, displayW + 2));
    }
    const blankLine = " ".repeat(displayW);

    for (let row = 0; row < innerH; row++) {
      out += moveTo(2, row + 2) + blankLine;
    }

    for (const boid of state.boids) {
      const ch = headingToChar(boid.vel);
      const col = Math.min(Math.floor(boid.pos.x), displayW - 1) + 2;
      const row = Math.floor(boid.pos.y) + 2;
      const style = boidStyles.get(boid.color) ?? "";
      out += moveTo(col, row) + style + ch + resetCode;
    }

    const fpsText = `${Math.round(state.fps)} fps`;
    out +=
      moveTo(displayW - fpsText.length + 1, 2) +
      (dimStyle ?? "") +
      fpsText +
      resetCode;

    return out;
  };

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

  const tickQueue = yield* Queue.sliding<number>(1);
  yield* Clock.currentTimeMillis.pipe(
    Effect.flatMap((now) => Queue.offer(tickQueue, now)),
    Effect.repeat(Schedule.spaced("16 millis")),
    Effect.forkScoped
  );

  const prompt = Prompt.Custom<FlockState, void, number>(
    { boids: initialBoids, arena, size, fps: 0, lastFrameTime: 0 },
    Queue.asDequeue(tickQueue),
    {
      render: (_, action) =>
        Effect.sync(() =>
          action._tag === "NextFrame" ? renderFrame(action.state) : ""
        ),
      process: (input, state) =>
        Effect.gen(function* () {
          if (input._tag === "Input")
            return Action.Submit({ value: undefined });
          const latest = yield* Queue.poll(sizes);
          const current = Option.isSome(latest)
            ? resizeFlock(state, latest.value)
            : state;
          const now = input.value;
          const delta = now - state.lastFrameTime;
          const instantFps =
            state.lastFrameTime && delta > 0 ? 1000 / delta : 0;
          const fps = state.fps
            ? state.fps * 0.9 + instantFps * 0.1
            : instantFps;
          return Action.NextFrame({
            state: stepFlock({ ...current, fps, lastFrameTime: now }),
          });
        }),
      clear: () => Effect.succeed(""),
    }
  );

  yield* Prompt.run(prompt);
}).pipe(Effect.scoped, Effect.provide(BunServices.layer));
