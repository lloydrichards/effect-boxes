import * as Equal from "effect/Equal";
import * as Hash from "effect/Hash";
import { pipeArguments } from "effect/Pipeable";
import type * as Annotation from "../Annotation.js";

/** @internal */
const AnnotationSymbolKey = "@effect/boxes/Annotation";

/** @internal */
export const AnnotationTypeId: Annotation.AnnotationTypeId = Symbol.for(
  AnnotationSymbolKey
) as Annotation.AnnotationTypeId;

/** @internal */
export const isAnnotation = (
  value: unknown
): value is Annotation.Annotation<unknown> =>
  typeof value === "object" &&
  value !== null &&
  "data" in value &&
  AnnotationTypeId in value &&
  (value as Record<PropertyKey, unknown>)[AnnotationTypeId] === "annotation";

/** @internal */
export const isAnnotationWithData = <A>(
  value: unknown,
  dataGuard: (data: unknown) => data is A
): value is Annotation.Annotation<A> =>
  isAnnotation(value) && dataGuard(value.data);

/** @internal */
export const createAnnotation = <A>(data: A): Annotation.Annotation<A> => ({
  [AnnotationTypeId]: "annotation" as const,
  [Equal.symbol](this: Annotation.Annotation<A>, that: unknown): boolean {
    return isAnnotation(that) && Equal.equals(this.data, that.data);
  },
  [Hash.symbol](this: Annotation.Annotation<A>): number {
    return Hash.hash(this.data);
  },
  pipe() {
    return pipeArguments(this, arguments);
  },
  data,
});

/** @internal */
export const getAnnotationData = <A>(annotation: Annotation.Annotation<A>): A =>
  annotation.data;

/** @internal */
export const mapAnnotationData = <A, B>(
  annotation: Annotation.Annotation<A>,
  mapper: (data: A) => B
): Annotation.Annotation<B> => createAnnotation(mapper(annotation.data));

/** @internal */
export const combineAnnotations = <A>(
  first: Annotation.Annotation<A>,
  second: Annotation.Annotation<A>,
  merger: (a: A, b: A) => A
): Annotation.Annotation<A> =>
  createAnnotation(merger(first.data, second.data));

/** @internal */
export const filterAnnotation = <A>(
  annotation: Annotation.Annotation<A>,
  predicate: (data: A) => boolean
): Annotation.Annotation<A> | undefined =>
  predicate(annotation.data) ? annotation : undefined;

/** @internal */
export const createAnnotations = <A>(
  dataArray: readonly A[]
): Annotation.Annotation<A>[] => dataArray.map(createAnnotation);

/** @internal */
export const extractAnnotationData = <A>(
  annotations: readonly Annotation.Annotation<A>[]
): A[] => annotations.map(getAnnotationData);

/** @internal */
export const empty: Annotation.Annotation<undefined> =
  createAnnotation(undefined);

/** @internal */
export const cloneAnnotation = <A>(
  annotation: Annotation.Annotation<A>
): Annotation.Annotation<A> => createAnnotation(annotation.data);
