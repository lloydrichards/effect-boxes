import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";
import * as Box from "../src/Box.js";
import { Layer, Stack } from "../src/Layout.js";
import * as Reactive from "../src/Reactive.js";
import * as Renderer from "../src/Renderer.js";

const region = (frame: Renderer.ResolvedFrame, id: string): Reactive.Region =>
  Option.getOrThrow(Reactive.getRegion(frame.regions, id));
const contains = (bounds: Reactive.Bounds, row: number, col: number): boolean =>
  row >= bounds.row &&
  row < bounds.row + bounds.rows &&
  col >= bounds.col &&
  col < bounds.col + bounds.cols;

describe("Stack visible regions", () => {
  it("retains hidden occurrences while hits follow opaque final ownership", () => {
    const background = Reactive.makeReactive(Box.emptyBox(3, 8), "background");
    const child = Reactive.makeReactive(Box.text("XX"), "child");
    const popup = Reactive.makeReactive(Box.hcat([child], Box.top), "popup");
    const hidden = Reactive.makeReactive(Box.text("H"), "hidden");
    const frame = Effect.runSync(
      Renderer.resolve(
        Stack.make(
          [
            Layer.make(background),
            Layer.make(hidden, { x: 3, y: 1, z: 1 }),
            Layer.make(popup, { x: 3, y: 1, z: 2 }),
            Layer.make(Box.emptyBox(1, 1), { x: 4, y: 1, z: 3 }),
          ],
          { width: 8, height: 3 }
        )
      )
    );
    expect(region(frame, "hidden").occurrences).toHaveLength(1);
    expect(region(frame, "hidden").visible).toEqual([]);
    expect(Reactive.hitTest(frame, { col: 3, row: 1 })).toEqual([
      "child",
      "popup",
    ]);
    expect(Reactive.hitTest({ col: 4, row: 1 })(frame)).toEqual([]);
    expect(Reactive.hitTest(frame, { col: 0, row: 0 })).toEqual(["background"]);
    expect(Option.isNone(Reactive.getRegion("missing")(frame.regions))).toBe(
      true
    );
    for (const id of ["background", "popup", "child", "hidden"]) {
      const visible = region(frame, id).visible;
      for (let row = 0; row < frame.rows; row++) {
        for (let col = 0; col < frame.cols; col++) {
          expect(visible.some((rect) => contains(rect, row, col))).toBe(
            Reactive.hitTest(frame, { row, col }).includes(id)
          );
        }
      }
    }
  });

  it("preserves repeated occurrences and unions nested duplicate IDs", () => {
    const inner = Reactive.makeReactive(Box.emptyBox(2, 3), "repeat");
    const outer = Reactive.makeReactive(Box.hcat([inner], Box.top), "repeat");
    const frame = Effect.runSync(
      Renderer.resolve(
        Stack.make([Layer.make(outer), Layer.make(inner, { x: 5 })], {
          width: 8,
          height: 2,
        })
      )
    );
    const repeated = region(frame, "repeat");
    expect(repeated.occurrences).toHaveLength(3);
    expect(new Set(repeated.occurrences.map((entry) => entry.key)).size).toBe(
      3
    );
    expect(repeated.visible).toEqual([
      { row: 0, col: 0, rows: 2, cols: 3 },
      { row: 0, col: 5, rows: 2, cols: 3 },
    ]);
    expect(Reactive.hitTest(frame, { row: 1, col: 1 })).toEqual(["repeat"]);
  });

  it("reports logical and clipped bounds separately and includes sanitized glyph blanks", () => {
    const source = Reactive.makeReactive(Box.text("界A"), "wide");
    const frame = Effect.runSync(
      Renderer.resolve(
        Stack.make([Layer.make(source, { x: -1 })], { width: 3, height: 1 })
      )
    );
    const occurrence = region(frame, "wide").occurrences[0];
    expect(occurrence?.bounds).toEqual({ row: 0, col: -1, rows: 1, cols: 3 });
    expect(occurrence?.clipped).toEqual({ row: 0, col: 0, rows: 1, cols: 2 });
    expect(occurrence?.visible).toEqual([{ row: 0, col: 0, rows: 1, cols: 2 }]);
    expect(Reactive.hitTest(frame, { row: 0, col: 0 })).toEqual(["wide"]);
  });

  it("keeps region geometry independent of output whitespace and validates queries", () => {
    const frame = Effect.runSync(
      Renderer.resolve(Reactive.makeReactive(Box.emptyBox(2, 3), "area"))
    );
    const render = (preserveWhitespace: boolean) =>
      Effect.runSync(
        Renderer.encode(frame, { preserveWhitespace }).pipe(
          Effect.provide(Renderer.PlainRendererLive)
        )
      );
    expect(render(false).output).toBe("\n");
    expect(render(true).output).toBe("   \n   ");
    expect(render(false).resolved).toBe(frame);
    expect(region(frame, "area").visible).toEqual([
      { row: 0, col: 0, rows: 2, cols: 3 },
    ]);
    for (const position of [
      { row: -1, col: 0 },
      { row: 0, col: 3 },
      { row: 2, col: 0 },
    ])
      expect(Reactive.hitTest(frame, position)).toEqual([]);
    for (const value of [NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => Reactive.hitTest(frame, { row: value, col: 0 })).toThrow(
        RangeError
      );
      expect(() => Reactive.hitTest(frame, { row: 0, col: value })).toThrow(
        RangeError
      );
    }
  });
});
