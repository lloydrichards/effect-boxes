import { HashMap, Option } from "effect";
import { dual } from "effect/Function";
import type * as Annotation from "../Annotation.js";
import type * as Ansi from "../Ansi.js";
import type * as Box from "../Box.js";
import type * as Reactive from "../Reactive.js";
import { createAnnotation } from "./annotation.js";
import { annotate } from "./box.js";
import { cursorTo } from "./cmd.js";
import * as Width from "./width.js";

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
  let positions: Reactive.PositionMap = HashMap.empty();

  const visit = (box: Box.Box<A>, row: number, col: number): void => {
    const { annotation, cols, content, rows } = box;
    if (rows === 0 || cols === 0) return;

    if (annotation && isReactive(annotation.data)) {
      positions = HashMap.set(positions, annotation.data.id, {
        row,
        col,
        rows,
        cols,
      });
    }

    switch (content._tag) {
      case "Row": {
        let childCol = col;
        for (const child of content.boxes) {
          visit(child, row, childCol);
          childCol += child.cols;
        }
        break;
      }
      case "Col": {
        let childRow = row;
        for (const child of content.boxes) {
          visit(child, childRow, col);
          childRow += child.rows;
        }
        break;
      }
      case "SubBox":
        visit(
          content.box,
          row + Width.alignmentOffset(content.yAlign, content.box.rows, rows),
          col + Width.alignmentOffset(content.xAlign, content.box.cols, cols)
        );
        break;
    }
  };

  visit(self, 0, 0);
  return positions;
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
