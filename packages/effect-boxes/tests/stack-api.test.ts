import { Effect, Layer as EffectLayer, Result } from "effect";
import { describe, expect, it } from "vitest";
import * as Annotation from "../src/Annotation.js";
import * as Ansi from "../src/Ansi.js";
import * as Box from "../src/Box.js";
import * as Cmd from "../src/Cmd.js";
import * as FrameEncoder from "../src/FrameEncoder.js";
import * as Width from "../src/internal/width.js";
import { Layer, type LayoutValidationError, Stack } from "../src/Layout.js";
import * as Reactive from "../src/Reactive.js";
import * as Renderer from "../src/Renderer.js";

const plain = <E>(
  self: Effect.Effect<Renderer.FrameOutput, E, FrameEncoder.FrameEncoder>
) =>
  Effect.runSync(self.pipe(Effect.provide(FrameEncoder.PlainFrameEncoderLive)));

describe("Stack public API", () => {
  it.each([
    ["plain", Renderer.PlainRendererLive],
    ["ANSI", Renderer.AnsiRendererLive],
  ])(
    "retains zero-width separators with surviving %s glyphs",
    (_, renderer) => {
      for (const text of [
        "A\u200bB",
        "\u1100\u200b\u1161X",
        "\u1100\u2060\u1161X",
        "\u200bA\u2060",
      ]) {
        const source = Box.text(text);
        for (const input of [
          source,
          Stack.make([Layer.make(source)], {
            width: source.cols,
            height: source.rows,
          }),
        ]) {
          const rendered = Effect.runSync(
            Renderer.frame(input, { preserveWhitespace: true }).pipe(
              Effect.provide(renderer)
            )
          );
          expect(rendered.lines).toEqual([text]);
          expect(Width.ofString(rendered.lines[0] ?? "")).toBe(source.cols);
        }
      }
      const source = Box.text("A\u200bB\u2060");
      for (const layers of [
        [Layer.make(source, { x: 1 })],
        [Layer.make(source), Layer.make(Box.text("X"), { x: 1 })],
      ]) {
        const rendered = Effect.runSync(
          Renderer.frame(Stack.make(layers, { width: 2, height: 1 }), {
            preserveWhitespace: true,
          }).pipe(Effect.provide(renderer))
        );
        expect(rendered.lines).toEqual([layers.length === 1 ? " A" : "AX"]);
      }
    }
  );

  it.each([
    ["plain", Renderer.PlainRendererLive],
    ["ANSI", Renderer.AnsiRendererLive],
  ])(
    "rejects cross-layer grapheme joining before %s encoding",
    (_, renderer) => {
      for (const styled of [false, true]) {
        const leading = Box.text("\u1100");
        const stack = Stack.make(
          [
            Layer.make(styled ? leading.pipe(Box.annotate(Ansi.red)) : leading),
            Layer.make(Box.text("\u1161"), { x: 2 }),
            Layer.make(Box.text("X"), { x: 3 }),
          ],
          { width: 4, height: 1 }
        );
        const result = Effect.runSync(
          Renderer.frame(stack, { preserveWhitespace: true }).pipe(
            Effect.provide(renderer),
            Effect.result
          )
        );
        expect(Result.isFailure(result)).toBe(true);
        if (Result.isFailure(result)) {
          expect(result.failure).toBeInstanceOf(Renderer.FrameResolutionError);
          expect(result.failure.message).toContain("grapheme boundaries");
        }
      }
    }
  );

  it.each([
    ["plain", Renderer.PlainRendererLive],
    ["ANSI", Renderer.AnsiRendererLive],
  ])(
    "preserves whole and separated Jamo geometry with %s encoding",
    (_, renderer) => {
      for (const [layers, width, expected] of [
        [[Layer.make(Box.text("\u1100\u1161X"))], 3, "\u1100\u1161X"],
        [
          [
            Layer.make(Box.text("\u1100")),
            Layer.make(Box.text("\u1161"), { x: 3 }),
            Layer.make(Box.text("X"), { x: 4 }),
          ],
          5,
          "\u1100 \u1161X",
        ],
      ] as const) {
        const rendered = Effect.runSync(
          Renderer.frame(Stack.make(layers, { width, height: 1 }), {
            preserveWhitespace: true,
          }).pipe(Effect.provide(renderer))
        );
        expect(rendered.lines).toEqual([expected]);
        expect(Width.ofString(rendered.lines[0] ?? "")).toBe(
          rendered.resolved.cols
        );
        expect(Width.ofString(expected.slice(0, -1))).toBe(width - 1);
      }
    }
  );

  it("supports default and positioned layers in either calling form", () => {
    const source = Box.text("A");
    expect(Layer.make(source)).toEqual({ box: source, x: 0, y: 0, z: 0 });
    expect(source.pipe(Layer.make())).toEqual(Layer.make(source));
    const options = { x: -2, y: -3, z: -4 };
    expect(source.pipe(Layer.make(options))).toEqual(
      Layer.make(source, options)
    );
    expect(
      Layer.make(source, {
        x: Number.MIN_SAFE_INTEGER,
        z: Number.MAX_SAFE_INTEGER,
      }).x
    ).toBe(Number.MIN_SAFE_INTEGER);
  });

  it("rejects invalid constructor integers and negative dimensions with RangeError", () => {
    const source = Box.text("A");
    for (const value of [
      0.5,
      NaN,
      Infinity,
      -Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      for (const key of ["x", "y", "z"])
        expect(() => Layer.make(source, { [key]: value })).toThrow(RangeError);
      expect(() => Stack.make([], { width: value, height: 0 })).toThrow(
        RangeError
      );
      expect(() => Stack.make([], { width: 0, height: value })).toThrow(
        RangeError
      );
    }
    expect(() => Stack.make([], { width: -1, height: 0 })).toThrow(RangeError);
    expect(() => Stack.make([], { width: 0, height: -1 })).toThrow(RangeError);
    for (const value of [
      -1,
      0.5,
      NaN,
      Infinity,
      -Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      for (const key of ["rows", "cols"]) {
        const invalidSource = Box.text("A");
        Reflect.set(invalidSource, key, value);
        expect(() => Layer.make(invalidSource)).toThrow(RangeError);
      }
    }
    expect(Layer.make(Box.emptyBox(-1, -1)).box.rows).toBe(0);
  });

  it("infers styled and reactive layers together without annotation casts", () => {
    const stack = Stack.make(
      [
        Layer.make(Box.text("A").pipe(Box.annotate(Ansi.red))),
        Layer.make(Box.text("B").pipe(Reactive.makeReactive("button")), {
          x: 1,
        }),
      ],
      { width: 2, height: 1 }
    );
    expect(plain(Renderer.frame(stack)).lines).toEqual(["AB"]);
  });

  it("snapshots input order and placement without becoming a Box", () => {
    const options = { x: 0, y: 0, z: 0 };
    const dimensions = { width: 2, height: 1 };
    const mutableLayer = { box: Box.text("A"), ...options };
    const layers = [mutableLayer, Layer.make(Box.text("B"), options)];
    const stack = Stack.make(layers, dimensions);
    mutableLayer.x = 1;
    options.z = 9;
    dimensions.width = 10;
    layers.reverse();
    expect(Box.isBox(stack)).toBe(false);
    expect(stack.width).toBe(2);
    expect(stack.layers.map((layer) => layer.x)).toEqual([0, 0]);
    expect(stack.layers.map((layer) => layer.z)).toEqual([0, 0]);
    expect(plain(Renderer.frame(stack)).lines).toEqual(["B "]);
    expect(Object.isFrozen(stack)).toBe(true);
    expect(Object.isFrozen(stack.layers)).toBe(true);
    expect(stack.layers.every(Object.isFrozen)).toBe(true);
  });

  it("encodes the same resolved snapshot through data-first and data-last operations", () => {
    const stack = Stack.make([Layer.make(Box.text("A"), { x: 1 })], {
      width: 3,
      height: 2,
    });
    const resolved = Effect.runSync(Renderer.resolve(stack));
    const first = plain(
      Renderer.encode(resolved, { preserveWhitespace: true })
    );
    const last = plain(Renderer.encode({ preserveWhitespace: true })(resolved));
    expect(first.resolved).toBe(resolved);
    expect(last.resolved).toBe(resolved);
    expect(first.lines).toEqual([" A ", "   "]);
    expect(first.output).toBe(" A \n   ");
    expect(last).toEqual(first);
    expect(plain(Renderer.frame({ preserveWhitespace: true })(stack))).toEqual(
      first
    );
    expect(plain(Renderer.frame(stack)).lines).toEqual(first.lines);
    expect(plain(Renderer.frame(stack)).output).toBe(" A\n");
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.lines)).toBe(true);
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(plain(Renderer.frame()(Box.text("B"))).output).toBe("B");
    expect(plain(Renderer.encode()(resolved)).output).toBe(" A\n");
  });

  it.each([
    [0, 0, [], ""],
    [0, 3, ["", "", ""], "\n\n"],
    [4, 0, [], ""],
  ])(
    "retains empty viewport geometry %i × %i",
    (width, height, lines, output) => {
      const frame = plain(Renderer.frame(Stack.make([], { width, height })));
      expect(frame.resolved.cols).toBe(width);
      expect(frame.resolved.rows).toBe(height);
      expect(frame.lines).toEqual(lines);
      expect(frame.output).toBe(output);
    }
  );

  it("rejects hidden commands and unknown annotations through typed resolution errors", () => {
    const sources: readonly Box.Box<unknown>[] = [
      Cmd.cursorUp(1),
      Box.text("A").pipe(Box.annotate(Annotation.createAnnotation("unknown"))),
    ];
    for (const source of sources) {
      const result = Effect.runSync(
        Effect.result(
          Renderer.resolve(
            Stack.make(
              [
                Layer.make(source, { x: 10 }),
                Layer.make(Box.text("cover"), { z: 1 }),
              ],
              { width: 0, height: 0 }
            )
          )
        )
      );
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result))
        expect(result.failure).toBeInstanceOf(Renderer.FrameResolutionError);
    }
  });

  it("supports standalone encoders and paired built-in Renderer layers", () => {
    const source = Box.text("A").pipe(Box.annotate(Ansi.red));
    const standalonePlain = plain(Renderer.frame(source));
    const pairedPlain = Effect.runSync(
      Renderer.frame(source).pipe(Effect.provide(Renderer.PlainRendererLive))
    );
    expect(pairedPlain).toEqual(standalonePlain);
    const standaloneAnsi = Effect.runSync(
      Renderer.frame(source).pipe(
        Effect.provide(FrameEncoder.AnsiFrameEncoderLive)
      )
    );
    const pairedAnsi = Effect.runSync(
      Renderer.frame(source).pipe(Effect.provide(Renderer.AnsiRendererLive))
    );
    expect(pairedAnsi).toEqual(standaloneAnsi);
    expect(pairedAnsi.lines).toEqual(["\u001b[0;31mA\u001b[0m"]);
  });

  it("keeps legacy custom Renderer valid and frame encoding separately registered", () => {
    const legacy = EffectLayer.succeed(Renderer.Renderer, {
      renderContent: () => Effect.succeed(["legacy"]),
      postProcess: (lines) => Effect.succeed(lines),
      processor: {
        processLine: (text) => text,
        processLineAligned: (text) => text,
        preservesFormatting: false,
      },
    });
    expect(
      Effect.runSync(
        Renderer.render(Box.text("A")).pipe(Effect.provide(legacy))
      )
    ).toBe("legacy");
    const remaining = Renderer.frame(Box.text("A")).pipe(
      Effect.provide(legacy)
    );
    // @ts-expect-error Ordinary Renderer does not provide the FrameEncoder service.
    const missing: Effect.Services<typeof remaining> extends never
      ? true
      : false = true;
    void missing;
    const custom = FrameEncoder.layer({
      encodeResolved: (view) => {
        expect(Object.keys(view).sort()).toEqual(["cols", "lines", "rows"]);
        expect(Object.isFrozen(view)).toBe(true);
        expect(Object.isFrozen(view.lines)).toBe(true);
        expect(view.rows).toBe(2);
        expect(view.cols).toBe(4);
        for (const row of view.lines) {
          expect(Object.isFrozen(row)).toBe(true);
          let column = 0;
          for (const run of row) {
            expect(run.col).toBe(column);
            column += run.cols;
            expect(Object.isFrozen(run)).toBe(true);
            expect(Object.isFrozen(run.style)).toBe(true);
            expect(Object.keys(run).sort()).toEqual([
              "col",
              "cols",
              "style",
              "text",
            ]);
          }
          expect(column).toBe(4);
        }
        return Effect.succeed(
          view.lines.map((row) => row.map((run) => run.text).join(""))
        );
      },
    });
    const source = Stack.make(
      [Layer.make(Box.text("界").pipe(Box.annotate(Ansi.red)), { x: 1 })],
      { width: 4, height: 2 }
    );
    const output = Effect.runSync(
      Renderer.frame(source, { preserveWhitespace: true }).pipe(
        Effect.provide(EffectLayer.merge(legacy, custom))
      )
    );
    expect(output.lines).toEqual([" 界 ", "    "]);
    expect(output.output).toBe(" 界 \n    ");
  });

  it("propagates custom encoding failures without falling back", () => {
    const failure = new FrameEncoder.FrameEncodingError({
      message: "Unsupported backend glyph",
    });
    const encoder = FrameEncoder.layer({
      encodeResolved: () => Effect.fail(failure),
    });
    const result = Effect.runSync(
      Renderer.frame(Box.text("A")).pipe(Effect.provide(encoder), Effect.result)
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) expect(result.failure).toBe(failure);
  });

  it("rejects an encoder returning the wrong row count", () => {
    const encoder = FrameEncoder.layer({
      encodeResolved: () => Effect.succeed([]),
    });
    const result = Effect.runSync(
      Renderer.frame(Box.text("A")).pipe(Effect.provide(encoder), Effect.result)
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result))
      expect(result.failure).toBeInstanceOf(FrameEncoder.FrameEncodingError);
  });
});

it("preserves the annotation type of empty Stack constructors", () => {
  const empty: Stack<never> = Stack.make([], { width: 0, height: 0 });
  const result: Result.Result<
    Stack<never>,
    LayoutValidationError
  > = Stack.makeResult([], { width: 0, height: 0 });
  expect(empty.layers).toEqual([]);
  expect(Result.getOrThrow(result).layers).toEqual([]);
});

it.each(["", "AB", "A\nB", "A\r", "A\t", "\u001b[1CA", "\u001b[2JA"])(
  "rejects custom encoder rows that change geometry: %j",
  (row) => {
    const custom = FrameEncoder.layer({
      encodeResolved: () => Effect.succeed([row]),
    });
    const result = Effect.runSync(
      Effect.result(Renderer.frame(Box.text("A")).pipe(Effect.provide(custom)))
    );
    expect(result).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "FrameEncodingError" },
    });
  }
);

it("accepts custom ANSI SGR formatting without changing row geometry", () => {
  const row = "\u001b[38:2:255:0:0mA\u001b[0m";
  const custom = FrameEncoder.layer({
    encodeResolved: () => Effect.succeed([row]),
  });
  const frame = Effect.runSync(
    Renderer.frame(Box.text("A")).pipe(Effect.provide(custom))
  );
  expect(frame.lines).toEqual([row]);
});
