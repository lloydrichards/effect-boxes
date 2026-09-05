/** biome-ignore-all lint/suspicious/noExplicitAny: Testing runtime rather than build */
import { describe, expect, it } from "vitest";
import * as Ansi from "../src/Ansi";
import * as Box from "../src/Box";

describe("Ansi Render Configuration", () => {
  describe("Aligned clipping", () => {
    it("should retain the rightmost columns in both renderers when right-aligned content is clipped", () => {
      const box = Box.alignHoriz(Box.text("abc"), Box.right, 2);

      expect(Box.renderPlainSync(box)).toBe("bc");
      expect(Box.renderPrettySync(box)).toBe("bc");
    });

    it("should preserve each center bias in both renderers when odd-width content is clipped", () => {
      const center1 = Box.alignHoriz(Box.text("abc"), Box.center1, 2);
      const center2 = Box.alignHoriz(Box.text("abc"), Box.center2, 2);

      expect(Box.renderPlainSync(center1)).toBe("bc");
      expect(Box.renderPrettySync(center1)).toBe("bc");
      expect(Box.renderPlainSync(center2)).toBe("ab");
      expect(Box.renderPrettySync(center2)).toBe("ab");
    });

    it("should retain the requested columns and ANSI style when aligned styled content is clipped", () => {
      const box = Box.alignHoriz(
        Box.text("abc").pipe(Box.annotate(Ansi.red)),
        Box.right,
        2
      );

      expect(Box.renderPrettySync(box)).toBe("\x1b[31mbc\x1b[0m");
    });
  });

  // ============================================================================
  // Pretty vs Plain Rendering (FR-011, FR-012)
  // ============================================================================

  describe("Pretty Rendering (Default)", () => {
    it("should include ANSI escape codes with pretty configuration", () => {
      const styledBox = Box.text("Red text").pipe(Box.annotate(Ansi.red));

      // Pretty rendering should include ANSI codes
      const rendered = Box.renderPrettySync(styledBox);
      expect(rendered).toContain("\u001b[31m"); // Red foreground
      expect(rendered).toContain("\u001b[0m"); // Reset
      expect(rendered).toBe("\u001b[31mRed text\u001b[0m");
    });

    it("should include ANSI codes for combined styles with pretty rendering", () => {
      const styledBox = Box.text("Styled").pipe(
        Box.annotate(Ansi.combine(Ansi.blue, Ansi.bgYellow, Ansi.bold))
      );

      const rendered = Box.renderPrettySync(styledBox);
      expect(rendered).toContain("\u001b[34;43;1m"); // Blue fg, yellow bg, bold
      expect(rendered).toContain("\u001b[0m"); // Reset
      expect(rendered).toBe("\u001b[34;43;1mStyled\u001b[0m");
    });

    it("should render layout structure correctly (current implementation)", () => {
      const redBox = Box.text("Error").pipe(Box.annotate(Ansi.red));
      const greenBox = Box.text("Success").pipe(Box.annotate(Ansi.green));
      const layout = Box.hsep([redBox, greenBox], 1, Box.top);

      const rendered = Box.renderPrettySync(layout);
      expect(rendered).toContain("\u001b[31mError\u001b[0m");
      expect(rendered).toContain("\u001b[32mSuccess\u001b[0m");
    });
  });

  describe("Plain Rendering (Future Implementation)", () => {
    it("should exclude ANSI codes with plain configuration", () => {
      const styledBox = Box.text("Yellow text").pipe(Box.annotate(Ansi.yellow));

      // This test will work when Box.renderPrettySyncPlain or Box.renderPrettySync with config is implemented
      // For now, we test the expected behavior conceptually
      const prettyActual = Box.renderPrettySync(styledBox);

      // Verify that pretty rendering has ANSI codes
      expect(prettyActual).toContain("\x1b[33m");
      expect(prettyActual).toContain("\x1b[0m");

      // When plain rendering is implemented, it should exclude ANSI codes:
      const plainExpected = "Yellow text";
      expect(Box.renderPlainSync(styledBox)).toBe(plainExpected);
    });

    it("should exclude all ANSI codes from complex layouts with plain rendering", () => {
      const styledBox = Box.text("Bold text").pipe(Box.annotate(Ansi.bold));
      const plainBox = Box.text("Normal text");
      const layout = Box.vcat([styledBox as any, plainBox as any], Box.left);

      const prettyRendered = Box.renderPrettySync(layout);
      expect(prettyRendered).toContain("\x1b[1m"); // Bold code
      expect(prettyRendered).toContain("\x1b[0m"); // Reset code

      const plainRendered = Box.renderPlainSync(layout);
      expect(plainRendered).toBe("Bold text  \nNormal text");
      expect(plainRendered).not.toContain("\x1b[");
    });

    it("should handle mixed styled content with plain configuration", () => {
      const styledBox = Box.text("Complex styling").pipe(
        Box.annotate(Ansi.combine(Ansi.magenta, Ansi.cyan, Ansi.underlined))
      );

      const prettyRendered = Box.renderPrettySync(styledBox);
      expect(prettyRendered).toContain("\x1b[36;4m"); // Cyan foreground (wins over magenta) + underlined
      expect(prettyRendered).toContain("\x1b[0m");

      const plainRendered = Box.renderPlainSync(styledBox);
      expect(plainRendered).toBe("Complex styling");
    });
  });

  // ============================================================================
  // Conditional Styling Patterns
  // ============================================================================

  describe("Conditional Styling Patterns", () => {
    it("should support conditional styling based on environment", () => {
      const testColorTerminal = (isColorSupported: boolean) => {
        const messageBox = Box.text("Status message");

        const finalBox = isColorSupported
          ? messageBox.pipe(Box.annotate(Ansi.green))
          : messageBox;

        return Box.renderPrettySync(finalBox);
      };

      // Test with color support
      const colorRendered = testColorTerminal(true);
      expect(colorRendered).toContain("\x1b[32m");
      expect(colorRendered).toContain("\x1b[0m");

      // Test without color support
      const plainRendered = testColorTerminal(false);
      expect(plainRendered).toBe("Status message");
    });

    it("should handle error/success/warning message patterns", () => {
      const createError = (msg: string) =>
        Box.text(`❌ ${msg}`).pipe(Box.annotate(Ansi.red));

      const createSuccess = (msg: string) =>
        Box.text(`✅ ${msg}`).pipe(Box.annotate(Ansi.green));

      const createWarning = (msg: string) =>
        Box.text(`⚠️ ${msg}`).pipe(Box.annotate(Ansi.yellow));

      const errorBox = createError("Something went wrong");
      const successBox = createSuccess("Operation completed");
      const warningBox = createWarning("Check this out");

      const errorRendered = Box.renderPrettySync(errorBox);
      const successRendered = Box.renderPrettySync(successBox);
      const warningRendered = Box.renderPrettySync(warningBox);

      expect(errorRendered).toContain("\x1b[31m"); // Red
      expect(successRendered).toContain("\x1b[32m"); // Green
      expect(warningRendered).toContain("\x1b[33m"); // Yellow

      expect(errorRendered).toContain("❌ Something went wrong");
      expect(successRendered).toContain("✅ Operation completed");
      expect(warningRendered).toContain("⚠️ Check this out");
    });

    it("should support highlighted sections pattern", () => {
      const highlightBackground = (content: any) =>
        content.pipe(Box.annotate(Ansi.combine(Ansi.bgBlue, Ansi.white)));

      const codeBlock = (code: string) =>
        Box.text(code).pipe(
          Box.annotate(Ansi.combine(Ansi.cyan, Ansi.bgBlack))
        );

      const highlightedBox = highlightBackground(Box.text("Important"));
      const codeBox = codeBlock("console.log('hello')");

      const highlightRendered = Box.renderPrettySync(highlightedBox);
      const codeRendered = Box.renderPrettySync(codeBox);

      expect(highlightRendered).toContain("\x1b[44;37m"); // Blue bg, white fg
      expect(codeRendered).toContain("\x1b[36;40m"); // Cyan fg, black bg
    });
  });

  // ============================================================================
  // Performance and Edge Cases
  // ============================================================================

  describe("Performance and Edge Cases", () => {
    it("should handle large layouts with multiple styled boxes efficiently", () => {
      const colors = [Ansi.red, Ansi.green, Ansi.blue, Ansi.yellow] as const;
      const getColor = (index: number) => colors[index % colors.length];

      const styledBoxes = Array.from({ length: 100 }, (_, i) => {
        const color = getColor(i);
        return Box.text(`Item ${i}`).pipe(Box.annotate(color || Ansi.red));
      });

      const layout = Box.vcat(styledBoxes as any, Box.left);
      const start = Date.now();
      const rendered = Box.renderPrettySync(layout);
      const duration = Date.now() - start;

      expect(rendered).toContain("Item 0");
      expect(rendered).toContain("Item 99");
      expect(rendered).toContain("\x1b[31m"); // Red codes
      expect(rendered).toContain("\x1b[32m"); // Green codes
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle nested box structures with mixed annotations", () => {
      const innerBox = Box.text("Inner").pipe(Box.annotate(Ansi.bold));

      const outerBox = Box.text("Outer").pipe(Box.annotate(Ansi.magenta));

      const nestedLayout = Box.hcat([outerBox, innerBox as any], Box.center1);
      const rendered = Box.renderPrettySync(nestedLayout);

      expect(rendered).toContain("\x1b[35m"); // Magenta for outer
      expect(rendered).toContain("\x1b[1m"); // Bold for inner
      expect(rendered).toContain("Outer");
      expect(rendered).toContain("Inner");
    });

    it("should handle empty and whitespace content with ANSI annotations", () => {
      const emptyBox = Box.text("").pipe(Box.annotate(Ansi.red));

      const whitespaceBox = Box.text("   ").pipe(Box.annotate(Ansi.bgYellow));

      const emptyRendered = Box.renderPrettySync(emptyBox);
      const whitespaceRendered = Box.renderPrettySync(whitespaceBox);

      // Empty content should render empty
      expect(emptyRendered).toBe("");

      // Whitespace content should apply ANSI styling
      expect(whitespaceRendered).toContain("\x1b[43m");
      expect(whitespaceRendered).toContain("\x1b[0m");
    });
  });
});
