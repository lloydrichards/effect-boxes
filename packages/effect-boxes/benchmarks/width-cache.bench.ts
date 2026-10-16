import { describe, test } from "vitest";
import * as Box from "../src/Box";
import * as Width from "../src/internal/width";

const batchSize = 100;

for (const content of ["status", "状態 👩‍💻 é", "\x1b[32mstatus\x1b[0m"]) {
  describe(`width cache: ${JSON.stringify(content)}`, () => {
    for (const operation of ["width", "segments", "render"] as const) {
      const run = (text: string): unknown => {
        switch (operation) {
          case "width":
            return Width.ofString(text);
          case "segments":
            return Width.segments(text);
          case "render":
            return Box.renderPlainSync(Box.text(text));
        }
      };

      test(`${operation}: repeated text, ${batchSize} calls`, async ({
        bench,
      }) => {
        const text = `${content} 0`;
        run(text);
        await bench("repeated", () => {
          for (let index = 0; index < batchSize; index++) {
            run(text);
          }
        }).run({ time: 100 });
      });

      test(`${operation}: changing text, ${batchSize} calls`, async ({
        bench,
      }) => {
        let sequence = 0;
        // Keep advancing during warmup and sampling so these remain cache misses.
        await bench("changing", () => {
          for (let index = 0; index < batchSize; index++) {
            run(`${content} ${operation} ${sequence++}`);
          }
        }).run({ time: 100 });
      });

      for (const workingSetSize of [1023, 1024, 1025]) {
        test(`${operation}: rotating ${workingSetSize} strings, ${batchSize} calls`, async ({
          bench,
        }) => {
          const texts = Array.from(
            { length: workingSetSize },
            (_, index) =>
              `${content} ${operation} rotating ${workingSetSize} ${index}`
          );
          for (const text of texts) {
            run(text);
          }
          let sequence = 0;
          // Preserve the cycle across samples to expose eviction above capacity.
          await bench(`rotating ${workingSetSize}`, () => {
            for (let index = 0; index < batchSize; index++) {
              const text = texts[sequence % workingSetSize];
              if (text !== undefined) {
                run(text);
              }
              sequence++;
            }
          }).run({ time: 100 });
        });
      }
    }
  });
}
