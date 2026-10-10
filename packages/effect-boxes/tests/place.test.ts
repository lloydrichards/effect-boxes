import { Equal, HashMap, Option, pipe, Result } from "effect";
import { describe, expect, it } from "vitest";
import * as Annotation from "../src/Annotation";
import * as Ansi from "../src/Ansi";
import * as Box from "../src/Box";
import * as Cmd from "../src/Cmd";
import { Place } from "../src/Layout";
import * as Reactive from "../src/Reactive";

const render = Box.renderPlainSync;
describe("Place", () => {
  it("uses zero offsets by default and returns exact dimensions without changing its source", () => {
    const source = Box.text("AB\nCD");
    const placed = Place.make(source, { width: 4, height: 3 });
    expect([placed.cols, placed.rows]).toEqual([4, 3]);
    expect(render(placed)).toBe("AB  \nCD  \n    ");
    expect(render(source)).toBe("AB\nCD");
  });

  it.each([
    ["left", "top", "AB  \n    \n    "],
    ["center", "center", "    \n AB \n    "],
    ["right", "bottom", "    \n    \n  AB"],
  ] as const)("places at %s/%s anchors", (x, y, expected) => {
    expect(
      render(Place.make(Box.text("AB"), { width: 4, height: 3, x, y }))
    ).toBe(expected);
  });

  it("floors odd center differences for both undersized and oversized content", () => {
    expect(render(Place.horizontal(Box.text("AB"), 5, "center"))).toBe(" AB  ");
    expect(render(Place.horizontal(Box.text("ABCDE"), 2, "center"))).toBe("CD");
    expect(render(Place.vertical(Box.text("A\nB\nC\nD\nE"), 2, "center"))).toBe(
      "C\nD"
    );
  });

  it("supports data-first and pipe calls for all three helpers", () => {
    const source = Box.text("ABC\nDEF");
    const options = { width: 5, height: 4, x: 1, y: 1 };
    expect(
      Equal.equals(
        Place.make(source, options),
        pipe(source, Place.make(options))
      )
    ).toBe(true);
    const horizontal = Place.horizontal(source, 2, -1);
    expect(horizontal.rows).toBe(source.rows);
    expect(render(horizontal)).toBe("BC\nEF");
    expect(
      Equal.equals(horizontal, pipe(source, Place.horizontal(2, -1)))
    ).toBe(true);
    const vertical = Place.vertical(source, 1, "bottom");
    expect(vertical.cols).toBe(source.cols);
    expect(render(vertical)).toBe("DEF");
    expect(
      Equal.equals(vertical, pipe(source, Place.vertical(1, "bottom")))
    ).toBe(true);
  });

  it("matches cell coordinates across negative offsets, clipping, and empty viewports", () => {
    const source = Box.text("ABC\nDEF");
    const lines = ["ABC", "DEF"];
    for (let width = 0; width <= 5; width++) {
      for (let height = 0; height <= 4; height++) {
        for (let x = -4; x <= 5; x++) {
          for (let y = -3; y <= 4; y++) {
            const placed = Place.make(source, { width, height, x, y });
            const expected =
              width === 0 || height === 0
                ? ""
                : Array.from({ length: height }, (_, row) =>
                    Array.from(
                      { length: width },
                      (_, col) => lines[row - y]?.[col - x] ?? " "
                    ).join("")
                  ).join("\n");
            expect([placed.cols, placed.rows]).toEqual([width, height]);
            expect(render(placed)).toBe(expected);
          }
        }
      }
    }
  });

  it("handles extreme safe offsets without unsafe addition cancellation", () => {
    for (const offset of [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]) {
      expect(
        render(Place.make(Box.text("ABC"), { width: 3, height: 2, x: offset }))
      ).toBe("   \n   ");
      expect(
        render(Place.make(Box.text("ABC"), { width: 3, height: 2, y: offset }))
      ).toBe("   \n   ");
    }
    const huge = Box.emptyBox(1, Number.MAX_SAFE_INTEGER);
    const placed = Place.make(huge, {
      width: 3,
      height: 1,
      x: -Number.MAX_SAFE_INTEGER + 1,
    });
    expect(render(placed)).toBe("   ");
    expect(placed.cols).toBe(3);
  });

  it("preserves nested styles and relative reactive geometry after surrounding composition", () => {
    const styled = Box.hcat([Box.text("AB"), Box.text("CD")], Box.top).pipe(
      Box.annotate(Ansi.red)
    );
    const source = Reactive.makeReactive(
      Box.align(Box.top, Box.left, 1, 4)(styled),
      "label"
    );
    const placed = Place.make(source, { width: 5, height: 3, x: -1, y: 1 });
    const surrounded = Box.hcat([Box.text("!!"), placed], Box.top);
    expect(render(surrounded)).toBe("!!     \n  BCD  \n       ");
    expect(Box.renderPrettySync(surrounded)).toContain("\x1b[31mBCD");
    expect(
      Option.getOrUndefined(
        HashMap.get(Reactive.getPositions(surrounded), "label")
      )
    ).toEqual({ row: 1, col: 2, rows: 1, cols: 3 });
  });

  it("retains generic annotations on source content rather than surrounding padding", () => {
    const data = { label: "source" };
    const source = Box.text("AB").pipe(
      Box.annotate(Annotation.createAnnotation(data))
    );
    const placed: Box.Box<typeof data> = Place.make(source, {
      width: 4,
      height: 3,
      x: 1,
      y: 1,
    });
    const visit = (self: Box.Box<typeof data>): number => {
      if (self.annotation) {
        expect(self.annotation.data).toBe(data);
        expect([self.cols, self.rows]).toEqual([2, 1]);
      }
      const own = self.annotation ? 1 : 0;
      switch (self.content._tag) {
        case "Row":
        case "Col":
          return (
            own +
            self.content.boxes.reduce((sum, child) => sum + visit(child), 0)
          );
        case "SubBox":
          return own + visit(self.content.box);
        default:
          return own;
      }
    };
    expect(visit(placed)).toBe(1);
  });

  it("keeps combining graphemes whole and blanks clipped halves of wide glyphs", () => {
    expect(render(Place.horizontal(Box.text("Ae\u0301B"), 1, -1))).toBe(
      "e\u0301"
    );
    expect(render(Place.horizontal(Box.text("界A"), 2, -1))).toBe(" A");
    expect(render(Place.horizontal(Box.text("A界"), 2, 0))).toBe("A ");
  });

  it.each([
    NaN,
    Infinity,
    -Infinity,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.MIN_SAFE_INTEGER - 1,
  ])(
    "rejects invalid numeric value %s in every coordinate/dimension",
    (value) => {
      const source = Box.text("X");
      expect(() => Place.make(source, { width: value, height: 1 })).toThrow(
        RangeError
      );
      expect(() => Place.make(source, { width: 1, height: value })).toThrow(
        RangeError
      );
      expect(() =>
        Place.make(source, { width: 1, height: 1, x: value })
      ).toThrow(RangeError);
      expect(() =>
        Place.make(source, { width: 1, height: 1, y: value })
      ).toThrow(RangeError);
      expect(() => Place.horizontal(source, value, 0)).toThrow(RangeError);
      expect(() => Place.vertical(source, value, 0)).toThrow(RangeError);
    }
  );

  it("rejects negative dimensions while allowing negative offsets", () => {
    expect(() => Place.make(Box.text("X"), { width: -1, height: 1 })).toThrow(
      RangeError
    );
    expect(() => Place.make(Box.text("X"), { width: 1, height: -1 })).toThrow(
      RangeError
    );
    expect(() => Place.horizontal(Box.text("X"), -1, 0)).toThrow(RangeError);
    expect(() => Place.vertical(Box.text("X"), -1, 0)).toThrow(RangeError);
    expect(
      render(
        Place.make(Box.text("XX\nXX"), { width: 1, height: 1, x: -1, y: -1 })
      )
    ).toBe("X");
  });

  it("rejects nested commands before clipping, including invisible content and empty viewports", () => {
    const commandStyle = Cmd.cursorUp(1).annotation;
    expect(commandStyle).toBeDefined();
    const mixed = commandStyle
      ? Box.text("X").pipe(Box.annotate(Ansi.combine(Ansi.red, commandStyle)))
      : Cmd.cursorUp(1);
    for (const source of [
      Cmd.cursorUp(1),
      mixed,
      Box.hcat([Box.text("X"), Cmd.cursorUp(1)], Box.top),
      Box.vcat([Box.text("X"), Cmd.eraseScreen], Box.left),
      Box.align(Box.top, Box.left, 2, 2)(Cmd.cursorUp(1)),
    ]) {
      expect(() => Place.make(source, { width: 0, height: 0 })).toThrow(
        RangeError
      );
      expect(() => Place.make(source, { width: 3, height: 2, x: 10 })).toThrow(
        RangeError
      );
      expect(() => Place.horizontal(source, 3, 0)).toThrow(RangeError);
      expect(() => Place.vertical(source, 3, 0)).toThrow(RangeError);
    }
  });
});

it("Place clips already-centered SubBoxes at their rendered coordinates", () => {
  const horizontal = Box.alignHoriz(Box.text("AB"), Box.center1, 3);
  const vertical = Box.alignVert(Box.text("A\nB"), Box.center1, 3);
  expect(render(horizontal)).toBe(" AB");
  expect(render(Place.horizontal(horizontal, 1, -2))).toBe("B");
  expect(render(vertical)).toBe(" \nA\nB");
  expect(render(Place.vertical(vertical, 1, -2))).toBe("B");
});

it("rejects invalid anchors supplied by JavaScript callers", () => {
  const source = Box.text("X");
  expect(() =>
    // @ts-expect-error JavaScript callers can supply a vertical anchor on x.
    Place.make(source, { width: 1, height: 1, x: "bottom" })
  ).toThrow(RangeError);
  // @ts-expect-error Null is not an omitted coordinate.
  expect(() => Place.make(source, { width: 1, height: 1, x: null })).toThrow(
    RangeError
  );
  // @ts-expect-error JavaScript callers can supply a horizontal anchor on y.
  expect(() => Place.vertical(source, 1, "right")).toThrow(RangeError);
});

it("returns placement validation failures without throwing and preserves successful output", () => {
  const source = Box.text("A").pipe(Box.annotate(Ansi.red));
  const options: Place.Options = { width: 3, height: 1, x: "right" };
  expect(
    Equal.equals(
      Result.getOrThrow(Place.makeResult(source, options)),
      Place.make(source, options)
    )
  ).toBe(true);
  expect(Place.makeResult(source, { width: -1, height: 1 })).toMatchObject({
    _tag: "Failure",
    failure: { reason: "InvalidInput" },
  });
  expect(
    Place.makeResult(Cmd.eraseScreen, { width: 0, height: 0 })
  ).toMatchObject({
    _tag: "Failure",
    failure: { reason: "UnsupportedCommand" },
  });
});
