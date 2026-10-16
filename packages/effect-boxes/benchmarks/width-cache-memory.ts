/** biome-ignore-all lint/suspicious/noConsole: Standalone memory measurement. */
import * as Box from "../src/Box";
import * as Width from "../src/internal/width";

const mode = process.argv[2] ?? "changing";
if (mode !== "changing" && mode !== "repeated") {
  throw new Error("Use changing or repeated");
}
if (typeof globalThis.gc !== "function") {
  throw new Error("Run with node --expose-gc --import tsx");
}

// Warm the renderer and Effect runtime before measuring retained text.
for (let index = 0; index < 1000; index++) {
  Box.renderPlainSync(Box.text("status warmup"));
}

const samples: { strings: number; heapUsed: number }[] = [];
for (let batch = 0; batch <= 4; batch++) {
  if (batch > 0) {
    for (let index = 0; index < 25_000; index++) {
      const sequence = mode === "changing" ? (batch - 1) * 25_000 + index : 0;
      Box.renderPlainSync(Box.text(`status ${sequence}`));
    }
  }
  globalThis.gc();
  samples.push({
    strings: batch * 25_000,
    heapUsed: process.memoryUsage().heapUsed,
  });
}

// Keep the module and its cache closures live through the final collection.
console.log(
  JSON.stringify({ runtime: process.version, mode, samples }, null, 2)
);
console.log("width sanity check:", Width.ofString("status 0"));
