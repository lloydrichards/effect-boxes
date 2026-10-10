---
"effect-boxes": minor
---

Add `Place.make`, `Place.horizontal`, and `Place.vertical` to `effect-boxes/Layout` for bounded positioning with numeric offsets or edge/center anchors. The helpers return ordinary Boxes, clip to exact dimensions, preserve visible annotations, and support pipe composition.

```ts
const placed = Box.text("Hello").pipe(
  Place.make({ width: 20, height: 4, x: "center", y: "bottom" })
);
```

Dimensions must be non-negative safe integers and numeric offsets must be safe integers. Invalid values and command annotations throw `RangeError`.

Use `Place.makeResult` to receive a typed `LayoutValidationError` instead of throwing on invalid input or command annotations.
