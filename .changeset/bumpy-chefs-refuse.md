---
"effect-boxes": minor
---

`Layer.make` and `Stack.make` now support opaque overlapping Boxes at the frame boundary, with plain and ANSI output through `Renderer.frame`.

Resolve once with `Renderer.resolve`, then encode the same snapshot with `Renderer.encode`. Custom backends can register a companion `FrameEncoder` without changing their existing Renderer implementation.

`Reactive.getRegion` exposes every occurrence and visible fragment, and `Reactive.hitTest` queries final opaque ownership on that snapshot.

```ts
import { Layer, Stack } from "effect-boxes/Layout";
import * as Box from "effect-boxes/Box";
import * as Renderer from "effect-boxes/Renderer";

const stack = Stack.make(
  [
    Layer.make(Box.text("Background")),
    Layer.make(Box.text("Popup"), { x: 2, z: 1 }),
  ],
  { width: 20, height: 4 }
);
const frame = Renderer.frame(stack, { preserveWhitespace: true });
```
