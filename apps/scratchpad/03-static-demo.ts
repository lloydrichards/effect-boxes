/** @effect-diagnostics unstableApiUsage:skip-file */
/**
 * Static demo showcasing the powerful layout capabilities of Effect Boxes.
 *
 * Demonstrates: word wrapping (para), multi-column text flow (columns),
 * alignment modes, horizontal bar charts, and positional offsets (move*).
 */
import { Data, Effect, Queue, Stream, Terminal } from "effect";
import { Prompt } from "effect/cli";
import * as Ansi from "effect-boxes/Ansi";
import * as Box from "effect-boxes/Box";
import * as Cmd from "effect-boxes/Cmd";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Keep each bordered cell intact when the next one needs a new row.
const packRows = <A>(cells: ReadonlyArray<Box.Box<A>>, width: number) => {
  const rows: Box.Box<A>[] = [];
  let row: Box.Box<A>[] = [];
  let used = 0;
  for (const cell of cells) {
    if (row.length && used + 1 + cell.cols > width) {
      rows.push(Box.hsep(row, 1, Box.top));
      row = [];
      used = 0;
    }
    used += (row.length ? 1 : 0) + cell.cols;
    row.push(cell);
  }
  if (row.length) rows.push(Box.hsep(row, 1, Box.top));
  return Box.vcat(rows, Box.left);
};

const sectionLabel = (label: string, width: number) =>
  Box.text(` ${label} `).pipe(
    Box.truncate(width, Box.left),
    Box.annotate(
      Ansi.combine(Ansi.bold, Ansi.bgColorRGB(45, 85, 155), Ansi.white)
    )
  );

const dimRule = (width: number) =>
  Box.text("─".repeat(width)).pipe(Box.annotate(Ansi.dim));

// ---------------------------------------------------------------------------
// 1. Header
// ---------------------------------------------------------------------------

const header = (width: number) =>
  Box.text("Effect Boxes").pipe(
    Box.annotate(Ansi.combine(Ansi.bold, Ansi.colorRGB(255, 165, 0))),
    Box.pad(0, 1),
    Box.border("rounded", { annotation: Ansi.dim }),
    Box.alignHoriz(Box.center1, width)
  );

const subtitle = (width: number) =>
  Box.para(
    "A functional layout engine for composable terminal UIs",
    Box.center1,
    width
  ).pipe(Box.annotate(Ansi.dim), Box.alignHoriz(Box.center1, width));

// ---------------------------------------------------------------------------
// 2. Word Wrapping — same text at different widths
// ---------------------------------------------------------------------------

const WRAP_TEXT =
  "Effect Boxes provides automatic word wrapping through the para function. " +
  "The same input text reflows to fit any target width, making responsive " +
  "terminal layouts easy to build.";

const wrapDemo = (width: number) => {
  const space = width - 8; // Three borders and two gaps.
  const wrapWidths = [0.24, 0.32, 0.44].map((share) =>
    Math.min(width - 2, Math.max(20, Math.floor(space * share)))
  );
  const wrapped = [...new Set(wrapWidths)].map((w) =>
    Box.vcat(
      [
        Box.text(`width=${w}`).pipe(
          Box.annotate(Ansi.combine(Ansi.bold, Ansi.cyan)),
          Box.alignHoriz(Box.center1, w)
        ),
        dimRule(w),
        Box.para(WRAP_TEXT, Box.left, w),
      ],
      Box.left
    ).pipe(Box.border("rounded", { annotation: Ansi.dim }))
  );

  return Box.vcat(
    [sectionLabel("Word Wrapping (para)", width), packRows(wrapped, width)],
    Box.left
  );
};

// ---------------------------------------------------------------------------
// 3. Multi-column text flow (columns)
// ---------------------------------------------------------------------------

const ARTICLE_TEXT =
  "Functional composition is the backbone of Effect Boxes. Every box is an " +
  "immutable value that can be combined, aligned, padded, and annotated " +
  "without mutation. Horizontal and vertical concatenation let you build " +
  "complex layouts from small, reusable pieces. Borders, separators, and " +
  "annotations add visual structure. The library draws inspiration from " +
  "Haskell's Text.PrettyPrint.Boxes, adapted for the Effect ecosystem " +
  "with full TypeScript type safety, pipeable APIs, and ANSI rendering.";

const columnDemo = (width: number) => {
  const count = Math.min(3, Math.max(1, Math.floor((width + 3) / 26)));
  const colWidth = Math.floor((width - (count - 1) * 3) / count);
  const colHeight = Math.ceil(
    Box.para(ARTICLE_TEXT, Box.left, colWidth).rows / count
  );

  return Box.vcat(
    [
      sectionLabel("Multi-Column Flow (columns)", width),
      Box.punctuateH(
        Box.columns(ARTICLE_TEXT, Box.left, colWidth, colHeight),
        Box.top,
        Box.text("│\n".repeat(colHeight).trimEnd()).pipe(
          Box.annotate(Ansi.dim),
          Box.pad(0, 1)
        )
      ),
    ],
    Box.left
  );
};

// ---------------------------------------------------------------------------
// 4. Alignment Showcase
// ---------------------------------------------------------------------------

const alignmentDemo = (width: number) => {
  const innerWidth = width - 2;
  const perRow = Math.min(4, Math.max(1, Math.floor((innerWidth + 1) / 16)));
  const cellWidth = Math.floor((innerWidth - perRow + 1) / perRow) - 4;
  const modes: Array<[string, Box.Alignment]> = [
    ["left", Box.left],
    ["center1", Box.center1],
    ["center2", Box.center2],
    ["right", Box.right],
  ];

  const makeRow = (
    txt: string,
    align: Box.Alignment,
    color: Ansi.AnsiAnnotation
  ) => {
    const aligned = Box.text(txt).pipe(Box.alignHoriz(align, cellWidth));
    return Box.text(
      Box.renderPlainSync(aligned)
        .trimEnd()
        .padEnd(cellWidth)
        .replace(/ /g, "·")
    ).pipe(Box.annotate(color));
  };

  const boxes = modes.map(([name, align]) =>
    Box.vcat(
      [
        Box.text(name).pipe(
          Box.alignHoriz(Box.center1, cellWidth),
          Box.annotate(Ansi.combine(Ansi.bold, Ansi.cyan))
        ),
        dimRule(cellWidth),
        makeRow("AB", align, Ansi.green),
        makeRow("ABC", align, Ansi.yellow),
        makeRow("ABCD", align, Ansi.magenta),
      ],
      Box.left
    ).pipe(Box.pad(0, 1), Box.border("single", { annotation: Ansi.dim }))
  );

  return Box.vcat(
    [
      sectionLabel("Alignment Modes", width),
      packRows(boxes, innerWidth).pipe(Box.border("rounded")),
    ],
    Box.left
  );
};

// ---------------------------------------------------------------------------
// 5. Horizontal Bar Chart
// ---------------------------------------------------------------------------

const barChartDemo = (width: number) => {
  const data: Array<[string, number]> = [
    ["Rust", 92],
    ["TypeScript", 78],
    ["Python", 65],
    ["Go", 54],
    ["Haskell", 41],
    ["Lua", 28],
  ];

  const maxVal = Math.max(...data.map(([, v]) => v));
  const barMaxWidth = width - 16;

  const barColors: Ansi.AnsiAnnotation[] = [
    Ansi.colorRGB(255, 100, 70),
    Ansi.colorRGB(70, 150, 255),
    Ansi.colorRGB(100, 220, 100),
    Ansi.colorRGB(0, 200, 200),
    Ansi.colorRGB(180, 130, 255),
    Ansi.colorRGB(255, 200, 60),
  ];

  const rows = data.map(([label, value], i) => {
    const barWidth = Math.round((value / maxVal) * barMaxWidth);
    return Box.hsep(
      [
        Box.text(label).pipe(
          Box.truncate(12, Box.left),
          Box.alignHoriz(Box.right, 12)
        ),
        Box.text("█".repeat(barWidth)).pipe(Box.annotate(barColors[i]!)),
        Box.text(`${value}`).pipe(Box.annotate(Ansi.dim)),
      ],
      1,
      Box.top
    );
  });

  return Box.vcat(
    [sectionLabel("Bar Chart (scaling with layout width)", width), ...rows],
    Box.left
  );
};

// ---------------------------------------------------------------------------
// 6. Positional Offsets (moveRight / moveDown)
// ---------------------------------------------------------------------------

const positionDemo = (width: number) => {
  const makeTag = (label: string, color: Ansi.AnsiAnnotation) =>
    Box.text(label).pipe(
      Box.annotate(Ansi.combine(Ansi.bold, color)),
      Box.pad(0, 1),
      Box.border("rounded"),
      Box.annotate(color)
    );

  const a = makeTag("origin", Ansi.green);
  const offsetTag = (offset: number, color: Ansi.AnsiAnnotation) =>
    Box.moveRight(makeTag(`moveRight(${offset})`, color), offset);
  const available = width - 4 - `moveRight(${width})`.length;
  const b = offsetTag(available, Ansi.magenta);
  const c = offsetTag(Math.floor(available / 2), Ansi.cyan);

  // Stack them — each box carries its own offset so they form a staircase
  const stacked = Box.vcat([a, b, c], Box.left);

  return Box.vcat(
    [sectionLabel("Positioning (moveRight / moveDown)", width), stacked],
    Box.left
  );
};

// ---------------------------------------------------------------------------
// 7. Per-Side Border Toggles
// ---------------------------------------------------------------------------

const borderSidesDemo = (width: number) => {
  // Tabbed interface (Lip Gloss style): all tabs skip the bottom border,
  // a connector line joins them to the content panel using junction chars.
  const labels =
    width >= 36 ? ["Overview", "Details", "Settings"] : ["Settings"];
  const activeIndex = labels.length - 1;

  const baseWidth = Math.floor(width / labels.length);
  const tabBoxes = labels.map((label, i) =>
    Box.text(label).pipe(
      Box.alignHoriz(
        Box.center1,
        (i === activeIndex ? width - i * baseWidth : baseWidth) - 4
      ),
      Box.pad(0, 1),
      Box.border("rounded", {
        sides: { bottom: false },
        annotation: i === activeIndex ? Ansi.cyan : Ansi.dim,
      }),
      i === activeIndex
        ? Box.annotate(Ansi.combine(Ansi.bold, Ansi.cyan))
        : (x) => x
    )
  );

  const tabs = Box.hcat(tabBoxes, Box.top);

  // Active tab gets a gap (spaces), inactive tabs get ─ with ┴ at junctions
  let connector = "";
  for (let i = 0; i < labels.length; i++) {
    const innerWidth = tabBoxes[i]!.cols - 2;
    const isActive = i === activeIndex;

    // Left edge or junction
    if (i === 0) {
      connector += isActive ? "│" : "├";
    } else {
      // Two chars for the junction (replacing ││ from adjacent tab borders)
      const prevActive = i - 1 === activeIndex;
      if (prevActive) {
        // active → inactive: close active's corner, tee for inactive
        connector += "╰┴";
      } else if (isActive) {
        // inactive → active: tee for inactive, close corner into active
        connector += "┴╯";
      } else {
        // both inactive
        connector += "┴┴";
      }
    }

    connector += isActive ? " ".repeat(innerWidth) : "─".repeat(innerWidth);
  }
  // Right edge
  connector += activeIndex === labels.length - 1 ? "│" : "┤";

  const connectorLine = Box.text(connector).pipe(Box.annotate(Ansi.cyan));

  // Content panel: width matches tabs
  const tabContent = Box.para(
    "This panel joins seamlessly with the active tab above " +
      "because the tab's bottom border is disabled.",
    Box.left,
    tabs.cols - 4 // -2 border -2 padding
  ).pipe(
    Box.alignHoriz(Box.left, tabs.cols - 4),
    Box.pad(0, 1),
    Box.border("rounded", {
      sides: { top: false },
      annotation: Ansi.cyan,
    })
  );

  const tabSection = Box.vcat([tabs, connectorLine, tabContent], Box.left);

  return Box.vcat(
    [sectionLabel("Border Layouts", width), tabSection],
    Box.left
  );
};

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

const buildDemo = (width: number) =>
  Box.vsep(
    [
      header(width),
      subtitle(width),
      wrapDemo(width),
      columnDemo(width),
      alignmentDemo(width),
      barChartDemo(width),
      positionDemo(width),
      borderSidesDemo(width),
    ],
    1,
    Box.left
  );

const Action = Data.taggedEnum<Prompt.ActionDefinition>();

const view = (size: Terminal.Size, offset: number) => {
  const demo =
    size.columns < 20 || size.rows < 2
      ? Box.text("Resize window · q quits".slice(0, size.columns))
      : buildDemo(size.columns);
  const page = Math.max(1, size.rows - 1);
  const maxOffset = Math.max(0, demo.rows - page);
  return { size, demo, page, maxOffset, offset: Math.min(offset, maxOffset) };
};

export const main = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const width = Math.max(20, process.stdout.columns || 76);
    yield* terminal.display(`${Box.renderPrettySync(buildDemo(width))}\n`);
    return;
  }
  const sizes = yield* terminal.size;
  const initial = view(yield* Queue.take(sizes), 0);
  const changes = yield* Queue.sliding<Terminal.Size>(1);
  yield* Stream.fromQueue(sizes).pipe(
    Stream.runForEach((size) => Queue.offer(changes, size)),
    Effect.forkScoped
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
  yield* Prompt.Custom<typeof initial, void, Terminal.Size>(initial, changes, {
    render: (_, action) =>
      Effect.sync(() => {
        if (action._tag !== "NextFrame") return "";
        const { size, demo, offset, page } = action.state;
        const body = Box.renderPrettySync(
          demo.pipe(Box.cropHeight(offset, page))
        ).replaceAll("\n", "\r\n");
        const footer =
          size.rows > 1 && size.columns >= 20
            ? Box.renderPrettySync(Cmd.cursorTo(0, size.rows - 1)) +
              (size.columns >= 36
                ? "↑/↓ scroll · PgUp/PgDn page · q quit"
                : "↑/↓ scroll · q quit")
            : "";
        return Box.renderPrettySync(Cmd.clearScreen) + body + footer;
      }),
    process: (input, state) =>
      Effect.sync(() => {
        if (input._tag === "Event")
          return Action.NextFrame({ state: view(input.value, state.offset) });
        const key = input.input.key.name;
        if (key === "q" || key === "enter" || key === "return")
          return Action.Submit({ value: undefined });
        const scroll: Record<string, number | undefined> = {
          up: -1,
          down: 1,
          pageup: -state.page,
          pagedown: state.page,
        };
        const delta = scroll[key];
        if (delta === undefined) return Action.Beep();
        return Action.NextFrame({
          state: {
            ...state,
            offset: Math.max(
              0,
              Math.min(state.maxOffset, state.offset + delta)
            ),
          },
        });
      }),
    clear: () => Effect.succeed(""),
  });
}).pipe(Effect.scoped);
