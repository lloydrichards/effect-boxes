import { Array, Context, Effect, Option, pipe } from "effect";
import { dual } from "effect/Function";
import type * as Annotation from "../Annotation";
import type * as Box from "../Box";
import type * as Reactive from "../Reactive";
import type * as R from "../Renderer";
import { blanks, isBox, match, merge, takeP, takePA } from "./box";
import { getPositions } from "./reactive";

export class Renderer extends Context.Service<
  Renderer,
  {
    readonly renderContent: <A>(box: Box.Box<A>) => Effect.Effect<string[]>;
    readonly postProcess: <A>(
      lines: string[],
      annotation?: Annotation.Annotation<A>
    ) => Effect.Effect<string[]>;
    readonly processor: R.TextProcessor;
  }
>()("Renderer") {}

export const defaultRenderConfig: R.RenderConfig = {
  preserveWhitespace: false,
};

export const renderBoxArray = <A>(
  boxes: Box.Box<A>[],
  renderRecursive: <B>(childBox: Box.Box<B>) => Effect.Effect<string[]>,
  combineLines: (rendered: string[][]) => string[]
): Effect.Effect<string[]> =>
  pipe(
    boxes,
    Array.match({
      onEmpty: () => Effect.succeed([]),
      onNonEmpty: (boxes) =>
        pipe(
          boxes,
          Array.head,
          Option.match({
            onNone: () => Effect.succeed([]),
            onSome: (firstBox) =>
              boxes.length === 1
                ? renderRecursive(firstBox)
                : pipe(
                    Effect.all(Array.map(boxes, renderRecursive)),
                    Effect.map(combineLines)
                  ),
          })
        ),
    })
  );

/** @internal */
export const renderBox = <A>(
  box: Box.Box<A>,
  processor: R.TextProcessor,
  renderRecursive: <B>(childBox: Box.Box<B>) => Effect.Effect<string[]>
): Effect.Effect<string[]> =>
  match(box, {
    blank: () =>
      Effect.succeed(
        // Zero-width boxes should render as empty, not as newlines
        box.cols === 0
          ? []
          : resizeBoxWithProcessor([""], box.rows, box.cols, processor)
      ),
    text: (text) =>
      Effect.succeed(
        resizeBoxWithProcessor([text], box.rows, box.cols, processor)
      ),
    row: (boxes) =>
      pipe(
        renderBoxArray(boxes, renderRecursive, merge),
        Effect.map((lines) =>
          resizeBoxWithProcessor(lines, box.rows, box.cols, processor)
        )
      ),
    col: (boxes) =>
      pipe(
        renderBoxArray(boxes, renderRecursive, Array.flatten),
        Effect.map((lines) =>
          resizeBoxWithProcessor(lines, box.rows, box.cols, processor)
        )
      ),
    subBox: (subBox, xAlign, yAlign) =>
      pipe(
        renderRecursive(subBox),
        Effect.map((rendered) =>
          resizeBoxAlignedWithProcessor(
            rendered,
            box.rows,
            box.cols,
            xAlign,
            yAlign,
            processor
          )
        )
      ),
  });

/** @internal */
const resizeBoxWithProcessor = (
  lines: string[],
  rows: number,
  cols: number,
  processor: R.TextProcessor
): string[] =>
  pipe(
    Array.map(lines, (line) => processor.processLine(line, cols)),
    takeP(blanks(cols), rows)
  );

/** @internal */
const resizeBoxAlignedWithProcessor = (
  lines: string[],
  rows: number,
  cols: number,
  hAlign: Box.Alignment,
  vAlign: Box.Alignment,
  processor: R.TextProcessor
): string[] =>
  takePA(
    Array.map(lines, (line) =>
      processor.processLineAligned(line, cols, hAlign)
    ),
    vAlign,
    blanks(cols),
    rows
  );

export const renderBoxToLines = <A>(
  box: Box.Box<A>
): Effect.Effect<string[], never, Renderer> =>
  Effect.gen(function* () {
    const renderer = yield* Renderer;
    return yield* renderer.renderContent(box);
  });

export const renderLinesToString = dual<
  (config?: R.RenderConfig) => (lines: string[]) => string,
  (lines: string[], config?: R.RenderConfig) => string
>(
  (args) => Array.isArray(args[0]),
  (lines, config) => {
    const { preserveWhitespace } = {
      ...defaultRenderConfig,
      ...config,
    };

    if (preserveWhitespace) {
      return lines.join("\n");
    }
    return lines.map((line) => line.trimEnd()).join("\n");
  }
);

// -----------------------------------------------------------------------------
// Renderer Selection Utilities
// -----------------------------------------------------------------------------

/** @internal */
export const render = dual<
  <A>(
    config?: R.RenderConfig
  ) => (self: Box.Box<A>) => Effect.Effect<string, never, Renderer>,
  <A>(
    self: Box.Box<A>,
    config?: R.RenderConfig
  ) => Effect.Effect<string, never, Renderer>
>(
  (args) => isBox(args[0]),
  (self, config) =>
    Effect.gen(function* () {
      const lines = yield* renderBoxToLines(self);
      return renderLinesToString(lines, config);
    })
);

// -----------------------------------------------------------------------------
// Tracked Rendering
// -----------------------------------------------------------------------------

/** @internal */
export interface RenderFrame {
  readonly lines: ReadonlyArray<string>;
  readonly output: string;
  readonly positions: Reactive.PositionMap;
}

/** @internal */
export const tracked = dual<
  <A>(
    config?: R.RenderConfig
  ) => (self: Box.Box<A>) => Effect.Effect<RenderFrame, never, Renderer>,
  <A>(
    self: Box.Box<A>,
    config?: R.RenderConfig
  ) => Effect.Effect<RenderFrame, never, Renderer>
>(
  (args) => isBox(args[0]),
  (self, config) =>
    Effect.gen(function* () {
      const lines = yield* renderBoxToLines(self);
      const output = renderLinesToString(lines, config);
      const positions = getPositions(self);
      return { lines, output, positions } as RenderFrame;
    })
);
