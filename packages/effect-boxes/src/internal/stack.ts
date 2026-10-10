/** @internal */
import { Result } from "effect";
import { dual } from "effect/Function";
import * as Box from "../Box.js";
import type { Layer, Stack } from "../Layout.js";
import * as Validation from "./layout-validation.js";

export const makeLayerResult = dual<
  (
    options?: Layer.Options
  ) => <A>(
    self: Box.Box<A>
  ) => Result.Result<Layer<A>, Validation.LayoutValidationError>,
  <A>(
    self: Box.Box<A>,
    options?: Layer.Options
  ) => Result.Result<Layer<A>, Validation.LayoutValidationError>
>(
  (args) => Box.isBox(args[0]),
  <A>(
    self: Box.Box<A>,
    options: Layer.Options = {}
  ): Result.Result<Layer<A>, Validation.LayoutValidationError> =>
    Result.gen(function* () {
      yield* Result.mapError(
        Validation.decodeSourceSize(self),
        Validation.invalidInput
      );
      const position = yield* Result.mapError(
        Validation.decodeLayerPosition(options),
        Validation.invalidInput
      );
      return Object.freeze({
        box: self,
        x: position.x ?? 0,
        y: position.y ?? 0,
        z: position.z ?? 0,
      });
    })
);

export const makeLayer = dual<
  (options?: Layer.Options) => <A>(self: Box.Box<A>) => Layer<A>,
  <A>(self: Box.Box<A>, options?: Layer.Options) => Layer<A>
>(
  (args) => Box.isBox(args[0]),
  <A>(self: Box.Box<A>, options?: Layer.Options): Layer<A> =>
    Validation.orThrow(makeLayerResult(self, options))
);

export function makeStackResult<const T extends ReadonlyArray<Layer<unknown>>>(
  layers: T,
  options: Stack.Options
): Result.Result<
  Stack<
    [T[number]] extends [never]
      ? never
      : T[number] extends Layer<infer A>
        ? A
        : never
  >,
  Validation.LayoutValidationError
>;
export function makeStackResult(
  layers: ReadonlyArray<Layer<unknown>>,
  options: Stack.Options
): Result.Result<Stack<unknown>, Validation.LayoutValidationError> {
  return Result.gen(function* () {
    const { width, height } = yield* Result.mapError(
      Validation.decodeViewport(options),
      Validation.invalidInput
    );
    // Snapshot descriptions so caller-owned arrays cannot alter the stack.
    const snapshot = yield* Result.all(
      layers.map((layer) =>
        makeLayerResult(layer.box, { x: layer.x, y: layer.y, z: layer.z })
      )
    );
    const stack: Stack<unknown> = {
      _tag: "Stack",
      width,
      height,
      layers: Object.freeze(snapshot),
    };
    return Object.freeze(stack);
  });
}

export const makeStack = <const T extends ReadonlyArray<Layer<unknown>>>(
  layers: T,
  options: Stack.Options
): Stack<
  [T[number]] extends [never]
    ? never
    : T[number] extends Layer<infer A>
      ? A
      : never
> => Validation.orThrow(makeStackResult(layers, options));
