/**
 * Encodes resolved frames independently of the tree-oriented Renderer service.
 *
 * Custom backends receive immutable paint runs with effective ANSI styles.
 * Register frame support explicitly with layer. Existing Renderer implementations
 * remain valid for ordinary Box rendering.
 *
 * @since 0.18.0
 * @module
 */
import type { Layer } from "effect";
import type * as internalFrame from "./internal/frame.js";
import * as internal from "./internal/frame-encoder.js";

/**
 * Describes a whole-grapheme paint run at a terminal column offset.
 * Styles are effective supported ANSI attributes with commands removed.
 *
 * - `col`: zero-based terminal column where the run starts.
 * - `cols`: terminal display width of the run, including wide graphemes.
 * - `text`: the graphemes to write at that position.
 * - `style`: effective `AnsiStyle` attributes for the run.
 *
 * @category models
 */
export type PaintRun = internalFrame.PaintRun;

/**
 * Describes all viewport rows, each covered by contiguous paint runs.
 * Empty-width rows contain no runs. Ownership and reactive metadata stay private.
 *
 * - `rows`: viewport height in terminal rows.
 * - `cols`: viewport width in terminal columns.
 * - `lines`: a readonly array of rows, each a readonly array of `PaintRun` values.
 *   There is one row per viewport row, including blank and padded rows.
 *
 * @category models
 */
export type FrameEncodingView = internalFrame.FrameEncodingView;

/**
 * Defines an effectful frame encoder. Acquire dependencies when building its layer.
 * Return one string per viewport row, preserving display widths and row boundaries.
 * Output rows may contain printable text and ANSI SGR formatting. Other terminal
 * controls and rows with a different display width fail with FrameEncodingError.
 * Unsupported backend content fails with FrameEncodingError.
 *
 * The `encodeResolved` field accepts a `FrameEncodingView` and returns
 * `Effect<ReadonlyArray<string>, FrameEncodingError>`. The returned array has
 * one string per viewport row. The encoder receives resolved geometry, so it
 * does not need to walk Boxes, clip layers, or determine cell ownership.
 * Acquire any required services before registering the encoder with `layer`.
 *
 * @category models
 */
export type Shape = internal.FrameEncoderShape;

/**
 * Identifies the required frame encoding capability.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import * as FrameEncoder from "effect-boxes/FrameEncoder"
 * const encoder = Effect.gen(function* () {
 *   return yield* FrameEncoder.FrameEncoder
 * })
 * ```
 * @category services
 */
export const FrameEncoder: typeof internal.FrameEncoder = internal.FrameEncoder;

/** @category models */
export type FrameEncoder = internal.FrameEncoder;

/**
 * Reports a backend encoding failure with optional diagnostic cause.
 *
 * @example
 * ```typescript
 * import * as FrameEncoder from "effect-boxes/FrameEncoder"
 * const failure = new FrameEncoder.FrameEncodingError({ message: "Unsupported glyph" })
 * ```
 * @category errors
 */
export const FrameEncodingError: typeof internal.FrameEncodingError =
  internal.FrameEncodingError;

/** @category errors */
export type FrameEncodingError = internal.FrameEncodingError;

/**
 * Registers explicit frame support for a backend.
 * Combine with the backend's ordinary Renderer layer using Effect Layer.merge.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import * as FrameEncoder from "effect-boxes/FrameEncoder"
 * const custom = FrameEncoder.layer({
 *   encodeResolved: (self) => Effect.succeed(
 *     self.lines.map((line) => line.map((run) => run.text).join(""))
 *   ),
 * })
 * ```
 * @category constructors
 */
export const layer: (implementation: Shape) => Layer.Layer<FrameEncoder> =
  internal.layer;

/**
 * Encodes frames as plain text, deliberately discarding supported styles.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import * as Box from "effect-boxes/Box"
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as FrameEncoder from "effect-boxes/FrameEncoder"
 * const result = Renderer.frame(Box.text("Hello")).pipe(
 *   Effect.provide(FrameEncoder.PlainFrameEncoderLive)
 * )
 * ```
 * @category layers
 */
export const PlainFrameEncoderLive: Layer.Layer<FrameEncoder> =
  internal.PlainFrameEncoderLive;

/**
 * Encodes effective styles into isolated ANSI SGR runs.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import * as Box from "effect-boxes/Box"
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as FrameEncoder from "effect-boxes/FrameEncoder"
 * const result = Renderer.frame(Box.text("Hello")).pipe(
 *   Effect.provide(FrameEncoder.AnsiFrameEncoderLive)
 * )
 * ```
 * @category layers
 */
export const AnsiFrameEncoderLive: Layer.Layer<FrameEncoder> =
  internal.AnsiFrameEncoderLive;
