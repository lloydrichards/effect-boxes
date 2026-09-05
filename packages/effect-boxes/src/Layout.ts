/**
 * Layout — higher-level layout combinators built on top of Box.
 *
 * Provides container-aware composition primitives inspired by CSS Flexbox:
 * - `Flex.row` / `Flex.col` distribute space among children proportionally
 * - `Container.make` passes available dimensions to child builders
 * - `Grid.make` / `Grid.auto` arrange items in fixed-column grids
 *
 * All helpers are pure functions that return standard Box values,
 * composable with existing Box primitives (border, annotate, pad, etc).
 *
 * @module
 */
import type * as Box from "./Box.js";
import * as internalContainer from "./internal/container.js";
import * as internalFlex from "./internal/flex.js";
import * as internalGrid from "./internal/grid.js";

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
