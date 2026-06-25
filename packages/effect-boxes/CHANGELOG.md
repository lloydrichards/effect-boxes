# effect-boxes

## 0.17.0

### Minor Changes

- [#90](https://github.com/lloydrichards/effect-boxes/pull/90) [`880f102`](https://github.com/lloydrichards/effect-boxes/commit/880f10274945e18b2d2bea813cb834afd5359433) Thanks [@lloydrichards](https://github.com/lloydrichards)! - add `Box.cropWidth` and `Box.cropHeight` for viewport-style cropping.

  Transformer that allow callers to crop boxes from an arbitrary horizontal or vertical offset, making it possible to render scrollable 2D viewports without pre-rendering to strings.

### Patch Changes

- [#88](https://github.com/lloydrichards/effect-boxes/pull/88) [`b1f5abb`](https://github.com/lloydrichards/effect-boxes/commit/b1f5abbd91da3f3f2da17e5de1db8627c3aeaaaa) Thanks [@lloydrichards](https://github.com/lloydrichards)! - fix `Box.truncate` stack overflow when truncating wide row layouts.

## 0.16.1

### Patch Changes

- [#81](https://github.com/lloydrichards/effect-boxes/pull/81) [`9410bcb`](https://github.com/lloydrichards/effect-boxes/commit/9410bcbbd99e6cc15152f8864c21c8bd0b6d5dbc) Thanks [@lloydrichards](https://github.com/lloydrichards)! - correctly export the Layout module for esm builds

- [#79](https://github.com/lloydrichards/effect-boxes/pull/79) [`29b3a3f`](https://github.com/lloydrichards/effect-boxes/commit/29b3a3fea479db540afbf9d4cf13e4a0f6ee3d0b) Thanks [@lloydrichards](https://github.com/lloydrichards)! - Pass an explicit `undefined` to `render` when rendering a box to align with the updated `render` function signature and avoid type/runtime inconsistencies.
