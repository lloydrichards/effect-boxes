/** biome-ignore-all lint/suspicious/noExplicitAny: Testing runtime rather than build */
import { describe, expect, it } from "vitest";
import * as Annotation from "../src/Annotation";
import * as Ansi from "../src/Ansi";
import * as Box from "../src/Box";

describe("Ansi Annotation Integration", () => {
  // ============================================================================
  // Box Annotation API Integration (FR-007, FR-009, FR-010)
  // ============================================================================

  describe("Box Annotation API Integration", () => {
    it("should support the specified API syntax for single styles", () => {
      const styledBox = Box.text("content").pipe(Box.annotate(Ansi.red));
      const rendered = Box.renderPrettySync(styledBox);

      expect(rendered).toBe("\x1b[31mcontent\x1b[0m");
      expect(styledBox.annotation).toEqual(Ansi.red);
    });

    it("should support combining annotations using Ansi.combine", () => {
      // From spec: Ansi.combine(Ansi.blue, Ansi.underlined)
      const combinedStyle = Ansi.combine(Ansi.blue, Ansi.underlined);

      const styledBox = Box.text("combined").pipe(Box.annotate(combinedStyle));
      const rendered = Box.renderPrettySync(styledBox);
      expect(rendered).toBe("\x1b[34;4mcombined\x1b[0m");
      const expectedData = [
        {
          _tag: "ForegroundColor",
          name: "blue",
          code: "34",
        },
        {
          _tag: "TextAttribute",
          name: "underlined",
          code: "4",
        },
      ];
      expect(styledBox.annotation?.data).toEqual(expectedData);
    });

    it("should maintain composability with existing Box functions", () => {
      const styledBox = Box.text("Hello").pipe(
        Box.annotate(Ansi.red),
        Box.alignHoriz(Box.center1, 10),
        Box.moveRight(2)
      );

      expect(styledBox.cols).toBe(12); // 10 + 2 movement

      const rendered = Box.renderPrettySync(styledBox);
      expect(rendered).toContain("\x1b[31m");
      expect(rendered).toContain("Hello");
    });
  });

  describe("Annotation Data Transformation", () => {
    it("should support reAnnotate with ANSI style transformations", () => {
      const styledBox = Box.text("Transform me").pipe(Box.annotate(Ansi.blue));

      const reAnnotatedBox = Box.reAnnotate(styledBox, () => Ansi.red.data);
      const rendered = Box.renderPrettySync(reAnnotatedBox);

      expect(rendered).toBe("\x1b[31mTransform me\x1b[0m");
      expect(reAnnotatedBox.annotation?.data).toEqual(Ansi.red.data);
    });

    it("should support alterAnnotation for creating style variations", () => {
      const baseBox = Box.text("Vary me").pipe(Box.annotate(Ansi.green));

      const variations = Box.alterAnnotation(baseBox, () => [
        Ansi.red.data,
        Ansi.blue.data,
        Ansi.yellow.data,
      ]);

      expect(variations).toHaveLength(3);

      const [redBox, blueBox, yellowBox] = variations;
      if (redBox && blueBox && yellowBox) {
        expect(Box.renderPrettySync(redBox)).toBe("\x1b[31mVary me\x1b[0m");
        expect(Box.renderPrettySync(blueBox)).toBe("\x1b[34mVary me\x1b[0m");
        expect(Box.renderPrettySync(yellowBox)).toBe("\x1b[33mVary me\x1b[0m");
      }
    });

    it("should handle complex annotation transformations with combined styles", () => {
      const complexStyle = Ansi.combine(Ansi.cyan, Ansi.bold);
      const styledBox = Box.text("Complex").pipe(Box.annotate(complexStyle));

      const enhanceStyle = (_combined: Ansi.AnsiStyle): Ansi.AnsiStyle =>
        Ansi.combine(Ansi.white, Ansi.bgMagenta, Ansi.underlined)
          .data as Ansi.AnsiStyle;

      const enhancedBox = Box.reAnnotate(styledBox, enhanceStyle);
      const rendered = Box.renderPrettySync(enhancedBox);

      expect(rendered).toContain("\x1b[37;45;4m"); // White fg, magenta bg, underlined
      expect(rendered).toContain("Complex");
    });
  });

  // ============================================================================
  // Style Inheritance and Scoping
  // ============================================================================

  describe("Style Inheritance and Scoping", () => {
    it("should restore a parent style after a child with the same style resets", () => {
      const layout = Box.hcat(
        [
          Box.text("a").pipe(Box.annotate(Ansi.red)),
          Box.text("b"),
        ],
        Box.top
      ).pipe(Box.annotate(Ansi.red));

      expect(Box.renderPrettySync(layout)).toBe(
        "\x1b[31ma\x1b[0m\x1b[31mb\x1b[0m"
      );
    });

    it("should restore a parent style after a child with a different style resets", () => {
      const layout = Box.hcat(
        [
          Box.text("a").pipe(Box.annotate(Ansi.blue)),
          Box.text("b"),
        ],
        Box.top
      ).pipe(Box.annotate(Ansi.red));

      expect(Box.renderPrettySync(layout)).toBe(
        "\x1b[31m\x1b[34ma\x1b[0m\x1b[31mb\x1b[0m"
      );
    });

    it("should maintain separate annotation scopes for nested boxes", () => {
      const innerBox = Box.text("Inner").pipe(Box.annotate(Ansi.red));
      const outerBox = Box.text("Outer").pipe(Box.annotate(Ansi.blue));

      const layout = Box.hcat([outerBox, innerBox as any], Box.top);
      const rendered = Box.renderPrettySync(layout);

      // Each box should maintain its own color
      expect(rendered).toContain("\x1b[34mOuter\x1b[0m"); // Red outer
      expect(rendered).toContain("\x1b[31mInner\x1b[0m"); // Blue inner
    });

    it("should not inherit parent annotations in complex layouts", () => {
      const parentBox = Box.vcat(
        [
          Box.text("Parent line 1"),
          Box.text("Parent line 2").pipe(Box.annotate(Ansi.bold)),
          Box.text("Parent line 3"),
        ],
        Box.left
      );

      const rendered = Box.renderPrettySync(parentBox);

      // Only the middle line should be bold
      const lines = rendered.split("\n");
      expect(lines[0]).toBe("Parent line 1");
      expect(lines[1]).toContain("\x1b[1mParent line 2\x1b[0m");
      expect(lines[2]).toBe("Parent line 3");
    });

    it("should handle annotation removal correctly", () => {
      const styledBox = Box.text("Styled text").pipe(
        Box.annotate(Ansi.magenta)
      );

      const unstyledBox = Box.unAnnotate(styledBox);
      const styledRendered = Box.renderPrettySync(styledBox);
      const unstyledRendered = Box.renderPrettySync(unstyledBox);

      expect(styledRendered).toContain("\x1b[35m"); // Magenta
      expect(unstyledRendered).toBe("Styled text"); // Plain text
      expect(unstyledBox.annotation).toBeUndefined();
    });
  });

  // ============================================================================
  // Complex Layout Integration
  // ============================================================================

  describe("Complex Layout Integration", () => {
    it("should handle the specification example layout correctly", () => {
      // From spec: Create complex layout with mixed styling
      const redBox = Box.text("red").pipe(Box.annotate(Ansi.red));

      const blueUnderlinedStyle = Ansi.combine(Ansi.blue, Ansi.underlined);

      const blueUnderlinedAnnotation = blueUnderlinedStyle;

      const innerLayout = Box.hsep(
        [
          Box.text("blue+u"),
          Box.text("bold").pipe(Box.annotate(Ansi.bold)),
          Box.text("blue+u"),
        ],
        1,
        Box.top
      ).pipe(Box.annotate(blueUnderlinedAnnotation));

      const layout = Box.hsep([redBox, innerLayout as any], 1, Box.top);
      const rendered = Box.renderPrettySync(layout);

      // Check that all styles are applied correctly
      expect(rendered).toContain("\x1b[31mred\x1b[0m"); // Red text
      expect(rendered).toContain("\x1b[34;4m"); // Blue underlined sections
      expect(rendered).toContain("\x1b[1mbold\x1b[0m"); // Bold text
    });

    it("should support punctuation with styled boxes", () => {
      const errorBox = Box.text("Error").pipe(Box.annotate(Ansi.red));

      const warningBox = Box.text("Warning").pipe(Box.annotate(Ansi.yellow));

      const infoBox = Box.text("Info").pipe(Box.annotate(Ansi.blue));

      const punctuatedLayout = Box.punctuateH(
        [errorBox, warningBox as any, infoBox as any],
        Box.top,
        Box.text(" | ")
      );

      const rendered = Box.renderPrettySync(punctuatedLayout);

      expect(rendered).toContain("\x1b[31mError\x1b[0m"); // Red
      expect(rendered).toContain("\x1b[33mWarning\x1b[0m"); // Yellow
      expect(rendered).toContain("\x1b[34mInfo\x1b[0m"); // Blue
      expect(rendered).toContain(" | "); // Separators
    });

    it("should handle vertical separation with styled content", () => {
      const headerBox = Box.text("HEADER").pipe(
        Box.annotate(Ansi.combine(Ansi.white, Ansi.bgBlack, Ansi.bold))
      );

      const contentBox = Box.text("Content goes here").pipe(
        Box.annotate(Ansi.green)
      );

      const footerBox = Box.text("Footer text").pipe(
        Box.annotate(Ansi.underlined)
      );

      const verticalLayout = Box.punctuateV(
        [headerBox, contentBox, footerBox],
        Box.left,
        Box.text("---")
      );

      const rendered = Box.renderPrettySync(verticalLayout);

      expect(rendered).toContain("\x1b[37;40;1mHEADER\x1b[0m"); // Header styling
      expect(rendered).toContain("\x1b[32mContent goes here\x1b[0m"); // Green content
      expect(rendered).toContain("\x1b[4mFooter text\x1b[0m"); // Underlined footer
    });
  });

  // ============================================================================
  // Error Handling and Edge Cases
  // ============================================================================

  describe("Error Handling and Edge Cases", () => {
    it("should handle annotation conflicts gracefully in complex scenarios", () => {
      // Create a box with conflicting annotations through transformation
      const initialBox = Box.text("Conflict test").pipe(Box.annotate(Ansi.red));

      const transformedBox = Box.reAnnotate(
        initialBox,
        (style) =>
          Ansi.combine(
            Annotation.createAnnotation(style), // Original red
            Ansi.blue, // Conflicting color
            Ansi.bold
          ).data
      );
      const rendered = Box.renderPrettySync(transformedBox);

      // Blue should win due to last-wins conflict resolution
      expect(rendered).toContain("\x1b[34;1m"); // Blue foreground + bold
      expect(rendered).not.toContain("\x1b[31m"); // Red should not appear
    });

    it("should handle empty boxes with ANSI annotations", () => {
      const emptyBox = Box.emptyBox(0, 0).pipe(Box.annotate(Ansi.cyan));

      const rendered = Box.renderPrettySync(emptyBox);
      expect(rendered).toBe(""); // Empty boxes should render empty
    });

    it("should preserve box dimensions when adding annotations", () => {
      const originalBox = Box.text("Multi\nLine\nContent");
      const annotatedBox = originalBox.pipe(Box.annotate(Ansi.bgYellow));

      expect(annotatedBox.rows).toBe(originalBox.rows);
      expect(annotatedBox.cols).toBe(originalBox.cols);

      const annotatedRendered = Box.renderPrettySync(annotatedBox);

      // Content should be preserved, just with ANSI codes added
      expect(annotatedRendered).toContain("Multi");
      expect(annotatedRendered).toContain("Line");
      expect(annotatedRendered).toContain("Content");
      expect(annotatedRendered).toContain("\x1b[43m"); // Yellow background
    });
  });
});
