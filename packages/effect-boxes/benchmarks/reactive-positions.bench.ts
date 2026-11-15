import { HashMap, Option } from "effect";
import { expect, test } from "vitest";
import * as Box from "../src/Box";
import * as Reactive from "../src/Reactive";

for (const width of [80, 160, 1280]) {
  const view = Box.hcat(
    [Box.emptyBox(24, width - 1), Reactive.makeReactive(Box.line("x"), "x")],
    Box.top
  );

  test(`getPositions on ${width}x24 box with one reactive ID`, async ({
    bench,
  }) => {
    expect(HashMap.get(Reactive.getPositions(view), "x")).toEqual(
      Option.some({ row: 0, col: width - 1, rows: 1, cols: 1 })
    );
    await bench("getPositions", () => Reactive.getPositions(view)).run({
      time: 300,
    });
  });
}
