import { Array, HashMap, Match, Option, pipe } from "effect";
import { dual } from "effect/Function";
import type * as Annotation from "../Annotation.js";
import type * as Ansi from "../Ansi.js";
import type * as Box from "../Box.js";
import type * as Reactive from "../Reactive.js";
import { createAnnotation } from "./annotation.js";
import { annotate, merge, resizeBox, resizeBoxAligned } from "./box.js";
import { cursorTo } from "./cmd.js";

/*
 *  --------------------------------------------------------------------------------
 *  --  Type Guards and Constructors  ----------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/** @internal */
export const isReactive = (value: unknown): value is Reactive.Reactive =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  "id" in value &&
  (value as Record<PropertyKey, unknown>)._tag === "ReactiveId" &&
  typeof (value as Record<PropertyKey, unknown>).id === "string";

/** @internal */
export const make = (id: string): Reactive.Reactive => ({
  _tag: "ReactiveId" as const,
  id,
});

/** @internal */
export const reactive = (
  id: string
): Annotation.Annotation<Reactive.Reactive> => createAnnotation(make(id));

/*
 *  --------------------------------------------------------------------------------
 *  --  Box Annotation Functions  --------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/** @internal */
export const makeReactive = dual<
  (id: string) => <A>(self: Box.Box<A>) => Box.Box<Reactive.Reactive>,
  <A>(self: Box.Box<A>, id: string) => Box.Box<Reactive.Reactive>
>(
  2,
  <A>(self: Box.Box<A>, id: string): Box.Box<Reactive.Reactive> =>
    annotate(self, reactive(id))
);

/*
 *  --------------------------------------------------------------------------------
 *  --  Position Tracking Render Functions  ----------------------------------------
 *  --------------------------------------------------------------------------------
 */

/** @internal */
export const getPositions = <A>(self: Box.Box<A>): Reactive.PositionMap => {
  const renderBoxWithTracking = <B>(
    box: Box.Box<B>,
    offsetRow: number,
    offsetCol: number
  ): readonly [string[], Reactive.PositionMap] => {
    const { cols, content, rows, annotation } = box;

    if (rows === 0 || cols === 0) {
      return [[], HashMap.empty()];
    }

    const basePositions: Reactive.PositionMap =
      annotation && isReactive(annotation.data)
        ? HashMap.make([
            annotation.data.id,
            {
              row: offsetRow,
              col: offsetCol,
              rows: box.rows,
              cols: box.cols,
            },
          ])
        : HashMap.empty();

    return pipe(
      content,
      Match.type<Box.Content<B>>().pipe(
        Match.tag(
          "Blank",
          () => [resizeBox([""], rows, cols), basePositions] as const
        ),
        Match.tag(
          "Text",
          ({ text }) => [resizeBox([text], rows, cols), basePositions] as const
        ),
        Match.tag("Row", ({ boxes }) => {
          const { rendered, acc } = pipe(
            boxes,
            Array.reduce(
              {
                rendered: [] as string[][],
                acc: basePositions,
                cur: offsetCol,
              },
              (acc, b) => {
                const result = renderBoxWithTracking(b, offsetRow, acc.cur);
                return {
                  rendered: [...acc.rendered, result[0]],
                  acc: HashMap.union(acc.acc, result[1]),
                  cur: acc.cur + b.cols,
                };
              }
            )
          );

          return [pipe(rendered, merge, resizeBox(rows, cols)), acc] as const;
        }),
        Match.tag("Col", ({ boxes }) => {
          // Use reduce to accumulate rendered boxes and positions
          const { lines, acc } = pipe(
            boxes,
            Array.reduce(
              {
                lines: [] as string[],
                acc: basePositions,
                currentRow: offsetRow,
              },
              (acc, b) => {
                const result = renderBoxWithTracking(
                  b,
                  acc.currentRow,
                  offsetCol
                );
                return {
                  lines: [...acc.lines, ...result[0]],
                  acc: HashMap.union(acc.acc, result[1]),
                  currentRow: acc.currentRow + b.rows,
                };
              }
            )
          );

          return [resizeBox(lines, rows, cols), acc] as const;
        }),
        Match.tag("SubBox", ({ box: subBox, xAlign, yAlign }) => {
          const result = renderBoxWithTracking(
            subBox,
            offsetRow + calculateAlignmentOffset(yAlign, rows - subBox.rows),
            offsetCol + calculateAlignmentOffset(xAlign, cols - subBox.cols)
          );

          return [
            pipe(result[0], resizeBoxAligned(rows, cols, xAlign, yAlign)),
            HashMap.union(basePositions, result[1]),
          ] as const;
        }),
        Match.exhaustive
      )
    );
  };

  const calculateAlignmentOffset = (
    alignment: Box.Alignment,
    space: number
  ): number =>
    Match.value(alignment).pipe(
      Match.when("AlignFirst", () => 0),
      Match.when("AlignLast", () => space),
      Match.when("AlignCenter1", () => Math.floor(space / 2)),
      Match.when("AlignCenter2", () => Math.ceil(space / 2)),
      Match.exhaustive
    );

  return renderBoxWithTracking(self, 0, 0)[1];
};

/*
 *  --------------------------------------------------------------------------------
 *  --  Cursor Navigation Commands  ------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/** @internal */
export const cursorToReactive = dual<
  (
    key: string
  ) => (
    positionMap: Reactive.PositionMap
  ) => Option.Option<Box.Box<Ansi.AnsiStyle>>,
  (
    positionMap: Reactive.PositionMap,
    key: string
  ) => Option.Option<Box.Box<Ansi.AnsiStyle>>
>(2, (positionMap, key) =>
  Option.map(HashMap.get(positionMap, key), (p) => cursorTo(p.col, p.row))
);
