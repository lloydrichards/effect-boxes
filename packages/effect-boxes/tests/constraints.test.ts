import { pipe } from "effect";
import { describe, expect, it } from "vitest";
import * as Ansi from "../src/Ansi";
import * as Box from "../src/Box";

/** Replace spaces with dots for visible whitespace in assertions */
const dots = (s: string) => s.replaceAll(" ", ".");

describe("Box.minWidth", () => {
  it("pads a narrow box to the target width", () => {
    const result = pipe(Box.text("Hi"), Box.minWidth(10));
    expect(Box.cols(result)).toBe(10);
    expect(Box.rows(result)).toBe(1);
  });

  it("is a no-op when box is already wider", () => {
    const result = pipe(Box.text("Hello World"), Box.minWidth(5));
    expect(Box.cols(result)).toBe(11);
  });

  it("is a no-op when box equals target width", () => {
    const result = pipe(Box.text("ABC"), Box.minWidth(3));
    expect(Box.cols(result)).toBe(3);
  });

  it("pads with spaces on the right (left-aligned)", () => {
    const result = pipe(Box.text("Hi"), Box.minWidth(5));
    expect(dots(Box.renderPlainSync(result))).toBe("Hi...");
  });

  it("works with multi-line boxes", () => {
    const result = pipe(Box.text("A\nBC"), Box.minWidth(5));
    expect(Box.cols(result)).toBe(5);
    expect(Box.rows(result)).toBe(2);
  });

  it("supports data-first usage", () => {
    const result = Box.minWidth(Box.text("Hi"), 10);
    expect(Box.cols(result)).toBe(10);
  });
});

describe("Box.maxWidth", () => {
  it("truncates a wide box to the target width", () => {
    const result = pipe(Box.text("Hello World"), Box.maxWidth(5));
    expect(Box.cols(result)).toBe(5);
  });

  it("is a no-op when box is already narrower", () => {
    const result = pipe(Box.text("Hi"), Box.maxWidth(10));
    expect(Box.cols(result)).toBe(2);
  });

  it("is a no-op when box equals target width", () => {
    const result = pipe(Box.text("ABC"), Box.maxWidth(3));
    expect(Box.cols(result)).toBe(3);
  });

  it("truncates content correctly", () => {
    const result = pipe(Box.text("Hello World"), Box.maxWidth(5));
    expect(Box.renderPlainSync(result)).toBe("Hello");
  });

  it("truncates each line of a multi-line box", () => {
    const result = pipe(Box.text("Hello\nWorld!"), Box.maxWidth(3));
    expect(Box.renderPlainSync(result)).toBe("Hel\nWor");
  });

  it("supports data-first usage", () => {
    const result = Box.maxWidth(Box.text("Hello World"), 5);
    expect(Box.cols(result)).toBe(5);
  });
});

describe("Box.cropWidth", () => {
  it("crops a horizontal window from text", () => {
    const result = pipe(Box.text("Hello World"), Box.cropWidth(6, 5));
    expect(Box.cols(result)).toBe(5);
    expect(Box.renderPlainSync(result)).toBe("World");
  });

  it("crops each line of a multi-line box", () => {
    const result = pipe(Box.text("abcdef\n123456"), Box.cropWidth(2, 3));
    expect(Box.cols(result)).toBe(3);
    expect(Box.rows(result)).toBe(2);
    expect(Box.renderPlainSync(result)).toBe("cde\n345");
  });

  it("is a maxWidth equivalent for non-positive offsets", () => {
    const result = pipe(Box.text("Hello"), Box.cropWidth(-2, 3));
    expect(Box.renderPlainSync(result)).toBe("Hel");
  });

  it("returns zero width when offset is beyond the box", () => {
    const result = pipe(Box.text("Hello\nWorld"), Box.cropWidth(20, 5));
    expect(Box.cols(result)).toBe(0);
    expect(Box.rows(result)).toBe(2);
    expect(Box.renderPlainSync(result)).toBe("\n");
  });

  it("does not split wide characters at crop boundaries", () => {
    const result = pipe(Box.text("a界b"), Box.cropWidth(1, 1));
    expect(Box.cols(result)).toBe(1);
    expect(Box.renderPlainSync(result)).toBe(" ");
  });

  it("crops through horizontally composed boxes", () => {
    const result = pipe(
      Box.hcat([Box.text("ABC"), Box.text("DEF")], Box.top),
      Box.cropWidth(2, 3)
    );
    expect(Box.renderPlainSync(result)).toBe("CDE");
  });

  it("preserves nested annotations when cropping horizontally composed boxes", () => {
    const result = pipe(
      Box.hcat(
        [
          Box.text("INFO ").pipe(Box.annotate(Ansi.cyan)),
          Box.text("message").pipe(Box.annotate(Ansi.red)),
        ],
        Box.top
      ),
      Box.cropWidth(3, 6)
    );

    expect(Box.renderPlainSync(result)).toBe("O mess");
    expect(Box.renderPrettySync(result)).toContain("\x1b[36mO ");
    expect(Box.renderPrettySync(result)).toContain("\x1b[31mmess");
  });

  it("supports data-first usage", () => {
    const result = Box.cropWidth(Box.text("Hello World"), 6, 5);
    expect(Box.renderPlainSync(result)).toBe("World");
  });
});

describe("Box.minHeight", () => {
  it("pads a short box to the target height", () => {
    const result = pipe(Box.text("X"), Box.minHeight(5));
    expect(Box.rows(result)).toBe(5);
    expect(Box.cols(result)).toBe(1);
  });

  it("is a no-op when box is already taller", () => {
    const result = pipe(Box.text("A\nB\nC\nD\nE"), Box.minHeight(3));
    expect(Box.rows(result)).toBe(5);
  });

  it("is a no-op when box equals target height", () => {
    const result = pipe(Box.text("A\nB"), Box.minHeight(2));
    expect(Box.rows(result)).toBe(2);
  });

  it("pads with blank rows at the bottom (top-aligned)", () => {
    const result = pipe(Box.text("X"), Box.minHeight(3));
    expect(dots(Box.renderPlainSync(result))).toBe("X\n.\n.");
  });

  it("supports data-first usage", () => {
    const result = Box.minHeight(Box.text("X"), 5);
    expect(Box.rows(result)).toBe(5);
  });
});

describe("Box.maxHeight", () => {
  it("truncates a tall box to the target height", () => {
    const result = pipe(Box.text("A\nB\nC\nD\nE"), Box.maxHeight(3));
    expect(Box.rows(result)).toBe(3);
  });

  it("is a no-op when box is already shorter", () => {
    const result = pipe(Box.text("A\nB"), Box.maxHeight(5));
    expect(Box.rows(result)).toBe(2);
  });

  it("is a no-op when box equals target height", () => {
    const result = pipe(Box.text("A\nB\nC"), Box.maxHeight(3));
    expect(Box.rows(result)).toBe(3);
  });

  it("keeps only the first n rows", () => {
    const result = pipe(Box.text("A\nB\nC\nD\nE"), Box.maxHeight(3));
    expect(Box.renderPlainSync(result)).toBe("A\nB\nC");
  });

  it("supports data-first usage", () => {
    const result = Box.maxHeight(Box.text("A\nB\nC\nD\nE"), 2);
    expect(Box.rows(result)).toBe(2);
  });
});

describe("Box.cropHeight", () => {
  it("crops a vertical window from text", () => {
    const result = pipe(Box.text("A\nB\nC\nD"), Box.cropHeight(1, 2));
    expect(Box.rows(result)).toBe(2);
    expect(Box.cols(result)).toBe(1);
    expect(Box.renderPlainSync(result)).toBe("B\nC");
  });

  it("is a maxHeight equivalent for non-positive offsets", () => {
    const result = pipe(Box.text("A\nB\nC"), Box.cropHeight(-1, 2));
    expect(Box.renderPlainSync(result)).toBe("A\nB");
  });

  it("returns zero height when offset is beyond the box", () => {
    const result = pipe(Box.text("A\nB"), Box.cropHeight(5, 2));
    expect(Box.rows(result)).toBe(0);
    expect(Box.cols(result)).toBe(1);
    expect(Box.renderPlainSync(result)).toBe("");
  });

  it("crops through vertically composed boxes", () => {
    const result = pipe(
      Box.vcat([Box.text("A\nB"), Box.text("C\nD")], Box.left),
      Box.cropHeight(1, 2)
    );
    expect(Box.renderPlainSync(result)).toBe("B\nC");
  });

  it("preserves nested annotations through fixed-size viewport crops", () => {
    const makeLine = (timestamp: string, level: string, message: string) => {
      const style = level === "WARN" ? Ansi.yellow : Ansi.cyan;
      return Box.hsep(
        [
          Box.text(timestamp).pipe(Box.annotate(Ansi.dim)),
          Box.text("●").pipe(Box.annotate(style)),
          Box.text(level.padEnd(5)).pipe(Box.annotate(style)),
          Box.text(message).pipe(Box.annotate(style)),
        ],
        1,
        Box.top
      );
    };

    const result = pipe(
      Box.vcat(
        [
          makeLine("00:01.1", "INFO", "first"),
          makeLine("00:03.0", "WARN", "Redis connection slow"),
        ],
        Box.left
      ),
      Box.cropHeight(1, 1),
      Box.minHeight(2),
      Box.cropWidth(0, 40),
      Box.minWidth(40)
    );

    const pretty = Box.renderPrettySync(result);
    expect(Box.renderPlainSync(result)).toContain("00:03.0 ● WARN  Redis");
    expect(pretty).toContain("\x1b[2m00:03.0\x1b[0m");
    expect(pretty).toContain("\x1b[33m●\x1b[0m");
    expect(pretty).toContain("\x1b[33mWARN \x1b[0m");
    expect(pretty).toContain("\x1b[33mRedis connection slow\x1b[0m");
  });

  it("supports data-first usage", () => {
    const result = Box.cropHeight(Box.text("A\nB\nC\nD"), 1, 2);
    expect(Box.renderPlainSync(result)).toBe("B\nC");
  });
});

describe("constraints composition", () => {
  it("minWidth + maxWidth clamps to exact width", () => {
    const result = pipe(Box.text("Hi"), Box.minWidth(10), Box.maxWidth(10));
    expect(Box.cols(result)).toBe(10);
  });

  it("minHeight + maxHeight clamps to exact height", () => {
    const result = pipe(Box.text("X"), Box.minHeight(5), Box.maxHeight(5));
    expect(Box.rows(result)).toBe(5);
  });

  it("all four constraints can be composed", () => {
    const result = pipe(
      Box.text("Hi"),
      Box.minWidth(10),
      Box.maxWidth(20),
      Box.minHeight(3),
      Box.maxHeight(5)
    );
    expect(Box.cols(result)).toBe(10);
    expect(Box.rows(result)).toBe(3);
  });
});
