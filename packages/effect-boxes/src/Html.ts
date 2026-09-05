/**
 * HTML element annotations for web-based box rendering.
 *
 * Provides annotation constructors for common HTML elements (div, span, p,
 * headings, etc.) that the HTML renderer interprets as markup. Use these
 * to produce styled HTML output from annotated boxes.
 *
 * @see {@link div} — annotate with a div element
 * @see {@link span} — annotate with a span element
 * @see {@link escapeHtml} — safely escape HTML entities
 *
 * @module
 */
import type * as Annotation from "./Annotation.js";
import * as internal from "./internal/html.js";
import type * as Renderer from "./Renderer.js";

/**
 * Data payload stored in HTML annotations.
 *
 * @category models
 */
export interface HtmlAnnotationData {
  readonly _tag: "Html";
  readonly element: string;
  readonly attributes?: Record<string, string> | undefined;
}

/**
 * Configuration options for the HTML renderer.
 *
 * @category models
 */
export interface HtmlRenderConfig extends Renderer.RenderConfig {
  readonly indent?: boolean;
  readonly indentSize?: number;
}

/**
 * Type guard that checks if a value is HTML annotation data.
 *
 * @example
 * ```typescript
 * import * as Html from "effect-boxes/Html"
 *
 * const value: unknown = { _tag: "Html", element: "div" }
 * console.log(Html.isHtml(value))
 * // true
 * ```
 *
 * @category guards
 */
export const isHtml: (data: unknown) => data is HtmlAnnotationData =
  internal.isHtml;

/**
 * Escapes special characters for safe HTML text output.
 *
 * @example
 * ```typescript
 * import * as Html from "effect-boxes/Html"
 *
 * console.log(Html.escapeHtml("<hello & world>"))
 * // &lt;hello &amp; world&gt;
 * ```
 *
 * @category utilities
 */
export const escapeHtml: (text: string) => string = internal.escapeHtml;

/**
 * Creates a `div` HTML annotation.
 *
 * @category constructors
 */
export const div: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.div;

/**
 * Creates a `span` HTML annotation.
 *
 * @category constructors
 */
export const span: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.span;

/**
 * Creates a `p` HTML annotation.
 *
 * @category constructors
 */
export const p: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.p;

/**
 * Creates an `h1` HTML annotation.
 *
 * @category constructors
 */
export const h1: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.h1;

/**
 * Creates an `h2` HTML annotation.
 *
 * @category constructors
 */
export const h2: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.h2;

/**
 * Creates an `h3` HTML annotation.
 *
 * @category constructors
 */
export const h3: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.h3;

/**
 * Creates an `h4` HTML annotation.
 *
 * @category constructors
 */
export const h4: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.h4;

/**
 * Creates an `h5` HTML annotation.
 *
 * @category constructors
 */
export const h5: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.h5;

/**
 * Creates an `h6` HTML annotation.
 *
 * @category constructors
 */
export const h6: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.h6;

/**
 * Creates a `section` HTML annotation.
 *
 * @category constructors
 */
export const section: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.section;

/**
 * Creates an `article` HTML annotation.
 *
 * @category constructors
 */
export const article: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.article;

/**
 * Creates a `header` HTML annotation.
 *
 * @category constructors
 */
export const header: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.header;

/**
 * Creates a `footer` HTML annotation.
 *
 * @category constructors
 */
export const footer: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.footer;

/**
 * Creates a `main` HTML annotation.
 *
 * @category constructors
 */
export const main: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.main;

/**
 * Creates a `nav` HTML annotation.
 *
 * @category constructors
 */
export const nav: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.nav;

/**
 * Creates an `aside` HTML annotation.
 *
 * @category constructors
 */
export const aside: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.aside;

/**
 * Creates a `ul` HTML annotation.
 *
 * @category constructors
 */
export const ul: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.ul;

/**
 * Creates an `ol` HTML annotation.
 *
 * @category constructors
 */
export const ol: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.ol;

/**
 * Creates an `li` HTML annotation.
 *
 * @category constructors
 */
export const li: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.li;

/**
 * Creates an `a` HTML annotation.
 *
 * @category constructors
 */
export const a: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.a;

/**
 * Creates a `strong` HTML annotation.
 *
 * @category constructors
 */
export const strong: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.strong;

/**
 * Creates an `em` HTML annotation.
 *
 * @category constructors
 */
export const em: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.em;

/**
 * Creates a `code` HTML annotation.
 *
 * @category constructors
 */
export const code: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.code;

/**
 * Creates a `pre` HTML annotation.
 *
 * @category constructors
 */
export const pre: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.pre;

/**
 * Creates a `br` HTML annotation.
 *
 * @category constructors
 */
export const br: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.br;

/**
 * Creates an `hr` HTML annotation.
 *
 * @category constructors
 */
export const hr: (
  attributes?: Record<string, string>
) => Annotation.Annotation<HtmlAnnotationData> = internal.hr;
