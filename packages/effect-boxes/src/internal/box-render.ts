import { Console, Effect, pipe } from "effect";
import type * as Box from "../Box.js";
import * as Renderer from "../Renderer.js";

/** @internal */
export const defaultRenderConfig: Renderer.RenderStyle = {
  _tag: "Plain",
};

/** @internal */
export const render = Renderer.render;

/** @internal */
export const renderPretty = <A>(self: Box.Box<A>): Effect.Effect<string> =>
  pipe(
    Renderer.render(self, { preserveWhitespace: false }),
    Effect.provide(Renderer.AnsiRendererLive)
  );

/** @internal */
export const renderPrettySync = <A>(self: Box.Box<A>): string =>
  pipe(renderPretty(self), Effect.runSync);

/** @internal */
export const renderPlain = <A>(self: Box.Box<A>): Effect.Effect<string> =>
  pipe(
    Renderer.render(self, { preserveWhitespace: true }),
    Effect.provide(Renderer.PlainRendererLive)
  );

/** @internal */
export const renderPlainSync = <A>(self: Box.Box<A>): string =>
  pipe(renderPlain(self), Effect.runSync);

/** @internal */
export const printBox = (
  self: Box.Box<unknown>
): Effect.Effect<void, never, Renderer.Renderer> =>
  Effect.gen(function* () {
    const rendered = yield* render(self, undefined);
    yield* Console.log(rendered);
  });
