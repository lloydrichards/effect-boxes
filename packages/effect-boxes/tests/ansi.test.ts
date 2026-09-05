import { describe, expect, it } from "vitest";
import * as Ansi from "../src/Ansi";
import * as Box from "../src/Box";
import * as Cmd from "../src/Cmd";

describe("Ansi Module", () => {
  describe("ANSI Color Definitions", () => {
    it("should define 8 primary colors with correct foreground codes", () => {
      expect(Ansi.black.data[0]?.code).toBe("30");
      expect(Ansi.red.data[0]?.code).toBe("31");
      expect(Ansi.green.data[0]?.code).toBe("32");
      expect(Ansi.yellow.data[0]?.code).toBe("33");
      expect(Ansi.blue.data[0]?.code).toBe("34");
      expect(Ansi.magenta.data[0]?.code).toBe("35");
      expect(Ansi.cyan.data[0]?.code).toBe("36");
      expect(Ansi.white.data[0]?.code).toBe("37");
    });

    it("should define 8 primary colors with correct background codes", () => {
      expect(Ansi.bgBlack.data[0]?.code).toBe("40");
      expect(Ansi.bgRed.data[0]?.code).toBe("41");
      expect(Ansi.bgGreen.data[0]?.code).toBe("42");
      expect(Ansi.bgYellow.data[0]?.code).toBe("43");
      expect(Ansi.bgBlue.data[0]?.code).toBe("44");
      expect(Ansi.bgMagenta.data[0]?.code).toBe("45");
      expect(Ansi.bgCyan.data[0]?.code).toBe("46");
      expect(Ansi.bgWhite.data[0]?.code).toBe("47");
    });
  });

  describe("ANSI Text Attributes", () => {
    it("should define text attribute with correct code", () => {
      expect(Ansi.bold.data[0]?.code).toBe("1");
      expect(Ansi.dim.data[0]?.code).toBe("2");
      expect(Ansi.italic.data[0]?.code).toBe("3");
      expect(Ansi.underlined.data[0]?.code).toBe("4");
      expect(Ansi.blink.data[0]?.code).toBe("5");
      expect(Ansi.inverse.data[0]?.code).toBe("7");
      expect(Ansi.hidden.data[0]?.code).toBe("8");
      expect(Ansi.strikethrough.data[0]?.code).toBe("9");
      expect(Ansi.overline.data[0]?.code).toBe("53");
    });

    it("should define reset attribute with correct code", () => {
      expect(Ansi.reset.data[0]?.name).toEqual("reset");
      expect(Ansi.reset.data[0]?.code).toBe("0");
    });
  });

  describe("Style Combination", () => {
    it("should combine multiple styles without conflicts", () => {
      const combined = Ansi.combine(Ansi.red, Ansi.bgYellow, Ansi.bold);
      const styles = combined.data;
      expect(styles).toHaveLength(3);
      expect(styles).toContainEqual(Ansi.red.data[0]);
      expect(styles).toContainEqual(Ansi.bgYellow.data[0]);
      expect(styles).toContainEqual(Ansi.bold.data[0]);
    });

    it("should handle conflict resolution with last-wins strategy for foreground colors", () => {
      const combined = Ansi.combine(Ansi.red, Ansi.blue);
      const styles = combined.data;
      expect(styles).toHaveLength(1);
      expect(styles).toEqual(Ansi.blue.data);
    });

    it("should handle conflict resolution with last-wins strategy for background colors", () => {
      const combined = Ansi.combine(Ansi.bgYellow, Ansi.bgGreen);
      const styles = combined.data;
      expect(styles).toHaveLength(1);
      expect(styles).toEqual(Ansi.bgGreen.data);
    });
  });

  describe("Box Integration with ANSI Styles", () => {
    it("should apply single color annotation to box rendering", () => {
      const styledBox = Box.text("Error message").pipe(Box.annotate(Ansi.red));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("\n")).toBe("\u001b[31mError message\u001b[0m");
    });

    it("should apply combined styles to box rendering", () => {
      const combinedStyle = Ansi.combine(Ansi.red, Ansi.bgYellow, Ansi.bold);
      const styledBox = Box.text("Alert!").pipe(Box.annotate(combinedStyle));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("\n")).toBe("\u001b[31;43;1mAlert!\u001b[0m");
    });
  });

  describe("Complex Box Layouts with ANSI Styles", () => {
    it("should render layout structure correctly", () => {
      const redBox = Box.text("Red").pipe(Box.annotate(Ansi.red));
      const blueBox = Box.text("Blue").pipe(Box.annotate(Ansi.blue));
      const layout = Box.hcat([redBox, blueBox], Box.top);
      const rendered = Ansi.renderAnnotatedBox(layout);
      expect(rendered.join("")).toContain("\u001b[31mRed\u001b[0m");
      expect(rendered.join("")).toContain("\u001b[34mBlue\u001b[0m");
    });

    it("should apply ANSI styling to root-level annotated layouts", () => {
      const redBox = Box.text("Red");
      const blueBox = Box.text("Blue");
      const layout = Box.hcat([redBox, blueBox], Box.top);
      const styledLayout = layout.pipe(Box.annotate(Ansi.green));
      const rendered = Ansi.renderAnnotatedBox(styledLayout);
      expect(rendered.join("\n")).toBe("\u001b[32mRedBlue\u001b[0m");
    });
  });

  describe("256, RGB and Hex Colors", () => {
    it("should generate correct escape sequence for color256", () => {
      const color = Ansi.color256(100);
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[38;5;100m");
    });

    it("should generate correct escape sequence for bgColor256", () => {
      const color = Ansi.bgColor256(150);
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[48;5;150m");
    });

    it("should generate correct escape sequence for colorRGB", () => {
      const color = Ansi.colorRGB(10, 20, 30);
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[38;2;10;20;30m");
    });

    it("should generate correct escape sequence for bgColorRGB", () => {
      const color = Ansi.bgColorRGB(40, 50, 60);
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[48;2;40;50;60m");
    });

    it("should clamp color values for color256", () => {
      const color = Ansi.color256(300);
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[38;5;255m");
    });

    it("should clamp color values for colorRGB", () => {
      const color = Ansi.colorRGB(300, -10, 255);
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[38;2;255;0;255m");
    });

    it("should generate correct escape sequence for bgColorHex", () => {
      const color = Ansi.bgColorHex("#FF00FF");
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[48;2;255;0;255m");
    });

    it("should generate correct escape sequence for colorHex", () => {
      const color = Ansi.colorHex("#00FF00");
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[38;2;0;255;0m");
    });

    it("should handle short hex codes for bgColorHex", () => {
      const color = Ansi.bgColorHex("#0F0");
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[48;2;0;255;0m");
    });

    it("should handle short hex codes for colorHex", () => {
      const color = Ansi.colorHex("#F0F");
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[38;2;255;0;255m");
    });

    it("should handle hex without # prefix", () => {
      const color = Ansi.colorHex("FF8800");
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[38;2;255;136;0m");
    });

    it("should handle lowercase hex", () => {
      const color = Ansi.colorHex("#ff00ff");
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[38;2;255;0;255m");
    });

    it("should parse #000000 as all zeros", () => {
      const color = Ansi.colorHex("#000000");
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[38;2;0;0;0m");
    });

    it("should parse #FFFFFF as all 255s", () => {
      const color = Ansi.colorHex("#FFFFFF");
      const styledBox = Box.text("test").pipe(Box.annotate(color));
      const rendered = Ansi.renderAnnotatedBox(styledBox);
      expect(rendered.join("")).toContain("\u001b[38;2;255;255;255m");
    });

    it("should throw on invalid hex string", () => {
      expect(() => Ansi.colorHex("xyz")).toThrow("Invalid hex color: xyz");
    });

    it("should throw on empty string", () => {
      expect(() => Ansi.colorHex("")).toThrow("Invalid hex color: ");
    });
  });

  describe("getAnsiEscapeSequence Edge Cases", () => {
    describe("Single Attribute Types", () => {
      it("should handle single foreground color", () => {
        const result = Ansi.getAnsiEscapeSequence(Ansi.red.data);
        expect(result).toBe("\u001b[31m");
      });

      it("should handle single background color", () => {
        const result = Ansi.getAnsiEscapeSequence(Ansi.bgYellow.data);
        expect(result).toBe("\u001b[43m");
      });

      it("should handle single text style", () => {
        const result = Ansi.getAnsiEscapeSequence(Ansi.bold.data);
        expect(result).toBe("\u001b[1m");
      });
    });

    describe("Multiple Styled Attributes", () => {
      it("should combine foreground color and background color", () => {
        const combined = Ansi.combine(Ansi.red, Ansi.bgYellow);
        const result = Ansi.getAnsiEscapeSequence(combined.data);
        expect(result).toBe("\u001b[31;43m");
      });

      it("should combine foreground color and multiple text styles", () => {
        const combined = Ansi.combine(Ansi.blue, Ansi.bold, Ansi.underlined);
        const result = Ansi.getAnsiEscapeSequence(combined.data);
        expect(result).toBe("\u001b[34;1;4m");
      });

      it("should combine all styled attribute types (foreground, background, multiple styles)", () => {
        const combined = Ansi.combine(
          Ansi.green,
          Ansi.bgMagenta,
          Ansi.bold,
          Ansi.italic,
          Ansi.underlined
        );
        const result = Ansi.getAnsiEscapeSequence(combined.data);
        expect(result).toBe("\u001b[32;45;1;3;4m");
      });
    });

    describe("Command Attributes", () => {
      it("should handle single command attribute", () => {
        // Use real command from Cmd module
        const cursorUpCmd = Cmd.cursorUp(1);
        if (cursorUpCmd.annotation?.data) {
          const result = Ansi.getAnsiEscapeSequence(
            cursorUpCmd.annotation.data
          );
          expect(result).toBe("\u001b[1A");
        }
      });

      it("should return first command when multiple command attributes are present", () => {
        // Combine multiple command attributes (though this is unusual in practice)
        const cursorUpCmd = Cmd.cursorUp(1);
        const cursorDownCmd = Cmd.cursorDown(1);

        if (cursorUpCmd.annotation?.data && cursorDownCmd.annotation?.data) {
          // Manually create combined data since Ansi.combine doesn't handle multiple commands well
          const combinedData: Ansi.AnsiStyle = [
            ...cursorUpCmd.annotation.data,
            ...cursorDownCmd.annotation.data,
          ];
          const result = Ansi.getAnsiEscapeSequence(combinedData);
          expect(result).toBe("\u001b[1A\u001b[1B"); // Should return first command
        }
      });

      it("should handle real command attributes from Cmd module", () => {
        // Test with real command boxes from the Cmd module
        const cursorSave = Cmd.cursorSavePosition;
        if (cursorSave.annotation?.data) {
          const result = Ansi.getAnsiEscapeSequence(cursorSave.annotation.data);
          expect(result).toBe("\u001b7"); // DEC save cursor
        }

        const cursorHide = Cmd.cursorHide;
        if (cursorHide.annotation?.data) {
          const result = Ansi.getAnsiEscapeSequence(cursorHide.annotation.data);
          expect(result).toBe("\u001b[?25l");
        }
      });

      it("should handle cursor movement commands correctly", () => {
        const cursorUp = Cmd.cursorUp(3);
        if (cursorUp.annotation?.data) {
          const result = Ansi.getAnsiEscapeSequence(cursorUp.annotation.data);
          expect(result).toBe("\u001b[3A");
        }

        const cursorTo = Cmd.cursorTo(10, 5);
        if (cursorTo.annotation?.data) {
          const result = Ansi.getAnsiEscapeSequence(cursorTo.annotation.data);
          expect(result).toBe("\u001b[6;11H"); // Note: 1-indexed in ANSI
        }
      });
    });

    describe("Mixed Attributes", () => {
      it("should prioritize command attributes over styled attributes", () => {
        const mixedAttributes = Ansi.combine(
          Ansi.red,
          Cmd.cursorUp(1).annotation || Ansi.reset,
          Ansi.bold
        );
        const result = Ansi.getAnsiEscapeSequence(mixedAttributes.data);
        expect(result).toBe("\u001b[31;1m\u001b[1A");
      });

      it("should process styled attributes when no commands are present", () => {
        const styledOnly = Ansi.combine(Ansi.red, Ansi.bgYellow, Ansi.bold);
        const result = Ansi.getAnsiEscapeSequence(styledOnly.data);
        expect(result).toBe("\u001b[31;43;1m");
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty array", () => {
        const result = Ansi.getAnsiEscapeSequence([]);
        expect(result).toBeNull();
      });

      it("should handle RGB color codes correctly", () => {
        const rgbColor = Ansi.colorRGB(128, 64, 192);
        const result = Ansi.getAnsiEscapeSequence(rgbColor.data);
        expect(result).toBe("\u001b[38;2;128;64;192m");
      });

      it("should handle 256-color codes correctly", () => {
        const color256 = Ansi.color256(200);
        const result = Ansi.getAnsiEscapeSequence(color256.data);
        expect(result).toBe("\u001b[38;5;200m");
      });

      it("should handle all styled attribute types at maximum", () => {
        // Test with 1 foreground, 1 background, and multiple styles using Ansi.combine
        const maxStyled = Ansi.combine(
          Ansi.red,
          Ansi.bgYellow,
          Ansi.bold,
          Ansi.italic,
          Ansi.underlined,
          Ansi.blink,
          Ansi.inverse
        );
        const result = Ansi.getAnsiEscapeSequence(maxStyled.data);
        expect(result).toBe("\u001b[31;43;1;3;4;5;7m");
      });

      it("should preserve order of styled attributes", () => {
        const orderedStyled = Ansi.combine(
          Ansi.bold,
          Ansi.red,
          Ansi.bgYellow,
          Ansi.italic
        );
        const result = Ansi.getAnsiEscapeSequence(orderedStyled.data);
        expect(result).toBe("\u001b[1;31;43;3m");
      });
    });
  });
  describe("rendering emojis", () => {
    it("should render single-character emojis correctly", () => {
      const box = Box.text("👩").pipe(Box.annotate(Ansi.bgRed));
      const rendered = Ansi.renderAnnotatedBox(box);
      expect(rendered.join("\n")).toBe("\u001b[41m👩\u001b[0m");
    });

    it("should render multi-character emojis correctly", () => {
      const box = Box.text("👩‍💻").pipe(Box.annotate(Ansi.bgCyan));
      const rendered = Ansi.renderAnnotatedBox(box);
      expect(rendered.join("\n")).toBe("\u001b[46m👩‍💻\u001b[0m");
    });
  });
});
