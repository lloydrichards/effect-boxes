import { test } from "vitest";
import * as Box from "../src/Box";

for (const words of [1000, 2000, 4000]) {
  const text = Array<string>(words).fill("x").join(" ");
  for (const width of [80, text.length]) {
    test(`para with ${words} words at width ${width}`, async ({ bench }) => {
      await bench("construct paragraph", () =>
        Box.para(text, Box.left, width)
      ).run({
        time: 300,
      });
    });
  }
}
