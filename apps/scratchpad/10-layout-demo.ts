/** @effect-diagnostics unstableApiUsage:skip-file */
/**
 * Interactive layout demo showcasing Flex, Grid, and Container combinators.
 *
 * Use ←/→ arrow keys to resize the container width and watch layouts reflow.
 * Press Enter or q to exit.
 */
import { BunServices } from "@effect/platform-bun";
import { Data, Effect, Match, Terminal } from "effect";
import { Prompt } from "effect/cli";
import { Ansi, Box, Cmd, Container, Flex, Grid } from "effect-boxes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIN_WIDTH = 40;
const MAX_WIDTH = 400;
const STEP = 2;

const sectionLabel = (text: string, w: number) =>
  Box.text(` ${text} `).pipe(
    Box.truncate(w, Box.left),
    Box.annotate(
      Ansi.combine(Ansi.bold, Ansi.bgColorRGB(45, 85, 155), Ansi.white)
    )
  );

const dimRule = (width: number) =>
  Box.text("─".repeat(width)).pipe(Box.annotate(Ansi.dim));

const propNote = (prop: string, explanation: string) =>
  Box.hsep(
    [
      Box.text(prop).pipe(Box.annotate(Ansi.yellow)),
      Box.text(explanation).pipe(Box.annotate(Ansi.dim)),
    ],
    1,
    Box.left
  );

const lbl = (text: string) => Box.text(text).pipe(Box.annotate(Ansi.cyan));

const card = (content: Box.Box<Ansi.AnsiStyle>) =>
  content.pipe(Box.pad(0, 1), Box.border("rounded"));

// ---------------------------------------------------------------------------
// Shared grid card data
// ---------------------------------------------------------------------------

const gridCardData = [
  { name: "Alpha", color: Ansi.red },
  { name: "Beta", color: Ansi.green },
  { name: "Gamma", color: Ansi.blue },
  { name: "Delta", color: Ansi.yellow },
  { name: "Epsilon", color: Ansi.magenta },
  { name: "Zeta", color: Ansi.cyan },
];

const gridCardInners = gridCardData.map(({ name, color }) =>
  Box.vcat(
    [
      Box.combineAll([
        Box.text("■ ").pipe(Box.annotate(color)),
        Box.text(name).pipe(Box.annotate(Ansi.combine(Ansi.bold, Ansi.white))),
      ]),
      Box.text("  Item card").pipe(Box.annotate(Ansi.dim)),
    ],
    Box.left
  ).pipe(Box.pad(0, 1))
);

// ---------------------------------------------------------------------------
// Section builders (all take width)
// ---------------------------------------------------------------------------

const flexRowSection = (w: number) =>
  Container.make({ width: w, padding: 0 }, (ctx) =>
    Box.vcat(
      [
        sectionLabel("Flex.row — Horizontal Space Distribution", w),
        propNote("Flex.fixed(box)", "keeps intrinsic width"),
        propNote("Flex.grow(box, factor?)", "stretches, content unchanged"),
        propNote(
          "Flex.fill((w) => box, factor?)",
          "builder gets allocated width"
        ),
        Box.emptyBox(1, 1),
        lbl("fixed + fill(1) + fixed"),
        Flex.row(
          [
            Flex.fixed(
              Box.text("FIXED").pipe(
                Box.minHeight(2),
                Box.pad(0, 1),
                Box.border("single")
              )
            ),
            Flex.fill((fw) =>
              Box.text("FILL (factor=1)").pipe(
                Box.minHeight(2),
                Box.minWidth(fw - 4),
                Box.pad(0, 1),
                Box.border("double")
              )
            ),
            Flex.fixed(
              Box.text("FIXED").pipe(
                Box.minHeight(2),
                Box.pad(0, 1),
                Box.border("single")
              )
            ),
          ],
          ctx.width,
          { gap: 1 }
        ),
        lbl("fill(1) + fill(2) — proportional split"),
        Flex.row(
          [
            Flex.fill(
              (fw) =>
                Box.text("1/3 width").pipe(
                  Box.minWidth(fw - 4),
                  Box.pad(0, 1),
                  Box.border("rounded")
                ),
              1
            ),
            Flex.fill(
              (fw) =>
                Box.text("2/3 width").pipe(
                  Box.minWidth(fw - 4),
                  Box.pad(0, 1),
                  Box.border("rounded")
                ),
              2
            ),
          ],
          ctx.width,
          { gap: 1 }
        ),

        lbl("fill(1) + fill(1) + fill(1) — equal thirds"),
        Flex.row(
          [
            Flex.fill(
              (fw) =>
                Box.text("1/3").pipe(
                  Box.minWidth(fw - 4),
                  Box.pad(0, 1),
                  Box.border("rounded")
                ),
              1
            ),
            Flex.fill(
              (fw) =>
                Box.text("1/3").pipe(
                  Box.minWidth(fw - 4),
                  Box.pad(0, 1),
                  Box.border("rounded")
                ),
              1
            ),
            Flex.fill(
              (fw) =>
                Box.text("1/3").pipe(
                  Box.minWidth(fw - 4),
                  Box.pad(0, 1),
                  Box.border("rounded")
                ),
              1
            ),
          ],
          ctx.width,
          { gap: 1 }
        ),
      ],
      Box.left
    )
  );

const flexSpacerSection = (w: number) =>
  Container.make({ width: w, padding: 0 }, (ctx) =>
    Box.vcat(
      [
        sectionLabel("Flex.spacer — Pushing Children Apart", w),

        propNote(
          "Flex.spacer()",
          "empty grow child that pushes siblings apart"
        ),
        Box.emptyBox(1, 1),
        lbl("fixed + spacer + fixed"),
        Flex.row(
          [
            Flex.fixed(
              Box.text("Logo").pipe(
                Box.annotate(Ansi.combine(Ansi.bold, Ansi.white))
              )
            ),
            Flex.spacer(),
            Flex.fixed(Box.text("[Menu]").pipe(Box.annotate(Ansi.dim))),
          ],
          ctx.width - 4
        ).pipe(Box.pad(0, 1), Box.border("rounded")),
        lbl("fixed + spacer + fixed + spacer + fixed"),
        Flex.row(
          [
            Flex.fixed(
              Box.combineAll([
                Box.text("● ").pipe(Box.annotate(Ansi.green)),
                Box.text("Status: OK"),
              ])
            ),
            Flex.spacer(),
            Flex.fixed(Box.text("Task: Build")),
            Flex.spacer(),
            Flex.fixed(Box.text("▸ Run").pipe(Box.annotate(Ansi.cyan))),
          ],
          ctx.width - 4
        ).pipe(Box.pad(0, 1), Box.border("rounded")),
        lbl("Toolbar: button groups with spacer in the middle"),
        Flex.row(
          [
            Flex.fixed(
              Box.hcat(
                [card(Box.text("Save")), card(Box.text("Undo"))],
                Box.top
              )
            ),
            Flex.spacer(),
            Flex.fixed(
              Box.hcat(
                [card(Box.text("Help")), card(Box.text("Quit"))],
                Box.top
              )
            ),
          ],
          ctx.width
        ),
      ],
      Box.left
    )
  );

const gridMakeSection = (w: number) => {
  const colWidth = Math.max(12, Math.floor((w - 4) / 3));
  const stretchedCards = gridCardInners.map((inner) =>
    inner.pipe(Box.minWidth(colWidth - 2), Box.border("rounded"))
  );

  return Box.vcat(
    [
      sectionLabel("Grid.make — Fixed Column Grid", w),
      propNote("cols", "number of columns per row"),
      propNote("colWidth", "fixed character width per cell"),
      propNote("gap: [h, v]", "horizontal and vertical gaps"),
      Box.emptyBox(1, 1),
      lbl(`Grid.make(cards, { cols: 3, colWidth: ${colWidth}, gap: [2, 1] })`),
      Grid.make(stretchedCards, {
        cols: 3,
        colWidth,
        gap: [2, 1],
      }),
    ],
    Box.left
  );
};

const gridAutoSection = (w: number) => {
  const renderAtWidth = (containerWidth: number) => {
    const minColWidth = 15;
    const gap = 1;
    const cols = Math.min(
      gridCardInners.length,
      Math.max(1, Math.floor((containerWidth + gap) / (minColWidth + gap)))
    );
    const colWidth = Math.floor((containerWidth - (cols - 1) * gap) / cols);
    const cards = gridCardInners.map((inner) =>
      inner.pipe(Box.minWidth(colWidth - 2), Box.border("rounded"))
    );
    return Box.vcat(
      [
        lbl(`width=${containerWidth}  →  ${cols} columns`),
        Grid.make(cards, {
          cols,
          colWidth,
          gap: [gap, 0],
        }),
      ],
      Box.left
    );
  };

  // Show at current width and two smaller breakpoints
  const w2 = Math.max(MIN_WIDTH, Math.floor(w * 0.6));

  return Box.vcat(
    [
      sectionLabel("Grid.auto — Responsive Column Count", w),
      propNote("minColWidth", "minimum width before dropping a column"),
      propNote("containerWidth", "available width drives column count"),
      Box.emptyBox(1, 1),
      Box.text("Same 6 items at different widths:").pipe(
        Box.annotate(Ansi.dim)
      ),
      renderAtWidth(w),
      renderAtWidth(w2),
    ],
    Box.left
  );
};

const ruler = (rw: number, labelText: string) =>
  Box.combineAll([
    Box.text("├").pipe(Box.annotate(Ansi.dim)),
    Box.text(
      "─".repeat(Math.max(0, Math.floor((rw - labelText.length - 4) / 2)))
    ).pipe(Box.annotate(Ansi.dim)),
    Box.text(` ${labelText} `).pipe(Box.annotate(Ansi.cyan)),
    Box.text(
      "─".repeat(Math.max(0, Math.ceil((rw - labelText.length - 4) / 2)))
    ).pipe(Box.annotate(Ansi.dim)),
    Box.text("┤").pipe(Box.annotate(Ansi.dim)),
  ]);

const containerSection = (w: number) =>
  Container.make({ width: w, padding: 0 }, (ctx) => {
    const outerWidth = ctx.width;

    return Box.vcat(
      [
        sectionLabel("Container.make — Width & Padding Context", w),
        propNote("width", "total container width"),
        propNote("padding", "subtracted to get innerWidth"),
        propNote("ctx.innerWidth", "usable width after padding"),
        Box.emptyBox(1, 1),
        Container.make({ width: outerWidth - 2, padding: 1 }, (outer) =>
          Box.vcat(
            [
              Box.text(
                `width: ${outer.width + 2}, innerWidth: ${outer.innerWidth}`
              ).pipe(Box.annotate(Ansi.white)),
              Container.make(
                { width: outer.innerWidth - 2, padding: 2 },
                (mid) =>
                  Box.vcat(
                    [
                      Box.text(
                        `width: ${mid.width + 2}, innerWidth: ${mid.innerWidth}`
                      ).pipe(Box.annotate(Ansi.white)),
                      Container.make(
                        { width: mid.innerWidth - 2, padding: 2 },
                        (inner) =>
                          Box.text(
                            `width: ${inner.width + 2}, innerWidth: ${inner.innerWidth}`
                          ).pipe(Box.annotate(Ansi.white))
                      ).pipe(Box.border("single", { annotation: Ansi.dim })),
                    ],
                    Box.left
                  )
              ).pipe(Box.border("rounded", { annotation: Ansi.dim })),
            ],
            Box.left
          )
        ).pipe(Box.border("double", { annotation: Ansi.dim })),
        ruler(outerWidth, `width: ${outerWidth}`),
      ],
      Box.left
    );
  });

const dashboardSection = (w: number) =>
  Container.make({ width: w, padding: 0 }, (ctx) => {
    // ── Header ──
    const headerNav = Flex.row(
      [
        Flex.fixed(
          Box.text("◆ Dashboard").pipe(
            Box.annotate(Ansi.combine(Ansi.bold, Ansi.white))
          )
        ),
        Flex.spacer(),
        Flex.fixed(
          Box.hsep(
            [
              Box.text("Home").pipe(Box.annotate(Ansi.dim)),
              Box.text("Reports").pipe(Box.annotate(Ansi.dim)),
              Box.text("Settings").pipe(Box.annotate(Ansi.dim)),
            ],
            2,
            Box.top
          )
        ),
        Flex.spacer(),
        Flex.fixed(Box.text("▸ Admin").pipe(Box.annotate(Ansi.cyan))),
      ],
      ctx.width - 4
    ).pipe(Box.pad(0, 1), Box.border("rounded"));

    // ── Sidebar ──
    const sidebarWidth = 18;
    const sidebarInner = Box.vcat(
      [
        Box.text("Navigation").pipe(
          Box.annotate(Ansi.combine(Ansi.bold, Ansi.white))
        ),
        dimRule(sidebarWidth - 4),
        Box.combineAll([
          Box.text("● ").pipe(Box.annotate(Ansi.cyan)),
          Box.text("Overview").pipe(Box.annotate(Ansi.cyan)),
        ]),
        Box.text("  Analytics").pipe(Box.annotate(Ansi.dim)),
        Box.text("  Users").pipe(Box.annotate(Ansi.dim)),
        Box.text("  Billing").pipe(Box.annotate(Ansi.dim)),
        Box.text("  Logs").pipe(Box.annotate(Ansi.dim)),
      ],
      Box.left
    ).pipe(Box.pad(0, 1));

    // ── KPI Cards ──
    const kpiData = [
      { label: "Users", value: "1,247", trend: "▲ 12%", color: Ansi.green },
      { label: "Revenue", value: "$48,290", trend: "▲ 8%", color: Ansi.green },
      { label: "Errors", value: "23", trend: "▼ 3%", color: Ansi.red },
    ];

    const makeKpiCards = (mainWidth: number) => {
      const gap = 1;
      const cols = 3;
      const colWidth = Math.floor((mainWidth - (cols - 1) * gap) / cols);

      const cards = kpiData.map(({ label: kpiLabel, value, trend, color }) =>
        Box.vcat(
          [
            Flex.row(
              [
                Flex.fixed(Box.text(kpiLabel).pipe(Box.annotate(Ansi.dim))),
                Flex.spacer(),
                Flex.fixed(Box.text(trend).pipe(Box.annotate(color))),
              ],
              colWidth - 4
            ),
            Box.text(value).pipe(
              Box.annotate(Ansi.combine(Ansi.bold, Ansi.white))
            ),
          ],
          Box.left
        ).pipe(Box.minWidth(colWidth - 4), Box.pad(0, 1), Box.border("rounded"))
      );

      return Grid.make(cards, { cols, colWidth, gap: [gap, 0] });
    };

    // ── Activity Table ──
    const makeActivityTable = (mainWidth: number) => {
      const activities = [
        {
          time: "09:41",
          icon: "●",
          desc: "Deploy completed",
          env: "production",
          status: "✓",
          color: Ansi.green,
        },
        {
          time: "09:38",
          icon: "●",
          desc: "Test suite passed",
          env: "ci/cd",
          status: "✓",
          color: Ansi.green,
        },
        {
          time: "09:35",
          icon: "○",
          desc: "Build started",
          env: "staging",
          status: " ",
          color: Ansi.yellow,
        },
        {
          time: "09:30",
          icon: "●",
          desc: "PR merged #142",
          env: "main",
          status: "✓",
          color: Ansi.green,
        },
      ];

      const tableRows = activities.map(
        ({ time, icon, desc, env, status, color }) =>
          Flex.row(
            [
              Flex.fixed(Box.text(time).pipe(Box.annotate(Ansi.dim))),
              Flex.fixed(Box.text(` ${icon} `).pipe(Box.annotate(color))),
              Flex.fixed(
                Box.text(desc).pipe(
                  Box.truncate(22, Box.left),
                  Box.alignHoriz(Box.left, 22)
                )
              ),
              Flex.fixed(
                Box.text(env).pipe(
                  Box.annotate(Ansi.dim),
                  Box.truncate(12, Box.left),
                  Box.alignHoriz(Box.left, 12)
                )
              ),
              Flex.spacer(),
              Flex.fixed(Box.text(status).pipe(Box.annotate(color))),
            ],
            mainWidth - 4
          )
      );

      return Box.vcat(
        [
          Box.text("Recent Activity").pipe(
            Box.annotate(Ansi.combine(Ansi.bold, Ansi.white))
          ),
          dimRule(mainWidth - 4),
          ...tableRows,
        ],
        Box.left
      ).pipe(Box.pad(0, 1), Box.border("single"));
    };

    // ── Body: sidebar + main ──
    const mainArea = (mw: number) =>
      Box.vcat([makeKpiCards(mw), makeActivityTable(mw)], Box.left);

    const mainWidth = ctx.width - sidebarWidth - 1;
    const main = mainArea(mainWidth);
    const mainHeight = Box.rows(main);
    const sidebar = sidebarInner.pipe(
      Box.minHeight(mainHeight - 2),
      Box.border("single")
    );

    const body = Flex.row([Flex.fixed(sidebar), Flex.fixed(main)], ctx.width, {
      gap: 1,
    });

    // ── Footer ──
    const footer = Flex.row(
      [
        Flex.fixed(Box.text("v2.4.1").pipe(Box.annotate(Ansi.dim))),
        Flex.spacer(),
        Flex.fixed(
          Box.text("© 2025 Effect Boxes").pipe(Box.annotate(Ansi.dim))
        ),
      ],
      ctx.width - 4
    ).pipe(Box.pad(0, 1), Box.border("rounded"));

    return Box.vcat(
      [
        sectionLabel("Dashboard — Combining All Layout Helpers", w),
        propNote("Container + Flex + Grid", "composed into a realistic layout"),
        Box.emptyBox(1, 1),
        headerNav,
        body,
        footer,
      ],
      Box.left
    );
  });

// ---------------------------------------------------------------------------
// Section registry
// ---------------------------------------------------------------------------

const sections: ReadonlyArray<{
  readonly name: string;
  readonly build: (w: number) => Box.Box<Ansi.AnsiStyle>;
}> = [
  { name: "Flex.row", build: flexRowSection },
  { name: "Flex.spacer", build: flexSpacerSection },
  { name: "Grid.make", build: gridMakeSection },
  { name: "Grid.auto", build: gridAutoSection },
  { name: "Container", build: containerSection },
  { name: "Dashboard", build: dashboardSection },
];

const buildFrame = (w: number, h: number, sectionIndex: number): string => {
  const section = sections[sectionIndex]!;

  // Navigation dots
  const items = sections.map((s, i) =>
    Box.text(s.name).pipe(
      Box.pad(0, 2),
      Box.annotate(
        i === sectionIndex ? Ansi.combine(Ansi.bold, Ansi.bgBlack) : Ansi.dim
      )
    )
  );

  const titleBox = Box.text("Layout").pipe(
    Box.moveLeft(2),
    Box.annotate(Ansi.combine(Ansi.bold, Ansi.colorRGB(255, 165, 0)))
  );

  const titleNav = Flex.row(
    [
      Flex.spacer(),
      Flex.fixed(Box.hcat([titleBox, ...items], Box.top)),
      Flex.spacer(),
    ],
    w,
    { align: Box.center1 }
  );

  const controls = Box.hsep(
    [
      Box.text("←/→ resize").pipe(Box.annotate(Ansi.dim)),
      Box.text("space next").pipe(Box.annotate(Ansi.dim)),
      Box.text(`${sectionIndex + 1}/${sections.length}`).pipe(
        Box.annotate(Ansi.dim)
      ),
      Box.text("q quit").pipe(Box.annotate(Ansi.dim)),
    ],
    2,
    Box.top
  ).pipe(Box.alignHoriz(Box.center1, Box.cols(titleNav)));

  const chrome = Box.vcat(
    [Box.emptyBox(1, 1), ruler(w, `width: ${w}`), titleNav, controls],
    Box.left
  );

  const frame = Flex.col([Flex.grow(section.build(w)), Flex.fixed(chrome)], h, {
    align: Box.left,
  });

  return Box.renderPrettySync(Box.combine(Cmd.clearScreen, frame));
};

// ---------------------------------------------------------------------------
// Interactive Prompt
// ---------------------------------------------------------------------------

type LayoutState = {
  readonly width: number;
  readonly sectionIndex: number;
};

const Action = Data.taggedEnum<Prompt.ActionDefinition>();

const LayoutPrompt = (initialWidth: number): Prompt.Prompt<string> => {
  let entered = false;

  const initialState: LayoutState = {
    width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, initialWidth)),
    sectionIndex: 0,
  };

  return Prompt.Custom<LayoutState, string>(initialState, {
    render: Effect.fnUntraced(function* (
      _state: LayoutState,
      action: Prompt.Action<LayoutState, string>
    ) {
      return Action.$match(action, {
        Beep: () => "",

        NextFrame: ({ state: nextState }) => {
          const termH = process.stdout.rows ?? 24;
          const frame = buildFrame(
            nextState.width,
            termH,
            nextState.sectionIndex
          );
          if (!entered) {
            entered = true;
            return (
              Box.renderPrettySync(
                Box.combineAll([Cmd.altScreenEnter, Cmd.cursorHide])
              ) + frame
            );
          }
          return frame;
        },

        Submit: () =>
          Box.renderPrettySync(
            Box.combineAll([
              Cmd.altScreenLeave,
              Cmd.cursorShow,
              Box.hsep(
                [
                  Box.text("✔").pipe(Box.annotate(Ansi.green)),
                  Box.text("Layout demo").pipe(Box.annotate(Ansi.bold)),
                ],
                1,
                Box.top
              ),
              Box.text("") as Box.Box<Ansi.AnsiStyle>,
            ])
          ),
      });
    }),

    process: Effect.fnUntraced(function* (input, state) {
      const lastIndex = sections.length - 1;

      return Match.value(input.key.name).pipe(
        Match.when("left", () =>
          Action.NextFrame({
            state: {
              ...state,
              width: Math.max(MIN_WIDTH, state.width - STEP),
            },
          })
        ),
        Match.when("right", () =>
          Action.NextFrame({
            state: {
              ...state,
              width: Math.min(MAX_WIDTH, state.width + STEP),
            },
          })
        ),
        Match.when("space", () =>
          Action.NextFrame({
            state: {
              ...state,
              sectionIndex:
                state.sectionIndex < lastIndex ? state.sectionIndex + 1 : 0,
            },
          })
        ),
        Match.whenOr("enter", "return", () => Action.Submit({ value: "done" })),
        Match.when("q", () => Action.Submit({ value: "done" })),
        Match.orElse(() => Action.Beep())
      );
    }),

    clear: Effect.fnUntraced(function* () {
      return "";
    }),
  });
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export const main = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;
  const termWidth = yield* terminal.columns;
  yield* LayoutPrompt(Math.min(termWidth, 80));
}).pipe(Effect.provide(BunServices.layer));
