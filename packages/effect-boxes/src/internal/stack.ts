/** @internal */
import { dual } from "effect/Function";
import * as Box from "../Box.js";
import type { Layer, Stack } from "../Layout.js";

const integer = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value))
    throw new RangeError(`${name} must be a safe integer`);
  return value;
};
const dimension = (value: number, name: string): number => {
  integer(value, name);
  if (value < 0) throw new RangeError(`${name} must be non-negative`);
  return value;
};

export const makeLayer = dual<
  (options?: Layer.Options) => <A>(self: Box.Box<A>) => Layer<A>,
  <A>(self: Box.Box<A>, options?: Layer.Options) => Layer<A>
>(
  (args) => Box.isBox(args[0]),
  <A>(self: Box.Box<A>, options: Layer.Options = {}): Layer<A> => {
    dimension(self.cols, "source columns");
    dimension(self.rows, "source rows");
    return Object.freeze({
      box: self,
      x: integer(options.x === undefined ? 0 : options.x, "x"),
      y: integer(options.y === undefined ? 0 : options.y, "y"),
      z: integer(options.z === undefined ? 0 : options.z, "z"),
    });
  }
);

export function makeStack<const T extends ReadonlyArray<Layer<unknown>>>(
  layers: T,
  options: Stack.Options
): Stack<T[number] extends Layer<infer A> ? A : never>;
export function makeStack(
  layers: ReadonlyArray<Layer<unknown>>,
  options: Stack.Options
): Stack<unknown> {
  const width = dimension(options.width, "width");
  const height = dimension(options.height, "height");
  // Copy each description so caller-owned arrays and option objects cannot
  // change ordering or placement after construction.
  const snapshot = layers.map((layer) =>
    makeLayer(layer.box, { x: layer.x, y: layer.y, z: layer.z })
  );
  return Object.freeze({
    _tag: "Stack",
    width,
    height,
    layers: Object.freeze(snapshot),
  });
}
