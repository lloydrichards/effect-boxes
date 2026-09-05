import { Array as Arr, Effect, Layer } from "effect";
import type * as Annotation from "../Annotation.js";
import type * as Box from "../Box.js";
import {
  applyAnsiStyling,
  getAnsiEscapeSequence,
  isAnsi,
  isCommandAnnotation,
  padPreservingAnsi,
  truncatePreservingAnsi,
} from "../internal/ansi.js";
import { match } from "../internal/box.js";
import { Renderer, renderBox } from "../internal/renderer.js";
import type * as R from "../Renderer.js";

/** @internal */

export const makeAnsiRenderer = Layer.effect(
  Renderer,
  Effect.gen(function* () {
    const processor: R.TextProcessor = {
      processLine: (text: string, targetWidth: number) =>
        truncatePreservingAnsi(text, targetWidth),
      processLineAligned: (
        text: string,
        targetWidth: number,
        alignment: Box.Alignment
      ) => padPreservingAnsi(text, targetWidth, alignment),
      preservesFormatting: true,
    };

    const postProcess = <A>(
      lines: string[],
      annotation?: Annotation.Annotation<A>
    ) => {
      if (annotation && isAnsi(annotation.data)) {
        const escapeSequence = getAnsiEscapeSequence(annotation.data);
        if (escapeSequence) {
          return Effect.succeed(applyAnsiStyling(lines, escapeSequence));
        }
      }
      return Effect.succeed(lines);
    };

    const renderContent = <A>(box: Box.Box<A>): Effect.Effect<string[]> => {
      // Handle single command annotation on zero-dim box
      if (
        (box.rows === 0 || box.cols === 0) &&
        isCommandAnnotation(box.annotation?.data)
      ) {
        const seq = getAnsiEscapeSequence(box.annotation.data);
        return Effect.succeed(seq ? [seq] : []);
      }

      // Handle zero-dim Row/Col containers - recurse into children to collect commands
      if (box.rows === 0 || box.cols === 0) {
        return match(box, {
          blank: () => Effect.succeed([]),
          text: () => Effect.succeed([]),
          row: (boxes) =>
            Effect.map(Effect.all(Arr.map(boxes, renderContent)), (results) => {
              const combined = Arr.flatten(results).join("");
              return combined ? [combined] : [];
            }),
          col: (boxes) =>
            Effect.map(Effect.all(Arr.map(boxes, renderContent)), (results) => {
              const combined = Arr.flatten(results).join("");
              return combined ? [combined] : [];
            }),
          subBox: (subBox) => renderContent(subBox),
        });
      }

      return Effect.gen(function* () {
        const lines = yield* renderBox(box, processor, renderContent);
        return yield* postProcess(lines, box.annotation);
      });
    };

    return {
      processor,
      renderContent,
      postProcess,
    };
  })
);
