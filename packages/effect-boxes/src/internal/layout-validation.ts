/** @internal */
import { Data, Result, Schema } from "effect";

export class LayoutValidationError extends Data.TaggedError(
  "LayoutValidationError"
)<{
  readonly reason: "InvalidInput" | "UnsupportedCommand";
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const Position = Schema.Struct({ row: Schema.Int, col: Schema.Int });
export const Viewport = Schema.Struct({
  width: Schema.Natural,
  height: Schema.Natural,
});
export const SourceSize = Schema.Struct({
  rows: Schema.Natural,
  cols: Schema.Natural,
});
export const Placement = Schema.Struct({
  ...Viewport.fields,
  x: Schema.optional(
    Schema.Union([Schema.Int, Schema.Literals(["left", "center", "right"])])
  ),
  y: Schema.optional(
    Schema.Union([Schema.Int, Schema.Literals(["top", "center", "bottom"])])
  ),
});
export const LayerPosition = Schema.Struct({
  x: Schema.optional(Schema.Int),
  y: Schema.optional(Schema.Int),
  z: Schema.optional(Schema.Int),
});

const decodeInteger = Schema.decodeUnknownResult(Schema.Int);
const decodeDimension = Schema.decodeUnknownResult(Schema.Natural);
export const integer = (
  value: number
): Result.Result<number, Schema.SchemaError> => decodeInteger(value);
export const dimension = (
  value: number
): Result.Result<number, Schema.SchemaError> => decodeDimension(value);
export const decodePosition = Schema.decodeUnknownResult(Position);
export const decodeViewport = Schema.decodeUnknownResult(Viewport);
export const decodeSourceSize = Schema.decodeUnknownResult(SourceSize);
export const decodePlacement = Schema.decodeUnknownResult(Placement);
export const decodeLayerPosition = Schema.decodeUnknownResult(LayerPosition);

export const invalidInput = (
  cause: Schema.SchemaError
): LayoutValidationError =>
  new LayoutValidationError({
    reason: "InvalidInput",
    message: cause.message,
    cause,
  });

// Preserve the synchronous constructor contract at this compatibility boundary.
export const orThrow = <A>(
  result: Result.Result<A, LayoutValidationError>
): A =>
  Result.match(result, {
    onSuccess: (value) => value,
    onFailure: (error) => {
      throw new RangeError(error.message, { cause: error });
    },
  });
