/** @internal */
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as Box from "../Box.js";
import type { Stack } from "../Layout.js";
import type { RenderConfig } from "../Renderer.js";
import type { ResolvedFrame } from "./frame.js";
import { encodingView, FrameResolutionError, resolveLayers } from "./frame.js";
import { FrameEncoder, FrameEncodingError } from "./frame-encoder.js";
import { renderLinesToString } from "./renderer.js";

export interface FrameOutput {
  readonly lines: ReadonlyArray<string>;
  readonly output: string;
  readonly resolved: ResolvedFrame;
}

export const resolve = <A>(
  self: Box.Box<A> | Stack<A>
): Effect.Effect<ResolvedFrame, FrameResolutionError> =>
  Effect.try({
    try: () =>
      Box.isBox(self)
        ? resolveLayers([{ box: self, x: 0, y: 0, z: 0 }], self.cols, self.rows)
        : resolveLayers(self.layers, self.width, self.height),
    catch: (cause) =>
      cause instanceof FrameResolutionError
        ? cause
        : new FrameResolutionError({
            message: "Unable to resolve frame",
            cause,
          }),
  });

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
  (self: ResolvedFrame, config?: RenderConfig) =>
    Effect.gen(function* () {
      const encoder = yield* FrameEncoder;
      const view = yield* Effect.try({
        try: () => encodingView(self),
        catch: (cause) =>
          new FrameEncodingError({ message: "Invalid resolved frame", cause }),
      });
      const encoded = yield* encoder.encodeResolved(view);
      if (
        encoded.length !== self.rows ||
        encoded.some((line) => typeof line !== "string")
      )
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
      "_tag" in args[0] &&
      args[0]._tag === "Stack"),
  <A>(self: Box.Box<A> | Stack<A>, config?: RenderConfig) =>
    Effect.flatMap(resolve(self), (resolved) => encode(resolved, config))
);
