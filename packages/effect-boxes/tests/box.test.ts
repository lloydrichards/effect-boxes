/** biome-ignore-all lint/suspicious/noExplicitAny: Testing runtime rather than build */
import { pipe, String } from "effect";
import * as Equal from "effect/Equal";
import * as Hash from "effect/Hash";
import * as Inspectable from "effect/Inspectable";
import { describe, expect, it } from "vitest";
import * as Annotation from "../src/Annotation";
import type { AnsiStyle } from "../src/Ansi";
import * as Ansi from "../src/Ansi";
import * as Box from "../src/Box";

describe("Box", () => {
  it("text trims trailing spaces per line", () => {
    const s = "abc   \nxy  ";
    expect(Box.renderPrettySync(Box.text(s))).toBe(
      String.stripMargin(
        `|abc
         |xy`
      )
    );
  });

  it("empty right identity", () => {
    const b = Box.hcat([Box.text("hi"), Box.text("!")], Box.top);
    expect(Box.renderPrettySync(Box.hAppend(b, Box.nullBox))).toBe(
      Box.renderPrettySync(b)
    );
  });

  it("empty left identity", () => {
    const b = Box.text("Z");
    expect(Box.renderPrettySync(Box.hAppend(Box.nullBox, b))).toBe(
      Box.renderPrettySync(b)
    );
  });

  it("empty top identity", () => {
    const b = Box.text("Z");
    expect(Box.renderPrettySync(Box.vAppend(Box.nullBox, b))).toBe(
      Box.renderPrettySync(b)
    );
  });

  it("empty bottom identity", () => {
    const b = Box.text("Z");
    expect(Box.renderPrettySync(Box.vAppend(b, Box.nullBox))).toBe(
      Box.renderPrettySync(b)
    );
  });

  it("associativity horizontal", () => {
    const a = Box.text("a");
    const b = Box.text("b");
    const c = Box.text("c");
    const leftH = Box.hAppend(a, Box.hAppend(b, c));
    const rightH = Box.hAppend(Box.hAppend(a, b), c);
    expect(Box.renderPrettySync(leftH)).toBe(Box.renderPrettySync(rightH));
  });

  it("associativity vertical", () => {
    const a = Box.text("a");
    const b = Box.text("b");
    const c = Box.text("c");
    const leftV = Box.vAppend(a, Box.vAppend(b, c));
    const rightV = Box.vAppend(Box.vAppend(a, b), c);
    expect(Box.renderPrettySync(leftV)).toBe(Box.renderPrettySync(rightV));
  });

  it("semigroup associativity", () => {
    // (a <> b) <> c = a <> (b <> c)
    const a = Box.text("a");
    const b = Box.text("b");
    const c = Box.text("c");
    const left = Box.combine(Box.combine(a, b), c);
    const right = Box.combine(a, Box.combine(b, c));
    expect(Box.renderPrettySync(left)).toBe(Box.renderPrettySync(right));
    expect(Box.renderPrettySync(left)).toBe("abc");
  });

  it("monoid left identity", () => {
    // empty <> x = x
    const box = Box.text("box");
    const result = Box.combine(Box.nullBox, box);
    expect(Box.renderPrettySync(result)).toBe(Box.renderPrettySync(box));
    expect(Box.renderPrettySync(result)).toBe("box");
  });

  it("monoid right identity", () => {
    // x <> empty = x
    const box = Box.text("world");
    const result = Box.combine(box, Box.nullBox);
    expect(Box.renderPrettySync(result)).toBe(Box.renderPrettySync(box));
    expect(Box.renderPrettySync(result)).toBe("world");
  });

  it("monoid combineAll with multiple boxes", () => {
    const result = Box.combineAll([
      Box.text("a"),
      Box.text("b"),
      Box.text("c"),
      Box.text("d"),
    ]);
    expect(Box.renderPrettySync(result)).toBe("abcd");
  });

  it("monoid combineAll with empty collection", () => {
    const result = Box.combineAll([]);
    expect(Box.renderPrettySync(result)).toBe(
      Box.renderPrettySync(Box.nullBox)
    );
    expect(Box.renderPrettySync(result)).toBe("");
  });

  it("combineMany combines a starting box with multiple boxes", () => {
    const result = Box.combineMany(
      [Box.text("1"), Box.text("2"), Box.text("3")],
      Box.text("start")
    );
    expect(Box.renderPrettySync(result)).toBe("start123");
  });

  it("rows and cols can describe a Box", () => {
    const box1 = Box.emptyBox(5, 3);
    expect(Box.rows(box1)).toBe(5);
    expect(Box.cols(box1)).toBe(3);

    const box2 = Box.text("line1\nline2\nline3");
    expect(Box.rows(box2)).toBe(3);
    expect(Box.cols(box2)).toBe(5);
  });
});

describe("issue38 parity tests", () => {
  it("char constructs 1x1 and Box.renders the character", () => {
    const b = Box.char("A");
    expect(b.rows).toBe(1);
    expect(b.cols).toBe(1);
    expect(Box.renderPrettySync(b)).toBe("A");
  });

  it("rows/cols report correct sizes and after composition", () => {
    const R1 = 3;
    const C1 = 2;
    const R2 = 3;
    const C2 = 3;
    const a = Box.emptyBox(R1, C1);
    const b = Box.emptyBox(R2, C2);
    expect(a.rows).toBe(R1);
    expect(a.cols).toBe(C1);
    const c = Box.hcat([a, b], Box.top);
    expect(c.rows).toBe(R1);
    expect(c.cols).toBe(C1 + C2);
  });

  it("emptyBox Box.renders exact spaces grid", () => {
    const R = 2;
    const C = 3;
    const b = Box.emptyBox(R, C);
    expect(Box.renderPlainSync(b).replaceAll(" ", ".")).toBe(
      String.stripMargin(
        `|...
         |...`
      )
    );
  });

  it("beside/above default to top alignment and match Box.hcat/Box.vcat", () => {
    const a = Box.text("x\ny");
    const b = Box.text("Z");
    const beside = (l: any, r: any) => Box.hcat([l, r], Box.top);
    const above = (t: any, bot: any) => Box.vcat([t, bot], Box.left);
    expect(Box.renderPrettySync(beside(a, b))).toBe(
      Box.renderPrettySync(Box.hcat([a, b], Box.top))
    );
    expect(Box.renderPrettySync(above(b, a))).toBe(
      Box.renderPrettySync(Box.vcat([b, a], Box.left))
    );
  });

  it("Box.hcat vertical alignment center2 vs center1 biases differ on odd free space", () => {
    const tall = Box.text("x\ny"); // height 2
    const short = Box.text("Z"); // height 1
    const c1 = Box.hcat([tall, short], Box.center1);
    const c2 = Box.hcat([tall, short], Box.center2);

    // Under center1 (ceil), Z should be on the bottom row
    expect(Box.renderPlainSync(c1).replaceAll(" ", ".")).toBe(
      String.stripMargin(
        `|xZ
         |y.`
      )
    );

    // Under center2 (floor), Z should be on the top row
    expect(Box.renderPlainSync(c2).replaceAll(" ", ".")).toBe(
      String.stripMargin(
        `|x.
         |yZ`
      )
    );
  });

  it("Box.hcat bottom alignment places shorter box at bottom", () => {
    const tall = Box.text("x\ny\nz");
    const short = Box.text("Q");
    expect(
      Box.renderPlainSync(Box.hcat([tall, short], Box.bottom)).replaceAll(
        " ",
        "."
      )
    ).toBe(
      String.stripMargin(
        `|x.
         |y.
         |zQ`
      )
    );
  });

  it("Box.vcat bottom (right align) pads shorter lines to the right", () => {
    const a = Box.text("a"); // width 1
    const b = Box.text("bb"); // width 2
    expect(
      Box.renderPlainSync(Box.vcat([a, b], Box.right)).replaceAll(" ", ".")
    ).toBe(
      String.stripMargin(
        `|.a
         |bb`
      )
    );
  });
  it("A: align center1 center1 5x5 with text 'x'", () => {
    const H = 5;
    const W = 5;
    expect(
      Box.renderPlainSync(
        Box.align(Box.text("x"), Box.center1, Box.center1, H, W)
      ).replaceAll(" ", ".")
    ).toBe(
      String.stripMargin(
        `|.....
         |.....
         |..x..
         |.....
         |.....`
      )
    );
  });
  it("B: align center1 center1 5x5 with text 'x\\ny'", () => {
    const H = 5;
    const W = 5;
    expect(
      Box.renderPlainSync(
        Box.align(Box.text("x\ny"), Box.center1, Box.center1, H, W)
      ).replaceAll(" ", ".")
    ).toBe(
      String.stripMargin(
        `|.....
         |.....
         |..x..
         |..y..
         |.....`
      )
    );
  });

  it("C: align center1 center1 5x5 with line 'x\\ny'", () => {
    const H = 5;
    const W = 5;
    expect(
      Box.renderPlainSync(
        Box.align(Box.line("x\ny"), Box.center1, Box.center1, H, W)
      ).replaceAll(" ", ".")
    ).toBe(
      String.stripMargin(
        `|.....
         |.....
         |..xy.
         |.....
         |.....`
      )
    );
  });
});

describe("columns", () => {
  it("creates single column for short text", () => {
    const text = "hello world";
    const cols = Box.columns(text, Box.left, 20, 5);
    expect(cols).toHaveLength(1);
    expect(cols[0]?.rows).toBe(5);
    expect(Box.renderPrettySync(cols[0] as any)).toBe(
      String.stripMargin(
        `|hello world
         |
         |
         |
         |`
      )
    );
  });

  it("creates multiple columns for long text", () => {
    const text =
      "This is a very long text that should be split into multiple columns when the width is constrained and height is limited.";
    const cols = Box.columns(text, Box.left, 10, 3);
    expect(cols.length).toBeGreaterThan(1);
    for (const col of cols) {
      expect(col.rows).toBe(3);
    }
    const allText = cols.map((col) => Box.renderPrettySync(col)).join("");
    expect(allText).toContain("This is a");
    expect(allText).toContain("very long");
  });

  it("handles text that fits exactly in one column", () => {
    const text = "line1 line2 line3";
    const cols = Box.columns(text, Box.left, 6, 3);
    expect(cols).toHaveLength(1);
    if (cols[0]) {
      expect(Box.renderPrettySync(cols[0])).toBe(
        String.stripMargin(
          `|line1
           |line2
           |line3`
        )
      );
    }
  });

  it("creates columns with right alignment", () => {
    const text = "short text here";
    const cols = Box.columns(text, Box.right, 8, 2);
    expect(cols.length).toBeGreaterThanOrEqual(1);
    if (cols[0]) {
      expect(cols[0].rows).toBe(2);
      const lines = Box.renderPrettySync(cols[0]).split("\n");
      const hasRightAlignment = lines.some(
        (line) => line.startsWith(" ") && line.trim().length > 0
      );
      expect(hasRightAlignment).toBe(true);
    }
  });

  it("handles empty text", () => {
    const cols = Box.columns("", Box.left, 10, 5);
    expect(cols).toHaveLength(1);
    expect(cols[0]?.rows).toBe(5);
    expect(Box.renderPrettySync(cols[0] as any)).toBe("");
  });

  it("handles single word", () => {
    const cols = Box.columns("word", Box.left, 10, 3);
    expect(cols).toHaveLength(1);
    expect(Box.renderPrettySync(cols[0] as any)).toBe(
      String.stripMargin(
        `|word
         |
         |`
      )
    );
  });

  it("creates appropriate number of columns based on text length and constraints", () => {
    const longText = new Array(100).fill("word").join(" ");
    const cols = Box.columns(longText, Box.left, 5, 2);
    expect(cols.length).toBeGreaterThan(10);
    for (const col of cols) {
      expect(col.rows).toBe(2);
    }
  });
});

describe("para", () => {
  it("creates paragraph box with left alignment", () => {
    const text = "This is a test paragraph that should flow nicely.";
    const box = Box.para(text, Box.left, 10);
    expect(box.rows).toBeGreaterThan(0);
    expect(box.cols).toBeLessThanOrEqual(10);
    expect(Box.renderPrettySync(box)).toBe(
      String.stripMargin(
        `|This is a
         |test
         |paragraph
         |that
         |should
         |flow
         |nicely.`
      )
    );
  });

  it("creates paragraph box with left alignment", () => {
    const text = "This is a test paragraph that should flow nicely.";
    const box = Box.para(text, Box.right, 10);
    expect(box.rows).toBeGreaterThan(0);
    expect(box.cols).toBeLessThanOrEqual(10);
    expect(Box.renderPrettySync(box)).toBe(
      String.stripMargin(
        `|This is a
         |     test
         |paragraph
         |     that
         |   should
         |     flow
         |  nicely.`
      )
    );
  });

  it("creates paragraph box with center alignment", () => {
    const text = "This is a test paragraph that should flow nicely.";
    const box = Box.para(text, Box.center1, 10);
    expect(box.rows).toBeGreaterThan(0);
    expect(box.cols).toBeLessThanOrEqual(10);
    expect(Box.renderPrettySync(box)).toBe(
      String.stripMargin(
        `|This is a
         |  test
         |paragraph
         |  that
         | should
         |  flow
         | nicely.`
      )
    );
  });

  it("flows text to specified width", () => {
    const text = "Something longer than the width.";
    expect(Box.renderPrettySync(Box.para(text, Box.left, 4))).toBe(
      String.stripMargin(
        `|Some
         |long
         |than
         |the
         |widt`
      )
    );
  });
});

describe("Spacing", () => {
  it("hcatWithSpace concatenates boxes horizontally with space", () => {
    const result = Box.hcatWithSpace(Box.text("left"), Box.text("right"));
    expect(Box.renderPrettySync(result)).toBe("left right");
  });

  it("hcatWithSpace with multi-line boxes", () => {
    const result = Box.hcatWithSpace(Box.text("A\nB"), Box.text("X\nY"));
    expect(Box.renderPrettySync(result)).toBe(
      String.stripMargin(
        `|A X
         |B Y`
      )
    );
  });

  it("vcatWithSpace concatenates boxes vertically with space", () => {
    const result = Box.vcatWithSpace(Box.text("top"), Box.text("bottom"));
    expect(Box.renderPrettySync(result)).toBe(
      String.stripMargin(
        `|top
         |
         |bottom`
      )
    );
  });

  it("vcatWithSpace with different widths", () => {
    const result = Box.vcatWithSpace(
      Box.text("short"),
      Box.text("much longer text")
    );
    expect(Box.renderPrettySync(result)).toBe(
      String.stripMargin(
        `|short
         |
         |much longer text`
      )
    );
  });
});

describe("Punctuation Functions", () => {
  it("punctuateH intersperse with comma", () => {
    const boxes = [Box.text("a"), Box.text("b"), Box.text("c")];
    const result = Box.punctuateH(boxes, Box.left, Box.text(","));
    expect(Box.renderPrettySync(result)).toBe("a,b,c");
  });

  it("punctuateH with single box", () => {
    const boxes = [Box.text("solo")];
    const result = Box.punctuateH(boxes, Box.left, Box.text("|"));
    expect(Box.renderPrettySync(result)).toBe("solo");
  });

  it("punctuateH with different alignments", () => {
    const result = Box.punctuateH(
      [Box.text("A\nB"), Box.text("X")],
      Box.bottom,
      Box.text("|")
    );
    expect(Box.renderPlainSync(result)).toBe(
      String.stripMargin(
        `|A  
         |B|X`
      )
    );
  });

  it("punctuateV intersperse with separator", () => {
    const result = Box.punctuateV(
      [Box.text("line1"), Box.text("line2"), Box.text("line3")],
      Box.left,
      Box.text("---")
    );
    expect(Box.renderPrettySync(result)).toBe(
      String.stripMargin(
        `|line1
         |---
         |line2
         |---
         |line3`
      )
    );
  });

  it("punctuateV with single box", () => {
    const result = Box.punctuateV(
      [Box.text("only")],
      Box.left,
      Box.text("***")
    );
    expect(Box.renderPrettySync(result)).toBe("only");
  });

  it("punctuateV with different alignments", () => {
    expect(
      Box.renderPrettySync(
        Box.punctuateV(
          [Box.text("A"), Box.text("WIDE")],
          Box.right,
          Box.text("--")
        )
      )
    ).toBe(
      String.stripMargin(
        `|   A
         |  --
         |WIDE`
      )
    );
  });
});

describe("Separation", () => {
  it("hsep with zero separation", () => {
    const result = Box.hsep(
      [Box.text("a"), Box.text("b"), Box.text("c")],
      0,
      Box.left
    );
    expect(Box.renderPrettySync(result)).toBe("abc");
  });

  it("hsep with spacing", () => {
    const result = Box.hsep([Box.text("x"), Box.text("y")], 3, Box.left);
    expect(Box.renderPrettySync(result)).toBe("x   y");
  });

  it("hsep with different alignments", () => {
    const result = Box.hsep(
      [Box.text("A\nB\nC"), Box.text("X")],
      1,
      Box.center1
    );
    expect(Box.renderPlainSync(result)).toBe(
      String.stripMargin(
        `|A  
         |B X
         |C  `
      )
    );
  });

  it("vsep with spacing", () => {
    const result = Box.vsep([Box.text("top"), Box.text("bottom")], 2, Box.left);
    expect(Box.renderPrettySync(result)).toBe(
      String.stripMargin(
        `|top
         |
         |
         |bottom`
      )
    );
  });

  it("vsep with different alignments", () => {
    const result = Box.vsep([Box.text("A"), Box.text("WIDE")], 1, Box.center1);
    expect(Box.renderPlainSync(result)).toBe(
      String.stripMargin(
        `| A  
         |    
         |WIDE`
      )
    );
  });
});

describe("Movement", () => {
  const centerBox = Box.align(Box.text("x"), Box.center1, Box.center1, 3, 3);

  it("moveUp adds rows below the box", () => {
    const result = Box.moveUp(centerBox, 2);
    expect(Box.renderPlainSync(result).replaceAll(" ", ".")).toBe(
      String.stripMargin(
        `|...
         |.x.
         |...
         |...
         |...`
      )
    );
  });

  it("moveUp with single row movement", () => {
    const result = Box.moveUp(centerBox, 1);
    expect(Box.renderPlainSync(result).replaceAll(" ", ".")).toBe(
      String.stripMargin(
        `|...
         |.x.
         |...
         |...`
      )
    );
  });

  it("moveDown adds rows above the box", () => {
    const result = Box.moveDown(centerBox, 2);
    expect(Box.renderPlainSync(result).replaceAll(" ", ".")).toBe(
      String.stripMargin(
        `|...
         |...
         |...
         |.x.
         |...`
      )
    );
  });

  it("moveDown with single row movement", () => {
    const result = Box.moveDown(centerBox, 1);
    expect(Box.renderPlainSync(result).replaceAll(" ", ".")).toBe(
      String.stripMargin(
        `|...
         |...
         |.x.
         |...`
      )
    );
  });

  it("moveLeft adds columns to the right", () => {
    const result = Box.moveLeft(centerBox, 2);
    expect(Box.renderPlainSync(result).replaceAll(" ", ".")).toBe(
      String.stripMargin(
        `|.....
         |.x...
         |.....`
      )
    );
  });

  it("moveLeft with single column movement", () => {
    const result = Box.moveLeft(centerBox, 1);
    expect(Box.renderPlainSync(result).replaceAll(" ", ".")).toBe(
      String.stripMargin(
        `|....
         |.x..
         |....`
      )
    );
  });

  it("moveRight adds columns to the left", () => {
    const result = Box.moveRight(centerBox, 2);
    expect(Box.renderPlainSync(result).replaceAll(" ", ".")).toBe(
      String.stripMargin(
        `|.....
         |...x.
         |.....`
      )
    );
  });

  it("moveRight with single column movement", () => {
    const result = Box.moveRight(centerBox, 1);
    expect(Box.renderPlainSync(result).replaceAll(" ", ".")).toBe(
      String.stripMargin(
        `|....
         |..x.
         |....`
      )
    );
  });
});

describe("Pipeable", () => {
  it("supports basic pipe with single transformation", () => {
    const result = Box.text("test").pipe(Box.alignHoriz(Box.center1, 10));
    expect(result.rows).toBe(Box.text("test").rows);
    expect(Box.renderPrettySync(result)).toContain("test");
  });

  it("supports pipe chaining with multiple transformations", (): void => {
    const result = Box.text("hello").pipe(
      Box.alignHoriz(Box.center1, 15),
      Box.alignVert(Box.center1, 5),
      Box.moveRight(2),
      Box.moveDown(1)
    );
    expect(result.cols).toBe(17);
    expect(result.rows).toBe(6);
    expect(Box.renderPrettySync(result)).toContain("hello");
  });

  it("preserves structural equality after a no-op transform", () => {
    const box = Box.text("unchanged");
    const result = box.pipe((self) => self);
    expect(Equal.equals(box, result)).toBe(true);
    expect(Hash.hash(box)).toBe(Hash.hash(result));
  });

  it("works with complex combinations including vcat and hcat in pipe chains", () => {
    const final = Box.vcat(
      [
        Box.text("A").pipe(Box.alignHoriz(Box.center1, 5)),
        Box.text("B").pipe(Box.alignHoriz(Box.center1, 5)),
        Box.text("C").pipe(Box.alignHoriz(Box.center1, 5)),
      ],
      Box.left
    ).pipe(Box.alignVert(Box.center1, 10), Box.moveRight(3));
    expect(final.cols).toBe(8);
    expect(final.rows).toBe(10);
    expect(Box.renderPrettySync(final)).toContain("A");
    expect(Box.renderPrettySync(final)).toContain("B");
    expect(Box.renderPrettySync(final)).toContain("C");
  });
});

describe("Equal", () => {
  it("compares identical boxes as equal", () => {
    const box1 = Box.text("hello");
    const box2 = Box.text("hello");
    expect(Equal.equals(box1, box2)).toBe(true);
  });

  it("compares boxes with different content as not equal", () => {
    const box1 = Box.text("hello");
    const box2 = Box.text("world");
    expect(Equal.equals(box1, box2)).toBe(false);
  });

  it("compares boxes with same content but different dimensions as not equal", () => {
    const box1 = Box.emptyBox(2, 3);
    const box2 = Box.emptyBox(3, 2);
    expect(Equal.equals(box1, box2)).toBe(false);
  });

  it("compares complex boxes with same structure as equal", () => {
    const box1 = Box.hcat([Box.text("a"), Box.text("b")], Box.top);
    const box2 = Box.hcat([Box.text("a"), Box.text("b")], Box.top);
    expect(Equal.equals(box1, box2)).toBe(true);
  });

  it("compares with non-Box objects as not equal", () => {
    const box = Box.text("test");
    const notBox = {
      rows: 1,
      cols: 4,
      content: { _tag: "Text", text: "test" },
    };
    expect(Equal.equals(box, notBox)).toBe(false);
  });
});

describe("Hash", () => {
  it("generates same hash for identical boxes", () => {
    const box1 = Box.text("hello");
    const box2 = Box.text("hello");
    expect(Hash.hash(box1)).toBe(Hash.hash(box2));
  });

  it("generates different hashes for boxes with different content", () => {
    const box1 = Box.text("hello");
    const box2 = Box.text("world");
    expect(Hash.hash(box1)).not.toBe(Hash.hash(box2));
  });

  it("generates different hashes for boxes with different dimensions", () => {
    const box1 = Box.emptyBox(2, 3);
    const box2 = Box.emptyBox(3, 2);
    expect(Hash.hash(box1)).not.toBe(Hash.hash(box2));
  });

  it("generates same hash for complex boxes with identical structure", () => {
    const box1 = Box.vcat([Box.text("line1"), Box.text("line2")], Box.left);
    const box2 = Box.vcat([Box.text("line1"), Box.text("line2")], Box.left);
    expect(Hash.hash(box1)).toBe(Hash.hash(box2));
  });

  it("should reuse the cached hash when hashing the same box repeatedly", () => {
    const box = Box.text("cached");
    const computeHash = box[Hash.symbol].bind(box);
    let computations = 0;
    Object.defineProperty(box, Hash.symbol, {
      value: () => {
        computations += 1;
        return computeHash();
      },
    });

    const hash1 = Hash.hash(box);
    const hash2 = Hash.hash(box);

    expect(hash1).toBe(hash2);
    expect(computations).toBe(1);
  });
});

describe("Inspectable", () => {
  it("provides enhanced toString method with content information", () => {
    const textBox = Box.text("hello");
    const emptyBox = Box.emptyBox(3, 5);
    const charBox = Box.char("Z");
    const longTextBox = Box.text(
      "This is a very long text that should be truncated"
    );
    const hcatBox = Box.hcat([Box.text("A"), Box.text("B")], Box.top);
    const vcatBox = Box.vcat([Box.text("X"), Box.text("Y")], Box.left);
    const alignedBox = Box.align(
      Box.text("test"),
      Box.center1,
      Box.center2,
      5,
      10
    );
    expect(textBox.toString()).toBe("Box(1x5 Col [1 boxes vertical])");
    expect(emptyBox.toString()).toBe("Box(3x5 Blank [empty])");
    expect(charBox.toString()).toBe('Box(1x1 Text "Z")');
    expect(longTextBox.toString()).toBe("Box(1x49 Col [1 boxes vertical])");
    expect(hcatBox.toString()).toBe("Box(1x2 Row [2 boxes horizontal])");
    expect(vcatBox.toString()).toBe("Box(2x1 Col [2 boxes vertical])");
    expect(alignedBox.toString()).toBe(
      "Box(5x10 SubBox [aligned AlignCenter1/AlignCenter2])"
    );
  });

  it("toString shows annotation status", () => {
    const box = Box.text("test");
    const annotatedBox = Box.annotate(
      box,
      Annotation.createAnnotation("my-annotation")
    );
    expect(box.toString()).toBe("Box(1x4 Col [1 boxes vertical])");
    expect(annotatedBox.toString()).toBe(
      "Box(1x4 Col [1 boxes vertical] annotated)"
    );
  });

  it("toString truncates long text content in Text boxes", () => {
    const shortText = Box.char("A");
    const longTextChar = Box.char("This is way too long for display"); // char() only takes first character
    const longTextBox = Box.make({
      rows: 1,
      cols: 30,
      content: {
        _tag: "Text",
        text: "This is a very long text that should be truncated for display",
      },
    });

    expect(shortText.toString()).toBe('Box(1x1 Text "A")');
    expect(longTextChar.toString()).toBe('Box(1x1 Text "T")'); // char() only takes first character
    expect(longTextBox.toString()).toBe(
      'Box(1x30 Text "This is a very lo...")'
    );
  });

  it("provides structured inspection via NodeInspectSymbol", () => {
    const box = Box.char("X");
    const inspected = box[Inspectable.NodeInspectSymbol]();

    expect(inspected).toHaveProperty("_tag", "Box");
    expect(inspected).toHaveProperty("rows", 1);
    expect(inspected).toHaveProperty("cols", 1);
    expect(inspected).toHaveProperty("content");
    expect(inspected).not.toHaveProperty("annotation");
  });

  it("provides toJSON method for serialization", () => {
    const box = Box.emptyBox(2, 3);
    const json = box.toJSON();
    expect(json).toHaveProperty("_tag", "Box");
    expect(json).toHaveProperty("rows", 2);
    expect(json).toHaveProperty("cols", 3);
    expect(json).toHaveProperty("content");
    expect(json).not.toHaveProperty("annotation");
  });

  it("excludes private implementation details from inspection", () => {
    const box = Box.text("test");
    const inspected = box[Inspectable.NodeInspectSymbol]();

    // Should only contain public properties
    const keys = Object.keys(inspected as object);
    expect(keys).toEqual(
      expect.arrayContaining(["_tag", "rows", "cols", "content"])
    );
    expect(keys).not.toContain("pipe");
    expect(keys).not.toContain(Symbol.for("effect/Hash"));
    expect(keys).not.toContain(Symbol.for("effect/Equal"));
  });
});

describe("Annotation Functions", () => {
  describe("annotate", () => {
    it("adds annotation to a box without annotation", () => {
      const box = Box.text("hello");
      const annotation = Annotation.createAnnotation("my-annotation");
      const annotatedBox = Box.annotate(box, annotation);

      expect(annotatedBox.rows).toBe(box.rows);
      expect(annotatedBox.cols).toBe(box.cols);
      expect(annotatedBox.annotation).toEqual(annotation);
      expect(Box.renderPrettySync(annotatedBox)).toBe(
        Box.renderPrettySync(box)
      );
    });

    it("supports dual signature with annotation first", () => {
      const box = Box.text("test");
      const annotation = Annotation.createAnnotation({
        type: "info",
        value: 42,
      });

      // Test curried version
      const annotator = Box.annotate(annotation);
      const result = annotator(box);

      expect(result.annotation?.data).toEqual({ type: "info", value: 42 });
    });

    it("replaces existing annotation when adding new one", () => {
      const box = Box.text("content");
      const firstAnnotation = Annotation.createAnnotation("first");
      const secondAnnotation = Annotation.createAnnotation("second");

      const firstAnnotated = Box.annotate(box, firstAnnotation);
      const secondAnnotated = Box.annotate(firstAnnotated, secondAnnotation);

      expect(firstAnnotated.annotation?.data).toBe("first");
      expect(secondAnnotated.annotation?.data).toBe("second");
    });

    it("preserves box structure and content when annotating", () => {
      const complexBox = Box.vcat(
        [Box.hcat([Box.text("A"), Box.text("B")], Box.top), Box.text("C")],
        Box.left
      );

      const annotation = Annotation.createAnnotation({ id: "complex-box" });
      const annotated = Box.annotate(complexBox, annotation);

      expect(Box.renderPrettySync(annotated)).toBe(
        Box.renderPrettySync(complexBox)
      );
      expect(annotated.rows).toBe(complexBox.rows);
      expect(annotated.cols).toBe(complexBox.cols);
      expect(annotated.annotation?.data).toEqual({ id: "complex-box" });
    });
  });

  describe("unAnnotate", () => {
    it("removes annotation from annotated box", () => {
      const box = Box.text("hello");
      const annotation = Annotation.createAnnotation("test-annotation");
      const annotatedBox = Box.annotate(box, annotation);
      const unAnnotatedBox = Box.unAnnotate(annotatedBox);

      expect(unAnnotatedBox.annotation).toBeUndefined();
      expect(unAnnotatedBox.rows).toBe(annotatedBox.rows);
      expect(unAnnotatedBox.cols).toBe(annotatedBox.cols);
      expect(Box.renderPrettySync(unAnnotatedBox)).toBe(
        Box.renderPrettySync(annotatedBox)
      );
    });

    it("handles box without annotation gracefully", () => {
      const box = Box.text("no annotation");
      const result = Box.unAnnotate(box);

      expect(result.annotation).toBeUndefined();
      expect(result.rows).toBe(box.rows);
      expect(result.cols).toBe(box.cols);
      expect(Box.renderPrettySync(result)).toBe(Box.renderPrettySync(box));
    });

    it("preserves complex box structure when removing annotation", () => {
      const complexBox = Box.hcat(
        [Box.text("Left\nSide"), Box.text("Right")],
        Box.center1
      );

      const annotated = Box.annotate(
        complexBox,
        Annotation.createAnnotation("remove-me")
      );
      const unAnnotated = Box.unAnnotate(annotated);

      expect(unAnnotated.annotation).toBeUndefined();
      expect(Box.renderPrettySync(unAnnotated)).toBe(
        Box.renderPrettySync(complexBox)
      );
    });
  });

  describe("reAnnotate", () => {
    it("transforms annotation data using provided function", () => {
      const box = Box.text("content");
      const initialData = { count: 5, name: "test" };
      const annotation = Annotation.createAnnotation(initialData);
      const annotatedBox = Box.annotate(box, annotation);

      const transform = (data: typeof initialData) => ({
        count: data.count * 2,
        name: data.name.toUpperCase(),
        transformed: true,
      });

      const reAnnotated = Box.reAnnotate(annotatedBox, transform);

      expect(reAnnotated.annotation?.data).toEqual({
        count: 10,
        name: "TEST",
        transformed: true,
      });
      expect(Box.renderPrettySync(reAnnotated)).toBe(Box.renderPrettySync(box));
    });

    it("supports dual signature with transform function first", () => {
      const box = Box.text("test");
      const annotation = Annotation.createAnnotation(10);
      const annotatedBox = Box.annotate(box, annotation);

      const doubler = (n: number) => n * 2;
      const transformer = Box.reAnnotate(doubler);
      const result = transformer(annotatedBox);

      expect(result.annotation?.data).toBe(20);
    });

    it("should throw when no annotation exists", () => {
      const box = Box.text("no annotation");
      const transform = (data: string) => data.toUpperCase();

      expect(() => Box.reAnnotate(box, transform)).toThrow(
        "Cannot reAnnotate: Box has no annotation to transform"
      );
    });

    it("preserves annotation structure while transforming data", () => {
      const box = Box.emptyBox(3, 3);
      const originalAnnotation = Annotation.createAnnotation("original");
      const annotated = Box.annotate(box, originalAnnotation);

      const reAnnotated = Box.reAnnotate(
        annotated,
        (data: string) => `${data}-modified`
      );

      expect(reAnnotated.annotation?.data).toBe("original-modified");
      expect(Annotation.isAnnotation(reAnnotated.annotation)).toBe(true);
    });
  });

  describe("alterAnnotation", () => {
    it("creates multiple boxes from single annotation using alter function", () => {
      const box = Box.text("base");
      const annotation = Annotation.createAnnotation(["a", "b", "c"]);
      const annotatedBox = Box.annotate(box, annotation);

      const alter = (data: string[]) => data.map((item) => item.toUpperCase());
      const resultBoxes = Box.alterAnnotation(annotatedBox, alter);

      expect(resultBoxes).toHaveLength(3);
      expect(resultBoxes[0]?.annotation?.data).toBe("A");
      expect(resultBoxes[1]?.annotation?.data).toBe("B");
      expect(resultBoxes[2]?.annotation?.data).toBe("C");

      for (const resultBox of resultBoxes) {
        expect(Box.renderPrettySync(resultBox)).toBe(Box.renderPrettySync(box));
        expect(resultBox.rows).toBe(box.rows);
        expect(resultBox.cols).toBe(box.cols);
      }
    });

    it("supports dual signature with alter function first", () => {
      const box = Box.text("test");
      const annotation = Annotation.createAnnotation(5);
      const annotatedBox = Box.annotate(box, annotation);

      const multiplier = (n: number) => [n * 2, n * 3, n * 4];
      const alterer = Box.alterAnnotation(multiplier);
      const results = alterer(annotatedBox);

      expect(results).toHaveLength(3);
      expect(results[0]?.annotation?.data).toBe(10);
      expect(results[1]?.annotation?.data).toBe(15);
      expect(results[2]?.annotation?.data).toBe(20);
    });

    it("throws error when trying to alter annotations on box without annotation", () => {
      const box = Box.text("no annotation");
      const alter = (data: string) => [data, `${data}2`];

      expect(() => Box.alterAnnotation(box, alter)).toThrow(
        "Cannot alter annotations on a box without annotation"
      );
    });

    it("handles alter function returning empty array", () => {
      const box = Box.char("X");
      const annotation = Annotation.createAnnotation("test");
      const annotatedBox = Box.annotate(box, annotation);

      const alter = () => [];
      const results = Box.alterAnnotation(annotatedBox, alter);

      expect(results).toHaveLength(0);
      expect(Array.isArray(results)).toBe(true);
    });

    it("preserves complex box structure in all resulting boxes", () => {
      const complexBox = Box.punctuateH(
        [Box.text("A"), Box.text("B"), Box.text("C")],
        Box.top,
        Box.text("|")
      );

      const annotation = Annotation.createAnnotation({
        type: "list",
        items: 3,
      });
      const annotatedBox = Box.annotate(complexBox, annotation);

      const alter = (data: { type: string; items: number }) =>
        Array.from({ length: data.items }, (_, i) => ({
          ...data,
          index: i,
          id: `item-${i}`,
        }));

      const results = Box.alterAnnotation(annotatedBox, alter);

      expect(results).toHaveLength(3);
      results.forEach((resultBox, index) => {
        expect(Box.renderPrettySync(resultBox)).toBe(
          Box.renderPrettySync(complexBox)
        );
        expect(resultBox.annotation?.data.index).toBe(index);
        expect(resultBox.annotation?.data.id).toBe(`item-${index}`);
        expect(resultBox.annotation?.data.type).toBe("list");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should render single char emojis correctly", () => {
      const emojiBox = Box.align(
        Box.text("😁"),
        Box.center1,
        Box.center1,
        3,
        3
      );

      expect(Box.renderPlainSync(emojiBox).replaceAll(" ", ".")).toBe(
        String.stripMargin(
          `|...
           |.😁.
           |...`
        )
      );
    });
    it("should render multi-char emojis correctly", () => {
      const emojiBox = Box.align(
        Box.text("👩‍💻"),
        Box.center1,
        Box.center1,
        3,
        3
      );

      expect(Box.renderPlainSync(emojiBox).replaceAll(" ", ".")).toBe(
        String.stripMargin(
          `|...
           |.👩💻
           |...`
        )
      );
    });
  });

  describe("Covariance", () => {
    it("border with annotation can be used in a generic pipeline", () => {
      // With covariance, border can widen Box<A> to Box<A | AnsiStyle>
      const panel = <A>(self: Box.Box<A>): Box.Box<A | AnsiStyle> =>
        Box.border(self, "rounded", { annotation: Ansi.green });
      const box = Box.text("hello");
      const result = panel(box);
      expect(result.rows).toBeGreaterThan(0);
    });

    it("Box<never> is assignable to Box<AnsiStyle>", () => {
      const neverBox: Box.Box<never> = Box.text("hello");
      const ansiBox: Box.Box<AnsiStyle> = neverBox;
      expect(Box.renderPrettySync(ansiBox)).toBe("hello");
    });

    it("Box<AnsiStyle> is assignable to Box<unknown>", () => {
      const styled: Box.Box<AnsiStyle> = pipe(
        Box.text("styled"),
        Box.border("rounded", { annotation: Ansi.green })
      );
      const wide: Box.Box<unknown> = styled;
      expect(Box.renderPrettySync(wide)).toBeDefined();
    });

    it("hAppend composes Box<never> with Box<AnsiStyle>", () => {
      const plain: Box.Box<never> = Box.text("left");
      const styled: Box.Box<AnsiStyle> = pipe(
        Box.text("right"),
        Box.border("rounded", { annotation: Ansi.green })
      );
      const result: Box.Box<AnsiStyle> = Box.hAppend(plain, styled);
      expect(result.cols).toBeGreaterThan(0);
    });

    it("vAppend composes Box<never> with Box<AnsiStyle>", () => {
      const plain: Box.Box<never> = Box.text("top");
      const styled: Box.Box<AnsiStyle> = pipe(
        Box.text("bottom"),
        Box.border("rounded", { annotation: Ansi.green })
      );
      const result: Box.Box<AnsiStyle> = Box.vAppend(plain, styled);
      expect(result.rows).toBeGreaterThan(0);
    });

    it("pipe composition with mixed annotation types", () => {
      const result = pipe(
        Box.text("content"),
        Box.moveRight(2),
        Box.border("rounded", { annotation: Ansi.green }),
        Box.moveDown(1)
      );
      expect(result.rows).toBeGreaterThan(0);
    });
  });
});
