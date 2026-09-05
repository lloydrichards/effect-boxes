import { describe, expect, it } from "vitest";
import * as Box from "../src/Box";

describe("cropping aligned boxes", () => {
  it("should retain right-aligned content when the horizontal crop selects it", () => {
    const box = Box.alignHoriz(Box.text("abc"), Box.right, 6);
    const cropped = Box.cropWidth(box, 3, 3);

    expect(Box.renderPlainSync(box)).toBe("   abc");
    expect(Box.renderPlainSync(cropped)).toBe("abc");
  });

  it("should retain bottom-aligned content when the vertical crop selects it", () => {
    const box = Box.moveDown(Box.text("abc"), 2);
    const cropped = Box.cropHeight(box, 2, 1);

    expect(Box.renderPlainSync(box)).toBe("   \n   \nabc");
    expect(Box.renderPlainSync(cropped)).toBe("abc");
  });

  it("should preserve the selected padding around centered content", () => {
    const box = Box.alignHoriz(Box.text("abcd"), Box.center1, 10);
    const cropped = Box.cropWidth(box, 0, 8);

    expect(Box.renderPlainSync(box)).toBe("   abcd   ");
    expect(Box.renderPlainSync(cropped)).toBe("   abcd ");
  });

  it("should crop the visible portion when centered content is already clipped", () => {
    const box = Box.alignHoriz(Box.text("abcdef"), Box.center1, 3);
    const cropped = Box.cropWidth(box, 1, 1);

    expect(Box.renderPlainSync(box)).toBe("bcd");
    expect(Box.renderPlainSync(cropped)).toBe("c");
  });
});
