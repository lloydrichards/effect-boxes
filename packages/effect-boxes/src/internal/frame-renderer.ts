/** @internal */
import { Effect, Predicate, Schema } from "effect";
import { dual } from "effect/Function";
import * as Box from "../Box.js";
import type { Stack } from "../Layout.js";
import type { RenderConfig } from "../Renderer.js";
import type { ResolvedFrame } from "./frame.js";
import {
  encodingView,
  type FrameResolutionError,
  resolveLayers,
} from "./frame.js";
import { FrameEncoder, FrameEncodingError } from "./frame-encoder.js";
import { renderLinesToString } from "./renderer.js";
import * as Width from "./width.js";

export interface FrameOutput {
  readonly lines: ReadonlyArray<string>;
  readonly output: string;
  readonly resolved: ResolvedFrame;
}

export const resolve: <A>(
  self: Box.Box<A> | Stack<A>
) => Effect.Effect<ResolvedFrame, FrameResolutionError> = Effect.fn(
  "Renderer.resolve"
)(function* <A>(self: Box.Box<A> | Stack<A>) {
  return yield* Effect.fromResult(
    Box.isBox(self)
      ? resolveLayers([{ box: self, x: 0, y: 0, z: 0 }], self.cols, self.rows)
      : resolveLayers(self.layers, self.width, self.height)
  );
});
const decodeLines = Schema.decodeUnknownEffect(Schema.Array(Schema.String));

const decodeRow = Schema.decodeUnknownEffect(
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject row-changing terminal controls after removing SGR.
  Schema.String.check(Schema.isPattern(/^[^\u0000-\u001f\u007f-\u009f]*$/u))
);

export const encode = dual<
  (
    config?: RenderConfig
  ) => (
    self: ResolvedFrame
  ) => Effect.Effect<FrameOutput, FrameEncodingError, FrameEncoder>,
  (
    self: ResolvedFrame,
    config?: RenderConfig
  ) => Effect.Effect<FrameOutput, FrameEncodingError, FrameEncoder>
>(
  (args) =>
    typeof args[0] === "object" && args[0] !== null && "regions" in args[0],
  Effect.fn("Renderer.encode")(function* (
    self: ResolvedFrame,
    config?: RenderConfig
  ) {
    const encoder = yield* FrameEncoder;
    const view = yield* Effect.fromOption(encodingView(self)).pipe(
      Effect.mapError(
        () => new FrameEncodingError({ message: "Invalid resolved frame" })
      )
    );
    const encoded = yield* encoder.encodeResolved(view).pipe(
      Effect.flatMap(decodeLines),
      Effect.mapError((cause) =>
        cause instanceof FrameEncodingError
          ? cause
          : new FrameEncodingError({
              message: "Frame encoder must return one string per viewport row",
              cause,
            })
      )
    );
    if (encoded.length !== self.rows)
      return yield* new FrameEncodingError({
        message: "Frame encoder must return one string per viewport row",
      });
    for (const line of encoded) {
      // SGR changes style without moving the cursor. Other controls can
      // invalidate ownership even when a width calculator strips them.
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Accept only geometry-neutral SGR escapes.
      const visible = line.replace(/(?:\u001b\[|\u009b)[0-9;:]*m/g, "");
      const row = yield* decodeRow(visible).pipe(
        Effect.mapError(
          (cause) =>
            new FrameEncodingError({
              message:
                "Frame encoder rows must contain text and ANSI SGR formatting only",
              cause,
            })
        )
      );
      if (Width.ofString(row) !== self.cols)
        return yield* new FrameEncodingError({
          message: "Frame encoder row width must match the resolved viewport",
        });
    }
    const lines = Object.freeze([...encoded]);
    return Object.freeze({
      lines,
      output: renderLinesToString([...lines], config),
      resolved: self,
    });
  })
);

export const frame = dual<
  (
    config?: RenderConfig
  ) => <A>(
    self: Box.Box<A> | Stack<A>
  ) => Effect.Effect<
    FrameOutput,
    FrameResolutionError | FrameEncodingError,
    FrameEncoder
  >,
  <A>(
    self: Box.Box<A> | Stack<A>,
    config?: RenderConfig
  ) => Effect.Effect<
    FrameOutput,
    FrameResolutionError | FrameEncodingError,
    FrameEncoder
  >
>(
  (args) =>
    Box.isBox(args[0]) ||
    (typeof args[0] === "object" &&
      args[0] !== null &&
      Predicate.isTagged(args[0], "Stack")),
  Effect.fn("Renderer.frame")(function* <A>(
    self: Box.Box<A> | Stack<A>,
    config?: RenderConfig
  ) {
    const resolved = yield* resolve(self);
    return yield* encode(resolved, config);
  })
);
