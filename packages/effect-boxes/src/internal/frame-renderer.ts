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
