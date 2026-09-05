import { pipe } from "effect";
import { describe, expect, it } from "vitest";
import * as Box from "../src/Box";
import { Container, Flex, Grid } from "../src/Layout";

// ─── Flex.row ────────────────────────────────────────────────────────────────

describe("Flex.row", () => {
  it("fixed children keep intrinsic width", () => {
    const result = Flex.row(
      [Flex.fixed(Box.text("AB")), Flex.fixed(Box.text("CD"))],
      80
    );
    expect(Box.cols(result)).toBe(4);
  });

  it("grow child fills remaining space", () => {
    const result = Flex.row(
      [Flex.fixed(Box.text("AB")), Flex.grow(Box.text("X"))],
      10
    );
    // fixed=2, grow gets 8
    expect(Box.cols(result)).toBe(10);
  });

  it("distributes remainder to first N grow children", () => {
    // 10 available, 3 grow children with factor 1 each
    // floor(10/3) = 3 each = 9, remainder = 1 -> first child gets 4
    const result = Flex.row(
      [
        Flex.grow(Box.text("A")),
        Flex.grow(Box.text("B")),
        Flex.grow(Box.text("C")),
      ],
      10
    );
    expect(Box.cols(result)).toBe(10);
  });

  it("proportional factors distribute correctly", () => {
    // 12 available, factors 2 and 1 -> 8 and 4
    const result = Flex.row(
      [Flex.grow(Box.text("A"), 2), Flex.grow(Box.text("B"), 1)],
      12
    );
    expect(Box.cols(result)).toBe(12);
  });

  it("gap is accounted for", () => {
    const result = Flex.row(
      [Flex.fixed(Box.text("AB")), Flex.fixed(Box.text("CD"))],
      80,
      { gap: 2 }
    );
    // 2 + 2 + 2(gap) = 6
    expect(Box.cols(result)).toBe(6);
  });

  it("spacer pushes items apart", () => {
    const result = Flex.row(
      [Flex.fixed(Box.text("L")), Flex.spacer(), Flex.fixed(Box.text("R"))],
      10
    );
    expect(Box.cols(result)).toBe(10);
    const rendered = Box.renderPlainSync(result);
    expect(rendered).toContain("L");
    expect(rendered).toContain("R");
  });

  it("fill builder receives allocated size", () => {
    let received = 0;
    Flex.row(
      [
        Flex.fixed(Box.text("XX")),
        Flex.fill((size) => {
          received = size;
          return Box.emptyBox(1, size);
        }),
      ],
      10
    );
    expect(received).toBe(8);
  });

  it("does not distribute remainder to zero-factor children", () => {
    const received: number[] = [];
    const child = (factor: number) =>
      Flex.fill((size) => {
        received.push(size);
        return Box.emptyBox(1, size);
      }, factor);

    Flex.row([child(0), child(1), child(1)], 1);

    expect(received).toEqual([0, 1, 0]);
  });

  it("supports data-last pipe usage", () => {
    const children = [Flex.fixed(Box.text("A")), Flex.grow(Box.text("B"))];
    const result = pipe(children, Flex.row(20));
    expect(Box.cols(result)).toBe(20);
  });

  it("overflow: fixed children exceed container", () => {
    const result = Flex.row(
      [Flex.fixed(Box.text("ABCDEFGHIJ")), Flex.grow(Box.text("X"))],
      5
    );
    // fixed is 10 > container 5, grow gets 0 (clamped), result > container
    expect(Box.cols(result)).toBeGreaterThanOrEqual(10);
  });

  it("should allocate zero width to grow children when fixed children use all available width", () => {
    const result = Flex.row(
      [Flex.fixed(Box.text("ABCDE")), Flex.grow(Box.text("x"))],
      5
    );

    expect(Box.cols(result)).toBe(5);
    expect(Box.renderPlainSync(result)).toBe("ABCDE");
  });
});

// ─── Flex.col ────────────────────────────────────────────────────────────────

describe("Flex.col", () => {
  it("fixed children keep intrinsic height", () => {
    const result = Flex.col(
      [Flex.fixed(Box.text("A\nB")), Flex.fixed(Box.text("C"))],
      10
    );
    expect(Box.rows(result)).toBe(3);
  });

  it("grow child fills remaining height", () => {
    const result = Flex.col(
      [Flex.fixed(Box.text("A")), Flex.grow(Box.text("X"))],
      10
    );
    expect(Box.rows(result)).toBe(10);
  });

  it("supports data-last pipe usage", () => {
    const children = [Flex.fixed(Box.text("A")), Flex.grow(Box.text("B"))];
    const result = pipe(children, Flex.col(8));
    expect(Box.rows(result)).toBe(8);
  });
});

// ─── Container ───────────────────────────────────────────────────────────────

describe("Container", () => {
  it("enforces width on output", () => {
    const result = Container.make({ width: 40 }, (_ctx) => Box.text("short"));
    expect(Box.cols(result)).toBe(40);
  });

  it("provides correct innerWidth with padding", () => {
    let innerW = 0;
    Container.make({ width: 40, padding: 2 }, (ctx) => {
      innerW = ctx.innerWidth;
      return Box.text("x");
    });
    expect(innerW).toBe(36); // 40 - 2*2
  });

  it("applies padding to output", () => {
    const result = Container.make({ width: 20, padding: 1 }, (_ctx) =>
      Box.text("hi")
    );
    // width enforced: 20, padding adds 1 on each side
    expect(Box.cols(result)).toBe(20);
    expect(Box.rows(result)).toBe(3); // 1 top + 1 content + 1 bottom
  });

  it("padding tuple [vertical, horizontal]", () => {
    let ctx: { innerWidth: number; innerHeight: number } | undefined;
    Container.make({ width: 30, height: 20, padding: [2, 3] }, (c) => {
      ctx = c;
      return Box.text("x");
    });
    expect(ctx?.innerWidth).toBe(24); // 30 - 3*2
    expect(ctx?.innerHeight).toBe(16); // 20 - 2*2
  });
});

// ─── Grid ────────────────────────────────────────────────────────────────────

describe("Grid.make", () => {
  it("arranges items in columns", () => {
    const items = ["A", "B", "C", "D"].map(Box.text);
    const result = Grid.make(items, { cols: 2, colWidth: 5 });
    // 2 cols of width 5 + gap 1 = 11 wide, 2 rows
    expect(Box.cols(result)).toBe(11);
    expect(Box.rows(result)).toBe(2);
  });

  it("pads incomplete last row", () => {
    const items = ["A", "B", "C"].map(Box.text);
    const result = Grid.make(items, { cols: 2, colWidth: 5 });
    // Still 2 cols wide even though last row has 1 item
    expect(Box.cols(result)).toBe(11);
  });

  it("supports data-last pipe usage", () => {
    const items = ["A", "B", "C", "D"].map(Box.text);
    const result = pipe(items, Grid.make({ cols: 2, colWidth: 5 }));
    expect(Box.cols(result)).toBe(11);
  });

  it("custom gap", () => {
    const items = ["A", "B", "C", "D"].map(Box.text);
    const result = Grid.make(items, { cols: 2, colWidth: 5, gap: [2, 1] });
    // 5 + 2 + 5 = 12 wide, 2 rows + 1 gap = 3 tall
    expect(Box.cols(result)).toBe(12);
    expect(Box.rows(result)).toBe(3);
  });
});

describe("Grid.auto", () => {
  it("calculates columns from container width", () => {
    const items = ["A", "B", "C", "D", "E", "F"].map(Box.text);
    // width=23, minColWidth=10, gap=1 -> floor((23+1)/(10+1))=2 cols
    const result = Grid.auto(items, 23, { minColWidth: 10 });
    expect(Box.cols(result)).toBeGreaterThanOrEqual(20);
  });

  it("supports data-last pipe usage", () => {
    const items = ["A", "B", "C", "D"].map(Box.text);
    const result = pipe(items, Grid.auto(40, { minColWidth: 10 }));
    expect(Box.cols(result)).toBeGreaterThan(0);
  });

  it("respects maxColWidth", () => {
    const items = ["A", "B"].map(Box.text);
    // width=100, minColWidth=10, maxColWidth=20, gap=1
    // cols = floor(101/11) = 9, capped at items.length=2
    // colWidth = floor((100-1)/2) = 49, capped at 20
    const result = Grid.auto(items, 100, { minColWidth: 10, maxColWidth: 20 });
    expect(Box.cols(result)).toBeLessThanOrEqual(100);
  });

  it("works without optional align or stretch", () => {
    const items = ["A", "B", "C", "D"].map(Box.text);
    const result = Grid.auto(items, 30, { minColWidth: 10 });
    expect(Box.rows(result)).toBeGreaterThan(0);
    expect(Box.cols(result)).toBeGreaterThan(0);
  });

  it("works with explicit align option", () => {
    const items = ["A", "B", "C", "D"].map(Box.text);
    const result = Grid.auto(items, 30, {
      minColWidth: 10,
      align: Box.center1,
    });
    expect(Box.rows(result)).toBeGreaterThan(0);
  });

  it("works with explicit stretch option", () => {
    const items = ["A", "B", "C", "D"].map(Box.text);
    const result = Grid.auto(items, 30, { minColWidth: 10, stretch: true });
    expect(Box.rows(result)).toBeGreaterThan(0);
  });
});

// ─── Render snapshot tests ───────────────────────────────────────────────────

describe("Layout render snapshots", () => {
  it("Flex.row with spacer renders correctly", () => {
    const result = Flex.row(
      [Flex.fixed(Box.text("L")), Flex.spacer(), Flex.fixed(Box.text("R"))],
      10
    );
    const rendered = Box.renderPlainSync(result);
    expect(rendered).toBe("L        R");
  });

  it("Container with flex row", () => {
    const result = Container.make({ width: 12, padding: 1 }, (ctx) =>
      Flex.row(
        [Flex.fixed(Box.text("A")), Flex.spacer(), Flex.fixed(Box.text("B"))],
        ctx.innerWidth
      )
    );
    const rendered = Box.renderPlainSync(result);
    // Should be 12 wide with padding
    expect(Box.cols(result)).toBe(12);
    expect(rendered).toContain("A");
    expect(rendered).toContain("B");
  });
});
