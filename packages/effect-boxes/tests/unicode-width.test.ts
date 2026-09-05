import { Effect, pipe } from "effect";
import { describe, expect, it } from "vitest";
import * as Ansi from "../src/Ansi";
import * as Box from "../src/Box";
import * as Renderer from "../src/Renderer";

const renderAnsiPreservingWhitespace = <A>(box: Box.Box<A>): string =>
  Effect.runSync(
    Renderer.render(box, { preserveWhitespace: true }).pipe(
      Effect.provide(Renderer.AnsiRendererLive)
    )
  );

describe("Unicode display widths", () => {
  it("should keep declared columns equal to rendered columns for CJK text", () => {
    const box = Box.text("你好");

    expect(box.cols).toBe(4);
    expect(Box.renderPlainSync(box)).toBe("你好");
  });

  it("should keep a joined emoji intact at a width boundary", () => {
    const box = Box.maxWidth(Box.line("👩‍💻x"), 2);

    expect(box.cols).toBe(2);
    expect(Box.renderPlainSync(box)).toBe("👩‍💻");
  });

  it("should preserve a decomposed combining grapheme at a width boundary", () => {
    const decomposed = "e\u0301";
    const box = Box.maxWidth(Box.line(`${decomposed}x`), 1);

    expect(box.cols).toBe(1);
    expect(Box.renderPlainSync(box)).toBe(decomposed);
  });

  it("should truncate wide text from the left within the column budget", () => {
    const box = Box.truncate(Box.line("你AB好CD界"), 5, Box.left);

    expect(box.cols).toBe(5);
    expect(Box.renderPlainSync(box)).toBe("你AB…");
  });

  it("should truncate wide text from the right within the column budget", () => {
    const box = Box.truncate(Box.line("你AB好CD界"), 5, Box.right);

    expect(box.cols).toBe(5);
    expect(Box.renderPlainSync(box)).toBe("…CD界");
  });

  it("should preserve the left bias of center1 when truncating wide text", () => {
    const box = Box.truncate(Box.line("你AB好CD界"), 6, Box.center1);

    expect(box.cols).toBe(6);
    expect(Box.renderPlainSync(box)).toBe("你A…界");
  });

  it("should preserve the right bias of center2 when truncating wide text", () => {
    const box = Box.truncate(Box.line("你AB好CD界"), 6, Box.center2);

    expect(box.cols).toBe(6);
    expect(Box.renderPlainSync(box)).toBe("你…D界");
  });

  it("should fit a wide grapheme and ellipsis within three columns", () => {
    const box = Box.truncate(Box.line("你好世界"), 3, Box.left);

    expect(box.cols).toBe(3);
    expect(Box.renderPrettySync(box)).toBe("你…");
  });

  it("should fit max-width wide text within the requested columns", () => {
    const box = Box.maxWidth(Box.line("你好"), 2);

    expect(box.cols).toBe(2);
    expect(Box.renderPlainSync(box)).toBe("你");
  });

  it("should omit a wide grapheme when maxWidth has only one column", () => {
    const box = Box.maxWidth(Box.line("你好"), 1);

    expect(box.cols).toBe(1);
    expect(Box.renderPlainSync(box)).toBe(" ");
  });

  it("should replace a partially cropped wide grapheme with a blank", () => {
    const box = Box.cropWidth(Box.line("A你B"), 2, 1);

    expect(box.cols).toBe(1);
    expect(Box.renderPlainSync(box)).toBe(" ");
  });

  it("should preserve center alignment bias at a wide boundary", () => {
    const leftBiased = Box.alignHoriz(Box.text("你好"), Box.center1, 3);
    const rightBiased = Box.alignHoriz(Box.text("你好"), Box.center2, 3);

    expect(Box.renderPlainSync(leftBiased)).toBe("你 ");
    expect(Box.renderPlainSync(rightBiased)).toBe(" 好");
  });

  it("should clip ANSI-styled wide text without losing style boundaries", () => {
    const styled = "\u001b[31m你好\u001b[0m";

    expect(Ansi.truncatePreservingAnsi(styled, 2)).toBe(
      "\u001b[31m你\u001b[0m"
    );
  });

  it("should render one blank column when aligned ANSI text cannot fit", () => {
    const box = pipe(
      Box.text("你"),
      Box.annotate(Ansi.red),
      Box.alignHoriz(Box.left, 1)
    );

    expect(renderAnsiPreservingWhitespace(box)).toBe(" ");
  });

  it("should retain ANSI styling when aligned clipping keeps wide text", () => {
    const box = pipe(
      Box.text("A你"),
      Box.annotate(Ansi.red),
      Box.alignHoriz(Box.right, 2)
    );
    expect(renderAnsiPreservingWhitespace(box)).toBe(
      "\u001b[31m你\u001b[0m"
    );
  });

  it("should flow paragraphs by columns and retain long-word truncation", () => {
    const wrapped = Box.para("你好 ab", Box.left, 5);
    const longWord = Box.para("你好世界", Box.left, 3);

    expect(wrapped.cols).toBe(4);
    expect(Box.renderPlainSync(wrapped)).toBe("你好\nab  ");
    expect(longWord.cols).toBe(3);
    expect(Box.renderPlainSync(longWord)).toBe("你 ");
  });

  it("should resize wide text to exact terminal columns", () => {
    expect(Box.resizeBox(["你好"], 1, 3)).toEqual(["你 "]);
    expect(Box.resizeBox(["你"], 1, 1)).toEqual([" "]);
  });

  it("should align resized wide text by terminal columns", () => {
    expect(Box.resizeBoxAligned(1, 4, Box.right, Box.top)(["你"])).toEqual([
      "  你",
    ]);
  });
});
