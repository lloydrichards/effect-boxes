/**
 * ANSI terminal styling and colored box rendering.
 *
 * Provides a complete set of ANSI escape code utilities for styling text
 * in terminal environments. Includes foreground/background colors (standard,
 * bright, 256-color, and RGB), text attributes (bold, italic, underline, etc.),
 * and a renderer that converts annotated boxes into ANSI-escaped strings.
 *
 * ## Common tasks
 *
 * - **Style text**: {@link bold}, {@link italic}, {@link underlined}
 * - **Foreground colors**: {@link red}, {@link green}, {@link blue}, {@link colorRGB}
 * - **Background colors**: {@link bgRed}, {@link bgGreen}, {@link bgColorHex}
 * - **Combine styles**: {@link combine}
 * - **Render**: {@link renderAnnotatedBox}
 *
 * ## Gotchas
 *
 * - Styles are combined additively — later attributes override earlier ones of the same kind
 * - {@link truncatePreservingAnsi} handles width-truncation without breaking escape sequences
 *
 * @see {@link renderAnnotatedBox} — render a styled box to terminal string
 * @see {@link combine} — merge multiple styles
 *
 * @module
 */
import type { Annotation } from "./Annotation.js";
import type { Box } from "./Box.js";
import * as internal from "./internal/ansi.js";

/**
 * @category models
 */
export type AnsiAttribute = {
  readonly _tag:
    | "ForegroundColor"
    | "BackgroundColor"
    | "TextAttribute"
    | "CommandAttribute";
  readonly name: string;
  readonly code: string;
};

/**
 * @category models
 */
export type AnsiStyle = readonly AnsiAttribute[];

/**
 * @category models
 */
export type AnsiAnnotation = Annotation<AnsiStyle>;

// --------------------------------------------------------------------------------
// --  ANSI Color Constants  ------------------------------------------------------
// --------------------------------------------------------------------------------

/**
 * Standard black foreground color.
 *
 * @category constructors
 */
export const black: AnsiAnnotation = internal.black;

/**
 * Standard red foreground color.
 *
 * @category constructors
 */
export const red: AnsiAnnotation = internal.red;

/**
 * Standard green foreground color.
 *
 * @category constructors
 */
export const green: AnsiAnnotation = internal.green;

/**
 * Standard yellow foreground color.
 *
 * @category constructors
 */
export const yellow: AnsiAnnotation = internal.yellow;

/**
 * Standard blue foreground color.
 *
 * @category constructors
 */
export const blue: AnsiAnnotation = internal.blue;

/**
 * Standard magenta foreground color.
 *
 * @category constructors
 */
export const magenta: AnsiAnnotation = internal.magenta;

/**
 * Standard cyan foreground color.
 *
 * @category constructors
 */
export const cyan: AnsiAnnotation = internal.cyan;

/**
 * Standard white foreground color.
 *
 * @category constructors
 */
export const white: AnsiAnnotation = internal.white;

/**
 * Default foreground color (terminal default).
 *
 * @category constructors
 */
export const fgDefault: AnsiAnnotation = internal.fgDefault;

/**
 * Bright black (gray) foreground color.
 *
 * @category constructors
 */
export const brightBlack: AnsiAnnotation = internal.brightBlack;

/**
 * Bright red foreground color.
 *
 * @category constructors
 */
export const brightRed: AnsiAnnotation = internal.brightRed;

/**
 * Bright green foreground color.
 *
 * @category constructors
 */
export const brightGreen: AnsiAnnotation = internal.brightGreen;

/**
 * Bright yellow foreground color.
 *
 * @category constructors
 */
export const brightYellow: AnsiAnnotation = internal.brightYellow;

/**
 * Bright blue foreground color.
 *
 * @category constructors
 */
export const brightBlue: AnsiAnnotation = internal.brightBlue;

/**
 * Bright magenta foreground color.
 *
 * @category constructors
 */
export const brightMagenta: AnsiAnnotation = internal.brightMagenta;

/**
 * Bright cyan foreground color.
 *
 * @category constructors
 */
export const brightCyan: AnsiAnnotation = internal.brightCyan;

/**
 * Bright white foreground color.
 *
 * @category constructors
 */
export const brightWhite: AnsiAnnotation = internal.brightWhite;

/**
 * Creates a foreground color using 256-color palette.
 *
 * Uses the extended 256-color ANSI palette for more color options
 * beyond the basic 8 colors.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const brightOrange = Ansi.color256(208)
 * const coloredText = Box.text("Bright orange text").pipe(
 *   Box.annotate(brightOrange)
 * )
 * ```
 *
 * @category constructors
 */
export const color256: (n: number) => AnsiAnnotation = internal.color256;

/**
 * Creates a foreground color using RGB values.
 *
 * Provides true color support with full RGB specification.
 * Each component should be between 0-255.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const customPurple = Ansi.colorRGB(128, 0, 128)
 * const styledText = Box.text("Custom purple").pipe(
 *   Box.annotate(customPurple)
 * )
 * console.log(Box.renderPrettySync(styledText))
 * ```
 *
 * @category constructors
 */
export const colorRGB: (r: number, g: number, b: number) => AnsiAnnotation =
  internal.colorRGB;

/**
 * Creates a foreground color from a hex color string.
 *
 * Accepts hex strings with or without a leading `#`, in 3-digit or 6-digit
 * format (e.g. `"#ff00ff"`, `"ff00ff"`, `"#f0f"`, `"f0f"`).
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const coral = Ansi.colorHex("#FF6B6B")
 * const styledText = Box.text("Coral text").pipe(
 *   Box.annotate(coral)
 * )
 * console.log(Box.renderPrettySync(styledText))
 * ```
 *
 * @category constructors
 */
export const colorHex: (hex: string) => AnsiAnnotation = internal.colorHex;

/**
 * Black background color.
 *
 * @category constructors
 */
export const bgBlack: AnsiAnnotation = internal.bgBlack;

/**
 * Red background color.
 *
 * @category constructors
 */
export const bgRed: AnsiAnnotation = internal.bgRed;

/**
 * Green background color.
 *
 * @category constructors
 */
export const bgGreen: AnsiAnnotation = internal.bgGreen;

/**
 * Yellow background color.
 *
 * @category constructors
 */
export const bgYellow: AnsiAnnotation = internal.bgYellow;

/**
 * Blue background color.
 *
 * @category constructors
 */
export const bgBlue: AnsiAnnotation = internal.bgBlue;

/**
 * Magenta background color.
 *
 * @category constructors
 */
export const bgMagenta: AnsiAnnotation = internal.bgMagenta;

/**
 * Cyan background color.
 *
 * @category constructors
 */
export const bgCyan: AnsiAnnotation = internal.bgCyan;

/**
 * White background color.
 *
 * @category constructors
 */
export const bgWhite: AnsiAnnotation = internal.bgWhite;

/**
 * Default background color (terminal default).
 *
 * @category constructors
 */
export const bgDefault: AnsiAnnotation = internal.bgDefault;

/**
 * Bright black (gray) background color.
 *
 * @category constructors
 */
export const bgBrightBlack: AnsiAnnotation = internal.bgBrightBlack;

/**
 * Bright red background color.
 *
 * @category constructors
 */
export const bgBrightRed: AnsiAnnotation = internal.bgBrightRed;

/**
 * Bright green background color.
 *
 * @category constructors
 */
export const bgBrightGreen: AnsiAnnotation = internal.bgBrightGreen;

/**
 * Bright yellow background color.
 *
 * @category constructors
 */
export const bgBrightYellow: AnsiAnnotation = internal.bgBrightYellow;

/**
 * Bright blue background color.
 *
 * @category constructors
 */
export const bgBrightBlue: AnsiAnnotation = internal.bgBrightBlue;

/**
 * Bright magenta background color.
 *
 * @category constructors
 */
export const bgBrightMagenta: AnsiAnnotation = internal.bgBrightMagenta;

/**
 * Bright cyan background color.
 *
 * @category constructors
 */
export const bgBrightCyan: AnsiAnnotation = internal.bgBrightCyan;

/**
 * Bright white background color.
 *
 * @category constructors
 */
export const bgBrightWhite: AnsiAnnotation = internal.bgBrightWhite;

/**
 * Creates a background color using 256-color palette.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const highlighted = Box.text("Highlighted text").pipe(
 *   Box.annotate(Ansi.bgColor256(226)) // Bright yellow background
 * )
 * ```
 *
 * @category constructors
 */
export const bgColor256: (n: number) => AnsiAnnotation = internal.bgColor256;

/**
 * Creates a background color using RGB values.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const softBackground = Ansi.bgColorRGB(240, 240, 240)
 * const subtleText = Box.text("Soft background").pipe(
 *   Box.annotate(softBackground)
 * )
 * ```
 *
 * @category constructors
 */
export const bgColorRGB: (r: number, g: number, b: number) => AnsiAnnotation =
  internal.bgColorRGB;

/**
 * Creates a background color from a hex color string.
 *
 * Accepts hex strings with or without a leading `#`, in 3-digit or 6-digit
 * format (e.g. `"#ff00ff"`, `"ff00ff"`, `"#f0f"`, `"f0f"`).
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const warmBg = Ansi.bgColorHex("#FFE4B5")
 * const styledText = Box.text("Warm background").pipe(
 *   Box.annotate(warmBg)
 * )
 * console.log(Box.renderPrettySync(styledText))
 * ```
 *
 * @category constructors
 */
export const bgColorHex: (hex: string) => AnsiAnnotation = internal.bgColorHex;

//
// --------------------------------------------------------------------------------
// --  Standard ANSI text attributes  ---------------------------------------------
// --------------------------------------------------------------------------------
//

/**
 * Bold text formatting.
 *
 * Makes text appear with increased weight/intensity.
 *
 * @category constructors
 */
export const bold: AnsiAnnotation = internal.bold;

/**
 * Dim text formatting.
 *
 * Makes text appear with reduced intensity.
 *
 * @category constructors
 */
export const dim: AnsiAnnotation = internal.dim;

/**
 * Italic text formatting.
 *
 * Makes text appear slanted (if supported by terminal).
 *
 * @category constructors
 */
export const italic: AnsiAnnotation = internal.italic;

/**
 * Underlined text formatting.
 *
 * Adds an underline beneath the text.
 *
 * @category constructors
 */
export const underlined: AnsiAnnotation = internal.underlined;

/**
 * Blinking text formatting.
 *
 * Makes text blink (if supported by terminal).
 *
 * @category constructors
 */
export const blink: AnsiAnnotation = internal.blink;

/**
 * Inverse text formatting.
 *
 * Swaps foreground and background colors.
 *
 * @category constructors
 */
export const inverse: AnsiAnnotation = internal.inverse;

/**
 * Hidden text formatting.
 *
 * Makes text invisible (useful for passwords).
 *
 * @category constructors
 */
export const hidden: AnsiAnnotation = internal.hidden;

/**
 * Strikethrough text formatting.
 *
 * Adds a line through the middle of the text.
 *
 * @category constructors
 */
export const strikethrough: AnsiAnnotation = internal.strikethrough;

/**
 * Overline text formatting.
 *
 * Adds a line above the text.
 *
 * @category constructors
 */
export const overline: AnsiAnnotation = internal.overline;

/**
 * Reset all formatting.
 *
 * Clears all ANSI formatting and returns to terminal defaults.
 *
 * @category constructors
 */
export const reset: AnsiAnnotation = internal.reset;

//
// --------------------------------------------------------------------------------
// --  Combine  -------------------------------------------------------------------
// --------------------------------------------------------------------------------
//

/**
 * Combines multiple ANSI style annotations into a single annotation.
 *
 * Merges multiple ANSI styling annotations using a last-wins strategy
 * for conflicting attributes. This allows you to layer styles like
 * combining color with formatting.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const styledText = Box.text("Important Warning").pipe(
 *   Box.annotate(Ansi.combine(Ansi.red, Ansi.bold, Ansi.underlined))
 * )
 * console.log(Box.renderPrettySync(styledText))
 * // Outputs red, bold, underlined text
 * ```
 *
 *
 * @category combinators
 */
export const combine: (...annotations: AnsiAnnotation[]) => AnsiAnnotation =
  internal.combine;

/*
 *  --------------------------------------------------------------------------------
 *  --  Rendering  -----------------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Extracts ANSI escape sequence from annotation data.
 *
 * Converts ANSI style data into the raw escape sequence string used
 * by terminals. Styled sequences (colors, text effects) join codes
 * with ';' and end with 'm'. Returns null for non-ANSI data.
 *
 * @example
 * ```typescript
 * import * as Ansi from "effect-boxes/Ansi"
 * import * as Annotation from "effect-boxes/Annotation"
 *
 * const redStyle = Annotation.getAnnotationData(Ansi.red)
 * const escapeSeq = Ansi.getAnsiEscapeSequence(redStyle)
 * console.log(escapeSeq)
 * // "\u001b[31m" (ANSI red foreground code)
 * ```
 *
 * @category utilities
 */
export const getAnsiEscapeSequence: (data: AnsiStyle) => string | null =
  internal.getAnsiEscapeSequence;

/**
 * Converts a box into an array of text lines with ANSI annotation support.
 *
 * Renders a box to text lines while preserving ANSI styling annotations.
 * This is the core function that bridges the Box layout system with
 * terminal ANSI output.
 *
 * @note Haskell: `renderBox :: Box -> [String]`
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const box = Box.text("Warning").pipe(Box.annotate(Ansi.red))
 * const lines = Ansi.renderAnnotatedBox(box)
 * console.log(lines[0])
 * ```
 *
 * @category utilities
 */
export const renderAnnotatedBox: <A>({
  cols,
  content,
  rows,
  annotation,
}: Box<A>) => string[] = internal.renderAnnotatedBox;

/**
 * Truncates a string to a target width while preserving ANSI escape sequences.
 *
 * Ensures that ANSI codes remain intact while the visible text is cut
 * to fit within the specified width. Useful for displaying colored
 * text in constrained spaces.
 *
 * @example
 * ```typescript
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const coloredText = "\x1b[31mThis is a long red text\x1b[0m"
 * const truncated = Ansi.truncatePreservingAnsi(coloredText, 10)
 * console.log(truncated)
 * // Outputs: "\x1b[31mThis is a \x1b[0m"
 * ```
 *
 * @category utilities
 */
export const truncatePreservingAnsi: (
  text: string,
  targetWidth: number
) => string = internal.truncatePreservingAnsi;
