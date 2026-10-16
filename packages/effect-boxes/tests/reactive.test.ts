import { Effect, HashMap, Option } from "effect";
import { describe, expect, it } from "vitest";
import * as Box from "../src/Box";
import * as Reactive from "../src/Reactive";
import * as Renderer from "../src/Renderer";

describe("Reactive Annotations", () => {
  describe("ReactiveId", () => {
    it("creates reactive ID with string identifier", () => {
      const reactiveId = Reactive.make("test-id");
      expect(reactiveId).toEqual({
        _tag: "ReactiveId",
        id: "test-id",
      });
    });

    it("validates reactive ID type guard for valid ReactiveId", () => {
      const reactiveId = Reactive.make("valid-id");
      expect(Reactive.isReactive(reactiveId)).toBe(true);
    });

    it("validates reactive ID type guard for invalid objects", () => {
      expect(Reactive.isReactive(null)).toBe(false);
      expect(Reactive.isReactive({})).toBe(false);
      expect(Reactive.isReactive({ _tag: "ReactiveId" })).toBe(false);
      expect(Reactive.isReactive({ id: "test" })).toBe(false);
      expect(Reactive.isReactive({ _tag: "Wrong", id: "test" })).toBe(false);
    });

    it("creates reactive annotation with string ID", () => {
      const annotation = Reactive.reactive("button-1");
      expect(annotation.data).toBeDefined();
      expect(Reactive.isReactive(annotation.data)).toBe(true);
      expect(annotation.data.id).toBe("button-1");
    });
  });

  describe("reactiveBox", () => {
    it("annotates box with reactive ID (data-first)", () => {
      const box = Box.text("Hello");
      const reactiveBox = Reactive.makeReactive(box, "greeting");

      expect(reactiveBox.rows).toBe(1);
      expect(reactiveBox.cols).toBe(5);
      expect(reactiveBox.annotation).toBeDefined();
      expect(reactiveBox.annotation?.data.id).toBe("greeting");
    });

    it("annotates box with reactive ID (data-last)", () => {
      const box = Box.text("World");
      const reactiveBox = Reactive.makeReactive("greeting-2")(box);

      expect(reactiveBox.rows).toBe(1);
      expect(reactiveBox.cols).toBe(5);
      expect(reactiveBox.annotation).toBeDefined();
      expect(reactiveBox.annotation?.data.id).toBe("greeting-2");
    });

    it("preserves box dimensions and content", () => {
      const originalBox = Box.text("Multi\nLine");
      const reactiveBox = Reactive.makeReactive(originalBox, "multi-line");

      expect(reactiveBox.rows).toBe(originalBox.rows);
      expect(reactiveBox.cols).toBe(originalBox.cols);
      expect(Box.renderPrettySync(reactiveBox)).toBe(
        Box.renderPrettySync(originalBox)
      );
    });
  });

  describe("getPositions", () => {
    it("tracks single reactive box position", () => {
      const box = Reactive.makeReactive(Box.text("Hello"), "single");
      const positions = Reactive.getPositions(box);
      const rendered = Box.renderPrettySync(box);
      expect(rendered).toBe("Hello");
      expect(HashMap.has(positions, "single")).toBe(true);

      const position = Option.getOrUndefined(HashMap.get(positions, "single"));
      expect(position).toEqual({
        row: 0,
        col: 0,
        rows: 1,
        cols: 5,
      });
    });

    it("tracks multiple reactive boxes in hcat layout", () => {
      const box1 = Reactive.makeReactive(Box.text("Left"), "left-box");
      const box2 = Reactive.makeReactive(Box.text("Right"), "right-box");
      const combined = Box.hcat([box1, box2], Box.top);

      const positions = Reactive.getPositions(combined);
      const rendered = Box.renderPrettySync(combined);

      expect(rendered).toBe("LeftRight");
      expect(HashMap.size(positions)).toBe(2);

      const leftPos = Option.getOrUndefined(HashMap.get(positions, "left-box"));
      expect(leftPos).toEqual({
        row: 0,
        col: 0,
        rows: 1,
        cols: 4,
      });

      const rightPos = Option.getOrUndefined(
        HashMap.get(positions, "right-box")
      );
      expect(rightPos).toEqual({
        row: 0,
        col: 4,
        rows: 1,
        cols: 5,
      });
    });

    it("tracks multiple reactive boxes in vcat layout", () => {
      const box1 = Reactive.makeReactive(Box.text("Top"), "top-box");
      const box2 = Reactive.makeReactive(Box.text("Bottom"), "bottom-box");
      const combined = Box.vcat([box1, box2], Box.left);

      const positions = Reactive.getPositions(combined);
      const rendered = Box.renderPrettySync(combined);

      expect(rendered).toBe("Top\nBottom");
      expect(HashMap.size(positions)).toBe(2);

      const topPos = Option.getOrUndefined(HashMap.get(positions, "top-box"));
      expect(topPos).toEqual({
        row: 0,
        col: 0,
        rows: 1,
        cols: 3,
      });

      const bottomPos = Option.getOrUndefined(
        HashMap.get(positions, "bottom-box")
      );
      expect(bottomPos).toEqual({
        row: 1,
        col: 0,
        rows: 1,
        cols: 6,
      });
    });

    it("tracks nested reactive boxes correctly", () => {
      const innerBox = Reactive.makeReactive(Box.text("Inner"), "inner");
      const outerBox = Reactive.makeReactive(
        Box.alignHoriz(innerBox, Box.center1, 10),
        "outer"
      );

      const positions = Reactive.getPositions(outerBox);

      expect(HashMap.size(positions)).toBe(2);

      const outerPos = Option.getOrUndefined(HashMap.get(positions, "outer"));
      expect(outerPos).toEqual({
        row: 0,
        col: 0,
        rows: 1,
        cols: 10,
      });

      const innerPos = Option.getOrUndefined(HashMap.get(positions, "inner"));
      expect(innerPos?.row).toBe(0);
      expect(innerPos?.col).toBe(2);
      expect(innerPos?.rows).toBe(1);
      expect(innerPos?.cols).toBe(5);
    });

    describe.each([Box.center1, Box.center2])("%s coordinates", (alignment) => {
      it.each([
        [2, 2, 0, 0],
        [2, 3, 1, 0],
        [2, 4, 1, 1],
        [2, 5, 2, 1],
        [3, 2, -1, 0],
        [3, 3, 0, 0],
        [3, 4, 0, 1],
        [3, 5, 1, 1],
        [4, 2, -1, -1],
        [4, 3, 0, -1],
        [5, 2, -2, -1],
        [5, 3, -1, -1],
      ])(
        "matches rendering for input %i and target %i on both axes",
        (input, target, center1Offset, center2Offset) => {
          const offset =
            alignment === Box.center1 ? center1Offset : center2Offset;
          const letters = "ABCDE".slice(0, input);
          const expected =
            offset >= 0 ? " ".repeat(offset) + letters : letters.slice(-offset);
          const visible = expected.padEnd(target).slice(0, target);

          const horizontal = Box.alignHoriz(
            Reactive.makeReactive(Box.text(letters), "label"),
            alignment,
            target
          );
          expect(Box.renderPlainSync(horizontal)).toBe(visible);
          expect(
            Option.getOrThrow(
              HashMap.get(Reactive.getPositions(horizontal), "label")
            )
          ).toEqual({ row: 0, col: offset, rows: 1, cols: input });

          const vertical = Box.alignVert(
            Reactive.makeReactive(Box.text([...letters].join("\n")), "label"),
            alignment,
            target
          );
          expect(Box.renderPlainSync(vertical)).toBe([...visible].join("\n"));
          expect(
            Option.getOrThrow(
              HashMap.get(Reactive.getPositions(vertical), "label")
            )
          ).toEqual({ row: offset, col: 0, rows: input, cols: 1 });
        }
      );
    });

    it("adds nested SubBox offsets to row and column layout positions", () => {
      const label = Reactive.makeReactive(Box.text("AB\nCD"), "label");
      const inner = Reactive.makeReactive(
        label.pipe(
          Box.alignHoriz(Box.center1, 3),
          Box.alignVert(Box.center1, 3)
        ),
        "inner"
      );
      const nested = inner.pipe(
        Box.alignHoriz(Box.center2, 4),
        Box.alignVert(Box.center2, 4)
      );
      const layout = Box.vcat(
        [Box.text("heading"), Box.hcat([Box.text(">"), nested], Box.top)],
        Box.left
      );
      const positions = Reactive.getPositions(layout);
      expect(Option.getOrThrow(HashMap.get(positions, "inner"))).toEqual({
        row: 2,
        col: 2,
        rows: 3,
        cols: 3,
      });
      expect(Option.getOrThrow(HashMap.get(positions, "label"))).toEqual({
        row: 3,
        col: 3,
        rows: 2,
        cols: 2,
      });
      const lines = Box.renderPlainSync(layout).split("\n");
      expect(lines[3]).toBe("   AB  ");
      expect(lines[4]).toBe("   CD  ");
    });

    it("handles boxes without reactive annotations", () => {
      const normalBox = Box.text("Normal");
      const reactiveBox = Reactive.makeReactive(
        Box.text("Reactive"),
        "reactive-only"
      );
      const combined = Box.hcat([normalBox, reactiveBox], Box.top);

      const positions = Reactive.getPositions(combined);
      const rendered = Box.renderPrettySync(combined);

      expect(rendered).toBe("NormalReactive");
      expect(HashMap.size(positions)).toBe(1);
      expect(HashMap.has(positions, "reactive-only")).toBe(true);

      const reactivePos = Option.getOrUndefined(
        HashMap.get(positions, "reactive-only")
      );
      expect(reactivePos?.col).toBe(6); // After "Normal"
    });

    it("handles empty and zero-dimension boxes", () => {
      const emptyBox = Reactive.makeReactive(Box.nullBox, "empty");
      const positions = Reactive.getPositions(emptyBox);

      expect(HashMap.size(positions)).toBe(0); // Empty boxes (0 rows/cols) are not tracked
    });
  });

  describe("cursorToReactive", () => {
    it("generates correct cursor command for existing position", () => {
      const positions: Reactive.PositionMap = HashMap.make([
        "button-1",
        { row: 5, col: 10, rows: 2, cols: 8 },
      ]);

      const command = Reactive.cursorToReactive(positions, "button-1");

      expect(Option.isSome(command)).toBe(true);
      const cmdBox = Option.getOrThrow(command);
      expect(cmdBox.annotation?.data[0]?.code).toBe("\x1b[6;11H"); // 1-based coordinates
    });

    it("returns None for non-existent reactive ID", () => {
      const positions: Reactive.PositionMap = HashMap.make([
        "button-1",
        { row: 5, col: 10, rows: 2, cols: 8 },
      ]);

      const command = Reactive.cursorToReactive(positions, "non-existent");

      expect(Option.isNone(command)).toBe(true);
    });

    it("handles zero coordinates correctly", () => {
      const positions: Reactive.PositionMap = HashMap.make([
        "origin",
        { row: 0, col: 0, rows: 1, cols: 1 },
      ]);

      const command = Reactive.cursorToReactive(positions, "origin");

      expect(Option.isSome(command)).toBe(true);
      const cmdBox = Option.getOrThrow(command);
      expect(cmdBox.annotation?.data[0]?.code).toBe("\x1b[1;1H"); // Cursor positions are 1-based
    });

    it("works with empty position map", () => {
      const positions: Reactive.PositionMap = HashMap.empty();

      const command = Reactive.cursorToReactive(positions, "any-id");

      expect(Option.isNone(command)).toBe(true);
    });
  });

  describe("integration scenarios", () => {
    it("complete workflow: create, render, and navigate", () => {
      // Create a layout with multiple reactive boxes
      const header = Reactive.makeReactive(Box.text("Header"), "header");
      const button1 = Reactive.makeReactive(Box.text("[OK]"), "ok-button");
      const button2 = Reactive.makeReactive(
        Box.text("[Cancel]"),
        "cancel-button"
      );

      const buttons = Box.hcat([button1, Box.text(" "), button2], Box.top);
      const layout = Box.vcat([header, Box.emptyBox(1, 0), buttons], Box.left);

      // Render with positions
      const positions = Reactive.getPositions(layout);
      const rendered = Box.renderPrettySync(layout);

      // Verify layout
      expect(rendered).toBe("Header\n\n[OK] [Cancel]");

      // Verify all positions are tracked
      expect(HashMap.size(positions)).toBe(3);

      // Test navigation to each element
      const headerNav = Reactive.cursorToReactive(positions, "header");
      const okNav = Reactive.cursorToReactive(positions, "ok-button");
      const cancelNav = Reactive.cursorToReactive(positions, "cancel-button");

      expect(Option.isSome(headerNav)).toBe(true);
      expect(Option.isSome(okNav)).toBe(true);
      expect(Option.isSome(cancelNav)).toBe(true);

      // Verify correct positions
      const headerPos = Option.getOrUndefined(HashMap.get(positions, "header"));
      const okPos = Option.getOrUndefined(HashMap.get(positions, "ok-button"));
      const cancelPos = Option.getOrUndefined(
        HashMap.get(positions, "cancel-button")
      );

      expect(headerPos).toEqual({ row: 0, col: 0, rows: 1, cols: 6 });
      expect(okPos).toEqual({ row: 2, col: 0, rows: 1, cols: 4 });
      expect(cancelPos).toEqual({ row: 2, col: 5, rows: 1, cols: 8 }); // After [OK] + space
    });
  });

  describe("renderTracked", () => {
    it("returns lines, output, and positions", () => {
      const layout = Box.vcat(
        [
          Reactive.makeReactive(Box.text("Header"), "header"),
          Box.text("Body"),
          Reactive.makeReactive(Box.text("Footer"), "footer"),
        ],
        Box.left
      );

      const frame = Effect.runSync(
        Renderer.tracked(layout).pipe(
          Effect.provide(Renderer.PlainRendererLive)
        )
      );

      expect(frame.lines).toHaveLength(3);
      expect(frame.output).toContain("Header");
      expect(frame.output).toContain("Body");
      expect(frame.output).toContain("Footer");

      const headerPos = Option.getOrUndefined(
        HashMap.get(frame.positions, "header")
      );
      const footerPos = Option.getOrUndefined(
        HashMap.get(frame.positions, "footer")
      );

      expect(headerPos).toEqual({ row: 0, col: 0, rows: 1, cols: 6 });
      expect(footerPos).toEqual({ row: 2, col: 0, rows: 1, cols: 6 });
    });

    it("works with data-last calling pattern", () => {
      const layout = Reactive.makeReactive(Box.text("Test"), "test");

      const frame = Effect.runSync(
        layout.pipe(
          Renderer.tracked(),
          Effect.provide(Renderer.PlainRendererLive)
        )
      );

      expect(frame.output).toContain("Test");
      expect(Option.isSome(HashMap.get(frame.positions, "test"))).toBe(true);
    });

    it("returns empty positions for non-reactive boxes", () => {
      const layout = Box.text("Plain");

      const frame = Effect.runSync(
        Renderer.tracked(layout).pipe(
          Effect.provide(Renderer.PlainRendererLive)
        )
      );

      expect(frame.output).toContain("Plain");
      expect(HashMap.size(frame.positions)).toBe(0);
    });

    it("works with yield* inside Effect.gen", () => {
      const layout = Box.vcat(
        [
          Reactive.makeReactive(Box.text("A"), "a"),
          Reactive.makeReactive(Box.text("B"), "b"),
        ],
        Box.left
      );

      const program = Effect.gen(function* () {
        const frame = yield* Renderer.tracked(layout);
        return frame;
      }).pipe(Effect.provide(Renderer.PlainRendererLive));

      const frame = Effect.runSync(program);
      expect(frame.output).toContain("A");
      expect(HashMap.size(frame.positions)).toBe(2);
    });
  });
});
