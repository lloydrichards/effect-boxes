import { pipe } from "effect";
import * as Equal from "effect/Equal";
import { describe, expect, it } from "vitest";
import * as Annotation from "../src/Annotation";
import * as Box from "../src/Box";

describe("Box.truncate", () => {
  // ---------------------------------------------------------------------------
  // No-op cases (content fits within width)
  // ---------------------------------------------------------------------------

  it("returns the box unchanged when width >= box width", () => {
    const box = Box.text("Hello");
    const result = pipe(box, Box.truncate(10, Box.left));
    expect(Box.renderPlainSync(result)).toBe("Hello");
  });

  it("returns the box unchanged when width == box width", () => {
    const box = Box.text("Hello");
    const result = pipe(box, Box.truncate(5, Box.left));
    expect(Box.renderPlainSync(result)).toBe("Hello");
  });

  // ---------------------------------------------------------------------------
  // AlignFirst truncation (keep start, truncate end)
  // ---------------------------------------------------------------------------

  describe("AlignFirst / left", () => {
    it("truncates from the end with ellipsis", () => {
      const box = Box.text("This is a very long piece of text");
      const result = pipe(box, Box.truncate(15, Box.left));
      expect(Box.renderPlainSync(result)).toBe("This is a very…");
    });

    it("truncates to width 1 (just ellipsis)", () => {
      const box = Box.text("Hello");
      const result = pipe(box, Box.truncate(1, Box.left));
      expect(Box.renderPlainSync(result)).toBe("…");
    });

    it("truncates to width 2", () => {
      const box = Box.text("Hello");
      const result = pipe(box, Box.truncate(2, Box.left));
      expect(Box.renderPlainSync(result)).toBe("H…");
    });
  });

  // ---------------------------------------------------------------------------
  // AlignLast truncation (keep end, truncate start)
  // ---------------------------------------------------------------------------

  describe("AlignLast / right", () => {
    it("truncates from the start with ellipsis", () => {
      const box = Box.text("This is a very long piece of text");
      const result = pipe(box, Box.truncate(15, Box.right));
      expect(Box.renderPlainSync(result)).toBe("… piece of text");
    });

    it("truncates to width 1 (just ellipsis)", () => {
      const box = Box.text("Hello");
      const result = pipe(box, Box.truncate(1, Box.right));
      expect(Box.renderPlainSync(result)).toBe("…");
    });

    it("truncates to width 2", () => {
      const box = Box.text("Hello");
      const result = pipe(box, Box.truncate(2, Box.right));
      expect(Box.renderPlainSync(result)).toBe("…o");
    });
  });

  // ---------------------------------------------------------------------------
  // AlignCenter1 truncation (keep both ends, truncate middle)
  // ---------------------------------------------------------------------------

  describe("AlignCenter1 / center1", () => {
    it("truncates from the middle with ellipsis", () => {
      const box = Box.text("This is a very long piece of text");
      const result = pipe(box, Box.truncate(15, Box.center1));
      expect(Box.renderPlainSync(result)).toBe("This is…of text");
    });

    it("truncates to width 1 (just ellipsis)", () => {
      const box = Box.text("Hello");
      const result = pipe(box, Box.truncate(1, Box.center1));
      expect(Box.renderPlainSync(result)).toBe("…");
    });

    it("truncates to width 3 (odd remainder)", () => {
      const box = Box.text("ABCDEF");
      const result = pipe(box, Box.truncate(3, Box.center1));
      // width 3 => 2 chars + ellipsis; split: 1 from start, 1 from end
      expect(Box.renderPlainSync(result)).toBe("A…F");
    });

    it("truncates to width 4 (even remainder, left-biased)", () => {
      const box = Box.text("ABCDEF");
      const result = pipe(box, Box.truncate(4, Box.center1));
      // width 4 => 3 chars + ellipsis; ceil for left, floor for right
      expect(Box.renderPlainSync(result)).toBe("AB…F");
    });
  });

  // ---------------------------------------------------------------------------
  // AlignCenter2 truncation (keep both ends, truncate middle, right-biased)
  // ---------------------------------------------------------------------------

  describe("AlignCenter2 / center2", () => {
    it("truncates to width 4 (even remainder, right-biased)", () => {
      const box = Box.text("ABCDEF");
      const result = pipe(box, Box.truncate(4, Box.center2));
      // width 4 => 3 chars + ellipsis; floor for left, ceil for right
      expect(Box.renderPlainSync(result)).toBe("A…EF");
    });
  });

  // ---------------------------------------------------------------------------
  // Multi-line boxes
  // ---------------------------------------------------------------------------

  describe("multi-line", () => {
    it("truncates each line independently", () => {
      const box = Box.text("Short\nThis is a longer line");
      const result = pipe(box, Box.truncate(10, Box.left));
      expect(Box.renderPrettySync(result)).toBe("Short\nThis is a…");
    });

    it("preserves lines that are already short enough", () => {
      const box = Box.text("Hi\nHello World");
      const result = pipe(box, Box.truncate(5, Box.left));
      expect(Box.renderPrettySync(result)).toBe("Hi\nHell…");
    });
  });

  // ---------------------------------------------------------------------------
  // Data-first API
  // ---------------------------------------------------------------------------

  describe("data-first", () => {
    it("supports data-first calling convention", () => {
      const box = Box.text("Hello World");
      const result = Box.truncate(box, 8, Box.left);
      expect(Box.renderPlainSync(result)).toBe(
        Box.renderPlainSync(pipe(box, Box.truncate(8, Box.left)))
      );
    });

    it("supports data-first with non-default position", () => {
      const box = Box.text("Hello World");
      const result = Box.truncate(box, 8, Box.right);
      expect(Box.renderPlainSync(result)).toBe(
        Box.renderPlainSync(pipe(box, Box.truncate(8, Box.right)))
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles empty box", () => {
      const box = Box.text("");
      const result = pipe(box, Box.truncate(5, Box.left));
      expect(Box.renderPlainSync(result)).toBe("");
    });

    it("handles single character text", () => {
      const box = Box.text("A");
      const result = pipe(box, Box.truncate(5, Box.left));
      expect(Box.renderPlainSync(result)).toBe("A");
    });

    it("handles single character text truncated to 1", () => {
      const box = Box.text("A");
      const result = pipe(box, Box.truncate(1, Box.left));
      expect(Box.renderPlainSync(result)).toBe("A");
    });

    it("updates the box cols to the new width", () => {
      const box = Box.text("Hello World");
      const result = pipe(box, Box.truncate(5, Box.left));
      expect(result.cols).toBe(5);
    });

    it("should preserve the annotation value when truncating annotated text", () => {
      const annotation = Annotation.createAnnotation("test-annotation");
      const box = pipe(Box.text("Hello World"), Box.annotate(annotation));
      const result = pipe(box, Box.truncate(8, Box.left));

      expect(Equal.equals(result.annotation, annotation)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Composition with other Box operations
  // ---------------------------------------------------------------------------

  describe("composition", () => {
    it("does not recurse infinitely when truncating a wide row", () => {
      const row = Box.hcat(
        [Box.text("left panel"), Box.text("right panel")],
        Box.top
      );

      expect(() => pipe(row, Box.truncate(8, Box.left))).not.toThrow();
      expect(pipe(row, Box.truncate(8, Box.left)).cols).toBe(8);
    });

    it("works with hcat after truncation", () => {
      const left = pipe(Box.text("Long left text"), Box.truncate(8, Box.left));
      const right = Box.text("Right");
      const combined = Box.hcat([left, right], Box.top);
      expect(combined.cols).toBe(8 + 5);
    });

    it("works with pipe chaining", () => {
      const result = pipe(
        Box.text("Hello World"),
        Box.truncate(8, Box.left),
        Box.moveRight(2)
      );
      expect(result.cols).toBe(10); // 8 truncated + 2 padding
    });
  });
});
