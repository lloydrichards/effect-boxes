import { Effect, pipe } from "effect";
import { describe, expect, it } from "vitest";
import * as Box from "../src/Box";
import * as Html from "../src/Html";
import * as Renderer from "../src/Renderer";

describe("Html", () => {
  describe("escapeHtml", () => {
    it("escapes ampersand", () => {
      expect(Html.escapeHtml("fish & chips")).toBe("fish &amp; chips");
    });

    it("escapes less than", () => {
      expect(Html.escapeHtml("x < y")).toBe("x &lt; y");
    });

    it("escapes greater than", () => {
      expect(Html.escapeHtml("x > y")).toBe("x &gt; y");
    });

    it("escapes double quotes", () => {
      expect(Html.escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
    });

    it("escapes single quotes", () => {
      expect(Html.escapeHtml("it's")).toBe("it&#39;s");
    });

    it("escapes script tags", () => {
      expect(Html.escapeHtml("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
      );
    });

    it("escapes multiple special characters", () => {
      expect(Html.escapeHtml('<div class="test">A & B</div>')).toBe(
        "&lt;div class=&quot;test&quot;&gt;A &amp; B&lt;/div&gt;"
      );
    });
  });

  describe("isHtml", () => {
    it("returns true for valid HtmlAnnotationData", () => {
      const data = { _tag: "Html" as const, element: "div" };
      expect(Html.isHtml(data)).toBe(true);
    });

    it("returns false for non-Html data", () => {
      expect(Html.isHtml({ _tag: "Other" })).toBe(false);
      expect(Html.isHtml({ element: "div" })).toBe(false);
      expect(Html.isHtml(null)).toBe(false);
      expect(Html.isHtml(undefined)).toBe(false);
      expect(Html.isHtml("string")).toBe(false);
    });
  });

  describe("element constructors", () => {
    it("creates div annotation", () => {
      const annotation = Html.div();
      expect(Html.isHtml(annotation.data)).toBe(true);
      expect(annotation.data.element).toBe("div");
    });

    it("creates div with attributes", () => {
      const annotation = Html.div({ class: "container", id: "main" });
      expect(annotation.data.element).toBe("div");
      expect(annotation.data.attributes).toEqual({
        class: "container",
        id: "main",
      });
    });

    it("creates span annotation", () => {
      const annotation = Html.span();
      expect(annotation.data.element).toBe("span");
    });

    it("creates paragraph annotation", () => {
      const annotation = Html.p({ class: "text" });
      expect(annotation.data.element).toBe("p");
      expect(annotation.data.attributes).toEqual({ class: "text" });
    });

    it("creates heading annotations", () => {
      expect(Html.h1().data.element).toBe("h1");
      expect(Html.h2().data.element).toBe("h2");
      expect(Html.h3().data.element).toBe("h3");
      expect(Html.h4().data.element).toBe("h4");
      expect(Html.h5().data.element).toBe("h5");
      expect(Html.h6().data.element).toBe("h6");
    });

    it("creates semantic elements", () => {
      expect(Html.section().data.element).toBe("section");
      expect(Html.article().data.element).toBe("article");
      expect(Html.header().data.element).toBe("header");
      expect(Html.footer().data.element).toBe("footer");
      expect(Html.main().data.element).toBe("main");
      expect(Html.nav().data.element).toBe("nav");
      expect(Html.aside().data.element).toBe("aside");
    });

    it("creates list elements", () => {
      expect(Html.ul().data.element).toBe("ul");
      expect(Html.ol().data.element).toBe("ol");
      expect(Html.li().data.element).toBe("li");
    });

    it("creates inline elements", () => {
      expect(Html.a({ href: "#" }).data.element).toBe("a");
      expect(Html.strong().data.element).toBe("strong");
      expect(Html.em().data.element).toBe("em");
      expect(Html.code().data.element).toBe("code");
    });

    it("creates void elements", () => {
      expect(Html.br().data.element).toBe("br");
      expect(Html.hr().data.element).toBe("hr");
    });
  });

  describe("HtmlRendererLive", () => {
    it("renders simple text in div", async () => {
      const box = Box.text("Hello").pipe(Box.annotate(Html.div()));
      const result = await pipe(
        box,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );
      expect(result).toBe("<div>\nHello\n</div>");
    });

    it("renders text with HTML escaping", async () => {
      const box = Box.text("<script>alert('xss')</script>").pipe(
        Box.annotate(Html.div())
      );
      const result = await pipe(
        box,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );
      expect(result).toBe(
        "<div>\n&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;\n</div>"
      );
    });

    it("renders with attributes", async () => {
      const box = Box.text("Content").pipe(
        Box.annotate(Html.div({ class: "container", id: "main" }))
      );
      const result = await pipe(
        box,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );
      expect(result).toBe('<div class="container" id="main">\nContent\n</div>');
    });

    it("escapes attribute values", async () => {
      const box = Box.text("Hello").pipe(
        Box.annotate(Html.div({ class: 'my"class' }))
      );
      const result = await pipe(
        box,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );
      expect(result).toBe('<div class="my&quot;class">\nHello\n</div>');
    });

    it("renders multi-line content", async () => {
      const box = Box.text("Line 1\nLine 2\nLine 3").pipe(
        Box.annotate(Html.div())
      );
      const result = await pipe(
        box,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );
      expect(result).toBe("<div>\nLine 1\nLine 2\nLine 3\n</div>");
    });

    it("preserves blank lines in preformatted content", async () => {
      const box = Box.text("Line 1\n\nLine 3").pipe(Box.annotate(Html.pre()));
      const result = await pipe(
        box,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );

      expect(result).toBe("<pre>\nLine 1\n\nLine 3\n</pre>");
    });

    it("preserves leading and trailing blank lines in preformatted content", async () => {
      const box = Box.text("\nLine 2\n").pipe(Box.annotate(Html.pre()));
      const result = await pipe(
        box,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );

      expect(result).toBe("<pre>\n\nLine 2\n\n</pre>");
    });

    it("preserves nested blank lines in pretty preformatted content", async () => {
      const code = Box.text("Line 1\n\nLine 3").pipe(Box.annotate(Html.code()));
      const box = Box.vcat([code], Box.left).pipe(Box.annotate(Html.pre()));
      const result = await pipe(
        box,
        Renderer.render({ preserveWhitespace: true }),
        Effect.provide(Renderer.HtmlPrettyRendererLive),
        Effect.runPromise
      );

      expect(result).toBe(
        "<pre>\n    <code>\n      Line 1\n\n      Line 3\n    </code>\n</pre>"
      );
    });

    it("renders empty box with div", async () => {
      const box = Box.emptyBox(0, 0).pipe(Box.annotate(Html.div()));
      const result = await pipe(
        box,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );
      expect(result).toBe("<div>\n</div>");
    });

    it("renders void element (br)", async () => {
      const box = Box.emptyBox(0, 0).pipe(Box.annotate(Html.br()));
      const result = await pipe(
        box,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );
      expect(result).toBe("<br />");
    });

    it("renders void element (hr)", async () => {
      const box = Box.emptyBox(0, 0).pipe(Box.annotate(Html.hr()));
      const result = await pipe(
        box,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );
      expect(result).toBe("<hr />");
    });

    it("renders nested boxes as nested HTML", async () => {
      const inner = Box.text("Inner").pipe(Box.annotate(Html.span()));
      const middle = Box.text("Middle").pipe(Box.annotate(Html.p()));
      const outer = Box.vcat([inner, middle], Box.left).pipe(
        Box.annotate(Html.div())
      );
      const result = await pipe(
        outer,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );
      expect(result).toContain("<div>");
      expect(result).toContain("</div>");
      expect(result).toContain("<span>");
      expect(result).toContain("Inner");
      expect(result).toContain("</span>");
      expect(result).toContain("<p>");
      expect(result).toContain("Middle");
      expect(result).toContain("</p>");
    });

    it("renders horizontal layout", async () => {
      const box1 = Box.text("A").pipe(Box.annotate(Html.span()));
      const box2 = Box.text("B").pipe(Box.annotate(Html.span()));
      const combined = Box.hcat([box1, box2], Box.top).pipe(
        Box.annotate(Html.div())
      );
      const result = await pipe(
        combined,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );
      expect(result).toContain("<div>");
      expect(result).toContain("A");
      expect(result).toContain("B");
      expect(result).toContain("</div>");
      expect(result).toContain("<span>");
      expect(result).toContain("</span>");
    });

    it("renders box without annotation", async () => {
      const box = Box.text("Plain text");
      const result = await pipe(
        box,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );
      expect(result).toBe("Plain text");
    });

    it("renders with indentation when enabled", async () => {
      const inner = Box.vcat([Box.text("Inner")], Box.left).pipe(
        Box.annotate(Html.span())
      );
      const outer = Box.vcat([inner], Box.left).pipe(Box.annotate(Html.div()));
      const result = await pipe(
        outer,
        Renderer.render(),
        Effect.provide(Renderer.HtmlPrettyRendererLive),

        Effect.runPromise
      );
      expect(result).toContain("<div>");
      expect(result).toContain("  <span>");
      expect(result).toContain("    Inner");
      expect(result).toContain("  </span>");
      expect(result).toContain("</div>");
    });

    it("renders with custom indent size", async () => {
      const inner = Box.vcat([Box.text("Text")], Box.left).pipe(
        Box.annotate(Html.p())
      );
      const outer = Box.vcat([inner], Box.left).pipe(Box.annotate(Html.div()));
      const result = await pipe(
        outer,
        Renderer.render(),
        Effect.provide(Renderer.HtmlPrettyRendererLive),
        Effect.runPromise
      );
      expect(result).toContain("<div>");
      expect(result).toContain("    <p>");
      expect(result).toContain("      Text");
      expect(result).toContain("    </p>");
      expect(result).toContain("</div>");
    });

    it("renders without indentation by default", async () => {
      const inner = Box.vcat([Box.text("Text")], Box.left).pipe(
        Box.annotate(Html.span())
      );
      const outer = Box.vcat([inner], Box.left).pipe(Box.annotate(Html.div()));
      const result = await pipe(
        outer,
        Renderer.render(),
        Effect.provide(Renderer.HtmlRendererLive),
        Effect.runPromise
      );
      expect(result).not.toContain("  <");
      expect(result).not.toContain("    ");
    });
  });
});
