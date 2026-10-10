import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import * as Annotation from "../src/Annotation";
import * as Ansi from "../src/Ansi";
import * as Box from "../src/Box";
import { Layer, Stack } from "../src/Layout";
import * as Renderer from "../src/Renderer";

interface TerminalStyle {
  readonly foreground: number;
  readonly background: number;
  readonly bold: boolean;
  readonly dim: boolean;
}
interface TerminalCell {
  readonly text: string;
  readonly style: TerminalStyle;
}
const defaults: TerminalStyle = {
  foreground: 39,
  background: 49,
  bold: false,
  dim: false,
};

// This consumer interprets the emitted SGR stream independently of the resolver
// and encoder. Unsupported escapes fail the test instead of disappearing.
const consumeTerminal = (
  output: string
): readonly (readonly TerminalCell[])[] => {
  let style = defaults;
  const rows: TerminalCell[][] = [[]];
  let row = 0;
  let offset = 0;
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  while (offset < output.length) {
    if (output[offset] === "\x1b") {
      const escape = /^\[([0-9;]*)m/.exec(output.slice(offset + 1));
      if (!escape) throw new Error(`Unsupported terminal escape at ${offset}`);
      for (const code of (escape[1] || "0").split(";").map(Number)) {
        if (code === 0) style = defaults;
        else if (code === 1) style = { ...style, bold: true };
        else if (code === 2) style = { ...style, dim: true };
        else if (code === 22) style = { ...style, bold: false, dim: false };
        else if ((code >= 30 && code <= 37) || code === 39)
          style = { ...style, foreground: code };
        else if ((code >= 40 && code <= 47) || code === 49)
          style = { ...style, background: code };
        else throw new Error(`Unsupported SGR ${code}`);
      }
      offset += 1 + escape[0].length;
    } else if (output[offset] === "\n") {
      rows.push([]);
      row++;
      offset++;
    } else {
      const nextEscape = output.indexOf("\x1b", offset);
      const nextLine = output.indexOf("\n", offset);
      const end = Math.min(
        nextEscape < 0 ? output.length : nextEscape,
        nextLine < 0 ? output.length : nextLine
      );
      for (const { segment } of segmenter.segment(output.slice(offset, end))) {
        const cells = rows[row];
        if (!cells) throw new Error("Missing terminal row");
        cells.push({ text: segment, style: { ...style } });
        // The fixtures use one known two-column glyph. No production width
        // helper is used to predict its terminal cells.
        if (segment === "界") cells.push({ text: "", style: { ...style } });
      }
      offset = end;
    }
  }
  return rows;
};
const cell = (
  text: string,
  foreground = 39,
  bold = false,
  background = 49,
  dim = false
): TerminalCell => ({ text, style: { foreground, background, bold, dim } });

const off = Annotation.createAnnotation<Ansi.AnsiStyle>([
  { _tag: "TextAttribute", name: "normalIntensity", code: "22" },
]);

describe("Stack ANSI terminal output", () => {
  it("restores nested default, off, and reset states across siblings and rows", () => {
    const source = Box.vcat(
      [
        Box.hcat(
          [
            Box.text("A"),
            Box.text("B").pipe(
              Box.annotate(Ansi.combine(Ansi.fgDefault, Ansi.bgDefault))
            ),
            Box.text("C").pipe(Box.annotate(off)),
            Box.text("D").pipe(Box.annotate(Ansi.reset)),
            Box.text("E"),
          ],
          Box.top
        ),
        Box.text("FGHIJ"),
      ],
      Box.left
    ).pipe(
      Box.annotate(Ansi.combine(Ansi.red, Ansi.bgBlue, Ansi.bold, Ansi.dim))
    );
    const rendered = Effect.runSync(
      Renderer.frame(source, { preserveWhitespace: true }).pipe(
        Effect.provide(Renderer.AnsiRendererLive)
      )
    );
    expect(consumeTerminal(rendered.output)).toEqual([
      [
        cell("A", 31, true, 44, true),
        cell("B", 39, true, 49, true),
        cell("C", 31, false, 44),
        cell("D"),
        cell("E", 31, true, 44, true),
      ],
      [..."FGHIJ"].map((text) => cell(text, 31, true, 44, true)),
    ]);
    // Appending plain text also verifies that the encoder leaves no live style.
    const appended = consumeTerminal(`${rendered.output}!`);
    expect(appended[1]?.at(-1)).toEqual(cell("!"));
  });

  it("emits full-width rows with opaque spaces and blanks a half-covered wide glyph", () => {
    const background = Box.text("A界BC\nD界EF").pipe(Box.annotate(Ansi.red));
    const cover = Box.text("X \nY ").pipe(Box.annotate(Ansi.green));
    const stack = Stack.make(
      [Layer.make(background), Layer.make(cover, { x: 2, z: 1 })],
      { width: 5, height: 2 }
    );
    const rendered = Effect.runSync(
      Renderer.frame(stack, { preserveWhitespace: true }).pipe(
        Effect.provide(Renderer.AnsiRendererLive)
      )
    );
    expect(consumeTerminal(rendered.output)).toEqual([
      [
        cell("A", 31),
        cell(" ", 31),
        cell("X", 32),
        cell(" ", 32),
        cell("C", 31),
      ],
      [
        cell("D", 31),
        cell(" ", 31),
        cell("Y", 32),
        cell(" ", 32),
        cell("F", 31),
      ],
    ]);
    expect(consumeTerminal(rendered.output).map((row) => row.length)).toEqual([
      5, 5,
    ]);
  });

  it("keeps combining graphemes and complete wide glyphs intact in terminal cells", () => {
    const rendered = Effect.runSync(
      Renderer.frame(Box.text("é界!"), { preserveWhitespace: true }).pipe(
        Effect.provide(Renderer.AnsiRendererLive)
      )
    );
    expect(consumeTerminal(rendered.output)).toEqual([
      [cell("é"), cell("界"), cell(""), cell("!")],
    ]);
  });
});
