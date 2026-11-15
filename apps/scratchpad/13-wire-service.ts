/** @effect-diagnostics unstableApiUsage:skip-file */
import {
  Console,
  Data,
  Effect,
  HashMap,
  Option,
  Queue,
  Schedule,
  Terminal,
} from "effect";
import { Prompt } from "effect/cli";
import * as Ansi from "effect-boxes/Ansi";
import * as Box from "effect-boxes/Box";
import * as Cmd from "effect-boxes/Cmd";
import * as Reactive from "effect-boxes/Reactive";

const stories = [
  {
    id: "ferry",
    desk: "HARBOR",
    time: "06:40",
    headline: "First ferry clears the harbor",
    body: `The first ferry left the east quay with twelve bicycles on deck and a sack of bread for the cafe on the far bank. From the ticket window the breakwater was almost invisible. The skipper waited until the orange pilot light appeared through the fog, then eased the boat out past the channel buoy.

The delay gave the deckhand time to rearrange the bicycles. Two touring bikes had bags wider than the rack, so their riders carried the bags to the bench and slipped the front wheels into the spaces beside the rail. That left the ramp clear for a family with a pushchair who reached the gate just before it closed.

The crossing took ten minutes longer than usual. A clerk at the landing telephoned the bus driver, who agreed to wait by the blue shelter until the foot passengers were ashore. The next boat is taking bicycles from the same gate. Riders joining the queue should collect a paper ticket at the window before bringing their bikes down the slope.`,
  },
  {
    id: "market",
    desk: "MARKET",
    time: "06:48",
    headline: "Market moves under the station roof",
    body: `Porters rolled the first crates of pears into the old ticket hall before sunrise. Overnight rain had left a pool across the market square, deep enough to cover the chalk marks that tell the stallholders where to set up. By the time the station clock struck seven, the fruit sellers had rebuilt their row beneath the glass roof.

The fish counter took the space beside the parcels door, where the tiled floor slopes toward a drain. The baker borrowed a luggage trolley for her trays and parked it under the old departures board. She has tied a red tea towel to the handle so her regulars can find her among the ticket queues.

Customers can use the entrance facing the clock tower. Deliveries come through the parcels door on Mill Lane, leaving the middle of the hall open for rail passengers. At noon the roads crew will lift the drain cover in the square. Even if the water has gone by then, the traders plan to finish the day indoors rather than move the loaded stalls a second time.`,
  },
  {
    id: "bridge",
    desk: "BRIDGE",
    time: "07:05",
    headline: "Footbridge opens for the morning crossing",
    body: `The keeper lowered the footbridge just as the school bell rang on the far bank. The first person across was the caretaker, pushing a trolley of exercise books that had spent the night in the lodge. Behind him came a queue of walkers and cyclists stretching along the towpath as far as the willow tree.

A replacement bearing went in under the eastern end of the span yesterday. During the first lift this morning an engineer marked the bearing housing with chalk, then watched the marks as the deck settled back onto its supports. The keeper opened both gates once she had checked that the two halves of the handrail met cleanly.

The riverside steps are open again. Anyone with a bicycle, buggy or loaded trolley can take the gentler slope past the boathouse and join the same crossing at deck level. Engineers will return after the evening rush to measure the bearing while the bridge is still warm. The keeper will pin the time of the next lift to the noticeboard beside the bell.`,
  },
  {
    id: "rail",
    desk: "RAIL",
    time: "07:12",
    headline: "Extra carriage joins the coast train",
    body: `Platform staff coupled a spare carriage to the coast train when the ferry passengers arrived together. The new carriage stood beyond the end of the platform canopy. A porter walked the length of the train with a brass handbell to let the people waiting under cover know there were empty seats at the rear.

Bicycles went into the guard's van beside the parcels compartment. Each rider received a numbered card with a matching tag for the handlebars. One passenger had already found a window seat when she remembered her lunch in a pannier. The guard passed it out through the van door with a minute to spare.

The train is due at the headland before the lighthouse opens. At the short platform there, only the front carriage and the van will draw alongside the ramp. The conductor will walk through the train after the tunnel to collect tickets and give cyclists time to move forward. Anyone travelling on to the pier can stay in their seat while the crew unloads the bikes.`,
  },
] as const;

const [ferry, market, bridge, rail] = stories;
const scenes = ["Split desk", "Center spread", "Markdown chat"] as const;
type Scene = (typeof scenes)[number];
type Story = (typeof stories)[number];
const dispatches: Record<Exclude<Scene, "Markdown chat">, readonly Story[]> = {
  "Split desk": [ferry, market],
  "Center spread": [market, bridge, rail],
};
const chats = [
  {
    question:
      "I'm cycling to the east quay with two panniers. Can I take the first ferry, and where do I catch the bus on the other side?",
    reply: `## Boarding at the east quay
Yes. Get your paper ticket at the window above the slipway, then wheel your bicycle down to the gate. If you reach the blue freight doors, you have gone past the passenger entrance.

## On the lower deck
- Wait beside the rail until the deckhand points out a rack. The crew loads the outside spaces first so the last riders can still reach the middle.
- Lift bulky panniers off before pushing your front wheel into the slot. There is a bench opposite the rack where you can sit with your bags.
- Keep the ticket somewhere you can reach without unpacking. The clerk at the far landing checks it as you come off the ramp.

> In fog, allow ten extra minutes for the crossing. You can ask the deckhand about the bus before the boat ties up.

The blue bus shelter is on the left as you leave the landing. This morning the driver agreed to wait for the boat. If you are riding on instead, let the foot passengers off first and follow the painted cycle line to the road.`,
  },
  {
    question:
      "I usually buy bread and pears in the square on my way to the train. Where are those stalls today, and can I get through with a pushchair?",
    reply: `## Use the clock tower entrance
The market has moved into the old ticket hall for the day. Come in from the square through the double doors facing the clock tower. Both doors are open, and the route to the stalls is level.

## Finding your usual shops
- For pears, turn left inside the hall. The fruit sellers are under the glass roof, with their crates against the wall and room to park a pushchair beside the weighing table.
- For bread, look under the old departures board. The baker is selling from a luggage trolley with a red tea towel tied to the handle.
- To catch your train, return to the middle aisle. It leads straight to the ticket barriers without taking you back outside.

> Leave the parcels door on Mill Lane clear. The fish seller and the delivery carts share that entrance.

The roads crew will check the drain at noon. The stallholders intend to stay in the hall until closing, so you can use the same route if you decide to shop after your return journey.`,
  },
  {
    question:
      "We're walking from the boathouse to the school with a buggy. Has the footbridge reopened, and do we need to use the riverside steps?",
    reply: `## Take the towpath
The footbridge is open for the morning crossing. From the boathouse, stay on the towpath until you reach the willow tree. The slope beside it brings you up to the bridge gate at deck level.

## Across to the school
- Join the queue at the keeper's lodge. Walkers, cyclists on foot and people with buggies all use the same gate.
- Keep to the right on the deck. The handrail runs through to the far bank, where the path forks around a small brick store.
- Take the left fork beside the school wall. The right fork doubles back to the riverside steps and would leave you carrying the buggy.

> Before setting off for the return walk, check the noticeboard beside the keeper's bell for the next lift time.

Engineers are coming back after the evening rush to check the replacement bearing. If the gates close while you are on the towpath, the bench outside the lodge has a clear view of the span and enough space beside it for the buggy.`,
  },
  {
    question:
      "I'm taking a bicycle on the coast train to the headland. Where should I board, and how do I get my bike back at the short platform?",
    reply: `## Find the guard's van
Stay on the platform with your bicycle and meet the guard by the parcels compartment. The extra passenger carriage is at the rear, but bicycles travel together in the van near the front.

## Before you take a seat
- Remove the things you want for the journey from your panniers. Once the train leaves, the van door stays shut until the crew is ready to unload.
- Take the numbered card from the guard and check that it matches the tag on your handlebars. Keep the card with your ticket.
- Tell the guard you are getting off at the headland. Bikes for that stop go nearest the door that opens onto the ramp.

> The platform at the headland only reaches the front carriage and the van. Listen for the conductor after the tunnel.

When the train stops, step out through the front carriage and wait beside the ramp with your card. The guard will bring the bikes down in order. The path to the lighthouse starts beyond the water tower, past the end of the platform fence.`,
  },
] as const;
const chatFrames = 900;
const frames = 180;
const Action = Data.taggedEnum<Prompt.ActionDefinition>();
const gold = "\x1b[1;33m";
const teal = "\x1b[36m";
const reset = "\x1b[0m";
type State = {
  readonly scene: Scene;
  readonly frame: number;
  readonly paused: boolean;
  readonly pin: number;
  readonly editions: number;
};
function select(scene: Scene, editions = 1): State {
  return {
    scene,
    frame: 0,
    paused: true,
    pin: scene === "Markdown chat" ? 0 : 1,
    editions,
  };
}
const initial = select("Split desk");

function replayLength(scene: Scene) {
  return scene === "Markdown chat" ? chatFrames * chats.length : frames;
}

function columnWidths(state: State, width: number) {
  const sweep = (1 - Math.cos((2 * Math.PI * state.frame) / (frames - 1))) / 2;

  const triple = state.scene === "Center spread";
  const available = width - (triple ? 6 : 3);
  const min = Math.max(8, Math.round(available * (triple ? 0.19 : 0.25)));
  if (!triple) {
    const left = min + Math.round((available - 2 * min) * sweep);
    return [left, available - left];
  }
  const center = min + Math.round((available - 3 * min) * sweep);
  const left = Math.floor((available - center) / 2);
  return [left, center, available - center - left];
}

function article(
  id: string,
  wrapped: { headline: Box.Box; body: Box.Box },
  width: number,
  label: string
) {
  return Box.vcat(
    [
      Box.hcat(
        [
          Reactive.makeReactive(Box.line("  "), id),
          Box.line(label).pipe(Box.annotate(Ansi.cyan)),
        ],
        Box.top
      ),
      wrapped.headline.pipe(Box.annotate(Ansi.bold)),
      Box.line(""),
      wrapped.body,
    ],
    Box.left
  ).pipe(Box.alignHoriz(Box.left, width));
}

// The demo replies use one-line Markdown blocks, including while the final line is streaming.
function markdown(source: string, width: number) {
  const blocks = source.split("\n").map((line) => {
    if (line === "") return Box.line("");
    if (line.startsWith("## ")) {
      return Box.para(line.slice(3), Box.left, width).pipe(
        Box.annotate(Ansi.bold)
      );
    }
    if (line.startsWith("- ") || line.startsWith("> ")) {
      const quote = line.startsWith(">");
      const body = Box.para(line.slice(2), Box.left, width - 2);
      const prefix = Box.text(
        Array.from({ length: body.rows }, (_, row) =>
          quote ? "│ " : row === 0 ? "• " : "  "
        ).join("\n")
      ).pipe(Box.alignHoriz(Box.left, 2), Box.annotate(Ansi.cyan));
      return Box.hcat([prefix, body], Box.top);
    }
    return Box.para(line, Box.left, width);
  });
  return Box.vcat(blocks, Box.left);
}

function chatFrame(state: State, width: number, height: number) {
  const step = state.frame % chatFrames;
  const sweep = (1 - Math.cos((2 * Math.PI * step) / (chatFrames - 1))) / 2;
  const narrow = Math.max(22, Math.round(width * 0.36));
  const cols = narrow + Math.round((width - narrow) * sweep);
  const progress = Math.min(1, step / (chatFrames * 0.76));
  const start = performance.now();
  const messages = Array.from({ length: state.editions }, (_, index) => {
    const chat =
      chats[(index + Math.floor(state.frame / chatFrames)) % chats.length] ??
      chats[0];
    const source = chat.reply.slice(
      0,
      Math.floor(chat.reply.length * progress)
    );
    return {
      question: Box.para(chat.question, Box.left, cols - 4),
      answer: markdown(source + (progress < 1 ? "▌" : ""), cols - 4),
    };
  });
  const reflow = performance.now() - start;
  const page = Box.vcat(
    messages.map(({ question, answer }, index) =>
      Box.vcat(
        [
          Box.vcat(
            [Box.line("You").pipe(Box.annotate(Ansi.cyan)), question],
            Box.right
          ),
          Box.line(""),
          Box.vcat(
            [
              Box.line("Harbor assistant").pipe(Box.annotate(Ansi.green)),
              answer,
            ],
            Box.left
          ).pipe(
            Box.alignHoriz(Box.left, cols - 4),
            Box.pad(0, 1),
            Box.border("rounded")
          ),
        ],
        Box.right
      ).pipe(Reactive.makeReactive(String(index)))
    ),
    Box.left
  );
  const lookupStart = performance.now();
  const positions = Reactive.getPositions(page);
  const lookup = performance.now() - lookupStart;
  const pinned = Option.getOrThrow(HashMap.get(positions, String(state.pin)));
  const top = pinned.row + Math.max(0, pinned.rows - height);
  return { page, top, pinned, reflow, lookup, widths: [cols] };
}

function pinCount(scene: Scene, editions: number) {
  return editions * (scene === "Markdown chat" ? 1 : dispatches[scene].length);
}

function compose(state: State, width: number, height: number) {
  if (state.scene === "Markdown chat") return chatFrame(state, width, height);
  const widths = columnWidths(state, width);
  const items = dispatches[state.scene];
  const start = performance.now();
  const batches = Array.from({ length: state.editions }, (_, edition) =>
    items.map((original, column) => {
      const story =
        edition === 0
          ? original
          : (stories[(edition + column) % stories.length] ?? original);
      const cols = widths[column] ?? width;
      return {
        story,
        cols,
        copy: {
          headline: Box.para(story.headline, Box.left, cols),
          body: Box.punctuateV(
            story.body
              .split("\n\n")
              .map((paragraph) => Box.para(paragraph, Box.left, cols)),
            Box.left,
            Box.line("")
          ),
        },
      };
    })
  );
  const reflow = performance.now() - start;
  const pages = batches.map((batch, edition) => {
    const columns = batch.map(({ story, cols, copy }, i) => {
      const label = cols >= 18 ? `${story.desk}  /  ${story.time}` : story.desk;
      return article(String(edition * items.length + i), copy, cols, label);
    });
    const rule = Box.text(
      Array<string>(Math.max(...columns.map((col) => col.rows)))
        .fill(" │ ")
        .join("\n")
    ).pipe(Box.annotate(Ansi.cyan));
    return Box.punctuateH(columns, Box.top, rule);
  });
  const page = Box.vcat(pages, Box.left);
  const lookupStart = performance.now();
  const positions = Reactive.getPositions(page);
  const lookup = performance.now() - lookupStart;
  const pinned = Option.getOrThrow(HashMap.get(positions, String(state.pin)));
  const top = Math.max(0, pinned.row - height + 3);
  return { page, top, pinned, reflow, lookup, widths };
}

function draw(
  frame: ReturnType<typeof compose>,
  width: number,
  height: number,
  state: State,
  fps: number
) {
  const { page, top, pinned, reflow, lookup } = frame;
  const visibleRows =
    state.scene === "Markdown chat" ? Math.min(height, pinned.rows) : height;
  const view = page.pipe(
    Box.cropHeight(top, visibleRows),
    Box.cropWidth(0, width)
  );
  const copy = Box.renderPrettySync(view).trimEnd().split("\n");
  const sceneIndex = scenes.indexOf(state.scene);
  const accent = [teal, gold, "\x1b[32m"][sceneIndex];
  const title = `${state.scene === "Markdown chat" ? "HARBOR CHAT" : "THE HARBOR WIRE"}   /   ${state.scene.toUpperCase()}`;
  const tabs =
    width < 53
      ? "1 Split  2 Center  3 Chat"
      : scenes
          .map((scene, i) =>
            scene === state.scene ? `[${i + 1} ${scene}]` : `${i + 1} ${scene}`
          )
          .join("   ");
  const status = `${state.paused ? "Paused" : fps ? `${fps.toFixed(1)} FPS` : "… FPS"}   Reflow ${reflow.toFixed(2)} ms   Lookup ${lookup.toFixed(2)} ms`;
  const tab = state.scene === "Markdown chat" ? "Tab chat" : "Tab pin";
  const keys = `Space ${state.paused ? "play" : "pause"}  ←/→ step  ${tab}  R reset  Q quit`;
  const telemetry =
    width < 51
      ? `${state.paused ? "Paused" : `${fps.toFixed(0)} FPS`}  Wrap ${reflow.toFixed(1)}ms  Find ${lookup.toFixed(1)}ms`
      : status;
  const load =
    state.scene === "Markdown chat"
      ? `-/+ load   Chat ${state.pin + 1}/${state.editions} · ${frame.widths[0]} cols`
      : `-/+ load   ${dispatches[state.scene].length * state.editions} stories${state.editions === 64 ? " (max)" : ""}`;
  const lines = [
    gold + title.slice(0, width) + reset,
    tabs.slice(0, width),
    load.slice(0, width),
    accent +
      (state.scene === "Markdown chat" ? "┄" : "═").repeat(width) +
      reset,
    ...Array.from({ length: height }, (_, i) => copy[i] ?? ""),
    teal + "─".repeat(width) + reset,
    telemetry.slice(0, width),
    ...(width < 51
      ? [
          `Space ${state.paused ? "play" : "pause"}   ←/→ step`,
          `${tab}   R reset   Q quit`,
        ]
      : [keys]),
  ];
  // Erase each old line after writing its replacement to avoid flashing the whole screen.
  const screen = `\x1b[H${lines.join("\x1b[K\r\n")}\x1b[K\x1b[J`;
  if (state.scene === "Markdown chat" || pinned.row < top) return screen;
  return (
    screen +
    Box.renderPrettySync(Cmd.cursorTo(pinned.col, 4 + pinned.row - top)) +
    gold +
    "▸" +
    reset
  );
}

function advance(
  input: Prompt.ProcessInput<void>,
  state: State
): Prompt.Action<State, void> {
  if (input._tag === "Event") {
    return Action.NextFrame({
      state: state.paused
        ? state
        : { ...state, frame: (state.frame + 1) % replayLength(state.scene) },
    });
  }
  const char = Option.getOrElse(input.input.input, () => "");
  if (char === "+" || char === "=" || char === "-") {
    const editions = Math.min(
      64,
      Math.max(1, state.editions * (char === "-" ? 0.5 : 2))
    );
    return Action.NextFrame({
      state: {
        ...state,
        editions,
        pin: state.pin % pinCount(state.scene, editions),
      },
    });
  }
  const key = input.input.key.name;
  switch (key) {
    case "1":
    case "2":
    case "3":
      return Action.NextFrame({
        state: select(scenes[Number(key) - 1] ?? scenes[0], state.editions),
      });
    case "space":
      return Action.NextFrame({ state: { ...state, paused: !state.paused } });
    case "left":
    case "right":
      return Action.NextFrame({
        state: {
          ...state,
          paused: true,
          frame:
            (state.frame +
              replayLength(state.scene) +
              (key === "right" ? 1 : -1)) %
            replayLength(state.scene),
        },
      });
    case "tab":
      return Action.NextFrame({
        state: {
          ...state,
          pin: (state.pin + 1) % pinCount(state.scene, state.editions),
        },
      });
    case "r":
      return Action.NextFrame({ state: select(state.scene, state.editions) });
    case "escape":
    case "q":
      return Action.Submit({ value: undefined });
    default:
      return Action.NextFrame({ state });
  }
}

export const main = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;
  if (!(process.stdin.isTTY && process.stdout.isTTY)) {
    const output = ["variant,frame,column_widths,reflow_ms,lookup_ms"];
    for (const scene of scenes) {
      for (let i = 0; i < replayLength(scene); i++) {
        const frame = compose({ ...select(scene), frame: i }, 79, 17);
        output.push(
          [
            scene,
            i,
            frame.widths.join("+"),
            frame.reflow.toFixed(4),
            frame.lookup.toFixed(4),
          ].join(",")
        );
      }
    }
    return yield* Console.log(output.join("\n"));
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
    Effect.repeat(Schedule.spaced("16 millis")),
    Effect.forkScoped
  );
  let lastState: State | undefined;
  let lastWidth = 0;
  let lastRows = 0;
  let fps = 0;
  let sampleStart = 0;
  let displayed = 0;
  yield* Prompt.Custom<State, void, void>(initial, Queue.asDequeue(ticks), {
    render: (_, action) =>
      Effect.gen(function* () {
        if (action._tag !== "NextFrame") return "";
        const width = Math.max(1, (yield* terminal.columns) - 1);
        const rows = yield* terminal.rows;
        if (
          action.state === lastState &&
          lastWidth === width &&
          lastRows === rows
        )
          return "";
        const now = performance.now();
        if (
          action.state.paused ||
          !lastState ||
          lastState.paused ||
          lastState.scene !== action.state.scene ||
          lastState.editions !== action.state.editions
        ) {
          sampleStart = now;
          displayed = 0;
          fps = 0;
        } else if (lastState.frame !== action.state.frame) {
          displayed++;
          if (now - sampleStart >= 500) {
            fps = (1000 * displayed) / (now - sampleStart);
            displayed = 0;
            sampleStart = now;
          }
        }
        lastState = action.state;
        lastWidth = width;
        lastRows = rows;
        if (rows < 11 || width < 33)
          return `\x1b[H\x1b[2J${"Enlarge window · Q quit".slice(0, width)}`;
        const height = rows - (width < 51 ? 8 : 7);
        return draw(
          compose(action.state, width, height),
          width,
          height,
          action.state,
          fps
        );
      }),
    process: (input, state) => Effect.succeed(advance(input, state)),
    clear: () => Effect.succeed(""),
  });
}).pipe(Effect.scoped);
