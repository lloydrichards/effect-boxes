/**
 * @internal
 */
import { Array as Arr, Match, pipe } from "effect";
import { dual } from "effect/Function";
import type * as Box from "../Box.js";
import type { Flex } from "../Layout.js";
import * as internal from "./box.js";

/*
 *  --------------------------------------------------------------------------------
 *  --  Constructors  --------------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/** @internal */
export const fixed = <A>(box: Box.Box<A>): Flex.Child<A> => ({
  _tag: "Fixed",
  box,
});

/** @internal */
export const grow = <A>(box: Box.Box<A>, factor = 1): Flex.Child<A> => ({
  _tag: "Grow",
  box,
  factor,
});

/** @internal */
export const fill = <A>(
  builder: (size: number) => Box.Box<A>,
  factor = 1
): Flex.Child<A> => ({
  _tag: "Fill",
  builder,
  factor,
});

/** @internal */
export const spacer = (factor = 1): Flex.Child<never> => ({
  _tag: "Fill",
  builder: (size: number) => internal.emptyBox(0, size),
  factor,
});

/*
 *  --------------------------------------------------------------------------------
 *  --  Internals  -----------------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

const flexFactor = <A>(child: Flex.Child<A>): number =>
  Match.value(child).pipe(
    Match.tag("Fixed", () => 0),
    Match.orElse((c) => c.factor)
  );

const flexFixedSize = <A>(
  child: Flex.Child<A>,
  measure: (box: Box.Box<A>) => number
): number =>
  Match.value(child).pipe(
    Match.tag("Fixed", (c) => measure(c.box)),
    Match.orElse(() => 0)
  );

const computeSizes = <A>(
  children: ReadonlyArray<Flex.Child<A>>,
  available: number,
  totalFactor: number
): ReadonlyArray<number> => {
  const baseSizes = Arr.map(children, (child) =>
    Match.value(child).pipe(
      Match.tag("Fixed", () => 0),
      Match.orElse((c) =>
        totalFactor > 0
          ? Math.max(0, Math.floor((c.factor / totalFactor) * available))
          : 0
      )
    )
  );

  const growIndices = pipe(
    children,
    Arr.reduce<number[], Flex.Child<A>>([], (acc, child, i) =>
      child._tag !== "Fixed" && child.factor > 0 ? Arr.append(acc, i) : acc
    )
  );

  const bonusIndices = new Set(
    Arr.take(
      growIndices,
      Math.max(0, available - Arr.reduce(baseSizes, 0, (a, b) => a + b))
    )
  );

  return Arr.map(baseSizes, (size, i) =>
    bonusIndices.has(i) ? size + 1 : size
  );
};

const resolveFlexChildren = <A>(
  children: ReadonlyArray<Flex.Child<A>>,
  available: number,
  totalFactor: number,
  alignFn: (box: Box.Box<A>, size: number) => Box.Box<A>
): Box.Box<A>[] => {
  const sizes = computeSizes(children, available, totalFactor);

  return Arr.map(children, (child, i) => {
    const size = sizes[i] ?? 0;
    return Match.value(child).pipe(
      Match.tag("Fixed", (c) => c.box),
      Match.tag("Fill", (c) => c.builder(size)),
      Match.tag("Grow", (c) => alignFn(c.box, size)),
      Match.exhaustive
    );
  });
};

/*
 *  --------------------------------------------------------------------------------
 *  --  Row  -----------------------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/** @internal */
export const row = dual<
  (
    containerWidth: number,
    options?: Flex.Options
  ) => <A>(self: ReadonlyArray<Flex.Child<A>>) => Box.Box<A>,
  <A>(
    self: ReadonlyArray<Flex.Child<A>>,
    containerWidth: number,
    options?: Flex.Options
  ) => Box.Box<A>
>(
  (args) => Arr.isArray(args[0]),
  <A>(
    self: ReadonlyArray<Flex.Child<A>>,
    containerWidth: number,
    options?: Flex.Options
  ): Box.Box<A> => {
    const align = options?.align ?? internal.top;
    const gap = options?.gap ?? 0;

    const fixedWidth = Arr.reduce(
      self,
      0,
      (sum, c) => sum + flexFixedSize(c, internal.cols)
    );
    const available = Math.max(
      0,
      containerWidth - fixedWidth - gap * Math.max(0, self.length - 1)
    );
    const totalFactor = Arr.reduce(self, 0, (sum, c) => sum + flexFactor(c));

    const sized = resolveFlexChildren(self, available, totalFactor, (box, w) =>
      internal.alignHoriz(box, internal.left, w)
    );

    return internal.hsep(sized, gap, align);
  }
);

/*
 *  --------------------------------------------------------------------------------
 *  --  Col  -----------------------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/** @internal */
export const col = dual<
  (
    containerHeight: number,
    options?: Flex.Options
  ) => <A>(self: ReadonlyArray<Flex.Child<A>>) => Box.Box<A>,
  <A>(
    self: ReadonlyArray<Flex.Child<A>>,
    containerHeight: number,
    options?: Flex.Options
  ) => Box.Box<A>
>(
  (args) => Arr.isArray(args[0]),
  <A>(
    self: ReadonlyArray<Flex.Child<A>>,
    containerHeight: number,
    options?: Flex.Options
  ): Box.Box<A> => {
    const align = options?.align ?? internal.left;
    const gap = options?.gap ?? 0;

    const fixedHeight = Arr.reduce(
      self,
      0,
      (sum, c) => sum + flexFixedSize(c, internal.rows)
    );
    const available = Math.max(
      0,
      containerHeight - fixedHeight - gap * Math.max(0, self.length - 1)
    );
    const totalFactor = Arr.reduce(self, 0, (sum, c) => sum + flexFactor(c));

    const sized = resolveFlexChildren(self, available, totalFactor, (box, h) =>
      internal.alignVert(box, internal.top, h)
    );

    return internal.vsep(sized, gap, align);
  }
);
