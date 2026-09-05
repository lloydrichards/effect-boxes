import { Array, Match, pipe } from "effect";
import type * as Box from "../Box.js";

const ST = "(?:\\u0007|\\u001B\\u005C|\\u009C)"; // Valid string terminator sequences are BEL, ESC\, and 0x9c
const osc = `(?:\\u001B\\][\\s\\S]*?${ST})`; // ESC ] ... ST (non-greedy until first ST)
const csi =
  "[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]"; //  ESC[, intermediates (optional), params (optional), final byte

// Pre-compiled regex for performance - avoid recreating on each call
const ANSI_REGEX = new RegExp(`${osc}|${csi}`, "g");

/**
 * Strips ANSI escape sequences from a string
 * Matches:
 * - CSI sequences: ESC [ ... letter (colors, cursor movement, etc.)
 * - OSC sequences: ESC ] ... (BEL|ESC\|0x9C) (operating system commands)
 * - Simple sequences: ESC letter (save/restore cursor, etc.)
 */
const stripAnsi = (str: string): string => str.replace(ANSI_REGEX, "");

// Simple caches using native Map for performance in hot paths
const widthCache = new Map<string, number>();
const segmentCache = new Map<string, readonly string[]>();

const segmenter = new Intl.Segmenter();

export const segments = (str: string): readonly string[] => {
  // Check cache first for repeated strings
  const cached = segmentCache.get(str);
  if (cached !== undefined) {
    return cached;
  }

  const result = pipe(
    segmenter.segment(str),
    Array.fromIterable,
    Array.map((d) => d.segment)
  );

  // Cache the result for future use (only for reasonably sized strings to prevent memory bloat)
  if (str.length <= 1000) {
    segmentCache.set(str, result);
  }

  return result;
};

// NOTE: ES2022-compatible patterns using 'u' flag (ES2018 Unicode property escapes) instead of character class union since 'v' flag is ES2024+
const zeroWidthClusterRegex =
  /^(?:\p{Default_Ignorable_Code_Point}|\p{Control}|\p{Mark}|\p{Surrogate})+$/u; // zero-width clusters (control chars, marks, surrogates, etc.)
const leadingNonPrintingRegex =
  /^(?:\p{Default_Ignorable_Code_Point}|\p{Control}|\p{Format}|\p{Mark}|\p{Surrogate})+/u; // leading non-printing characters in a cluster

// Use RGI_Emoji with the 'v' flag via dynamic constructor to avoid TS type errors (target is ES2022, but runtime supports 'v' flag)
const emojiRegex = new RegExp("\\p{RGI_Emoji}", "v");
const isEmoji = (segment: string): boolean => emojiRegex.test(segment);

const WIDE_CHAR_RANGES = [
  // Hangul Jamo
  [0x11_00, 0x11_5f],
  // CJK symbols and punctuation
  [0x2e_80, 0x2e_ff],
  [0x2f_00, 0x2f_df],
  [0x30_00, 0x30_3f],
  // Hiragana and Katakana
  [0x30_40, 0x30_9f],
  [0x30_a0, 0x30_ff],
  // Bopomofo
  [0x31_00, 0x31_2f],
  // Hangul compatibility
  [0x31_30, 0x31_8f],
  [0x31_90, 0x31_bf],
  [0x31_c0, 0x31_ef],
  // CJK compatibility
  [0x32_00, 0x32_ff],
  [0x33_00, 0x33_ff],
  // CJK extension A
  [0x34_00, 0x4d_bf],
  // CJK unified ideographs
  [0x4e_00, 0x9f_ff],
  // Yi syllables
  [0xa0_00, 0xa4_8f],
  [0xa4_90, 0xa4_cf],
  // Hangul syllables
  [0xac_00, 0xd7_af],
  // CJK compatibility ideographs
  [0xf9_00, 0xfa_ff],
  // Halfwidth and fullwidth forms
  [0xfe_30, 0xfe_6f], // Adjusted to include full-width parens
  // Common emoji ranges
  [0x01_f3_00, 0x01_f5_ff],
  [0x01_f6_00, 0x01_f6_4f],
  [0x01_f6_80, 0x01_f6_ff],
  [0x01_f7_00, 0x01_f7_7f],
  [0x01_f7_80, 0x01_f7_ff],
  [0x01_f8_00, 0x01_f8_ff],
  [0x01_f9_00, 0x01_f9_ff],
  [0x01_fa_00, 0x01_fa_6f],
  [0x01_fa_70, 0x01_fa_ff],
] as const;

const isFullWidth = (codePoint: number): boolean =>
  codePoint === 0x30_00 || // Ideographic space
  (codePoint >= 0xff_01 && codePoint <= 0xff_60) || // Fullwidth ASCII
  (codePoint >= 0xff_e0 && codePoint <= 0xff_e6); // Fullwidth symbols

const isWide = (codePoint: number): boolean => {
  for (const [start, end] of WIDE_CHAR_RANGES) {
    if (codePoint >= start && codePoint <= end) {
      return true;
    }
  }
  return false;
};

const eastAsianWidth = (codePoint: number): number => {
  if (isFullWidth(codePoint) || isWide(codePoint)) {
    return 2;
  }
  return 1;
};

const isZeroWidthCluster = (segment: string): boolean =>
  zeroWidthClusterRegex.test(segment);

/**
 * Calculate the visual width of a string, accounting for:
 * - ANSI escape sequences (stripped by default)
 * - Multi-character emojis (width 2)
 * - East Asian wide characters (width 2)
 * - Zero-width characters (width 0)
 * - Control characters (width 0)
 *
 * @param input - The input string to measure
 * @param options - Configuration options for width calculation
 * @returns The visual width of the string in terminal columns
 *
 * @example
 * ```typescript
 * import { getStringWidth } from "./StringWidth"
 * import { pipe } from "effect"
 *
 * // Basic usage
 * getStringWidth("hello") // => 5
 * getStringWidth("👩‍💻") // => 2 (multi-char emoji)
 * getStringWidth("你好") // => 4 (2 wide chars)
 *
 * // With pipe
 * pipe("hello world", getStringWidth()) // => 11
 *
 * // With ANSI codes (stripped by default)
 * getStringWidth("\x1b[31mred\x1b[0m") // => 3
 * ```
 */
export const ofString = (input: string): number => {
  // Check cache first for frequently computed strings
  const cached = widthCache.get(input);
  if (cached !== undefined) {
    return cached;
  }

  const string = stripAnsi(input);

  if (string.length === 0) {
    const result = 0;
    // Cache empty string results
    widthCache.set(input, result);
    return result;
  }

  const result = pipe(
    segments(string),
    Array.reduce(0, (acc, segment) => {
      // Skip zero-width clusters (control chars, pure marks, etc.)
      if (isZeroWidthCluster(segment)) {
        return acc;
      }
      // Emoji sequences are always double-width
      if (isEmoji(segment)) {
        return acc + 2;
      }
      // For other clusters, use East Asian Width of the first visible code point
      const baseVisible = segment.replace(leadingNonPrintingRegex, "");
      if (baseVisible.length > 0) {
        const codePoint = baseVisible.codePointAt(0);
        if (codePoint !== undefined) {
          return acc + eastAsianWidth(codePoint);
        }
      }

      return acc;
    })
  );

  // Cache result for future use (only for reasonably sized strings to prevent memory bloat)
  if (input.length <= 1000) {
    widthCache.set(input, result);
  }

  return result;
};

/** @internal */
export const sliceColumns = (
  input: string,
  offset: number,
  width: number
): string => {
  if (width <= 0) {
    return "";
  }

  const start = Math.max(0, offset);
  const end = start + width;
  let column = 0;
  const result: string[] = [];

  for (const segment of segments(input)) {
    const segmentWidth = ofString(segment);
    const nextColumn = column + segmentWidth;

    if (column >= start && nextColumn <= end) {
      result.push(segment);
    } else {
      const overlap = Math.max(
        0,
        Math.min(nextColumn, end) - Math.max(column, start)
      );
      if (overlap > 0) {
        result.push(" ".repeat(overlap));
      }
    }

    column = nextColumn;
    if (column >= end) {
      break;
    }
  }

  return result.join("");
};

const alignmentAnchor = (alignment: Box.Alignment, width: number): number =>
  Match.value(alignment).pipe(
    Match.when("AlignFirst", () => 0),
    Match.when("AlignLast", () => width),
    Match.when("AlignCenter1", () => Math.ceil(width / 2)),
    Match.when("AlignCenter2", () => Math.floor(width / 2)),
    Match.exhaustive
  );

/** @internal */
export const alignmentOffset = (
  alignment: Box.Alignment,
  inputWidth: number,
  targetWidth: number
): number =>
  alignmentAnchor(alignment, targetWidth) -
  alignmentAnchor(alignment, inputWidth);

/** @internal */
export const fitString = (
  input: string,
  width: number,
  alignment: Box.Alignment
): string => {
  const targetWidth = Math.max(0, width);
  const inputWidth = ofString(input);

  if (inputWidth > targetWidth) {
    const offset = -alignmentOffset(alignment, inputWidth, targetWidth);
    return sliceColumns(input, offset, targetWidth);
  }

  const padding = targetWidth - inputWidth;
  const before = alignmentOffset(alignment, inputWidth, targetWidth);
  return " ".repeat(before) + input + " ".repeat(padding - before);
};
