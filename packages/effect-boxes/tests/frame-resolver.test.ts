import { HashMap, Option, Result } from "effect";
import { describe, expect, it } from "vitest";
import * as Annotation from "../src/Annotation";
import * as Ansi from "../src/Ansi";
import * as Box from "../src/Box";
import * as Cmd from "../src/Cmd";
import {
  FrameResolutionError,
  hitTest,
  type InputLayer,
  encodingView as lookupEncodingView,
  resolveLayers as resolveLayersResult,
} from "../src/internal/frame";
import * as Width from "../src/internal/width";
import * as Reactive from "../src/Reactive";

const resolveLayers = (...args: Parameters<typeof resolveLayersResult>) =>
  Result.getOrThrow(resolveLayersResult(...args));
const encodingView = (frame: Parameters<typeof lookupEncodingView>[0]) =>
  Option.getOrThrow(lookupEncodingView(frame));

const layer = (box: Box.Box<unknown>, x = 0, y = 0, z = 0): InputLayer => ({
  box,
  x,
  y,
  z,
});
const lines = (
  layers: readonly InputLayer[],
  width: number,
  height: number
): readonly string[] =>
  encodingView(resolveLayers(layers, width, height)).lines.map((row) =>
    row.map((run) => run.text).join("")
  );
const region = (frame: ReturnType<typeof resolveLayers>, id: string) =>
  Option.getOrThrow(HashMap.get(frame.regions, id));
const customStyle = (code: string) =>
  Annotation.createAnnotation<Ansi.AnsiStyle>([
    { _tag: "TextAttribute", name: "custom", code },
  ]);

describe("resolved frame", () => {
  it("composes bounded opaque layers against a coordinate reference", () => {
    for (let width = 0; width <= 4; width++) {
      for (let height = 0; height <= 3; height++) {
        for (let x = -3; x <= 4; x++) {
          for (let y = -2; y <= 3; y++) {
            const source = Box.text("AB\nCD");
            const expected = Array.from({ length: height }, (_, row) =>
              Array.from({ length: width }, (_, col) => {
                const sourceRow = row - y;
                const sourceCol = col - x;
                return sourceRow >= 0 &&
                  sourceRow < 2 &&
                  sourceCol >= 0 &&
                  sourceCol < 2
                  ? ["AB", "CD"][sourceRow]?.[sourceCol]
                  : "x";
              }).join("")
            );
            expect(
              lines(
                [
                  layer(
                    Box.text(
                      Array.from({ length: height }, () =>
                        "x".repeat(width)
                      ).join("\n")
                    )
                  ),
                  layer(source, x, y),
                ],
                width,
                height
              )
            ).toEqual(expected);
          }
        }
      }
    }
  });

  it("orders by z and input order while spaces block underlying hits", () => {
    const background = Reactive.makeReactive(Box.text("abc"), "background");
    const frame = resolveLayers(
      [
        layer(Box.text("XYZ"), 0, 0, 2),
        layer(background),
        layer(Box.text(" "), 1, 0, 2),
      ],
      3,
      1
    );
    expect(
      encodingView(frame)
        .lines[0]?.map((run) => run.text)
        .join("")
    ).toBe("X Z");
    expect(hitTest(frame, { row: 0, col: 1 })).toEqual([]);
    expect(region(frame, "background").visible).toEqual([]);
  });

  it("uses renderer alignment on both axes, including centered oversized content", () => {
    for (const align of [Box.left, Box.center1, Box.center2, Box.right]) {
      for (let outer = 1; outer <= 4; outer++) {
        for (let inner = 1; inner <= 4; inner++) {
          const source = "ABCD".slice(0, inner);
          const horizontal = Box.alignHoriz(Box.text(source), align, outer);
          expect(lines([layer(horizontal)], outer, 1)).toEqual([
            Width.fitString(source, outer, align),
          ]);
          const vertical = Box.alignVert(
            Box.text([...source].join("\n")),
            align,
            outer
          );
          const start = Width.alignmentOffset(align, inner, outer);
          expect(lines([layer(vertical)], 1, outer)).toEqual(
            Array.from(
              { length: outer },
              (_, row) => source[row - start] ?? " "
            )
          );
        }
      }
    }
  });

  it("inherits, overrides, resets and restores nested styles without changing inputs", () => {
    const inherited = Ansi.combine(Ansi.red, Ansi.bold, Ansi.italic);
    const children = [
      Box.text("a"),
      Box.text("b").pipe(Box.annotate(Ansi.fgDefault)),
      Box.text("c").pipe(Box.annotate(customStyle("22"))),
      Box.text("d").pipe(Box.annotate(Ansi.reset)),
      Box.text("e"),
    ];
    const source = Box.hcat(children, Box.top).pipe(Box.annotate(inherited));
    const runs = encodingView(resolveLayers([layer(source)], 5, 1)).lines[0];
    expect(
      runs?.map((run) => run.style.map((attribute) => attribute.code))
    ).toEqual([
      ["31", "1", "3"],
      ["1", "3"],
      ["31", "3"],
      [],
      ["31", "1", "3"],
    ]);
    expect(Object.isFrozen(inherited.data)).toBe(false);
    expect(Object.isFrozen(runs)).toBe(true);
    expect(
      runs?.every(
        (run) =>
          Object.isFrozen(run) &&
          Object.isFrozen(run.style) &&
          run.style.every(Object.isFrozen)
      )
    ).toBe(true);
  });

  it("interprets every supported off code and default background", () => {
    const active = Ansi.combine(
      Ansi.bold,
      Ansi.dim,
      Ansi.italic,
      Ansi.underlined,
      Ansi.blink,
      Ansi.inverse,
      Ansi.hidden,
      Ansi.strikethrough,
      Ansi.overline,
      Ansi.bgBlue
    );
    const disabled = Annotation.createAnnotation<Ansi.AnsiStyle>([
      ...["22", "23", "24", "25", "27", "28", "29", "55"].map(
        (code): Ansi.AnsiAttribute => ({
          _tag: "TextAttribute",
          name: "off",
          code,
        })
      ),
      ...Ansi.bgDefault.data,
    ]);
    const source = Box.alignHoriz(
      Box.text("a").pipe(Box.annotate(disabled)),
      Box.left,
      2
    ).pipe(Box.annotate(active));
    const runs = encodingView(resolveLayers([layer(source)], 2, 1)).lines[0];
    expect(runs?.[0]?.style).toEqual([]);
    expect(runs?.[1]?.style.map((value) => value.code)).toEqual(
      active.data.map((value) => value.code)
    );
  });

  it("preserves complete graphemes and blanks partially clipped or occluded wide glyphs", () => {
    expect(lines([layer(Box.text("e\u0301👩‍💻中"))], 5, 1)).toEqual([
      "e\u0301👩‍💻中",
    ]);
    const wide = Reactive.makeReactive(Box.text("中"), "wide");
    const frame = resolveLayers([layer(wide), layer(Box.text("X"), 1)], 2, 1);
    expect(
      encodingView(frame)
        .lines[0]?.map((run) => run.text)
        .join("")
    ).toBe(" X");
    expect(hitTest(frame, { row: 0, col: 0 })).toEqual(["wide"]);
    expect(hitTest(frame, { row: 0, col: 1 })).toEqual([]);
    expect(lines([layer(wide, -1)], 1, 1)).toEqual([" "]);
    expect(lines([layer(wide)], 1, 1)).toEqual([" "]);
  });

  it("tracks fragmented repeated occurrences and innermost unique ancestry", () => {
    const inner = Reactive.makeReactive(Box.text("abcde"), "same");
    const nested = Box.alignHoriz(inner, Box.left, 5).pipe(
      Box.annotate(Reactive.reactive("same"))
    );
    const source = Box.vcat([nested, inner], Box.left).pipe(
      Box.annotate(Reactive.reactive("parent"))
    );
    const frame = resolveLayers([layer(source), layer(Box.text("X"), 2)], 5, 2);
    const repeated = region(frame, "same");
    expect(repeated.occurrences).toHaveLength(3);
    expect(new Set(repeated.occurrences.map((value) => value.key)).size).toBe(
      3
    );
    expect(repeated.occurrences[0]?.visible).toEqual([
      { row: 0, col: 0, rows: 1, cols: 2 },
      { row: 0, col: 3, rows: 1, cols: 2 },
    ]);
    expect(hitTest(frame, { row: 0, col: 1 })).toEqual(["same", "parent"]);
    expect(hitTest(frame, { row: 0, col: 2 })).toEqual([]);
    expect(hitTest(frame, { row: 1, col: 2 })).toEqual(["same", "parent"]);
    expect(Object.isFrozen(repeated)).toBe(true);
    expect(Object.isFrozen(repeated.occurrences)).toBe(true);
    expect(
      repeated.occurrences.every(
        (value) =>
          Object.isFrozen(value.visible) && Object.isFrozen(value.bounds)
      )
    ).toBe(true);
  });

  it("coalesces vertical visibility and unions overlapping occurrences of one ID", () => {
    const child = Reactive.makeReactive(Box.text("abc\ndef"), "same");
    const source = Box.alignHoriz(child, Box.left, 3).pipe(
      Box.annotate(Reactive.reactive("same"))
    );
    const frame = resolveLayers([layer(source)], 3, 2);
    const value = region(frame, "same");
    const expected = [{ row: 0, col: 0, rows: 2, cols: 3 }];
    expect(value.visible).toEqual(expected);
    expect(value.occurrences.map((occurrence) => occurrence.visible)).toEqual([
      expected,
      expected,
    ]);
  });

  it("validates annotation tags and codes independently of structural ANSI guards", () => {
    const invalid = [
      [{ _tag: "ForegroundColor", name: "unsafe", code: "31;0" }],
      [{ _tag: "BackgroundColor", name: "unsafe", code: "31" }],
      [{ _tag: "TextAttribute", name: 1, code: "1" }],
      [{ _tag: "Unknown", name: "unknown", code: "1" }],
      [{ _tag: "ForegroundColor", name: "unsafe", code: "38;2;1;2;256" }],
      [{ _tag: "TextAttribute", name: "unsafe", code: 1 }],
      [...Ansi.red.data, ...(Cmd.cursorTo(0, 0).annotation?.data ?? [])],
    ];
    for (const data of invalid) {
      const source = Box.text("x").pipe(
        Box.annotate(Annotation.createAnnotation(data))
      );
      expect(() => resolveLayers([layer(source, 100)], 0, 0)).toThrow(
        FrameResolutionError
      );
    }
  });

  it("copies source styles and geometry into a snapshot without freezing inputs", () => {
    const source = Box.text("a");
    const attribute: Ansi.AnsiAttribute = {
      _tag: "ForegroundColor",
      name: "red",
      code: "31",
    };
    const attributes = [attribute];
    const styled = Box.annotate(
      source,
      Annotation.createAnnotation(attributes)
    );
    const frame = resolveLayers([layer(styled)], 2, 1);
    attributes.push({ _tag: "TextAttribute", name: "bold", code: "1" });
    if (source.content._tag === "Col")
      source.content.boxes.push(Box.text("changed"));
    expect(encodingView(frame).lines[0]?.[0]?.text).toBe("a");
    expect(encodingView(frame).lines[0]?.[0]?.style).toEqual([attribute]);
    expect(Object.isFrozen(attributes)).toBe(false);
  });

  it("retains fully hidden and clipped logical regions, including empty viewports", () => {
    const source = Reactive.makeReactive(Box.text("ABC"), "item");
    const frame = resolveLayers(
      [layer(source, -1, 1), layer(Box.emptyBox(2, 4))],
      4,
      2
    );
    expect(region(frame, "item").occurrences[0]).toMatchObject({
      bounds: { row: 1, col: -1, rows: 1, cols: 3 },
      clipped: { row: 1, col: 0, rows: 1, cols: 2 },
      visible: [],
    });
    const empty = resolveLayers([layer(source)], 0, 2);
    expect(encodingView(empty).lines).toEqual([[], []]);
    expect(region(empty, "item").visible).toEqual([]);
  });

  it("rejects unsupported content even in offscreen, occluded or empty layers", () => {
    const invalid = [
      Cmd.cursorTo(0, 0),
      Box.text("\u001b[31mred"),
      Box.text("x").pipe(
        Box.annotate(Annotation.createAnnotation({ tooltip: "x" }))
      ),
      Box.text("x").pipe(Box.annotate(customStyle("999"))),
      Box.text("x").pipe(Box.annotate(Ansi.colorRGB(1.5, 2, 3))),
    ];
    for (const box of invalid) {
      for (const [x, width, height] of [
        [100, 2, 1],
        [0, 0, 0],
        [0, 2, 1],
      ]) {
        expect(() =>
          resolveLayers(
            [layer(box, x), layer(Box.text("cover"), 0, 0, 1)],
            width ?? 0,
            height ?? 0
          )
        ).toThrow(FrameResolutionError);
      }
    }
  });

  it.each([
    [2 ** 32, 1],
    [0, 2 ** 32],
    [2 ** 32, 0],
    [1001, 1000],
    [0, 1_000_001],
  ])(
    "returns a typed failure for an oversized %s by %s viewport",
    (width, height) => {
      const result = resolveLayersResult([], width, height);
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(FrameResolutionError);
        expect(result.failure.message).toContain("dense storage limit");
      }
    }
  );

  it("rejects invalid dimensions and unrepresentable logical coordinates before allocation", () => {
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => resolveLayers([], value, 1)).toThrow(FrameResolutionError);
    }
    expect(() =>
      resolveLayers([layer(Box.text("x"), Number.MAX_SAFE_INTEGER)], 1, 1)
    ).toThrow(FrameResolutionError);
    expect(
      lines([layer(Box.text("x"), -Number.MAX_SAFE_INTEGER)], 1, 1)
    ).toEqual([" "]);
    expect(() =>
      hitTest(resolveLayers([], 1, 1), { row: 0.5, col: 0 })
    ).toThrow(RangeError);
    expect(hitTest(resolveLayers([], 1, 1), { row: -1, col: 0 })).toEqual([]);
  });
});
