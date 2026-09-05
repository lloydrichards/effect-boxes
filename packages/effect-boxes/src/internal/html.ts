import type * as Annotation from "../Annotation.js";
import { createAnnotation } from "./annotation.js";

export interface HtmlAnnotationData {
  readonly _tag: "Html";
  readonly element: string;
  readonly attributes?: Record<string, string> | undefined;
}

export const isHtml = (data: unknown): data is HtmlAnnotationData =>
  typeof data === "object" &&
  data !== null &&
  "_tag" in data &&
  data._tag === "Html" &&
  "element" in data &&
  typeof (data as HtmlAnnotationData).element === "string";

export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export const isVoidElement = (element: string): boolean =>
  VOID_ELEMENTS.has(element);

export const div = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "div", attributes });

export const span = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "span", attributes });

export const p = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "p", attributes });

export const h1 = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "h1", attributes });

export const h2 = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "h2", attributes });

export const h3 = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "h3", attributes });

export const h4 = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "h4", attributes });

export const h5 = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "h5", attributes });

export const h6 = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "h6", attributes });

export const section = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "section", attributes });

export const article = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "article", attributes });

export const header = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "header", attributes });

export const footer = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "footer", attributes });

export const main = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "main", attributes });

export const nav = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "nav", attributes });

export const aside = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "aside", attributes });

export const ul = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "ul", attributes });

export const ol = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "ol", attributes });

export const li = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "li", attributes });

export const a = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "a", attributes });

export const strong = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "strong", attributes });

export const em = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "em", attributes });

export const code = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "code", attributes });

export const pre = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "pre", attributes });

export const br = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "br", attributes });

export const hr = (
  attributes?: Record<string, string>
): Annotation.Annotation<HtmlAnnotationData> =>
  createAnnotation({ _tag: "Html", element: "hr", attributes });
