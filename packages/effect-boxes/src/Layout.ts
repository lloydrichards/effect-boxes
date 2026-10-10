/**
 * Layout — higher-level layout combinators built on top of Box.
 *
 * Provides container-aware composition primitives inspired by CSS Flexbox:
 * - `Flex.row` / `Flex.col` distribute space among children proportionally
 * - `Container.make` passes available dimensions to child builders
 * - `Grid.make` / `Grid.auto` arrange items in fixed-column grids
 * - `Place.make` places and clips content within an exact bounded region
 *
 * Flex, Container, Grid, and Place return standard Box values. Layer and
 * Stack describe overlapping Boxes for Renderer.frame at the frame boundary.
 *
 * @module
 */
import type { Result } from "effect";
import type * as Box from "./Box.js";
import * as internalContainer from "./internal/container.js";
import * as internalFlex from "./internal/flex.js";
import * as internalGrid from "./internal/grid.js";
import * as internalValidation from "./internal/layout-validation.js";
import * as internalPlace from "./internal/place.js";
import * as internalStack from "./internal/stack.js";

/*
 *  --------------------------------------------------------------------------------
 *  --  Flex  ----------------------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Distributes space among children using a flexbox-style algorithm.
 *
 * Fixed children keep their intrinsic size. Grow and Fill children share
 * remaining space proportionally based on their factor. Remainder columns
 * are distributed one each to the first N grow children to avoid rounding
 * gaps.
 *
 * If fixed children exceed the container size, grow children receive 0
 * space and the result may be wider/taller than the container. Compose
 * with `Box.maxWidth` to enforce hard limits.
 *
 * @example
 * ```typescript
 * import { pipe } from "effect"
 * import * as Box from "effect-boxes/Box"
 * import { Flex } from "effect-boxes/Layout"
 *
 * // Data-first
 * const row = Flex.row(
 *   [Flex.fixed(Box.text("Name:")), Flex.spacer(), Flex.fixed(Box.text("[ok]"))],
 *   80
 * )
 *
 * // Data-last (pipe)
 * const row2 = pipe(
 *   [Flex.fixed(Box.text("Name:")), Flex.grow(Box.text("value"), 2), Flex.fixed(Box.text("[ok]"))],
 *   Flex.row(80, { gap: 1 })
 * )
 * ```
 *
 * @category combinators
 */
export const Flex = {
  /**
   * Creates a fixed-size flex child that occupies its intrinsic width/height.
   *
   * @example
   * ```typescript
   * import * as Box from "effect-boxes/Box"
   * import { Flex } from "effect-boxes/Layout"
   *
   * const child = Flex.fixed(Box.text("Label"))
   * ```
   *
   * @category constructors
   */
  fixed: internalFlex.fixed,

  /**
   * Creates a growable flex child that expands to fill remaining space.
   *
   * @example
   * ```typescript
   * import * as Box from "effect-boxes/Box"
   * import { Flex } from "effect-boxes/Layout"
   *
   * const child = Flex.grow(Box.text("stretches"), 2)
   * ```
   *
   * @category constructors
   */
  grow: internalFlex.grow,

  /**
   * Creates a flex child that fills remaining space via a builder function.
   * The builder receives the allocated width (for row) or height (for col)
   * so content can be constructed to fit exactly.
   *
   * @example
   * ```typescript
   * import * as Box from "effect-boxes/Box"
   * import { Flex } from "effect-boxes/Layout"
   *
   * const child = Flex.fill((width) => Box.text("=".repeat(width)))
   * ```
   *
   * @category constructors
   */
  fill: internalFlex.fill,

  /**
   * Creates a flexible spacer that pushes adjacent children apart.
   *
   * @example
   * ```typescript
   * import * as Box from "effect-boxes/Box"
   * import { Flex } from "effect-boxes/Layout"
   *
   * const row = Flex.row(
   *   [Flex.fixed(Box.text("left")), Flex.spacer(), Flex.fixed(Box.text("right"))],
   *   40
   * )
   * ```
   *
   * @category constructors
   */
  spacer: internalFlex.spacer,

  /**
   * Arranges children horizontally within a fixed container width.
   *
   * @example
   * ```typescript
   * import { pipe } from "effect"
   * import * as Box from "effect-boxes/Box"
   * import { Flex } from "effect-boxes/Layout"
   *
   * // Data-first
   * const row = Flex.row(
   *   [Flex.fixed(Box.text("Name:")), Flex.grow(Box.text("value"))],
   *   40
   * )
   *
   * // Data-last (pipe)
   * const row2 = pipe(
   *   [Flex.fixed(Box.text("Name:")), Flex.grow(Box.text("value"))],
   *   Flex.row(40, { gap: 1 })
   * )
   * ```
   *
   * @category combinators
   */
  row: internalFlex.row,

  /**
   * Arranges children vertically within a fixed container height.
   *
   * @example
   * ```typescript
   * import * as Box from "effect-boxes/Box"
   * import { Flex } from "effect-boxes/Layout"
   *
   * const col = Flex.col(
   *   [Flex.fixed(Box.text("header")), Flex.grow(Box.text("body")), Flex.fixed(Box.text("footer"))],
   *   24
   * )
   * ```
   *
   * @category combinators
   */
  col: internalFlex.col,
} as const;

/**
 * @category models
 */
export declare namespace Flex {
  /**
   * A flex child that occupies its intrinsic width/height.
   *
   * @category models
   */
  export interface Fixed<A = never> {
    readonly _tag: "Fixed";
    readonly box: Box.Box<A>;
  }

  /**
   * A flex child that grows to fill remaining space proportionally.
   *
   * @category models
   */
  export interface Grow<A = never> {
    readonly _tag: "Grow";
    readonly box: Box.Box<A>;
    readonly factor: number;
  }

  /**
   * A flex child that fills remaining space via a builder function.
   *
   * @category models
   */
  export interface Fill<A = never> {
    readonly _tag: "Fill";
    readonly builder: (size: number) => Box.Box<A>;
    readonly factor: number;
    readonly isSpacer?: true;
  }

  /**
   * A child element in a flex layout.
   *
   * @category models
   */
  export type Child<A = never> = Fixed<A> | Grow<A> | Fill<A>;

  /**
   * Options for flex row/col layout.
   *
   * @category models
   */
  export interface Options {
    readonly align?: Box.Alignment;
    readonly gap?: number;
  }
}

/*
 *  --------------------------------------------------------------------------------
 *  --  Container  -----------------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Provides container dimensions to a child builder function.
 * Automatically computes inner dimensions after padding, enforces width
 * on the output, and applies padding.
 *
 * @category combinators
 */
export const Container = {
  /**
   * Creates a container that passes available dimensions to a builder
   * function. Enforces the container width on the output and applies
   * padding.
   *
   * @example
   * ```typescript
   * import * as Box from "effect-boxes/Box"
   * import { Container } from "effect-boxes/Layout"
   *
   * const box = Container.make({ width: 40, padding: 1 }, (ctx) =>
   *   Box.text("inner width: " + ctx.innerWidth)
   * )
   * console.log(Box.cols(box))
   * // 40
   * ```
   *
   * @category constructors
   */
  make: internalContainer.make,
} as const;

/**
 * @category models
 */
export declare namespace Container {
  /**
   * Context passed to a container builder function with computed inner
   * dimensions after padding.
   *
   * @category models
   */
  export interface Context {
    readonly width: number;
    readonly height: number;
    readonly innerWidth: number;
    readonly innerHeight: number;
  }

  /**
   * Options for creating a container.
   *
   * @category models
   */
  export interface Options {
    readonly width: number;
    readonly height?: number;
    readonly padding?: number | readonly [number, number];
  }
}

/*
 *  --------------------------------------------------------------------------------
 *  --  Grid  ----------------------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Arranges items in rows and columns with uniform column width.
 *
 * @category combinators
 */
export const Grid = {
  /**
   * Arranges items in a fixed-column grid with uniform column width.
   *
   * @example
   * ```typescript
   * import { pipe } from "effect"
   * import * as Box from "effect-boxes/Box"
   * import { Grid } from "effect-boxes/Layout"
   *
   * // Data-first
   * const grid = Grid.make(
   *   ["A", "B", "C", "D"].map(Box.text),
   *   { cols: 2, colWidth: 10, gap: [1, 0] }
   * )
   *
   * // Data-last (pipe)
   * const grid2 = pipe(
   *   ["A", "B", "C", "D"].map(Box.text),
   *   Grid.make({ cols: 2, colWidth: 10 })
   * )
   * ```
   *
   * @category combinators
   */
  make: internalGrid.make,

  /**
   * Calculates column count from container width and arranges items
   * in a grid with auto-computed dimensions.
   *
   * @example
   * ```typescript
   * import { pipe } from "effect"
   * import * as Box from "effect-boxes/Box"
   * import { Grid } from "effect-boxes/Layout"
   *
   * // Data-first
   * const grid = Grid.auto(
   *   ["A", "B", "C", "D", "E", "F"].map(Box.text),
   *   80,
   *   { minColWidth: 20 }
   * )
   *
   * // Data-last (pipe)
   * const grid2 = pipe(
   *   ["A", "B", "C", "D", "E", "F"].map(Box.text),
   *   Grid.auto(80, { minColWidth: 20 })
   * )
   * ```
   *
   * @category combinators
   */
  auto: internalGrid.auto,
} as const;

/**
 * @category models
 */
export declare namespace Grid {
  /**
   * Options for fixed-column grid layout.
   *
   * @category models
   */
  export interface Options {
    readonly cols: number;
    readonly colWidth: number;
    readonly gap?: readonly [number, number];
    readonly align?: Box.Alignment;
    readonly stretch?: boolean;
  }

  /**
   * Options for auto-column grid layout.
   *
   * @category models
   */
  export interface AutoOptions {
    readonly minColWidth: number;
    readonly maxColWidth?: number;
    readonly gap?: number;
    readonly align?: Box.Alignment;
    readonly stretch?: boolean;
  }
}

/**
 * Places content within an exact bounded region using terminal cell coordinates.
 *
 * The make helper sets both dimensions; horizontal and vertical preserve the
 * other source dimension. Numeric offsets default to zero. Center rounding uses
 * floor((outer - inner) / 2), including oversized content. Visible annotations
 * survive clipping, and padding outside the source is unannotated.
 *
 * Dimensions must be non-negative safe integers and numeric offsets must be safe
 * integers. Invalid values and Cmd annotations anywhere in the source throw
 * RangeError, including when the source is wholly outside the viewport.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import { Place } from "effect-boxes/Layout"
 *
 * const placed = Place.make(Box.text("Hello"), {
 *   width: 20, height: 4, x: "center", y: "bottom"
 * })
 * console.log(placed.cols, placed.rows) // 20, 4
 * ```
 *
 * @category transformations
 */
export const Place = {
  /**
   * Places and clips a Box within exactly the requested width and height.
   *
   * Offsets default to zero. Center uses floor((outer - inner) / 2), including
   * oversized content. Padding outside the source is unannotated. Visible source
   * annotations survive clipping; partial wide glyphs become blank cells.
   *
   * @throws RangeError - If dimensions are negative or not safe integers, offsets
   * are not safe integers, anchors are invalid, or the source contains Cmd annotations.
   *
   * @example
   * ```typescript
   * import * as Box from "effect-boxes/Box"
   * import { Place } from "effect-boxes/Layout"
   *
   * const placed = Box.text("Hello").pipe(
   *   Place.make({ width: 20, height: 4, x: "center", y: "bottom" })
   * )
   * console.log(placed.cols, placed.rows) // 20, 4
   * ```
   *
   * @category transformations
   */
  make: internalPlace.make,

  /**
   * Places a Box, returning validation failures instead of throwing them.
   * Uses the same clipping and annotation preservation as Place.make.
   *
   * @example
   * ```typescript
   * import { Result } from "effect"
   * import * as Box from "effect-boxes/Box"
   * import { Place } from "effect-boxes/Layout"
   * const result = Box.text("Hello").pipe(
   *   Place.makeResult({ width: 20, height: 4, x: "center" })
   * )
   * if (Result.isSuccess(result)) console.log(result.success.cols) // 20
   * ```
   * @category transformations
   */
  makeResult: internalPlace.makeResult,

  /**
   * Places a Box horizontally within an exact width, preserving its height.
   *
   * Uses the same clipping, validation, and command rejection as Place.make.
   *
   * @example
   * ```typescript
   * import * as Box from "effect-boxes/Box"
   * import { Place } from "effect-boxes/Layout"
   *
   * const placed = Place.horizontal(Box.text("Hello"), 10, "right")
   * console.log(Box.renderPlainSync(placed)) // "     Hello"
   * ```
   *
   * @category transformations
   */
  horizontal: internalPlace.horizontal,

  /**
   * Places a Box vertically within an exact height, preserving its width.
   *
   * Uses the same clipping, validation, and command rejection as Place.make.
   *
   * @example
   * ```typescript
   * import * as Box from "effect-boxes/Box"
   * import { Place } from "effect-boxes/Layout"
   *
   * const placed = Box.text("Hello").pipe(Place.vertical(3, "bottom"))
   * console.log(placed.rows, placed.cols) // 3, 5
   * ```
   *
   * @category transformations
   */
  vertical: internalPlace.vertical,
} as const;

/**
 * Reports invalid layout input or unsupported command annotations.
 *
 * @example
 * ```typescript
 * import { Result } from "effect"
 * import * as Box from "effect-boxes/Box"
 * import { Place } from "effect-boxes/Layout"
 * const result = Place.makeResult(Box.text("A"), { width: -1, height: 1 })
 * if (Result.isFailure(result)) console.log(result.failure.reason) // "InvalidInput"
 * ```
 * @category errors
 */
export const LayoutValidationError: typeof internalValidation.LayoutValidationError =
  internalValidation.LayoutValidationError;
/** @category errors */
export type LayoutValidationError = internalValidation.LayoutValidationError;

/**
 * @category models
 */
export declare namespace Place {
  /**
   * Horizontal coordinate or anchor.
   * @category models
   */
  export type Horizontal = number | "left" | "center" | "right";
  /**
   * Vertical coordinate or anchor.
   * @category models
   */
  export type Vertical = number | "top" | "center" | "bottom";
  /**
   * Bounded placement options in terminal cells.
   * @category models
   */
  export interface Options {
    readonly width: number;
    readonly height: number;
    readonly x?: Horizontal;
    readonly y?: Vertical;
  }
}

/**
 * Describes one opaque Box positioned within a Stack viewport.
 *
 * @category models
 */
export interface Layer<out A = never> {
  readonly box: Box.Box<A>;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Creates positioned layers for frame-boundary composition.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import { Layer } from "effect-boxes/Layout"
 * const popup = Layer.make(Box.text("Popup"), { x: 2, y: 1, z: 1 })
 * const piped = Box.text("Popup").pipe(Layer.make({ x: 2, y: 1 }))
 * ```
 *
 * @category constructors
 */
export const Layer: {
  /**
   * Positions a Box with signed safe integer offsets and z-order.
   * Defaults x, y, and z to zero. Invalid numbers throw RangeError.
   *
   * @example
   * ```typescript
   * import * as Box from "effect-boxes/Box"
   * import { Layer } from "effect-boxes/Layout"
   * const layer = Layer.make(Box.text("Hello"))
   * const piped = Box.text("Hello").pipe(Layer.make())
   * ```
   * @category constructors
   */
  readonly make: {
    (options?: Layer.Options): <A>(self: Box.Box<A>) => Layer<A>;
    <A>(self: Box.Box<A>, options?: Layer.Options): Layer<A>;
  };
  /**
   * Positions a Box, returning invalid coordinates as a validation failure.
   *
   * @example
   * ```typescript
   * import { Result } from "effect"
   * import * as Box from "effect-boxes/Box"
   * import { Layer } from "effect-boxes/Layout"
   * const result = Layer.makeResult(Box.text("A"), { x: 0.5 })
   * console.log(Result.isFailure(result)) // true
   * ```
   * @category constructors
   */
  readonly makeResult: {
    (
      options?: Layer.Options
    ): <A>(self: Box.Box<A>) => Result.Result<Layer<A>, LayoutValidationError>;
    <A>(
      self: Box.Box<A>,
      options?: Layer.Options
    ): Result.Result<Layer<A>, LayoutValidationError>;
  };
} = {
  make: internalStack.makeLayer,
  makeResult: internalStack.makeLayerResult,
};

/** @category models */
export namespace Layer {
  /**
   * Describes signed safe integer coordinates and ordering.
   * @category models
   */
  export interface Options {
    readonly x?: number;
    readonly y?: number;
    readonly z?: number;
  }
}

/**
 * Describes flat opaque layers within an exact viewport. A Stack is not a Box.
 *
 * @category models
 */
export interface Stack<out A = never> {
  readonly _tag: "Stack";
  readonly width: number;
  readonly height: number;
  readonly layers: ReadonlyArray<Layer<A>>;
}

/**
 * Combines layers for resolution and encoding through Renderer.frame.
 * Higher z wins; later input wins ties. Spaces and padding are opaque.
 * Partial wide glyphs become blanks when clipped or covered.
 *
 * @example
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 * import { Layer, Stack } from "effect-boxes/Layout"
 * const stack = Stack.make([
 *   Layer.make(Box.text("Background")),
 *   Layer.make(Box.text("Popup"), { x: 2, z: 1 }),
 * ], { width: 20, height: 4 })
 * ```
 *
 * @category combinators
 */
export const Stack: {
  /**
   * Copies layers into a bounded immutable description.
   * Requires nonnegative safe integer dimensions; invalid values throw RangeError.
   *
   * @example
   * ```typescript
   * import * as Box from "effect-boxes/Box"
   * import { Layer, Stack } from "effect-boxes/Layout"
   * const stack = Stack.make([Layer.make(Box.text("A"))], { width: 8, height: 2 })
   * ```
   * @category constructors
   */
  readonly make: <const T extends ReadonlyArray<Layer<unknown>>>(
    layers: T,
    options: Stack.Options
  ) => Stack<T[number] extends Layer<infer A> ? A : never>;
  /**
   * Copies layers into a viewport, returning invalid dimensions as a failure.
   *
   * @example
   * ```typescript
   * import { Result } from "effect"
   * import { Stack } from "effect-boxes/Layout"
   * const result = Stack.makeResult([], { width: 8, height: 2 })
   * console.log(Result.isSuccess(result)) // true
   * ```
   * @category constructors
   */
  readonly makeResult: <const T extends ReadonlyArray<Layer<unknown>>>(
    layers: T,
    options: Stack.Options
  ) => Result.Result<
    Stack<T[number] extends Layer<infer A> ? A : never>,
    LayoutValidationError
  >;
} = {
  make: internalStack.makeStack,
  makeResult: internalStack.makeStackResult,
};

/** @category models */
export namespace Stack {
  /**
   * Describes exact viewport dimensions in terminal cells.
   * @category models
   */
  export interface Options {
    readonly width: number;
    readonly height: number;
  }
}
