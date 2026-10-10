/**
 * Reactive annotations for interactive terminal UIs.
 *
 * Extends the annotation system with position-aware metadata, enabling
 * hit-testing and cursor-to-element mapping. Useful for building
 * interactive CLI applications where boxes respond to user input.
 *
 * ## Common tasks
 *
 * - **Create** reactive boxes: {@link make}, {@link reactive}
 * - **Query** positions: {@link getPositions}, {@link cursorToReactive}
 * - **Check** type: {@link isReactive}
 *
 * @see {@link make} — create a reactive annotation
 * @see {@link cursorToReactive} — map cursor position to element
 *
 * @module
 */
import { HashMap, type Option, type Result } from "effect";
import { dual } from "effect/Function";
import type { Annotation } from "./Annotation.js";
import type { AnsiStyle } from "./Ansi.js";
import type { Box } from "./Box.js";
import * as internalFrame from "./internal/frame.js";
import * as internal from "./internal/reactive.js";
import type { LayoutValidationError } from "./Layout.js";
import type { ResolvedFrame } from "./Renderer.js";

/*
 *  --------------------------------------------------------------------------------
 *  --  Reactive Types  ------------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Reactive identifier type for tracking box positions.
 *
 * Represents a unique identifier that can be attached to boxes to enable
 * position tracking in rendered output. Essential for building interactive
 * terminal applications where you need to know where specific boxes are
 * positioned after layout calculation.
 *
 * @example
 * ```typescript
 * import * as Reactive from "effect-boxes/Reactive"
 *
 * const buttonId: Reactive.Reactive = {
 *   _tag: "ReactiveId",
 *   id: "submit-button"
 * }
 * // Used to track the position of a submit button in a form
 * ```
 *
 * @category models
 */
export type Reactive = {
  readonly _tag: "ReactiveId";
  readonly id: string;
};

/**
 * Convenience type for reactive annotations.
 *
 * Combines the Annotation wrapper with Reactive data, providing a complete
 * type for reactive box annotations. Used throughout the reactive system
 * for type-safe position tracking.
 *
 * @example
 * ```typescript
 * import * as Reactive from "effect-boxes/Reactive"
 * import * as Box from "effect-boxes/Box"
 *
 * const menuAnnotation: Reactive.ReactiveAnnotation =
 *   Reactive.reactive("main-menu")
 *
 * const reactiveMenu = Box.text("Main Menu").pipe(
 *   Box.annotate(menuAnnotation)
 * )
 * ```
 *
 * @category models
 */
export type ReactiveAnnotation = Annotation<Reactive>;

/**
 * Map of reactive IDs to their positions in the rendered output.
 *
 * Contains the calculated positions and dimensions of all reactive boxes
 * after layout processing. Essential for implementing cursor navigation,
 * click handling, and other interactive features in terminal applications.
 *
 * @example
 * ```typescript
 * import * as Reactive from "effect-boxes/Reactive"
 * import * as Box from "effect-boxes/Box"
 * import { HashMap } from "effect"
 *
 * const layout = Box.vcat([
 *   Reactive.makeReactive(Box.text("Header"), "header"),
 *   Reactive.makeReactive(Box.text("Content"), "content"),
 *   Reactive.makeReactive(Box.text("Footer"), "footer")
 * ], Box.left)
 *
 * const positions: Reactive.PositionMap = Reactive.getPositions(layout)
 * // Contains entries like:
 * // "header"  -> { row: 0, col: 0, rows: 1, cols: 6 }
 * // "content" -> { row: 1, col: 0, rows: 1, cols: 7 }
 * // "footer"  -> { row: 2, col: 0, rows: 1, cols: 6 }
 * ```
 *
 * @category models
 */
export type PositionMap = HashMap.HashMap<
  string, // Reactive ID
  {
    readonly row: number; // 0-based row position
    readonly col: number; // 0-based column position
    readonly rows: number; // height of the box
    readonly cols: number; // width of the box
  }
>;

/*
 *  --------------------------------------------------------------------------------
 *  --  Type Guards and Constructors  ----------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Type guard to check if a value is a Reactive annotation.
 *
 * Determines whether a given value conforms to the Reactive interface.
 * Essential for type-safe processing of annotations and filtering
 * reactive elements from other annotation types.
 *
 * @example
 * ```typescript
 * import * as Reactive from "effect-boxes/Reactive"
 *
 * console.log(Reactive.isReactive({ id: "btn", kind: "reactive" }))
 * // false (not a valid Reactive instance)
 *
 * const r = Reactive.reactive("button-1")
 * import * as Annotation from "effect-boxes/Annotation"
 * console.log(Reactive.isReactive(Annotation.getAnnotationData(r)))
 * // true
 * ```
 *
 * @category guards
 */
export const isReactive: (value: unknown) => value is Reactive =
  internal.isReactive;

/**
 * Creates a ReactiveId with the specified string identifier.
 *
 * Constructs a Reactive object with the proper structure and tag.
 * Use this when you need to create reactive identifiers for manual
 * annotation or when building custom reactive systems.
 *
 * @example
 * ```typescript
 * import * as Reactive from "effect-boxes/Reactive"
 * import * as Annotation from "effect-boxes/Annotation"
 *
 * const buttonReactive = Reactive.make("submit-button")
 * console.log(buttonReactive)
 * // { _tag: "ReactiveId", id: "submit-button" }
 *
 * const menuReactive = Reactive.make("navigation-menu")
 * const formReactive = Reactive.make("contact-form")
 * ```
 *
 * @category constructors
 */
export const make: (id: string) => Reactive = internal.make;

/**
 * Creates a reactive annotation with the specified string identifier.
 *
 * Combines reactive ID creation with annotation wrapping in a single step.
 * This is the preferred method for creating reactive annotations as it
 * handles both the Reactive object creation and annotation wrapping.
 *
 * @example
 * ```typescript
 * import * as Reactive from "effect-boxes/Reactive"
 * import * as Box from "effect-boxes/Box"
 *
 * const buttonAnnotation = Reactive.reactive("save-button")
 * const saveButton = Box.text("Save").pipe(Box.annotate(buttonAnnotation))
 *
 * const menuAnnotation = Reactive.reactive("main-menu")
 * const menu = Box.vcat([
 *   Box.text("File"),
 *   Box.text("Edit"),
 *   Box.text("View")
 * ], Box.left).pipe(Box.annotate(menuAnnotation))
 * ```
 *
 * @category constructors
 */
export const reactive: (id: string) => Annotation<Reactive> = internal.reactive;

/*
 *  --------------------------------------------------------------------------------
 *  --  Box Annotation Functions  --------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Annotates a box with a reactive identifier for position tracking.
 *
 * Transforms any box into a reactive box by adding position tracking
 * capabilities. Supports both data-first and data-last calling patterns
 * for flexible composition. The resulting box can be tracked in the
 * position map after rendering.
 *
 * @example
 * ```typescript
 * import * as Reactive from "effect-boxes/Reactive"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const titleBox = Box.text("Application Title")
 * const reactiveTitle = Reactive.makeReactive(titleBox, "main-title")
 *
 * const styledButton = Box.text("Click Me").pipe(Box.annotate(Ansi.bold))
 * const reactiveButton = Reactive.makeReactive(styledButton, "click-btn")
 * ```
 *
 * @category transformations
 */
export const makeReactive: {
  (id: string): <A>(self: Box<A>) => Box<Reactive>;
  <A>(self: Box<A>, id: string): Box<Reactive>;
} = internal.makeReactive;

/*
 *  --------------------------------------------------------------------------------
 *  --  Position Tracking Render Functions  ----------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Collects positions of reactive annotations from a box.
 *
 * Traverses a box layout and extracts the calculated positions of all
 * reactive elements, returning a position map that can be used for
 * cursor navigation and interactive features. Essential for implementing
 * click handling, keyboard navigation, and dynamic updates.
 *
 * @example
 * ```typescript
 * import * as Reactive from "effect-boxes/Reactive"
 * import * as Box from "effect-boxes/Box"
 * import { HashMap } from "effect"
 *
 * const layout = Box.vcat([
 *   Reactive.makeReactive(Box.text("Header"), "header"),
 *   Box.text("Static content"),
 *   Reactive.makeReactive(Box.text("Button"), "btn"),
 *   Reactive.makeReactive(Box.text("Footer"), "footer")
 * ], Box.left)
 *
 * const positions = Reactive.getPositions(layout)
 * const headerPos = HashMap.get(positions, "header")
 * // Some({ row: 0, col: 0, rows: 1, cols: 6 })
 * ```
 *
 * @category utilities
 */
export const getPositions: <A>(self: Box<A>) => PositionMap =
  internal.getPositions;

/*
 *  --------------------------------------------------------------------------------
 *  --  Cursor Navigation Commands  ------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Creates a cursor movement command to navigate to a reactive box position.
 *
 * Generates an ANSI cursor movement command to position the cursor at a
 * specific reactive element. Returns an Option that contains the movement
 * command if the reactive ID exists, or None if not found. Essential for
 * implementing keyboard navigation and cursor-based interactions.
 *
 * @example
 * ```typescript
 * import * as Reactive from "effect-boxes/Reactive"
 * import * as Box from "effect-boxes/Box"
 * import * as Cmd from "effect-boxes/Cmd"
 * import { pipe, Option } from "effect"
 *
 * const layout = Box.vcat([
 *   Reactive.makeReactive(Box.text("Menu Item 1"), "item-1"),
 *   Reactive.makeReactive(Box.text("Menu Item 2"), "item-2"),
 *   Reactive.makeReactive(Box.text("Menu Item 3"), "item-3")
 * ], Box.left)
 *
 * const positions = Reactive.getPositions(layout)
 * const moveToItem2 = Reactive.cursorToReactive(positions, "item-2")
 *
 * pipe(
 *   moveToItem2,
 *   Option.match({
 *     onNone: () => console.log("Item not found"),
 *     onSome: (cmd) => console.log("Moving cursor to item 2")
 *   })
 * )
 * ```
 *
 * @category navigation
 */
export const cursorToReactive: {
  (key: string): (positionMap: PositionMap) => Option.Option<Box<AnsiStyle>>;
  (positionMap: PositionMap, key: string): Option.Option<Box<AnsiStyle>>;
} = internal.cursorToReactive;

/**
 * Describes bounds in terminal rows and columns.
 *
 * @category models
 */
export type Bounds = internalFrame.Bounds;

/**
 * Retains one source occurrence with logical, clipped, and visible bounds.
 * Keys identify occurrences within this frame only.
 *
 * @category models
 */
export type RegionOccurrence = internalFrame.RegionOccurrence;

/**
 * Aggregates occurrences of a reactive ID and their visible rectangles.
 * Fully hidden IDs retain occurrences with empty visible arrays.
 *
 * @category models
 */
export type Region = internalFrame.Region;

/**
 * Maps reactive IDs to regions from one resolved snapshot.
 *
 * @category models
 */
export type RegionMap = internalFrame.RegionMap;

/**
 * Finds all occurrences and visible fragments of a reactive ID in a frame.
 * Returns None for an unknown ID. Hidden IDs remain present.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import * as Box from "effect-boxes/Box"
 * import * as Reactive from "effect-boxes/Reactive"
 * import * as Renderer from "effect-boxes/Renderer"
 * const resolved = Effect.runSync(Renderer.resolve(
 *   Reactive.makeReactive(Box.text("Button"), "button")
 * ))
 * const region = Reactive.getRegion(resolved.regions, "button")
 * ```
 * @category utilities
 */
export const getRegion: {
  (id: string): (self: RegionMap) => Option.Option<Region>;
  (self: RegionMap, id: string): Option.Option<Region>;
} = dual(2, (self: RegionMap, id: string) => HashMap.get(self, id));

/**
 * Finds visible reactive IDs at one cell, innermost first without duplicate IDs.
 * Opaque untracked content blocks lower hits. Out-of-viewport cells return an
 * empty array; non-safe-integer coordinates throw RangeError.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import * as Box from "effect-boxes/Box"
 * import * as Reactive from "effect-boxes/Reactive"
 * import * as Renderer from "effect-boxes/Renderer"
 * const resolved = Effect.runSync(Renderer.resolve(
 *   Reactive.makeReactive(Box.text("Button"), "button")
 * ))
 * const hits = Reactive.hitTest(resolved, { col: 1, row: 0 })
 * console.log(hits) // ["button"]
 * ```
 * @category utilities
 */
export const hitTest: {
  (position: {
    readonly row: number;
    readonly col: number;
  }): (self: ResolvedFrame) => ReadonlyArray<string>;
  (
    self: ResolvedFrame,
    position: { readonly row: number; readonly col: number }
  ): ReadonlyArray<string>;
} = dual(2, internalFrame.hitTest);

/**
 * Finds visible reactive IDs, returning invalid coordinates or frame identity as a failure.
 * Out-of-viewport cells return a successful empty array.
 *
 * @example
 * ```typescript
 * import { Effect, Result } from "effect"
 * import * as Box from "effect-boxes/Box"
 * import * as Reactive from "effect-boxes/Reactive"
 * import * as Renderer from "effect-boxes/Renderer"
 * const frame = Effect.runSync(Renderer.resolve(Box.text("A")))
 * const result = Reactive.hitTestResult(frame, { row: 0.5, col: 0 })
 * console.log(Result.isFailure(result)) // true
 * ```
 * @category utilities
 */
export const hitTestResult: {
  (position: {
    readonly row: number;
    readonly col: number;
  }): (
    self: ResolvedFrame
  ) => Result.Result<
    ReadonlyArray<string>,
    LayoutValidationError | internalFrame.FrameResolutionError
  >;
  (
    self: ResolvedFrame,
    position: { readonly row: number; readonly col: number }
  ): Result.Result<
    ReadonlyArray<string>,
    LayoutValidationError | internalFrame.FrameResolutionError
  >;
} = dual(2, internalFrame.hitTestResult);
