/**
 * Core box data type and layout operations for text-based rendering.
 *
 * The `Box` module provides an immutable 2D text layout system inspired by
 * Haskell's `boxes` library. Boxes are rectangular blocks of text that can
 * be composed horizontally, vertically, aligned, and annotated with
 * arbitrary metadata.
 *
 * ## Mental model
 *
 * - **`Box<A>`** — a rectangular grid of characters with optional annotations of type `A`
 * - All operations are **pure** — they return new boxes, never mutate
 * - Most functions are **dual** — support both data-first and pipe-based usage
 * - Boxes implement `Equal`, `Hash`, and `Pipeable` from Effect
 *
 * ## Common tasks
 *
 * - **Create** a box: {@link text}, {@link emptyBox}, {@link char}, {@link nullBox}
 * - **Combine** boxes: {@link hcat}, {@link vcat}, {@link hAppend}, {@link vAppend}
 * - **Align** content: {@link alignHoriz}, {@link alignVert}, {@link align}
 * - **Move** position: {@link moveRight}, {@link moveDown}, {@link moveLeft}, {@link moveUp}
 * - **Add borders**: {@link border}, {@link singleBorder}, {@link roundedBorder}
 * - **Render** to string: {@link render}, {@link renderPlain}
 *
 * ## Gotchas
 *
 * - {@link text} trims trailing spaces per line
 * - {@link nullBox} is the identity element for {@link hcat} and {@link vcat}
 * - Alignment constants ({@link top}, {@link bottom}, {@link center1}, {@link center2}) are shared across horizontal and vertical operations
 *
 * ## Quickstart
 *
 * **Example** (Composing a simple layout)
 *
 * ```ts
 * import { pipe } from "effect"
 * import * as Box from "effect-boxes/Box"
 *
 * const layout = pipe(
 *   Box.text("Hello"),
 *   Box.moveRight(2),
 *   Box.alignHoriz(Box.center1, 20)
 * )
 * console.log(Box.render(layout))
 * ```
 *
 * @see {@link text} — create a box from a string
 * @see {@link hcat} — horizontal concatenation
 * @see {@link vcat} — vertical concatenation
 * @see {@link render} — convert to string
 *
 * @module
 */
import type { Effect, Types } from "effect";
import type * as Equal from "effect/Equal";
import type * as Hash from "effect/Hash";
import type * as Inspectable from "effect/Inspectable";
import type { Pipeable } from "effect/Pipeable";
import type { Annotation } from "./Annotation.js";
import * as internal from "./internal/box.js";
import * as internalRender from "./internal/box-render.js";
import type * as Renderer from "./Renderer.js";

/**
 * Symbol used to identify Box values at runtime.
 *
 * @category models
 */
export const BoxTypeId: unique symbol = internal.BoxTypeId;

/**
 * @category models
 */
export type BoxTypeId = typeof BoxTypeId;

/**
 * @category models
 */
export type Alignment =
  | "AlignFirst"
  | "AlignCenter1"
  | "AlignCenter2"
  | "AlignLast";

/**
 * Align boxes along their tops.
 *
 * @category constructors
 */
export const top: Alignment = internal.top;

/**
 * Align boxes along their bottoms.
 *
 * @category constructors
 */
export const bottom: Alignment = internal.bottom;

/**
 * Align boxes to the left.
 *
 * @category constructors
 */
export const left: Alignment = internal.left;

/**
 * Align boxes to the right.
 *
 * @category constructors
 */
export const right: Alignment = internal.right;

/**
 * Align boxes centered, but biased to the left/top in case of unequal parities.
 *
 * @category constructors
 */
export const center1: Alignment = internal.center1;

/**
 * Align boxes centered, but biased to the right/bottom in case of unequal parities.
 *
 * @category constructors
 */
export const center2: Alignment = internal.center2;

/**
 * @category models
 */
export type Blank = { _tag: "Blank" };

/**
 * @category models
 */
export type Text = { _tag: "Text"; text: string };

/**
 * @category models
 */
export type Row<A = never> = { _tag: "Row"; boxes: Box<A>[] };

/**
 * @category models
 */
export type Col<A = never> = { _tag: "Col"; boxes: Box<A>[] };

/**
 * @category models
 */
export type SubBox<A = never> = {
  _tag: "SubBox";
  xAlign: Alignment;
  yAlign: Alignment;
  box: Box<A>;
};

/**
 * @category models
 */
export type Content<A = never> = Blank | Text | Row<A> | Col<A> | SubBox<A>;

/**
 * @category models
 */
export type BoxAnnotations<T extends readonly unknown[]> = T extends readonly [
  infer Head,
  ...infer Tail,
]
  ? Head extends Box<infer A>
    ? A | BoxAnnotations<Tail>
    : never
  : never;

/**
 * The Box data type, representing a rectangular area of text with various combinators for layout and alignment.
 *
 * @category models
 */
export interface Box<out A = never>
  extends Pipeable,
    Equal.Equal,
    Hash.Hash,
    Inspectable.Inspectable {
  readonly [BoxTypeId]: {
    readonly _A: Types.Covariant<A>;
  };
  readonly rows: number;
  readonly cols: number;
  readonly content: Content<A>;
  readonly annotation?: Annotation<A> | undefined;
}

// -----------------------------------------------------------------------------
// Refinements
// -----------------------------------------------------------------------------

/**
 * Type guard to determine if a value is a Box.
 *
 * @category guards
 */
export const isBox: <A>(u: unknown) => u is Box<A> = internal.isBox;

// -----------------------------------------------------------------------------
// Constructors
// -----------------------------------------------------------------------------

/**
 * Creates an empty box with no content.
 *
 * Serves as the identity element for Box combinations and the base
 * case for building more complex layouts.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const empty = Box.nullBox
 * console.log(`Dimensions: ${Box.rows(empty)} x ${Box.cols(empty)}`)
 * // Dimensions: 0 x 0
 * console.log(Box.renderPlainSync(empty))
 * // (empty string)
 * ```
 *
 * @note Haskell: `nullBox :: Box`
 * @category constructors
 */
export const nullBox: Box<never> = internal.nullBox;

/**
 * Creates an empty box with the specified dimensions.
 *
 * Useful for creating spacers or placeholders in layouts where you need
 * specific dimensions without visible content.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const spacer = Box.emptyBox(3, 10)
 * console.log(`Dimensions: ${Box.rows(spacer)} x ${Box.cols(spacer)}`)
 * // Dimensions: 3 x 10
 * console.log(Box.renderPlainSync(spacer))
 * //
 * //
 * //
 * ```
 *
 * @note Haskell: `empty :: Int -> Int -> Box`
 * @category constructors
 */
export const emptyBox: (rows?: number, cols?: number) => Box<never> =
  internal.emptyBox;

/**
 * Creates a one-row box containing a single grapheme.
 *
 * If the string contains multiple graphemes, only the first is used. The
 * box width matches the grapheme's terminal display width.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const asterisk = Box.char("*")
 * console.log(`Dimensions: ${Box.rows(asterisk)} x ${Box.cols(asterisk)}`)
 * // Dimensions: 1 x 1
 * console.log(Box.renderPlainSync(asterisk))
 * // *
 *
 * const unicode = Box.char("🌟")
 * console.log(Box.renderPlainSync(unicode))
 * // 🌟
 * ```
 *
 * @note Haskell: `char :: Char -> Box`
 * @category constructors
 */
export const char: (c: string) => Box<never> = internal.char;

/**
 * Creates a box containing multi-line text, splitting on newlines.
 *
 * The most commonly used constructor for creating text-based boxes.
 * Automatically handles line breaks and calculates proper dimensions.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const greeting = Box.text("Hello\nWorld")
 * console.log(`Dimensions: ${Box.rows(greeting)} x ${Box.cols(greeting)}`)
 * // Dimensions: 2 x 5
 * console.log(Box.renderPlainSync(greeting))
 * // Hello
 * // World
 *
 * const singleLine = Box.text("Simple text")
 * console.log(`Dimensions: ${Box.rows(singleLine)} x ${Box.cols(singleLine)}`)
 * // Dimensions: 1 x 11
 * ```
 *
 * @note Haskell: `text :: String -> Box`
 * @category constructors
 */
export const text: (s: string) => Box<never> = internal.text;

/**
 * Creates a single-line box from a string, removing any line breaks.
 *
 * Forces the text onto a single line by replacing newlines with spaces.
 * Useful when you need to ensure text appears on one line regardless
 * of the input string's formatting.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const multilineInput = "Hello\nWorld\nExample"
 * const singleLine = Box.line(multilineInput)
 * console.log(`Dimensions: ${Box.rows(singleLine)} x ${Box.cols(singleLine)}`)
 * // Dimensions: 1 x 19
 * console.log(Box.renderPlainSync(singleLine))
 * // Hello World Example
 * ```
 *
 * @note Haskell: `line :: String -> Box`
 * @category constructors
 */
export const line: (s: string) => Box<never> = internal.line;

/**
 * Creates a paragraph box with text flowed to fit within the specified width.
 *
 * Breaks text into lines that fit within the given width, applying the
 * specified alignment to each line within the paragraph.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const longText = "This is a very long sentence that needs to be wrapped to fit within a specific width"
 * const paragraph = Box.para(longText, Box.left, 20)
 * console.log(Box.renderPlainSync(paragraph))
 * // This is a very long
 * // sentence that needs to
 * // be wrapped to fit
 * // within a specific
 * // width
 * ```
 *
 * @note Haskell: `para :: Alignment -> Int -> String -> Box`
 * @category constructors
 */
export const para: {
  (a: Alignment, w: number): (self: string) => Box<never>;
  (self: string, a: Alignment, w: number): Box<never>;
} = internal.para;

/**
 * Combines two boxes horizontally using the Semigroup instance.
 *
 * The fundamental combining operation that forms the basis of the Box
 * semigroup. Concatenates boxes horizontally with top alignment.
 *
 * **Mathematical Properties**
 * - **Associative**: `combine(combine(a, b), c) ≡ combine(a, combine(b, c))`
 * - **Identity**: `combine(nullBox, a) ≡ combine(a, nullBox) ≡ a`
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const left = Box.text("Hello")
 * const right = Box.text("World")
 * const combined = Box.combine(left, right)
 * console.log(Box.renderPlainSync(combined))
 * // HelloWorld
 * ```
 *
 * @note Haskell: `instance Semigroup Box where l <> r = hcat top [l,r]`
 * @category combinators
 */
export const combine: {
  <B>(that: Box<B>): <A>(self: Box<A>) => Box<A | B>;
  <A, B>(self: Box<A>, that: Box<B>): Box<A | B>;
} = internal.combine;

/**
 * Combines multiple boxes with a starting box using the Semigroup operation.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const boxes = [Box.text("B"), Box.text("C")]
 * const result = Box.combineMany(boxes, Box.text("A"))
 * console.log(Box.renderPlainSync(result))
 * // ABC
 * ```
 *
 * @category combinators
 */
export const combineMany: {
  <A>(start: Box<A>): <B>(self: Iterable<Box<B>>) => Box<A | B>;
  <A, B>(self: Iterable<Box<B>>, start: Box<A>): Box<A | B>;
} = internal.combineMany;

/**
 * Combines all boxes in a collection horizontally, returning nullBox if empty.
 *
 * Implements the Monoid instance for Box, providing a way to combine
 * any number of boxes into a single horizontal layout.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const boxes = [Box.text("A"), Box.text("B"), Box.text("C")]
 * const combined = Box.combineAll(boxes)
 * console.log(Box.renderPlainSync(combined))
 * // ABC
 *
 * const empty = Box.combineAll([])
 * console.log(empty === Box.nullBox) // structural equality via Effect
 * ```
 *
 * @note Haskell: `instance Monoid Box where mempty = nullBox mappend = (<>) mconcat = hcat top`
 * @category combinators
 */
export const combineAll: <T extends readonly Box<unknown>[]>(
  collection: T
) => Box<BoxAnnotations<T>> = internal.combineAll;

/**
 * Gets the number of rows in a box.
 *
 * Returns the height of the box in terms of text lines.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const multiLine = Box.text("Line 1\nLine 2\nLine 3")
 * console.log(Box.rows(multiLine))
 * // 3
 *
 * const singleLine = Box.text("One line")
 * console.log(Box.rows(singleLine))
 * // 1
 *
 * const empty = Box.nullBox
 * console.log(Box.rows(empty))
 * // 0
 * ```
 *
 * @note Haskell: `rows :: Box -> Int`
 * @category utilities
 */
export const rows: <A>(self: Box<A>) => number = internal.rows;

/**
 * Gets the number of columns in a box.
 *
 * Returns the width of the box in terms of character columns.
 * For multi-line text, returns the width of the longest line.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const text = Box.text("Short\nLonger line\nShort")
 * console.log(Box.cols(text))
 * // 11 (width of "Longer line")
 *
 * const single = Box.text("Hello")
 * console.log(Box.cols(single))
 * // 5
 *
 * const empty = Box.nullBox
 * console.log(Box.cols(empty))
 * // 0
 * ```
 *
 * @note Haskell: `cols :: Box -> Int`
 * @category utilities
 */
export const cols: <A>(self: Box<A>) => number = internal.cols;

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

/**
 * Creates a box with the specified dimensions and content.
 *
 * @category constructors
 */
export const make: <A>(self: {
  rows: number;
  cols: number;
  content: Content<A>;
  annotation?: Annotation<A> | undefined;
}) => Box<A> = internal.make;

/**
 * Pattern matching utility for Box content.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const box = Box.text("Hello")
 * const result = Box.match(box, {
 *   blank: () => "blank",
 *   text: (t) => `text: ${t}`,
 *   row: (boxes) => `row of ${boxes.length}`,
 *   col: (boxes) => `col of ${boxes.length}`,
 *   subBox: () => "subBox"
 * })
 * console.log(result)
 * // text: Hello
 * ```
 *
 * @category utilities
 */
export const match: {
  <A, R>(patterns: {
    readonly blank: () => R;
    readonly text: (text: string) => R;
    readonly row: (boxes: Box<A>[]) => R;
    readonly col: (boxes: Box<A>[]) => R;
    readonly subBox: (box: Box<A>, xAlign: Alignment, yAlign: Alignment) => R;
  }): (self: Box<A>) => R;
  <A, R>(
    self: Box<A>,
    patterns: {
      readonly blank: () => R;
      readonly text: (text: string) => R;
      readonly row: (boxes: Box<A>[]) => R;
      readonly col: (boxes: Box<A>[]) => R;
      readonly subBox: (box: Box<A>, xAlign: Alignment, yAlign: Alignment) => R;
    }
  ): R;
} = internal.match;

/**
 * Arranges boxes horizontally in a row with the specified vertical alignment.
 *
 * The most fundamental layout combinator for creating horizontal layouts.
 * The alignment parameter controls how boxes of different heights are
 * positioned relative to each other.
 *
 * **Mathematical Properties**
 * - **Associative**: `hcat(a, [hcat(a, [x, y]), z]) ≡ hcat(a, [x, hcat(a, [y, z])])`
 * - **Identity**: `hcat(a, [nullBox, x]) ≡ hcat(a, [x, nullBox]) ≡ x`
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const boxes = [Box.text("Left"), Box.text("Middle"), Box.text("Right")]
 * const horizontal = Box.hcat(boxes, Box.top)
 * console.log(Box.renderPlainSync(horizontal))
 * // LeftMiddleRight
 * ```
 *
 * @note Haskell: `hcat :: Foldable f => Alignment -> f Box -> Box`
 * @category combinators
 */
export const hcat: {
  <T extends readonly Box<unknown>[]>(
    a: Alignment
  ): (self: T) => Box<BoxAnnotations<T>>;
  <T extends readonly Box<unknown>[]>(
    self: T,
    a: Alignment
  ): Box<BoxAnnotations<T>>;
} = internal.hcat;

/**
 * Arranges boxes vertically in a column with the specified horizontal alignment.
 *
 * The vertical counterpart to `hcat`, essential for creating column-based layouts.
 * The alignment parameter controls how boxes of different widths are positioned
 * relative to each other.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const boxes = [Box.text("Top"), Box.text("Middle"), Box.text("Bottom")]
 * const vertical = Box.vcat(boxes, Box.left)
 * console.log(Box.renderPlainSync(vertical))
 * // Top
 * // Middle
 * // Bottom
 * ```
 *
 * @note Haskell: `vcat :: Foldable f => Alignment -> f Box -> Box`
 * @category combinators
 */
export const vcat: {
  <T extends readonly Box<unknown>[]>(
    a: Alignment
  ): (self: T) => Box<BoxAnnotations<T>>;
  <T extends readonly Box<unknown>[]>(
    self: T,
    a: Alignment
  ): Box<BoxAnnotations<T>>;
} = internal.vcat;

/**
 * Places two boxes side by side horizontally.
 *
 * A simple binary operation for combining two boxes horizontally with
 * top alignment. Equivalent to `hcat([left, right], top)` but optimized
 * for the two-box case.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const left = Box.text("Left")
 * const right = Box.text("Right")
 * const combined = Box.hAppend(left, right)
 * console.log(Box.renderPlainSync(combined))
 * // LeftRight
 * ```
 *
 * @note Haskell: `instance Semigroup Box where l <> r = hcat top [l,r]`
 * @category combinators
 */
export const hAppend: {
  <B>(that: Box<B>): <A>(self: Box<A>) => Box<A | B>;
  <A, B>(self: Box<A>, that: Box<B>): Box<A | B>;
} = internal.hAppend;

/**
 * Places two boxes side by side with a single space column between them.
 *
 * Convenience function for horizontal concatenation with automatic spacing.
 * Equivalent to `hAppend(left, hAppend(space, right))` where space is a
 * single-character space box.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const left = Box.text("Hello")
 * const right = Box.text("World")
 * const spaced = Box.hcatWithSpace(left, right)
 * console.log(Box.renderPlainSync(spaced))
 * // Hello World
 *
 * // Compare with hAppend (no space)
 * const noSpace = Box.hAppend(left, right)
 * console.log(Box.renderPlainSync(noSpace))
 * // HelloWorld
 * ```
 *
 * @note Haskell: `(<+>) :: Box -> Box -> Box`
 * @category combinators
 */
export const hcatWithSpace: {
  <B>(that: Box<B>): <A>(self: Box<A>) => Box<A | B>;
  <A, B>(self: Box<A>, that: Box<B>): Box<A | B>;
} = internal.hcatWithSpace;

/**
 * Stacks two boxes vertically, one above the other.
 *
 * The vertical counterpart to `hAppend`, combining two boxes in a column
 * with left alignment. Optimized for the two-box case.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const top = Box.text("Top")
 * const bottom = Box.text("Bottom")
 * const stacked = Box.vAppend(top, bottom)
 * console.log(Box.renderPlainSync(stacked))
 * // Top
 * // Bottom
 * ```
 *
 * @note Haskell: `(//) :: Box -> Box -> Box`
 * @category combinators
 */
export const vAppend: {
  <B>(that: Box<B>): <A>(self: Box<A>) => Box<A | B>;
  <A, B>(self: Box<A>, that: Box<B>): Box<A | B>;
} = internal.vAppend;

/**
 * Stacks two boxes vertically with a single empty row between them.
 *
 * Convenience function for vertical concatenation with automatic spacing.
 * Adds visual separation between vertically stacked content.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const top = Box.text("First section")
 * const bottom = Box.text("Second section")
 * const spaced = Box.vcatWithSpace(top, bottom)
 * console.log(Box.renderPlainSync(spaced))
 * // First section
 * //
 * // Second section
 *
 * // Compare with vAppend (no space)
 * const noSpace = Box.vAppend(top, bottom)
 * console.log(Box.renderPlainSync(noSpace))
 * // First section
 * // Second section
 * ```
 *
 * @note Haskell: `(/+/) :: Box -> Box -> Box`
 * @category combinators
 */
export const vcatWithSpace: {
  <B>(that: Box<B>): <A>(self: Box<A>) => Box<A | B>;
  <A, B>(self: Box<A>, that: Box<B>): Box<A | B>;
} = internal.vcatWithSpace;

/**
 * Arranges boxes horizontally with a separator box placed between each pair.
 *
 * Useful for creating lists, navigation bars, or any horizontal sequence
 * where items need consistent separation. The separator is inserted between
 * each adjacent pair of boxes, but not at the beginning or end.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const items = [Box.text("Home"), Box.text("About"), Box.text("Contact")]
 * const separator = Box.text(" | ")
 * const navbar = Box.punctuateH(items, Box.center1, separator)
 * console.log(Box.renderPlainSync(navbar))
 * // Home | About | Contact
 * ```
 *
 *
 * @note Haskell: `punctuateH :: Foldable f => Alignment -> Box -> f Box -> Box`
 * @category combinators
 */
export const punctuateH: {
  <A, T extends readonly Box<unknown>[]>(
    a: Alignment,
    p: Box<A>
  ): (self: T) => Box<A | BoxAnnotations<T>>;
  <A, T extends readonly Box<unknown>[]>(
    self: T,
    a: Alignment,
    p: Box<A>
  ): Box<A | BoxAnnotations<T>>;
} = internal.punctuateH;

/**
 * Arranges boxes vertically with a separator box placed between each pair.
 *
 * The vertical counterpart to `punctuateH`, useful for creating vertical
 * lists, menus, or content sections with consistent separation between items.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const menuItems = [
 *   Box.text("File"),
 *   Box.text("Edit"),
 *   Box.text("View"),
 *   Box.text("Help")
 * ]
 * const separator = Box.text("---")
 * const menu = Box.punctuateV(menuItems, Box.left, separator)
 * console.log(Box.renderPlainSync(menu))
 * // File
 * // ---
 * // Edit
 * // ---
 * // View
 * // ---
 * // Help
 * ```
 *
 * @note Haskell: `punctuateV :: Foldable f => Alignment -> Box -> f Box -> Box`
 * @category combinators
 */
export const punctuateV: {
  <A, T extends readonly Box<unknown>[]>(
    a: Alignment,
    p: Box<A>
  ): (self: T) => Box<A | BoxAnnotations<T>>;
  <A, T extends readonly Box<unknown>[]>(
    self: T,
    a: Alignment,
    p: Box<A>
  ): Box<A | BoxAnnotations<T>>;
} = internal.punctuateV;

/**
 * Arranges boxes horizontally with the specified amount of space between each.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const items = [Box.text("A"), Box.text("B"), Box.text("C")]
 * const row = Box.hsep(items, 2, Box.top)
 * console.log(Box.renderPlainSync(row))
 * // A  B  C
 * ```
 *
 * @note Haskell: `hsep :: Foldable f => Int -> Alignment -> f Box -> Box`
 * @category combinators
 */
export const hsep: {
  (sep: number, a: Alignment): <A>(self: readonly Box<A>[]) => Box<A>;
  <A>(self: readonly Box<A>[], sep: number, a: Alignment): Box<A>;
} = internal.hsep;

/**
 * Arranges boxes vertically with the specified amount of space between each.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const items = [Box.text("A"), Box.text("B"), Box.text("C")]
 * const column = Box.vsep(items, 1, Box.left)
 * console.log(Box.renderPlainSync(column))
 * // A
 * //
 * // B
 * //
 * // C
 * ```
 *
 * @note Haskell: `vsep :: Foldable f => Int -> Alignment -> f Box -> Box`
 * @category combinators
 */
export const vsep: {
  (sep: number, a: Alignment): <A>(self: readonly Box<A>[]) => Box<A>;
  <A>(self: readonly Box<A>[], sep: number, a: Alignment): Box<A>;
} = internal.vsep;

/*
 *  --------------------------------------------------------------------------------
 *  --  Paragraph flowing  ---------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Flows text into multiple columns of specified width and height.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const text = "one two three four five six seven eight"
 * const cols = Box.columns(text, Box.left, 10, 2)
 * console.log(cols.length)
 * ```
 *
 * @note Haskell: `columns :: Alignment -> Int -> Int -> String -> [Box]`
 * @category utilities
 */
export const columns: {
  (a: Alignment, w: number, h: number): (self: string) => Box[];
  (self: string, a: Alignment, w: number, h: number): Box[];
} = internal.columns;

/*
 *  --------------------------------------------------------------------------------
 *  --  Alignment  -----------------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Horizontally aligns a box within a specified width.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const value = Box.alignHoriz(Box.text("X"), Box.center1, 5)
 * console.log(Box.renderPlainSync(value))
 * //   X
 * ```
 *
 * @note Haskell: `alignHoriz :: Alignment -> Int -> Box -> Box`
 * @category transformations
 */
export const alignHoriz: {
  (a: Alignment, c: number): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, a: Alignment, c: number): Box<A>;
} = internal.alignHoriz;

/**
 * Vertically aligns a box within a specified height.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const value = Box.alignVert(Box.text("X"), Box.bottom, 3)
 * console.log(Box.rows(value))
 * // 3
 * ```
 *
 * @note Haskell: `alignVert :: Alignment -> Int -> Box -> Box`
 * @category transformations
 */
export const alignVert: {
  (a: Alignment, r: number): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, a: Alignment, r: number): Box<A>;
} = internal.alignVert;

/**
 * Aligns a box within specified dimensions using both horizontal and vertical alignment.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const value = Box.align(Box.text("X"), Box.center1, Box.center1, 3, 5)
 * console.log(Box.rows(value), Box.cols(value))
 * // 3 5
 * ```
 *
 * @note Haskell: `align :: Alignment -> Alignment -> Int -> Int -> Box -> Box`
 * @category transformations
 */
export const align: {
  (
    ah: Alignment,
    av: Alignment,
    r: number,
    c: number
  ): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, ah: Alignment, av: Alignment, r: number, c: number): Box<A>;
} = internal.align;

/**
 * Aligns a box to the left within its container.
 *
 * Ensures left alignment without changing the box dimensions. Useful
 * as a convenience function when you need explicit left alignment.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const box = Box.text("Hello\nWorld")
 * const leftAligned = Box.alignLeft(box)
 * console.log(Box.renderPlainSync(leftAligned))
 * // Hello
 * // World
 * ```
 *
 * @category transformations
 */
export const alignLeft: <A>(self: Box<A>) => Box<A> = internal.alignLeft;

/**
 * Moves a box up by adding empty rows below it.
 *
 * Increases the total height of the box by adding blank rows at the bottom,
 * effectively moving the content upward within a larger container.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const box = Box.text("Content")
 * const moved = Box.moveUp(box, 2)
 * console.log(`Original: ${Box.rows(box)} rows`)
 * // Original: 1 rows
 * console.log(`Moved: ${Box.rows(moved)} rows`)
 * // Moved: 3 rows
 * console.log(Box.renderPlainSync(moved))
 * // Content
 * //
 * //
 * ```
 *
 * @note Haskell: `moveUp :: Int -> Box -> Box`
 * @category transformations
 */
export const moveUp: {
  (n: number): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, n: number): Box<A>;
} = internal.moveUp;

/**
 * Moves a box down by adding empty rows above it.
 *
 * Increases the total height of the box by adding blank rows at the top,
 * effectively moving the content downward within a larger container.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const content = Box.text("Main content")
 * const withSpacing = Box.moveDown(content, 2)
 * console.log(Box.renderPlainSync(withSpacing))
 * //
 * //
 * // Main content
 * ```
 *
 * @note Haskell: `moveDown :: Int -> Box -> Box`
 * @category transformations
 */
export const moveDown: {
  (n: number): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, n: number): Box<A>;
} = internal.moveDown;

/**
 * Moves a box left by adding empty columns to the right.
 *
 * Increases the total width of the box by adding spaces to the right,
 * effectively moving the content leftward within a larger container.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const box = Box.text("Hello")
 * const moved = Box.moveLeft(box, 3)
 * console.log(`Original: ${Box.cols(box)} cols`)
 * // Original: 5 cols
 * console.log(`Moved: ${Box.cols(moved)} cols`)
 * // Moved: 8 cols
 * console.log(`"${Box.renderPlainSync(moved)}"`)
 * // "Hello   "
 * ```
 *
 * @note Haskell: `moveLeft :: Int -> Box -> Box`
 * @category transformations
 */
export const moveLeft: {
  (n: number): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, n: number): Box<A>;
} = internal.moveLeft;

/**
 * Moves a box right by adding empty columns to the left.
 *
 * Increases the total width of the box by adding spaces to the left,
 * effectively moving the content rightward within a larger container.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const text = Box.text("Indented content")
 * const indented = Box.moveRight(text, 4)
 * console.log(`"${Box.renderPlainSync(indented)}"`)
 * // "    Indented content"
 * ```
 *
 * @note Haskell: `moveRight :: Int -> Box -> Box`
 * @category transformations
 */
export const moveRight: {
  (n: number): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, n: number): Box<A>;
} = internal.moveRight;

// =============================================================================
// Truncation
// =============================================================================

/**
 * Truncates each line of a box to a maximum width, inserting an ellipsis
 * character (`…`) where content was removed.
 *
 * The `position` parameter uses the existing {@link Alignment} type to control
 * where content is preserved:
 *
 * - `AlignFirst` / `left` — keep the beginning, truncate the end (default)
 * - `AlignLast` / `right` — keep the end, truncate the beginning
 * - `AlignCenter1` / `AlignCenter2` — keep both ends, truncate the middle
 *
 * When the box's width is already within the target width, the box is
 * returned unchanged. The ellipsis counts as one column toward the width.
 *
 * @example
 * ```typescript
 * import { pipe } from "effect"
 * import * as Box from "effect-boxes/Box"
 *
 * const long = Box.text("This is a very long piece of text")
 *
 * // Truncate from end
 * const end = pipe(long, Box.truncate(15, Box.left))
 * console.log(Box.renderPlainSync(end))
 * // "This is a very…"
 *
 * // Truncate from start
 * const start = pipe(long, Box.truncate(15, Box.right))
 * console.log(Box.renderPlainSync(start))
 * // "…piece of text"
 *
 * // Truncate from middle
 * const middle = pipe(long, Box.truncate(15, Box.center1))
 * console.log(Box.renderPlainSync(middle))
 * // "This is…of text"
 * ```
 *
 * @category transformations
 */
export const truncate: {
  (width: number, position: Alignment): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, width: number, position: Alignment): Box<A>;
} = internal.truncate;

/*
 *  --------------------------------------------------------------------------------
 *  --  Implementation  ------------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Default render configuration for backwards compatibility (plain mode).
 *
 * @category utilities
 */
export const defaultRenderConfig: Renderer.RenderStyle =
  internalRender.defaultRenderConfig;

/**
 * Merges multiple arrays of rendered text lines into a single array.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const renderedBoxes = [["AB", "CD"], ["12", "34"]]
 * const merged = Box.merge(renderedBoxes)
 * console.log(merged)
 * // ["AB12", "CD34"]
 * ```
 *
 * @note Haskell: `merge = foldr (zipWith (++)) (repeat [])`
 * @category utilities
 */
export const merge: (renderedBoxes: string[][]) => string[] = internal.merge;

/**
 * Takes up to n elements from an array, padding with a default value if needed.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const arr = ["a", "b"]
 * const result = Box.takeP(arr, "-", 4)
 * console.log(result)
 * // ["a", "b", "-", "-"]
 * ```
 *
 * @note Haskell: `takeP :: a -> Int -> [a] -> [a]`
 * @category utilities
 */
export const takeP: {
  <A>(a: A, n: number): (self: readonly A[]) => A[];
  <A>(self: readonly A[], a: A, n: number): A[];
} = internal.takeP;

/**
 * Takes elements from an array with alignment, padding as needed.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const arr = ["a", "b"]
 * const result = Box.takePA(arr, Box.center1, "-", 5)
 * console.log(result)
 * // ["-", "a", "b", "-", "-"]
 * ```
 *
 * @note Haskell: `takePA :: Alignment -> a -> Int -> [a] -> [a]`
 * @category utilities
 */
export const takePA: {
  <A>(alignment: Alignment, a: A, n: number): (self: readonly A[]) => A[];
  <A>(self: readonly A[], alignment: Alignment, a: A, n: number): A[];
} = internal.takePA;

/**
 * Creates a string of spaces with the specified length.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const spaces = Box.blanks(5)
 * console.log(`|${spaces}|`)
 * // |     |
 * ```
 *
 * @note Haskell: `blanks :: Int -> String`
 * @category utilities
 */
export const blanks: (n: number) => string = internal.blanks;

/**
 * Adjusts the size of rendered text lines to specific dimensions.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const lines = ["AB", "CD"]
 * const resized = Box.resizeBox(lines, 3, 4)
 * console.log(resized)
 * // ["AB  ", "CD  ", "    "]
 * ```
 *
 * @note Haskell: `resizeBox :: Int -> Int -> [String] -> [String]`
 * @category utilities
 */
export const resizeBox: {
  (r: number, c: number): (self: string[]) => string[];
  (self: string[], r: number, c: number): string[];
} = internal.resizeBox;

/**
 * Adjusts the size of rendered text lines with alignment options.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const lines = ["A", "B"]
 * const resized = Box.resizeBoxAligned(3, 4, Box.center1, Box.center1)(lines)
 * console.log(resized.length)
 * // 3
 * ```
 *
 * @note Haskell: `resizeBoxAligned :: Int -> Int -> Alignment -> Alignment -> [String] -> [String]`
 * @category utilities
 */
export const resizeBoxAligned: (
  r: number,
  c: number,
  ha: Alignment,
  va: Alignment
) => (self: string[]) => string[] = internal.resizeBoxAligned;

/**
 * Renders a box to a string with ANSI styling within an Effect context.
 *
 * Uses the ANSI renderer to produce styled output with escape codes for
 * bold, color, and other terminal formatting. Whitespace is not preserved.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import * as Effect from "effect/Effect"
 *
 * const box = Box.annotate(Box.text("Hello"), Ansi.bold)
 * const program = Box.renderPretty(box)
 * const output = Effect.runSync(program)
 * // Outputs bold "Hello" with ANSI escape codes
 * ```
 *
 * @note Haskell: `renderPretty :: Box -> Effect String`
 * @category utilities
 */
export const renderPretty: <A>(self: Box<A>) => Effect.Effect<string> =
  internalRender.renderPretty;

/**
 * Renders a box to a pretty string with ANSI styling.
 *
 * Synchronous version of render for quick rendering without Effect.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const box = Box.annotate(Box.text("Hello"), Ansi.bold)
 * const output = Box.renderPrettySync(box)
 * console.log(output)
 * // Outputs bold "Hello" with ANSI escape codes
 * ```
 *
 * @note Haskell: `renderPrettySync :: Box -> String`
 * @category utilities
 */
export const renderPrettySync: <A>(self: Box<A>) => string =
  internalRender.renderPrettySync;

/**
 * Renders a box to a plain string without any special formatting within an
 * Effect context.
 *
 * Uses the plain renderer to produce unformatted output with whitespace
 * preserved. Useful when styling is not needed or output will be processed
 * further.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Effect from "effect/Effect"
 *
 * const box = Box.text("Hello\nWorld")
 * const program = Box.renderPlain(box)
 * const output = Effect.runSync(program)
 * // Hello
 * // World
 * ```
 *
 * @note Haskell: `renderPlain :: Box -> Effect String`
 * @category utilities
 */
export const renderPlain: <A>(self: Box<A>) => Effect.Effect<string> =
  internalRender.renderPlain;

/**
 * Renders a box to a plain string without any special formatting.
 *
 * Synchronous version of render for quick rendering without Effect.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const box = Box.text("Hello\nWorld")
 * const output = Box.renderPlainSync(box)
 * console.log(output)
 * // Hello
 * // World
 * ```
 *
 * @note Haskell: `renderPlainSync :: Box -> String`
 * @category utilities
 */
export const renderPlainSync: <A>(self: Box<A>) => string =
  internalRender.renderPlainSync;

/** * Renders a box to a Renderer within an Effect context.
 *
 * Asynchronous rendering that supports complex rendering strategies
 * and configurations. Returns an Effect that produces a Renderer.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Effect from "effect/Effect"
 * import * as Renderer from "effect-boxes/Renderer"
 *
 * const box = Box.text("Hello, Effect!")
 * const program = box.pipe(Box.render(), Effect.provide(Renderer.PlainRendererLive))
 *
 * Effect.runPromise(program).then((result) => {
 *   console.log(result)
 * })
 * ```
 *
 * @note Haskell: `render :: RenderConfig -> Box -> Effect<String, never, Renderer>`
 * @category utilities
 */
export const render: {
  <A>(
    config?: Renderer.RenderConfig | undefined
  ): (self: Box<A>) => Effect.Effect<string, never, Renderer.Renderer>;
  <A>(
    self: Box<A>,
    config?: Renderer.RenderConfig
  ): Effect.Effect<string, never, Renderer.Renderer>;
} = internalRender.render;

/**
 * Prints a box to the console using the Effect Console.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Effect from "effect/Effect"
 * import { PlainRendererLive } from "effect-boxes/Renderer"
 *
 * const box = Box.text("Hello, Box!")
 * const program = Box.printBox(box).pipe(Effect.provide(PlainRendererLive))
 * Effect.runPromise(program)
 * // Hello, Box!
 * ```
 *
 * @note Haskell: `printBox :: Box -> IO ()`
 * @category utilities
 */
export const printBox: <A>(
  self: Box<A>
) => Effect.Effect<void, never, Renderer.Renderer> = internalRender.printBox;

/*
 *  --------------------------------------------------------------------------------
 *  --  Annotation Functions  ------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Adds an annotation to a box.
 *
 * Annotations provide a way to attach additional data (like styling information)
 * to boxes without affecting their layout properties. Commonly used with the
 * Ansi module for colored terminal output.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const coloredBox = Box.annotate(
 *   Box.text("Hello World"),
 *   Ansi.red
 * )
 * ```
 *
 * @category transformations
 */
export const annotate: {
  <B>(annotation: Annotation<B>): <A>(self: Box<A>) => Box<B>;
  <A, B>(self: Box<A>, annotation: Annotation<B>): Box<B>;
} = internal.annotate;

/**
 * Removes the annotation from a box, returning a Box<never>.
 *
 * Strips all annotation data from a box, leaving only the layout structure
 * and content. Useful when you need a plain box without styling.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const annotatedBox = Box.annotate(
 *   Box.text("Styled text"),
 *   Ansi.red
 * )
 *
 * const plainBox = Box.unAnnotate(annotatedBox)
 * // Now plainBox has no color annotation
 * ```
 *
 * @category transformations
 */
export const unAnnotate: <A>(self: Box<A>) => Box<never> = internal.unAnnotate;

/**
 * Transforms the annotation of a box using a provided function.
 *
 * Applies a transformation function to the box's annotation, allowing you
 * to modify or convert annotation data. If the box has no annotation,
 * returns the box unchanged.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const redBox = Box.annotate(
 *   Box.text("Text"),
 *   Ansi.red
 * )
 *
 * // Transform red to blue
 * const blueBox = Box.reAnnotate(redBox, (ann) =>
 *   Ansi.blue
 * )
 * ```
 *
 * @category transformations
 */
export const reAnnotate: {
  <A, B>(transform: (annotation: A) => B): (self: Box<A>) => Box<B>;
  <A, B>(self: Box<A>, transform: (annotation: A) => B): Box<B>;
} = internal.reAnnotate;

/**
 * Applies a function to modify annotations within a box structure, creating multiple boxes.
 *
 * The alter function receives an annotation and returns an array of new annotations.
 * Returns an array of boxes, one for each annotation returned by the alter function.
 * If the box has no annotation, throws an error.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const baseBox = Box.annotate(
 *   Box.text("Message"),
 *   Ansi.red
 * )
 *
 * // Create multiple color variations
 * const variations = Box.alterAnnotation(baseBox, (ann) => [
 *   Ansi.red,
 *   Ansi.green,
 *   Ansi.blue
 * ])
 * // Returns array of 3 boxes with different colors
 * ```
 *
 * @category transformations
 */
export const alterAnnotation: {
  <A, B>(alter: (annotation: A) => B[]): (self: Box<A>) => Box<B>[];
  <A, B>(self: Box<A>, alter: (annotation: A) => B[]): Box<B>[];
} = internal.alterAnnotation;

// --------------------------------------------------------------------------------
// --  Border  --------------------------------------------------------------------
// --------------------------------------------------------------------------------

/**
 * Characters used to draw a border around a box.
 *
 * @category models
 */
export type BorderChars = internal.BorderChars;

/**
 * Named border style presets.
 *
 * - `"single"` — thin single-line border (`┌─┐│└┘`)
 * - `"double"` — double-line border (`╔═╗║╚╝`)
 * - `"rounded"` — rounded corners (`╭─╮│╰╯`)
 * - `"thick"` — bold/thick lines (`┏━┓┃┗┛`)
 * - `"ascii"` — ASCII-only (`+-+|`)
 *
 * @category models
 */
export type BorderStyle = internal.BorderStyle;

/**
 * Options for the `border` combinator.
 *
 * @category models
 */
export type BorderOptions<A> = internal.BorderOptions<A>;

/**
 * Single-line border character set.
 *
 * @category constructors
 */
export const singleBorder: BorderChars = internal.singleBorder;

/**
 * Double-line border character set.
 *
 * @category constructors
 */
export const doubleBorder: BorderChars = internal.doubleBorder;

/**
 * Rounded-corner border character set.
 *
 * @category constructors
 */
export const roundedBorder: BorderChars = internal.roundedBorder;

/**
 * Thick/bold border character set.
 *
 * @category constructors
 */
export const thickBorder: BorderChars = internal.thickBorder;

/**
 * ASCII-only border character set.
 *
 * @category constructors
 */
export const asciiBorder: BorderChars = internal.asciiBorder;

/**
 * Wraps a box with a border using the specified style.
 *
 * Draws a border around the box using Unicode box-drawing characters.
 * Supports multiple preset styles and optional annotation (color) for
 * the border characters.
 *
 * @example
 * ```typescript
 * import { pipe } from "effect"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * // Default single border
 * const bordered = pipe(Box.text("Hello"), Box.border())
 * console.log(Box.renderPlainSync(bordered))
 * // ┌─────┐
 * // │Hello│
 * // └─────┘
 *
 * // Rounded border with color
 * const fancy = pipe(
 *   Box.text("Warning"),
 *   Box.border("rounded", { annotation: Ansi.yellow })
 * )
 * console.log(Box.renderPrettySync(fancy))
 * ```
 *
 * @category combinators
 */
export const border: {
  <B>(
    style?: BorderStyle,
    options?: BorderOptions<B>
  ): <A>(self: Box<A>) => Box<A | B>;
  <A, B>(
    self: Box<A>,
    style?: BorderStyle,
    options?: BorderOptions<B>
  ): Box<A | B>;
} = internal.border;

// --------------------------------------------------------------------------------
// --  Padding  -------------------------------------------------------------------
// --------------------------------------------------------------------------------

/**
 * Adds padding (empty space) around a box.
 *
 * Supports CSS-like shorthand for specifying padding per side.
 * Padding adds space between the content and any surrounding border.
 *
 * - `pad(all)` — uniform padding on all sides
 * - `pad(vertical, horizontal)` — vertical (top/bottom) and horizontal (left/right)
 * - `pad(top, right, bottom, left)` — per-side, CSS order
 *
 * @example
 * ```typescript
 * import { pipe } from "effect"
 * import * as Box from "effect-boxes/Box"
 *
 * // Uniform padding of 1 on all sides
 * const padded = pipe(Box.text("Hi"), Box.pad(1))
 * console.log(Box.renderPlainSync(padded).replaceAll(" ", "."))
 * // ....
 * // .Hi.
 * // ....
 *
 * // Padding with border
 * const panel = pipe(Box.text("Hi"), Box.pad(1, 2), Box.border("rounded"))
 * console.log(Box.renderPlainSync(panel))
 * // ╭──────╮
 * // │      │
 * // │  Hi  │
 * // │      │
 * // ╰──────╯
 * ```
 *
 * @category transformations
 */
export const pad: {
  (all: number): <A>(self: Box<A>) => Box<A>;
  (vertical: number, horizontal: number): <A>(self: Box<A>) => Box<A>;
  (
    top: number,
    right: number,
    bottom: number,
    left: number
  ): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, all: number): Box<A>;
  <A>(self: Box<A>, vertical: number, horizontal: number): Box<A>;
  <A>(
    self: Box<A>,
    top: number,
    right: number,
    bottom: number,
    left: number
  ): Box<A>;
} = internal.pad;

/**
 * Ensures a box is at least `n` columns wide, padding with spaces on the right
 * if the box is narrower.
 *
 * @example
 * ```typescript
 * import { pipe } from "effect"
 * import * as Box from "effect-boxes/Box"
 *
 * const result = pipe(Box.text("Hi"), Box.minWidth(10))
 * console.log(Box.cols(result))
 * // 10
 * ```
 *
 * @category transformations
 */
export const minWidth: {
  (n: number): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, n: number): Box<A>;
} = internal.minWidth;

/**
 * Caps a box at `n` columns wide, truncating lines that exceed the limit.
 *
 * @example
 * ```typescript
 * import { pipe } from "effect"
 * import * as Box from "effect-boxes/Box"
 *
 * const result = pipe(Box.text("Hello World"), Box.maxWidth(5))
 * console.log(Box.cols(result))
 * // 5
 * ```
 *
 * @category transformations
 */
export const maxWidth: {
  (n: number): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, n: number): Box<A>;
} = internal.maxWidth;

/**
 * Crops a box horizontally, keeping up to `width` columns after `offset`.
 *
 * @example
 * ```typescript
 * import { pipe } from "effect"
 * import * as Box from "effect-boxes/Box"
 *
 * const result = pipe(Box.text("Hello World"), Box.cropWidth(6, 5))
 * console.log(Box.renderPlainSync(result))
 * // World
 * ```
 *
 * @category transformations
 */
export const cropWidth: {
  (offset: number, width: number): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, offset: number, width: number): Box<A>;
} = internal.cropWidth;

/**
 * Ensures a box is at least `n` rows tall, padding with blank rows at the
 * bottom if the box is shorter.
 *
 * @example
 * ```typescript
 * import { pipe } from "effect"
 * import * as Box from "effect-boxes/Box"
 *
 * const result = pipe(Box.text("X"), Box.minHeight(5))
 * console.log(Box.rows(result))
 * // 5
 * ```
 *
 * @category transformations
 */
export const minHeight: {
  (n: number): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, n: number): Box<A>;
} = internal.minHeight;

/**
 * Caps a box at `n` rows tall, keeping only the first `n` rows.
 *
 * @example
 * ```typescript
 * import { pipe } from "effect"
 * import * as Box from "effect-boxes/Box"
 *
 * const result = pipe(Box.text("A\nB\nC\nD\nE"), Box.maxHeight(3))
 * console.log(Box.rows(result))
 * // 3
 * ```
 *
 * @category transformations
 */
export const maxHeight: {
  (n: number): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, n: number): Box<A>;
} = internal.maxHeight;

/**
 * Crops a box vertically, keeping up to `height` rows after `offset`.
 *
 * @example
 * ```typescript
 * import { pipe } from "effect"
 * import * as Box from "effect-boxes/Box"
 *
 * const result = pipe(Box.text("A\nB\nC\nD"), Box.cropHeight(1, 2))
 * console.log(Box.renderPlainSync(result))
 * // B
 * // C
 * ```
 *
 * @category transformations
 */
export const cropHeight: {
  (offset: number, height: number): <A>(self: Box<A>) => Box<A>;
  <A>(self: Box<A>, offset: number, height: number): Box<A>;
} = internal.cropHeight;
