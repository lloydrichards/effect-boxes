import { Effect, Layer } from "effect";
import type * as Annotation from "../Annotation.js";
import type * as Box from "../Box.js";
import { takeP, takePA } from "../internal/box.js";
import { Renderer, renderBox } from "../internal/renderer.js";
import * as Width from "../internal/width.js";
import type * as R from "../Renderer.js";

/** @internal */

export const makePlainRenderer = Layer.effect(
  Renderer,
  Effect.gen(function* () {
    const processor: R.TextProcessor = {
      processLine: (text: string, targetWidth: number) =>
        takeP(Width.segments(text), " ", targetWidth).join(""),
      processLineAligned: (
        text: string,
        targetWidth: number,
        alignment: Box.Alignment
      ) => takePA(Width.segments(text), alignment, " ", targetWidth).join(""),
      preservesFormatting: false,
    };

    const postProcess = <A>(
      lines: string[],
      _annotation?: Annotation.Annotation<A>
    ) => Effect.succeed(lines);

    const renderContent = <A>(box: Box.Box<A>): Effect.Effect<string[]> =>
      Effect.gen(function* () {
        const lines = yield* renderBox(box, processor, renderContent);
        return yield* postProcess(lines, box.annotation);
      });

    return {
      processor,
      renderContent,
      postProcess,
    };
  })
);
