/**
 * Type-safe annotation system for attaching metadata to boxes.
 *
 * Annotations allow boxes to carry arbitrary typed data (colors, styles,
 * semantic tags) that renderers can interpret. The annotation type parameter
 * `A` on `Box<A>` flows through all composition operations.
 *
 * ## Mental model
 *
 * - **`Annotation<A>`** — a wrapper holding metadata of type `A`
 * - Annotations are **structural** — they implement `Equal` and `Hash`
 * - They compose via {@link combineAnnotations} for layered styling
 *
 * ## Common tasks
 *
 * - **Create** an annotation: {@link createAnnotation}, {@link empty}
 * - **Inspect**: {@link isAnnotation}, {@link getAnnotationData}
 * - **Transform**: {@link mapAnnotationData}, {@link combineAnnotations}
 *
 * @see {@link createAnnotation} — primary constructor
 * @see {@link combineAnnotations} — merge multiple annotations
 *
 * @module
 */
import type * as Equal from "effect/Equal";
import type * as Hash from "effect/Hash";
import type { Pipeable } from "effect/Pipeable";
import * as internal from "./internal/annotation.js";

/**
 * @category models
 */
export const AnnotationTypeId: unique symbol = internal.AnnotationTypeId;

/**
 * @category models
 */
export type AnnotationTypeId = typeof AnnotationTypeId;

/**
 * Generic annotation wrapper with branded type safety.
 *
 * Annotations provide a way to attach arbitrary data to boxes without
 * affecting their layout properties. This abstraction allows styling
 * systems (like ANSI colors) to work with the Box layout system.
 *
 * @category models
 */
export interface Annotation<A = never>
  extends Pipeable,
    Equal.Equal,
    Hash.Hash {
  readonly [AnnotationTypeId]: "annotation";
  readonly data: A;
}

/**
 * Type guard to check if a value is an Annotation.
 *
 * @example
 * ```typescript
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const style = Ansi.red
 * if (Annotation.isAnnotation(style)) {
 *   console.log("This is an annotation")
 *   // TypeScript now knows style is Annotation<unknown>
 * }
 * ```
 *
 * @category guards
 */
export const isAnnotation: (value: unknown) => value is Annotation<unknown> =
  internal.isAnnotation;

/**
 * Type guard to check if a value is an Annotation with specific data type.
 *
 * Provides type-safe checking for annotations containing specific data types,
 * useful when working with different annotation systems.
 *
 * @example
 * ```typescript
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const isStringAnnotation = (data: unknown): data is string =>
 *   typeof data === "string"
 *
 * const annotation = Annotation.createAnnotation("some text")
 * if (Annotation.isAnnotationWithData(annotation, isStringAnnotation)) {
 *   // TypeScript knows annotation is Annotation<string>
 *   const text = Annotation.getAnnotationData(annotation) // string
 * }
 * ```
 *
 * @category guards
 */
export const isAnnotationWithData: <A>(
  value: unknown,
  dataGuard: (data: unknown) => data is A
) => value is Annotation<A> = internal.isAnnotationWithData;

/**
 * Creates a new Annotation with the provided data.
 *
 * The fundamental constructor for creating typed annotations. Wraps arbitrary
 * data in the Annotation abstraction for use with the Box system.
 *
 * @example
 * ```typescript
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Box from "effect-boxes/Box"
 *
 * // Create custom annotation types
 * type TooltipData = { text: string; position: "top" | "bottom" }
 * const tooltip = Annotation.createAnnotation<TooltipData>({
 *   text: "Click for more info",
 *   position: "top"
 * })
 *
 * // Apply to box
 * const buttonWithTooltip = Box.text("Click me").pipe(
 *   Box.annotate(tooltip)
 * )
 * ```
 *
 * @category constructors
 */
export const createAnnotation: <A>(data: A) => Annotation<A> =
  internal.createAnnotation;

/**
 * Extracts the data from an Annotation<A>.
 *
 * Unwraps the annotation wrapper to access the underlying data. Essential
 * for consuming annotation data in styling systems and custom renderers.
 *
 * @example
 * ```typescript
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const redStyle = Ansi.red
 * const ansiCommands = Annotation.getAnnotationData(redStyle)
 * console.log(ansiCommands)
 * // [{ _tag: "ForegroundColor", name: "red", code: "31" }]
 * ```
 *
 * @category utilities
 */
export const getAnnotationData: <A>(annotation: Annotation<A>) => A =
  internal.getAnnotationData;

/**
 * Maps the data of an Annotation<A> to create an Annotation<B>.
 *
 * Transforms annotation data while preserving the annotation structure.
 * Essential for converting between different annotation formats or
 * modifying annotation data for different rendering contexts.
 *
 * @example
 * ```typescript
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const redAnsi = Ansi.red
 * const cssAnnotation = Annotation.mapAnnotationData(
 *   redAnsi,
 *   (ansiCommands) => ({ className: "text-red-500" })
 * )
 *
 * const cssData = Annotation.getAnnotationData(cssAnnotation)
 * console.log(cssData) // { className: "text-red-500" }
 * ```
 *
 * @category transformations
 */
export const mapAnnotationData: <A, B>(
  annotation: Annotation<A>,
  mapper: (data: A) => B
) => Annotation<B> = internal.mapAnnotationData;
/**
 * Combines two annotations by merging their data.
 *
 * Merges annotation data using a custom merger function. Essential for
 * combining multiple styling annotations or accumulating annotation
 * properties across box compositions.
 *
 * @example
 * ```typescript
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const redColor = Ansi.red
 * const boldStyle = Ansi.bold
 *
 * const combined = Annotation.combineAnnotations(
 *   redColor,
 *   boldStyle,
 *   (first, second) => [...first, ...second]
 * )
 *
 * const allCommands = Annotation.getAnnotationData(combined)
 * // Contains both color and bold commands
 * ```
 *
 * @category combinators
 */
export const combineAnnotations: <A>(
  first: Annotation<A>,
  second: Annotation<A>,
  merger: (a: A, b: A) => A
) => Annotation<A> = internal.combineAnnotations;

/**
 * Filters annotation data based on a predicate function.
 *
 * Returns the annotation if the predicate passes, otherwise undefined.
 * Useful for conditionally applying annotations or filtering out
 * annotations that don't meet certain criteria.
 *
 * @example
 * ```typescript
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Box from "effect-boxes/Box"
 *
 * type ConditionalStyle = { color: string; condition: boolean }
 *
 * const conditionalRed = Annotation.createAnnotation<ConditionalStyle>({
 *   color: "red",
 *   condition: true
 * })
 *
 * const validStyle = Annotation.filterAnnotation(
 *   conditionalRed,
 *   (data) => data.condition
 * )
 *
 * if (validStyle) {
 *   // Apply the style to a box
 *   const styledBox = Box.text("Error!").pipe(Box.annotate(validStyle))
 * }
 * ```
 *
 * @category utilities
 */
export const filterAnnotation: <A>(
  annotation: Annotation<A>,
  predicate: (data: A) => boolean
) => Annotation<A> | undefined = internal.filterAnnotation;

/**
 * Creates an array of annotations from an array of data.
 *
 * Efficiently wraps multiple data items in annotations. Useful for batch
 * processing of styling data or creating multiple annotations with similar
 * structure.
 *
 * @example
 * ```typescript
 * import * as Annotation from "effect-boxes/Annotation"
 *
 * type ColorData = { name: string; hex: string }
 * const colorData: ColorData[] = [
 *   { name: "red", hex: "#ff0000" },
 *   { name: "green", hex: "#00ff00" },
 *   { name: "blue", hex: "#0000ff" }
 * ]
 *
 * const colorAnnotations = Annotation.createAnnotations(colorData)
 * // Array of 3 Annotation<ColorData> instances
 * ```
 *
 * @category constructors
 */
export const createAnnotations: <A>(
  dataArray: readonly A[]
) => Annotation<A>[] = internal.createAnnotations;

/**
 * Extracts data from an array of annotations.
 *
 * Unwraps multiple annotations to get their underlying data as an array.
 * The inverse operation of `createAnnotations`, useful for batch processing
 * annotation data or preparing data for external systems.
 *
 * @example
 * ```typescript
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Ansi from "effect-boxes/Ansi"
 *
 * const annotations = [Ansi.red, Ansi.bold, Ansi.underlined]
 * const allCommands = Annotation.extractAnnotationData(annotations)
 *
 * // Flatten all ANSI commands for processing
 * const flatCommands = allCommands.flat()
 * console.log(flatCommands.length) // Total number of ANSI commands
 * ```
 *
 * @category utilities
 */
export const extractAnnotationData: <A>(
  annotations: readonly Annotation<A>[]
) => A[] = internal.extractAnnotationData;

/**
 * Type-level utility to extract the data type from an `Annotation` type.
 *
 * @category models
 */
export type AnnotationData<T> = T extends Annotation<infer A> ? A : never;

/**
 * Predefined annotation containing `undefined` for use as a default or
 * placeholder.
 *
 * Its data type remains `undefined`, so it cannot be treated as an annotation
 * containing another data type.
 *
 * @example
 * ```typescript
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Ansi from "effect-boxes/Ansi"
 * import * as Box from "effect-boxes/Box"
 *
 * const getStatusStyle = (isError: boolean) =>
 *   isError ? Ansi.red : Annotation.empty
 *
 * const statusBox = Box.text("Status: OK").pipe(
 *   Box.annotate(getStatusStyle(false))
 * )
 * // Box with no styling applied due to empty annotation
 * ```
 *
 * @category constructors
 */
export const empty: Annotation<undefined> = internal.empty;

/**
 * Creates a copy of an annotation with the same data.
 *
 * Creates a deep copy of an annotation with identical data. Useful for
 * creating independent annotation instances that can be modified separately
 * or for ensuring annotation immutability in complex operations.
 *
 * @example
 * ```typescript
 * import * as Annotation from "effect-boxes/Annotation"
 * import * as Box from "effect-boxes/Box"
 *
 * type Style = { color: string; weight: string }
 * const baseStyle = Annotation.createAnnotation<Style>({
 *   color: "blue",
 *   weight: "normal"
 * })
 *
 * const clonedStyle = Annotation.cloneAnnotation(baseStyle)
 *
 * // Both annotations have the same data but are separate instances
 * const box1 = Box.text("Text 1").pipe(Box.annotate(baseStyle))
 * const box2 = Box.text("Text 2").pipe(Box.annotate(clonedStyle))
 * ```
 *
 * @category utilities
 */
export const cloneAnnotation: <A>(annotation: Annotation<A>) => Annotation<A> =
  internal.cloneAnnotation;
