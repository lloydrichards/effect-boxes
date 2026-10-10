/** @internal */
import { Context, Data, Effect, Layer } from "effect";
import type { FrameEncodingView } from "./frame.js";

export class FrameEncodingError extends Data.TaggedError("FrameEncodingError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface FrameEncoderShape {
  readonly encodeResolved: (
    self: FrameEncodingView
  ) => Effect.Effect<ReadonlyArray<string>, FrameEncodingError>;
}

export class FrameEncoder extends Context.Service<
  FrameEncoder,
  FrameEncoderShape
>()("effect-boxes/FrameEncoder") {}

export const layer = (
  implementation: FrameEncoderShape
): Layer.Layer<FrameEncoder> => Layer.succeed(FrameEncoder, implementation);

export const PlainFrameEncoderLive: Layer.Layer<FrameEncoder> = layer({
  encodeResolved: Effect.fn("FrameEncoder.plain")(function* (self) {
    return self.lines.map((line) => line.map((run) => run.text).join(""));
  }),
});

export const AnsiFrameEncoderLive: Layer.Layer<FrameEncoder> = layer({
  encodeResolved: Effect.fn("FrameEncoder.ansi")(function* (self) {
    return self.lines.map((line) =>
      line
        .map((run) => {
          if (run.style.length === 0) return run.text;
          const code = run.style.map((attribute) => attribute.code).join(";");
          // Each styled run starts from terminal defaults and restores defaults.
          // This isolates sibling runs, rows, and subsequent terminal writes.
          return `\u001b[0;${code}m${run.text}\u001b[0m`;
        })
        .join("")
    );
  }),
});
