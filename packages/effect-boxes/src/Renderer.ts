/**
 * Pluggable rendering pipeline for converting boxes to output strings.
 *
 * The `Renderer` module defines a `TextProcessor` interface and provides
 * Effect layers for plain text, ANSI, and HTML rendering. Use this when
 * you need configurable or effectful rendering (e.g., tracked rendering
 * with position maps).
 *
 * ## Common tasks
 *
 * - **Render a box**: {@link render}, {@link renderBoxToLines}
 * - **Use a layer**: {@link PlainRendererLive}, {@link AnsiRendererLive}, {@link HtmlRendererLive}
 * - **Track positions**: {@link tracked}
 *
 * @see {@link render} — main rendering function
 * @see {@link tracked} — rendering with position tracking
 *
 * @module
 */
import { type Effect, Layer } from "effect";
import type * as Box from "./Box.js";
import * as internal from "./internal/renderer.js";
import { makeAnsiRenderer } from "./renderer/AnsiRenderer.js";
import { HtmlRenderConfig, makeHtmlRenderer } from "./renderer/HtmlRenderer.js";
import { makePlainRenderer } from "./renderer/PlainRenderer.js";

/**
 * Text processing interface for customizing line rendering behavior.
 *
 * Defines how text lines are processed during rendering, including width
 * adjustment, alignment handling, and formatting preservation. Used by
 * different renderer implementations to control text output behavior.
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as Box from "effect-boxes/Box"
 *
 * const customProcessor: Renderer.TextProcessor = {
 *   processLine: (text, targetWidth) => {
 *     // Custom line processing logic
 *     return text.padEnd(targetWidth, ' ')
 *   },
 *   processLineAligned: (text, targetWidth, alignment) => {
 *     // Custom alignment logic
 *     switch (alignment) {
 *       case Box.center1:
 *         const padding = Math.floor((targetWidth - text.length) / 2)
 *         return ' '.repeat(padding) + text
 *       default:
 *         return text
 *     }
 *   },
 *   preservesFormatting: true
 * }
 * ```
 *
 * @category models
 */
export type TextProcessor = {
  readonly processLine: (text: string, targetWidth: number) => string;
  readonly processLineAligned: (
    text: string,
    targetWidth: number,
    alignment: Box.Alignment
  ) => string;
  readonly preservesFormatting: boolean;
};

/**
 * Discriminated union defining different rendering styles.
 *
 * Controls how boxes are rendered to text output. Plain rendering strips
 * all formatting and produces simple text, while Pretty rendering preserves
 * ANSI styling and formatting with optional whitespace handling.
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { Effect } from "effect"
 *
 * const styledBox = Box.text("Hello World").pipe(Box.annotate(Ansi.red))
 *
 * // Plain rendering - strips all formatting
 * const plainStyle: Renderer.RenderStyle = { _tag: "Plain" }
 *
 * // Pretty rendering - preserves ANSI formatting
 * const prettyStyle: Renderer.RenderStyle = {
 *   _tag: "Pretty",
 *   preserveWhitespace: true
 * }
 *
 * // Pretty rendering with default whitespace handling
 * const prettyDefault: Renderer.RenderStyle = { _tag: "Pretty" }
 * ```
 *
 * @category models
 */
export type RenderStyle =
  | { readonly _tag: "Plain" }
  | { readonly _tag: "Pretty"; readonly preserveWhitespace?: boolean };

/**
 * Configuration options for controlling rendering behavior.
 *
 * Provides fine-grained control over how boxes are converted to text output.
 * Options affect whitespace handling, line endings, and other text formatting
 * aspects during the rendering process.
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as Box from "effect-boxes/Box"
 * import { Effect, pipe } from "effect"
 *
 * const multiLineBox = Box.vcat([
 *   Box.text("Line 1   "),  // Trailing spaces
 *   Box.text("Line 2"),
 *   Box.text("   Line 3")   // Leading spaces
 * ], Box.left)
 *
 * // Default configuration - may trim whitespace
 * const defaultConfig: Renderer.RenderConfig = {}
 *
 * // Preserve all whitespace
 * const preserveConfig: Renderer.RenderConfig = {
 *   preserveWhitespace: true
 * }
 *
 * // Usage with render function
 * const renderWithConfig = pipe(
 *   multiLineBox,
 *   Renderer.render(preserveConfig),
 *   Effect.provide(Renderer.PlainRendererLive)
 * )
 * ```
 *
 * @category models
 */
export type RenderConfig = {
  readonly preserveWhitespace?: boolean;
};

/**
 * Renderer service tag for Effect.js dependency injection.
 *
 * Service interface for the rendering system, providing dependency injection
 * capabilities for Effect computations. Use this to access renderer operations
 * that require specific rendering implementations (Plain or ANSI).
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { Effect, pipe } from "effect"
 *
 * const renderProgram = (content: string) =>
 *   Effect.gen(function* () {
 *     const styledBox = Box.text(content).pipe(Box.annotate(Ansi.green))
 *     const result = yield* Renderer.render(styledBox)
 *     yield* Effect.log(`Rendered: ${result}`)
 *     return result
 *   })
 *
 * // Run with ANSI renderer
 * const program = pipe(
 *   renderProgram("Hello Effect!"),
 *   Effect.provide(Renderer.AnsiRendererLive)
 * )
 * ```
 *
 * @category services
 */
export const Renderer = internal.Renderer;

/**
 * Type representing the Renderer service interface.
 *
 * Defines the contract for renderer implementations, including text processing
 * capabilities and configuration options. Used for dependency injection in
 * Effect-based rendering operations.
 *
 * @category models
 */
export type Renderer = internal.Renderer;

/**
 * Default render configuration.
 *
 * Provides standard rendering settings that work well for most use cases.
 * Used as fallback when no explicit configuration is provided to rendering
 * functions. Contains sensible defaults for whitespace handling and formatting.
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as Box from "effect-boxes/Box"
 * import { Effect, pipe } from "effect"
 *
 * const box = Box.text("Hello World")
 *
 * // These are equivalent - both use default config
 * const render1 = pipe(
 *   box,
 *   Renderer.render(),
 *   Effect.provide(Renderer.PlainRendererLive)
 * )
 *
 * const render2 = pipe(
 *   box,
 *   Renderer.render(Renderer.defaultRenderConfig),
 *   Effect.provide(Renderer.PlainRendererLive)
 * )
 * ```
 *
 * @category configuration
 */
export const defaultRenderConfig: RenderConfig = internal.defaultRenderConfig;

// -----------------------------------------------------------------------------
// Core Rendering API (Effect-first)
// -----------------------------------------------------------------------------

/**
 * Renders a box to an array of text lines using the Renderer service.
 *
 * Core rendering function that converts a Box layout into an array of strings,
 * with each string representing a line of output. This is the foundation
 * of the rendering system and handles all layout calculations, text processing,
 * and annotation rendering according to the active renderer implementation.
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { Effect, pipe } from "effect"
 *
 * const complexBox = Box.vcat([
 *   Box.text("Header").pipe(Box.annotate(Ansi.bold)),
 *   Box.hcat([
 *     Box.text("Left"),
 *     Box.text("Right").pipe(Box.annotate(Ansi.red))
 *   ], Box.top),
 *   Box.text("Footer")
 * ], Box.left)
 *
 * const renderLines = pipe(
 *   complexBox,
 *   Renderer.renderBoxToLines,
 *   Effect.provide(Renderer.AnsiRendererLive)
 * )
 *
 * // Result: Effect that yields ["Header", "LeftRight", "Footer"]
 * // with appropriate ANSI formatting
 * ```
 *
 * @category rendering
 */
export const renderBoxToLines: <A>(
  box: Box.Box<A>
) => Effect.Effect<string[], never, internal.Renderer> =
  internal.renderBoxToLines;

/**
 * Converts rendered lines to a single string with optional configuration.
 *
 * Takes an array of text lines and joins them into a single string output,
 * applying whitespace handling and formatting rules according to the provided
 * configuration. Supports both data-first and data-last calling patterns
 * for flexible composition.
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import { pipe } from "effect"
 *
 * const lines = ["Header", "Content Line 1", "Content Line 2", "Footer"]
 *
 * // Data-first usage
 * const result1 = Renderer.renderLinesToString(lines)
 * // "Header\nContent Line 1\nContent Line 2\nFooter"
 *
 * // Data-last usage with pipe
 * const result2 = pipe(
 *   lines,
 *   Renderer.renderLinesToString()
 * )
 * ```
 *
 * @category rendering
 */
export const renderLinesToString: {
  (config?: RenderConfig): (lines: string[]) => string;
  (lines: string[], config?: RenderConfig): string;
} = internal.renderLinesToString;

// -----------------------------------------------------------------------------
// Renderer Selection Utilities
// -----------------------------------------------------------------------------

/**
 * Convenience function to render a box directly to a string.
 *
 * Combines `renderBoxToLines` and `renderLinesToString` into a single operation
 * for streamlined rendering. This is the most commonly used rendering function
 * as it provides complete box-to-string conversion with optional configuration.
 * Supports both data-first and data-last calling patterns.
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { Effect, pipe } from "effect"
 *
 * const styledBox = Box.text("Hello World").pipe(Box.annotate(Ansi.green))
 *
 * // Data-first usage
 * const program1 = pipe(
 *   Renderer.render(styledBox),
 *   Effect.provide(Renderer.AnsiRendererLive)
 * )
 *
 * // Data-last usage
 * const program2 = pipe(
 *   styledBox,
 *   Renderer.render(),
 *   Effect.provide(Renderer.AnsiRendererLive)
 * )
 * ```
 *
 * @category rendering
 */
export const render: {
  <A>(
    config?: RenderConfig
  ): (box: Box.Box<A>) => Effect.Effect<string, never, Renderer>;
  <A>(
    box: Box.Box<A>,
    config?: RenderConfig
  ): Effect.Effect<string, never, Renderer>;
} = internal.render;

// -----------------------------------------------------------------------------
// Tracked Rendering
// -----------------------------------------------------------------------------

/**
 * Result of a tracked render pass containing rendered output and reactive positions.
 *
 * Combines the rendered string output with position metadata for all reactive
 * boxes in the layout. Positions use logical terminal cell coordinates.
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as Reactive from "effect-boxes/Reactive"
 * import * as Box from "effect-boxes/Box"
 * import { Effect, pipe, HashMap } from "effect"
 *
 * const layout = Box.vcat([
 *   Reactive.makeReactive(Box.text("Header"), "header"),
 *   Box.text("Body"),
 *   Reactive.makeReactive(Box.text("Footer"), "footer")
 * ], Box.left)
 *
 * const program = pipe(
 *   Renderer.tracked(layout),
 *   Effect.provide(Renderer.PlainRendererLive)
 * )
 * // Result: { lines: [...], output: "Header\nBody\nFooter", positions: HashMap }
 * ```
 *
 * @category models
 */
export type RenderFrame = internal.RenderFrame;

/**
 * Renders a box to a string and collects reactive position metadata in one operation.
 *
 * Combines rendering with reactive position tracking, returning a `RenderFrame`
 * containing the rendered lines, joined output string, and a position map for
 * all reactive annotations. Supports both data-first and data-last calling patterns.
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as Reactive from "effect-boxes/Reactive"
 * import * as Box from "effect-boxes/Box"
 * import { Effect, pipe, HashMap } from "effect"
 *
 * const layout = Box.vcat([
 *   Reactive.makeReactive(Box.text("Title"), "title"),
 *   Reactive.makeReactive(Box.text("Button"), "btn")
 * ], Box.left)
 *
 * const program = Effect.gen(function* () {
 *   const frame = yield* Renderer.tracked(layout)
 *   console.log(frame.output)
 *   const btnPos = HashMap.get(frame.positions, "btn")
 *   return frame
 * }).pipe(Effect.provide(Renderer.AnsiRendererLive))
 * ```
 *
 * @category rendering
 */
export const tracked: {
  <A>(
    config?: RenderConfig
  ): (box: Box.Box<A>) => Effect.Effect<RenderFrame, never, Renderer>;
  <A>(
    box: Box.Box<A>,
    config?: RenderConfig
  ): Effect.Effect<RenderFrame, never, Renderer>;
} = internal.tracked;

// -----------------------------------------------------------------------------
// Renderer Layers
// -----------------------------------------------------------------------------

/**
 * Plain text renderer layer implementation.
 *
 * Provides a Renderer service that strips all formatting and produces clean
 * text output. Ideal for logging, file output, or contexts where ANSI formatting
 * is not supported or desired. All styling annotations are ignored during
 * rendering, resulting in plain text representation of the box layout.
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { Effect, pipe } from "effect"
 *
 * const styledBox = Box.vcat([
 *   Box.text("Title").pipe(Box.annotate(Ansi.bold)),
 *   Box.text("Content").pipe(Box.annotate(Ansi.red)),
 *   Box.text("Footer").pipe(Box.annotate(Ansi.blue))
 * ], Box.left)
 *
 * const plainOutput = pipe(
 *   styledBox,
 *   Renderer.render(),
 *   Effect.provide(Renderer.PlainRendererLive)
 * )
 * // Result: "Title\nContent\nFooter" (no ANSI codes)
 * ```
 *
 * @category layers
 */
export const PlainRendererLive: Layer.Layer<Renderer> = makePlainRenderer;

/**
 * ANSI-enabled renderer layer implementation.
 *
 * Provides a Renderer service that preserves all ANSI formatting and styling
 * during rendering. Essential for terminal applications where colors, bold text,
 * underlines, and other visual formatting enhance the user experience.
 * Processes all styling annotations and converts them to appropriate ANSI codes.
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { Effect, pipe } from "effect"
 *
 * const colorfulBox = Box.vcat([
 *   Box.text("✓ Success").pipe(Box.annotate(Ansi.green)),
 *   Box.text("⚠ Warning").pipe(Box.annotate(Ansi.yellow)),
 *   Box.text("✗ Error").pipe(Box.annotate(Ansi.red))
 * ], Box.left)
 *
 * const terminalOutput = pipe(
 *   colorfulBox,
 *   Renderer.render(),
 *   Effect.provide(Renderer.AnsiRendererLive)
 * )
 * // Result: Text with full color and formatting
 * ```
 *
 * @category layers
 */
export const AnsiRendererLive: Layer.Layer<Renderer> = makeAnsiRenderer;

/**
 * HTML renderer layer implementation.
 *
 * Provides a Renderer service that converts box layouts into HTML format.
 * Preserves structural and styling annotations by translating them into
 * appropriate HTML tags and attributes. Useful for web applications,
 * documentation generation, or any context where HTML output is required.
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as Box from "effect-boxes/Box"
 * import * as Html from "effect-boxes/Html"
 * import { Effect, pipe } from "effect"
 *
 * const htmlBox = Box.vcat([
 *   Box.text("Hello World").pipe(Box.annotate(Html.h1())),
 *   Box.text("This is an example of HTML rendering.").pipe(Box.annotate(Html.p())),
 *   Box.text("Goodbye!").pipe(Box.annotate(Html.p()))
 * ], Box.left)
 *
 * const htmlOutput = pipe(
 *   htmlBox,
 *   Renderer.render(),
 *   Effect.provide(Renderer.HtmlRendererLive)
 * )
 * // Result: HTML string with appropriate tags
 * ```
 *
 * @category layers
 */
export const HtmlRendererLive: Layer.Layer<Renderer> = makeHtmlRenderer.pipe(
  Layer.provideMerge(
    Layer.succeed(HtmlRenderConfig)(HtmlRenderConfig.defaultValue())
  )
);

/**
 * HTML renderer layer configured for pretty-formatted output.
 *
 * Uses indentation and whitespace preservation to produce readable HTML
 * strings that are easier to inspect in logs, snapshots, and tests.
 *
 * @example
 * ```typescript
 * import * as Renderer from "effect-boxes/Renderer"
 * import * as Box from "effect-boxes/Box"
 * import * as Html from "effect-boxes/Html"
 * import { Effect, pipe } from "effect"
 *
 * const box = Box.text("Hello").pipe(Box.annotate(Html.p()))
 *
 * const html = pipe(
 *   Renderer.render(box),
 *   Effect.provide(Renderer.HtmlPrettyRendererLive)
 * )
 * ```
 *
 * @category layers
 */
export const HtmlPrettyRendererLive: Layer.Layer<Renderer> =
  makeHtmlRenderer.pipe(
    Layer.provide(
      Layer.succeed(HtmlRenderConfig)({
        indent: true,
        indentSize: 2,
        preserveWhitespace: true,
      })
    )
  );
