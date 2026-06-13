import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Cause, Console, Effect, Option } from "effect";
import { Command, Flag, Prompt } from "effect/unstable/cli";
import { Ansi, Box, Cmd } from "effect-boxes";
import { main as progressBarDemo } from "./01-progress-bar";
import { main as cursorDemo } from "./02-cursor";
import { main as staticDemo } from "./03-static-demo";
import { main as ansiDemo } from "./04-ansi-demo";
import { main as compositionDemo } from "./05-composition-demo";
import { main as htmlDemo } from "./06-html-rendering";
import { main as textPromptDemo } from "./07-text-prompt";
import { main as perlinDemo } from "./08-perlin-flow-field";
import { main as logViewerDemo } from "./09-log-viewer";
import { main as layoutDemo } from "./10-layout-demo";
import { main as boidsDemo } from "./11-boids-flocking";

const demos = [
  {
    title: "1. Reactive Progress Bar",
    value: "progress-bar",
    description:
      "Reactive.makeReactive IDs for efficient partial screen updates",
  },
  {
    title: "2. Cursor Positioning",
    value: "cursor",
    description: "Manual Cmd.cursorTo for character-level partial rerenders",
  },
  {
    title: "3. Static Layout",
    value: "static-demo",
    description: "Tables, color palette, and nested borders (no animation)",
  },
  {
    title: "4. ANSI Styles",
    value: "ansi-demo",
    description: "Foreground, background, RGB gradient, text attributes",
  },
  {
    title: "5. Cmd Composition",
    value: "composition",
    description: "Composing cursor save/restore and screen commands with Boxes",
  },
  {
    title: "6. HTML Rendering",
    value: "html",
    description: "Blog page rendered to HTML via HtmlAnnotation and Renderer",
  },
  {
    title: "7. Text Prompt",
    value: "text-prompt",
    description: "Custom interactive text input built with Prompt.custom",
  },
  {
    title: "8. Perlin Flow Field",
    value: "perlin",
    description: "Animated noise-driven walkers with cursor positioning",
  },
  {
    title: "9. Log Viewer",
    value: "log-viewer",
    description:
      "Scrollable stream log viewer with truncate, minWidth, maxWidth, maxHeight",
  },
  {
    title: "10. Layout Combinators",
    value: "layout",
    description:
      "Flex, Grid, and Container layout demos with a full dashboard example",
  },
  {
    title: "11. Boids Flocking",
    value: "boids",
    description:
      "Autonomous agents with separation, alignment, and cohesion (Nature of Code)",
  },
] as const;

type DemoId = (typeof demos)[number]["value"];

const runDemo = (id: DemoId) => {
  switch (id) {
    case "progress-bar":
      return progressBarDemo;
    case "static-demo":
      return staticDemo;
    case "ansi-demo":
      return ansiDemo;
    case "cursor":
      return cursorDemo;
    case "composition":
      return compositionDemo;
    case "html":
      return htmlDemo;
    case "text-prompt":
      return textPromptDemo;
    case "perlin":
      return perlinDemo;
    case "log-viewer":
      return logViewerDemo;
    case "layout":
      return layoutDemo;
    case "boids":
      return boidsDemo;
  }
};

const root = Command.make(
  "scratch",
  {
    run: Flag.integer("run").pipe(
      Flag.optional,
      Flag.withDescription("Run a demo by number (1-11)")
    ),
  },
  ({ run }) =>
    Effect.gen(function* () {
      if (Option.isSome(run)) {
        const demo = demos[run.value - 1];
        if (demo) {
          yield* runDemo(demo.value);
          return;
        }
      }

      const selected = yield* Prompt.select({
        message: "Select a demo to run",
        choices: [...demos],
      });

      yield* runDemo(selected);
    })
);

const program = root.pipe(
  Command.run({ version: "1.0.0" }),
  Effect.provide(BunServices.layer),
  Effect.catchCause((cause) => {
    if (Cause.hasInterruptsOnly(cause)) {
      const message = Box.text("Bye-bye!").pipe(
        Box.pad(0, 4),
        Box.border("rounded", { annotation: Ansi.yellow }),
        Box.moveDown(1)
      );
      return Console.log(
        Box.renderPrettySync(Box.combine(Cmd.altScreenLeave, message))
      );
    }
    return Effect.failCause(cause);
  })
);

BunRuntime.runMain(program);
