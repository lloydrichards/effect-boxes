import { Effect, pipe } from "effect";
import { describe, expect, it } from "vitest";
import { Box, Renderer } from "../src/index";

describe("optional data-first arguments", () => {
  it.each([
    ["one value", () => Box.pad(Box.text("X"), 1), 3, 3],
    ["two values", () => Box.pad(Box.text("X"), 1, 2), 5, 3],
    ["four values", () => Box.pad(Box.text("X"), 1, 2, 3, 4), 7, 5],
  ])("Box.pad accepts %s", (_name, make, cols, rows) => {
    const result = make();

    expect(result.cols).toBe(cols);
    expect(result.rows).toBe(rows);
  });

  it.each([
    ["defaults", () => Box.border(Box.text("X"))],
    ["a style", () => Box.border(Box.text("X"), "rounded")],
    [
      "a style and options",
      () => Box.border(Box.text("X"), "rounded", { sides: { top: false } }),
    ],
  ])("Box.border accepts %s", (_name, make) => {
    const result = make();

    expect(result.cols).toBe(3);
  });

  it("Renderer.render accepts an omitted config", () => {
    const result = Effect.runSync(
      Renderer.render(Box.text("X")).pipe(
        Effect.provide(Renderer.PlainRendererLive)
      )
    );

    expect(result).toBe("X");
  });

  it("Renderer.render accepts a config", () => {
    const result = Effect.runSync(
      Renderer.render(Box.text("X "), { preserveWhitespace: true }).pipe(
        Effect.provide(Renderer.PlainRendererLive)
      )
    );

    expect(result).toBe("X ");
  });

  it("Renderer.renderLinesToString accepts an omitted config", () => {
    expect(Renderer.renderLinesToString(["X "])).toBe("X");
  });

  it("Renderer.renderLinesToString accepts a config", () => {
    expect(
      Renderer.renderLinesToString(["X "], { preserveWhitespace: true })
    ).toBe("X ");
  });

  it("preserves data-last calls", () => {
    const result = Effect.runSync(
      pipe(
        Box.text("X"),
        Box.pad(1),
        Box.border(),
        Renderer.render(),
        Effect.provide(Renderer.PlainRendererLive)
      )
    );

    expect(result).toBe(
      "\u250c\u2500\u2500\u2500\u2510\n\u2502   \u2502\n\u2502 X \u2502\n\u2502   \u2502\n\u2514\u2500\u2500\u2500\u2518"
    );
    expect(pipe(["X "], Renderer.renderLinesToString())).toBe("X");
  });
});
