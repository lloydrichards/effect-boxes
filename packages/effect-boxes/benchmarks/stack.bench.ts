import { Effect } from "effect";
import { describe, test } from "vitest";
import * as Ansi from "../src/Ansi";
import * as Box from "../src/Box";
import * as FrameEncoder from "../src/FrameEncoder";
import { Layer, Stack } from "../src/Layout";
import * as Reactive from "../src/Reactive";
import * as Renderer from "../src/Renderer";

for (const { width, height } of [
  { width: 80, height: 24 },
  { width: 160, height: 48 },
]) {
  for (const count of [1, 10, 50]) {
    const layers = Array.from({ length: count }, (_, index) => {
      const styled = Box.text(`Panel ${index}\n界 é\nDetails`).pipe(
        Box.pad(1, 2),
        Box.border("rounded"),
        Box.annotate(index % 2 === 0 ? Ansi.blue : Ansi.green)
      );
      const panel = Box.hcat([styled], Box.top).pipe(
        Reactive.makeReactive(`panel-${index}`)
      );
      return Layer.make(panel, {
        x: (index * 3) % (width - 8),
        y: (index * 2) % (height - 4),
        z: index,
      });
    });
    const stack = Stack.make(layers, { width, height });
    const resolved = Effect.runSync(Renderer.resolve(stack));
    const encoding = Renderer.encode(resolved, {
      preserveWhitespace: true,
    }).pipe(Effect.provide(FrameEncoder.AnsiFrameEncoderLive));
    describe(`${width}x${height}, ${count} opaque panels`, () => {
      test("resolve geometry, style, and regions", async ({ bench }) => {
        await bench("resolve", () =>
          Effect.runSync(Renderer.resolve(stack))
        ).run({
          time: 300,
        });
      });
      test("encode the resolved ANSI frame", async ({ bench }) => {
        await bench("encode", () => Effect.runSync(encoding)).run({
          time: 300,
        });
      });
    });
  }
}
