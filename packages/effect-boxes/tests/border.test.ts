import { pipe, String } from "effect";
import { describe, expect, it } from "vitest";
import * as Ansi from "../src/Ansi";
import * as Box from "../src/Box";

describe("Box.border", () => {
  it("wraps a single-line text with default (single) border", () => {
    const result = pipe(Box.text("Hi"), Box.border());
    expect(Box.renderPlainSync(result)).toBe(
      String.stripMargin(
        `|┌──┐
         |│Hi│
         |└──┘`
      )
    );
  });

  it("wraps multi-line text", () => {
    const result = pipe(Box.text("AB\nCD"), Box.border());
    expect(Box.renderPlainSync(result)).toBe(
      String.stripMargin(
        `|┌──┐
         |│AB│
         |│CD│
         |└──┘`
      )
    );
  });

  it("supports rounded style", () => {
    const result = pipe(Box.text("X"), Box.border("rounded"));
    expect(Box.renderPlainSync(result)).toBe(
      String.stripMargin(
        `|╭─╮
         |│X│
         |╰─╯`
      )
    );
  });

  it("supports double style", () => {
    const result = pipe(Box.text("X"), Box.border("double"));
    expect(Box.renderPlainSync(result)).toBe(
      String.stripMargin(
        `|╔═╗
         |║X║
         |╚═╝`
      )
    );
  });

  it("supports thick style", () => {
    const result = pipe(Box.text("X"), Box.border("thick"));
    expect(Box.renderPlainSync(result)).toBe(
      String.stripMargin(
        `|┏━┓
         |┃X┃
         |┗━┛`
      )
    );
  });

  it("supports ascii style", () => {
    const result = pipe(Box.text("X"), Box.border("ascii"));
    expect(Box.renderPlainSync(result)).toBe(
      String.stripMargin(
        `|+-+
         ||X|
         |+-+`
      )
    );
  });

  it("data-first usage works", () => {
    const result = Box.border(Box.text("Hi"), "single", {});
    expect(Box.renderPlainSync(result)).toBe(
      String.stripMargin(
        `|┌──┐
         |│Hi│
         |└──┘`
      )
    );
  });

  it("dimensions are correct (content + 2 for border)", () => {
    const content = Box.text("Hello");
    const bordered = pipe(content, Box.border());
    expect(bordered.rows).toBe(content.rows + 2);
    expect(bordered.cols).toBe(content.cols + 2);
  });

  it("works with annotation for border color", () => {
    const result = pipe(
      Box.text("Hi"),
      Box.border("rounded", { annotation: Ansi.red })
    );
    expect(result.rows).toBe(3);
    expect(result.cols).toBe(4);
  });

  it("handles empty box", () => {
    const result = pipe(Box.emptyBox(0, 0), Box.border());
    expect(result.cols).toBe(2);
  });

  it("renders only the top and bottom edges around a zero-height box", () => {
    const result = Box.border(Box.emptyBox(0, 3));
    expect(Box.renderPlainSync(result)).toBe("┌───┐\n└───┘");
    expect(result.rows).toBe(2);
  });

  it("retains side widths around zero-height content without horizontal edges", () => {
    const result = Box.border(Box.emptyBox(0, 3), "single", {
      sides: { top: false, bottom: false },
    });
    expect(result.rows).toBe(0);
    expect(result.cols).toBe(5);
    expect(Box.renderPlainSync(result)).toBe("");
  });

  describe("per-side border toggles", () => {
    it("no bottom border", () => {
      const result = pipe(
        Box.text("Hi"),
        Box.border("single", { sides: { bottom: false } })
      );
      expect(Box.renderPlainSync(result)).toBe(
        String.stripMargin(
          `|┌──┐
           |│Hi│`
        )
      );
    });

    it("no top border", () => {
      const result = pipe(
        Box.text("Hi"),
        Box.border("single", { sides: { top: false } })
      );
      expect(Box.renderPlainSync(result)).toBe(
        String.stripMargin(
          `|│Hi│
           |└──┘`
        )
      );
    });

    it("no left border", () => {
      const result = pipe(
        Box.text("Hi"),
        Box.border("single", { sides: { left: false } })
      );
      expect(Box.renderPlainSync(result)).toBe(
        String.stripMargin(
          `|──┐
           |Hi│
           |──┘`
        )
      );
    });

    it("no right border", () => {
      const result = pipe(
        Box.text("Hi"),
        Box.border("single", { sides: { right: false } })
      );
      expect(Box.renderPlainSync(result)).toBe(
        String.stripMargin(
          `|┌──
           |│Hi
           |└──`
        )
      );
    });

    it("left border only (quote style)", () => {
      const result = pipe(
        Box.text("Quote"),
        Box.border("thick", {
          sides: { top: false, right: false, bottom: false },
        })
      );
      expect(Box.renderPlainSync(result)).toBe(String.stripMargin(`|┃Quote`));
    });

    it("top and bottom only (horizontal rule style)", () => {
      const result = pipe(
        Box.text("Hi"),
        Box.border("single", { sides: { left: false, right: false } })
      );
      expect(Box.renderPlainSync(result)).toBe(
        String.stripMargin(
          `|──
           |Hi
           |──`
        )
      );
    });

    it("no borders at all returns content unchanged", () => {
      const content = Box.text("Hi");
      const result = pipe(
        content,
        Box.border("single", {
          sides: { top: false, right: false, bottom: false, left: false },
        })
      );
      expect(Box.renderPlainSync(result)).toBe(Box.renderPlainSync(content));
    });

    it("dimensions adjust when sides are disabled", () => {
      const content = Box.text("Hi");

      const noBottom = pipe(
        content,
        Box.border("single", { sides: { bottom: false } })
      );
      expect(noBottom.rows).toBe(content.rows + 1);
      expect(noBottom.cols).toBe(content.cols + 2);

      const noLeftRight = pipe(
        content,
        Box.border("single", { sides: { left: false, right: false } })
      );
      expect(noLeftRight.rows).toBe(content.rows + 2);
      expect(noLeftRight.cols).toBe(content.cols);
    });

    it("works with rounded style and sides", () => {
      const result = pipe(
        Box.text("Tab"),
        Box.border("rounded", { sides: { bottom: false } })
      );
      expect(Box.renderPlainSync(result)).toBe(
        String.stripMargin(
          `|╭───╮
           |│Tab│`
        )
      );
    });

    it("corners omitted when adjacent sides disabled", () => {
      const result = pipe(
        Box.text("X"),
        Box.border("single", { sides: { top: false, left: false } })
      );
      expect(Box.renderPlainSync(result)).toBe(
        String.stripMargin(
          `|X│
           |─┘`
        )
      );
    });

    it("works with multi-line content and partial borders", () => {
      const result = pipe(
        Box.text("AB\nCD"),
        Box.border("single", { sides: { right: false, bottom: false } })
      );
      expect(Box.renderPlainSync(result)).toBe(
        String.stripMargin(
          `|┌──
           |│AB
           |│CD`
        )
      );
    });
  });
});
