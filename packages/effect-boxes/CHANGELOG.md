# effect-boxes

## 0.17.2

### Patch Changes

- [#121](https://github.com/lloydrichards/effect-boxes/pull/121) [`8fa41b2`](https://github.com/lloydrichards/effect-boxes/commit/8fa41b254972950faf50838d0c1f0c407e377923) Thanks [@lloydrichards](https://github.com/lloydrichards)! - ANSI rendering now preserves horizontal alignment when clipping content to a narrower width ([#100](https://github.com/lloydrichards/effect-boxes/issues/100)).

- [#126](https://github.com/lloydrichards/effect-boxes/pull/126) [`cd18f2a`](https://github.com/lloydrichards/effect-boxes/commit/cd18f2add9f556ceca715ef77da11ce04fcd36d5) Thanks [@lloydrichards](https://github.com/lloydrichards)! - Box rendering and width constraints now keep CJK text, emoji, and combining graphemes within their declared terminal columns ([#96](https://github.com/lloydrichards/effect-boxes/issues/96)).

- [#118](https://github.com/lloydrichards/effect-boxes/pull/118) [`51e2ede`](https://github.com/lloydrichards/effect-boxes/commit/51e2ede46a500e938c6245b3cef470deab3f6bdf) Thanks [@lloydrichards](https://github.com/lloydrichards)! - Box.unAnnotate now removes annotations from nested layouts.

- [#110](https://github.com/lloydrichards/effect-boxes/pull/110) [`071aae2`](https://github.com/lloydrichards/effect-boxes/commit/071aae25752dfa320168d1144284e1726b88dfcb) Thanks [@lloydrichards](https://github.com/lloydrichards)! - Flexible layout children now receive zero space when fixed content exhausts the available size.

- [#117](https://github.com/lloydrichards/effect-boxes/pull/117) [`62536dd`](https://github.com/lloydrichards/effect-boxes/commit/62536dde1b40d2d93d480782a762ed340608c626) Thanks [@lloydrichards](https://github.com/lloydrichards)! - Box text and character constructors now preserve complete grapheme sequences such as joined emoji.

- [#113](https://github.com/lloydrichards/effect-boxes/pull/113) [`fb07cfe`](https://github.com/lloydrichards/effect-boxes/commit/fb07cfef4dadef8d27a3ffaefe43abd1a9ddb147) Thanks [@lloydrichards](https://github.com/lloydrichards)! - Optional data-first Box and Renderer calls now return their declared results when options are omitted.

- [#114](https://github.com/lloydrichards/effect-boxes/pull/114) [`b58ba07`](https://github.com/lloydrichards/effect-boxes/commit/b58ba07b8d9c9b54042324beda8f9a82788eb024) Thanks [@lloydrichards](https://github.com/lloydrichards)! - Preformatted HTML output now preserves blank content lines.

- [#112](https://github.com/lloydrichards/effect-boxes/pull/112) [`0325be2`](https://github.com/lloydrichards/effect-boxes/commit/0325be2a25c462cbb37e033a459afb70efb6a3d6) Thanks [@lloydrichards](https://github.com/lloydrichards)! - Published declarations now pass strict NodeNext type checking.

- [#122](https://github.com/lloydrichards/effect-boxes/pull/122) [`a93efc3`](https://github.com/lloydrichards/effect-boxes/commit/a93efc3298b608f3212d75edd9b369268dd8e0f9) Thanks [@lloydrichards](https://github.com/lloydrichards)! - `Annotation.empty` now exposes its actual `undefined` data type instead of being assignable to annotations containing other data ([#102](https://github.com/lloydrichards/effect-boxes/issues/102)).

- [#125](https://github.com/lloydrichards/effect-boxes/pull/125) [`85f7e60`](https://github.com/lloydrichards/effect-boxes/commit/85f7e60efc23faabbb6c35de08d0e7dd7ff4c8bd) Thanks [@lloydrichards](https://github.com/lloydrichards)! - ANSI rendering now restores parent styles after nested matching styles reset them ([#99](https://github.com/lloydrichards/effect-boxes/issues/99)).

- [#115](https://github.com/lloydrichards/effect-boxes/pull/115) [`4b220ff`](https://github.com/lloydrichards/effect-boxes/commit/4b220ffc96884984159840a5ff09b81b6980fe4c) Thanks [@lloydrichards](https://github.com/lloydrichards)! - Vertical spacers now consume column height, and narrow containers keep their declared width when padding exceeds it.

- [#124](https://github.com/lloydrichards/effect-boxes/pull/124) [`1d52a41`](https://github.com/lloydrichards/effect-boxes/commit/1d52a4167c736aadb0129e69c7fb18f66b8a8d5a) Thanks [@lloydrichards](https://github.com/lloydrichards)! - `Box.cropWidth` and `Box.cropHeight` now retain aligned content selected by the crop window ([#95](https://github.com/lloydrichards/effect-boxes/issues/95)).

## 0.17.1

### Patch Changes

- [#91](https://github.com/lloydrichards/effect-boxes/pull/91) [`cd1da55`](https://github.com/lloydrichards/effect-boxes/commit/cd1da55f58daf55e9d8a6a8edb68ab7e82645ae8) Thanks [@lloydrichards](https://github.com/lloydrichards)! - upgrade min effect version to rc

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
