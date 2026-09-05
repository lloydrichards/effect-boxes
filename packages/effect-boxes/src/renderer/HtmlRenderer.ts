import { Array, Context, Effect, Layer } from "effect";
import type * as Annotation from "../Annotation.js";
import type * as Box from "../Box.js";
import { match } from "../internal/box.js";
import { isHtml, isVoidElement } from "../internal/html.js";
import { Renderer, renderBoxArray } from "../internal/renderer.js";
import type * as R from "../Renderer.js";

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const renderAttributes = (attributes?: Record<string, string>): string => {
  if (!attributes || Object.keys(attributes).length === 0) {
    return "";
  }
  return Object.entries(attributes)
    .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
    .join("");
};
const wrapLinesInHtmlTag = (
  lines: string[],
  element: string,
  config: HtmlRenderConfig,
  attributes?: Record<string, string>,
  depth = 0
): string[] => {
  const indent = config.indent
    ? " ".repeat((config.indentSize ?? 2) * depth)
    : "";
  const innerIndent = config.indent
    ? " ".repeat((config.indentSize ?? 2) * (depth + 1))
    : "";

  if (lines.length === 0) {
    if (isVoidElement(element)) {
      return [`${indent}<${element}${renderAttributes(attributes)} />`];
    }
    return [
      `${indent}<${element}${renderAttributes(attributes)}>`,
      `${indent}</${element}>`,
    ];
  }

  if (isVoidElement(element)) {
    return lines.map((line) => indent + line);
  }

  return [
    `${indent}<${element}${renderAttributes(attributes)}>`,
    ...lines.map((line) => (line.trim() === "" ? "" : innerIndent + line)),
    `${indent}</${element}>`,
  ];
};
export type HtmlRenderConfig = {
  readonly indent: boolean;
  readonly indentSize: number;
  readonly preserveWhitespace: boolean;
};

export const HtmlRenderConfig = Context.Reference<HtmlRenderConfig>(
  "HtmlRenderConfig",
  {
    defaultValue: () => ({
      indent: false,
      indentSize: 2,
      preserveWhitespace: false,
    }),
  }
);
export const makeHtmlRenderer = Layer.effect(
  Renderer,
  Effect.gen(function* () {
    const config = yield* HtmlRenderConfig;

    const processor: R.TextProcessor = {
      processLine: (text: string, targetWidth: number) => {
        if (text.length <= targetWidth) {
          return text;
        }
        return text.slice(0, targetWidth);
      },
      processLineAligned: (
        text: string,
        targetWidth: number,
        alignment: Box.Alignment
      ) => {
        if (text.length >= targetWidth) {
          return text.slice(0, targetWidth);
        }

        const padding = targetWidth - text.length;

        switch (alignment) {
          case "AlignFirst":
            return text + " ".repeat(padding);
          case "AlignLast":
            return " ".repeat(padding) + text;
          case "AlignCenter1": {
            const leftPad = Math.floor(padding / 2);
            const rightPad = padding - leftPad;
            return " ".repeat(leftPad) + text + " ".repeat(rightPad);
          }
          case "AlignCenter2": {
            const leftPad = Math.ceil(padding / 2);
            const rightPad = padding - leftPad;
            return " ".repeat(leftPad) + text + " ".repeat(rightPad);
          }
        }
      },
      preservesFormatting: true,
    };

    const postProcess = <A>(
      lines: string[],
      annotation?: Annotation.Annotation<A>,
      depth = 0
    ): Effect.Effect<string[]> => {
      if (!isHtml(annotation?.data)) {
        return Effect.succeed(lines);
      }

      const htmlData = annotation.data;
      const result = wrapLinesInHtmlTag(
        lines,
        htmlData.element,
        config,
        htmlData.attributes,
        depth
      );
      return Effect.succeed(result);
    };

    const renderContentInternal = <A>(
      box: Box.Box<A>,
      depth = 0
    ): Effect.Effect<string[]> => {
      if ((box.rows === 0 || box.cols === 0) && isHtml(box.annotation?.data)) {
        const htmlData = box.annotation.data;
        const indent = config.indent
          ? " ".repeat((config.indentSize ?? 2) * depth)
          : "";

        if (isVoidElement(htmlData.element)) {
          return Effect.succeed([
            indent +
              ((element: string, attributes?: Record<string, string>): string =>
                `<${element}${renderAttributes(attributes)} />`)(
                htmlData.element,
                htmlData.attributes
              ),
          ]);
        }

        if (box.rows > 0) {
          return postProcess(
            Array.makeBy(box.rows, () => ""),
            box.annotation,
            depth
          );
        }

        return Effect.succeed([
          indent +
            ((element: string, attributes?: Record<string, string>): string =>
              `<${element}${renderAttributes(attributes)}>`)(
              htmlData.element,
              htmlData.attributes
            ),
          indent +
            ((element: string): string => `</${element}>`)(htmlData.element),
        ]);
      }

      return Effect.gen(function* () {
        const currentDepth = isHtml(box.annotation?.data) ? depth + 1 : depth;

        const lines = yield* Effect.gen(function* () {
          if (box.rows === 0) {
            return [];
          }

          if (box.cols === 0) {
            return Array.makeBy(box.rows, () => "");
          }

          return yield* match(box, {
            blank: () => Effect.succeed([]),
            text: (text) => Effect.succeed([escapeHtml(text)]),
            row: (boxes) =>
              renderBoxArray(
                boxes,
                (b) => renderContentInternal(b, currentDepth),
                Array.flatten
              ),
            col: (boxes) =>
              renderBoxArray(
                boxes,
                (b) => renderContentInternal(b, currentDepth),
                Array.flatten
              ),
            subBox: (subBox, _xAlign, _yAlign) =>
              renderContentInternal(subBox, currentDepth),
          });
        });

        return yield* postProcess(lines, box.annotation, depth);
      });
    };

    const renderContent = <A>(box: Box.Box<A>): Effect.Effect<string[]> =>
      renderContentInternal(box, 0);

    return {
      processor,
      renderContent,
      postProcess,
    };
  })
);
