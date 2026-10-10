/** @internal */
import { Match, Predicate, Result } from "effect";
import { dual } from "effect/Function";
import type * as Box from "../Box.js";
import type { Place } from "../Layout.js";
import { isAnsi } from "./ansi.js";
import * as internal from "./box.js";
import * as Validation from "./layout-validation.js";

const axis = (
  position: Place.Horizontal | Place.Vertical,
  outer: number,
  inner: number
): number =>
  Match.value(position).pipe(
    Match.when(Predicate.isNumber, (value) => value),
    Match.when("center", () => Math.floor((outer - inner) / 2)),
    Match.whenOr("right", "bottom", () => outer - inner),
    Match.orElse(() => 0)
  );

const rejectCommands = <A>(
  self: Box.Box<A>
): Result.Result<void, Validation.LayoutValidationError> =>
  Result.gen(function* () {
    if (
      self.annotation &&
      isAnsi(self.annotation.data) &&
      self.annotation.data.some((attribute) =>
        Predicate.isTagged(attribute, "CommandAttribute")
      )
    )
      return yield* Result.fail(
        new Validation.LayoutValidationError({
          reason: "UnsupportedCommand",
          message: "Place does not support Cmd annotations",
        })
      );
    switch (self.content._tag) {
      case "Row":
      case "Col":
        for (const child of self.content.boxes) yield* rejectCommands(child);
        break;
      case "SubBox":
        yield* rejectCommands(self.content.box);
        break;
    }
  });

/** @internal */
export const makeResult = dual<
  (
    options: Place.Options
  ) => <A>(
    self: Box.Box<A>
  ) => Result.Result<Box.Box<A>, Validation.LayoutValidationError>,
  <A>(
    self: Box.Box<A>,
    options: Place.Options
  ) => Result.Result<Box.Box<A>, Validation.LayoutValidationError>
>(
  2,
  <A>(
    self: Box.Box<A>,
    options: Place.Options
  ): Result.Result<Box.Box<A>, Validation.LayoutValidationError> =>
    Result.gen(function* () {
      const placement = yield* Result.mapError(
        Validation.decodePlacement(options),
        Validation.invalidInput
      );
      yield* Result.mapError(
        Validation.decodeSourceSize(self),
        Validation.invalidInput
      );
      const { width, height } = placement;
      const x = axis(placement.x ?? "left", width, self.cols);
      const y = axis(placement.y ?? "top", height, self.rows);
      yield* rejectCommands(self);

      const left = Math.max(0, x);
      const top = Math.max(0, y);
      const sourceCol = Math.max(0, -x);
      const sourceRow = Math.max(0, -y);
      // Subtract bounded extents rather than adding offsets to source dimensions.
      // This keeps extreme safe-integer offsets from overflowing or cancelling.
      const visibleWidth = Math.max(
        0,
        Math.min(self.cols - sourceCol, width - left)
      );
      const visibleHeight = Math.max(
        0,
        Math.min(self.rows - sourceRow, height - top)
      );
      if (visibleWidth === 0 || visibleHeight === 0)
        return internal.emptyBox(height, width);
      const clipped = internal.cropHeight(
        internal.cropWidth(self, sourceCol, visibleWidth),
        sourceRow,
        visibleHeight
      );
      const row = internal.hcat(
        [
          internal.emptyBox(visibleHeight, left),
          clipped,
          internal.emptyBox(visibleHeight, width - left - visibleWidth),
        ],
        internal.top
      );

      return internal.vcat(
        [
          internal.emptyBox(top, width),
          row,
          internal.emptyBox(height - top - visibleHeight, width),
        ],
        internal.left
      );
    })
);

/** @internal */
export const make = dual<
  (options: Place.Options) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, options: Place.Options) => Box.Box<A>
>(
  2,
  <A>(self: Box.Box<A>, options: Place.Options): Box.Box<A> =>
    Validation.orThrow(makeResult(self, options))
);

/** @internal */
export const horizontal = dual<
  (
    width: number,
    position: Place.Horizontal
  ) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, width: number, position: Place.Horizontal) => Box.Box<A>
>(
  3,
  <A>(
    self: Box.Box<A>,
    width: number,
    position: Place.Horizontal
  ): Box.Box<A> => make(self, { width, height: self.rows, x: position })
);

/** @internal */
export const vertical = dual<
  (
    height: number,
    position: Place.Vertical
  ) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, height: number, position: Place.Vertical) => Box.Box<A>
>(
  3,
  <A>(self: Box.Box<A>, height: number, position: Place.Vertical): Box.Box<A> =>
    make(self, { width: self.cols, height, y: position })
);
