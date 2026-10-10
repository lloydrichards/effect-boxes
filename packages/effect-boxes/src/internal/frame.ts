import { Data, HashMap } from "effect";
import type * as Ansi from "../Ansi.js";
import type * as Box from "../Box.js";
import { isBox } from "./box.js";
import { isReactive } from "./reactive.js";
import * as Width from "./width.js";

/** @internal */
export interface Bounds {
  readonly row: number;
  readonly col: number;
  readonly rows: number;
  readonly cols: number;
}
/** @internal */
export interface RegionOccurrence {
  readonly key: string;
  readonly bounds: Bounds;
  readonly clipped: Bounds;
  readonly visible: readonly Bounds[];
}
/** @internal */
export interface Region {
  readonly id: string;
  readonly occurrences: readonly RegionOccurrence[];
  readonly visible: readonly Bounds[];
}
/** @internal */
export type RegionMap = HashMap.HashMap<string, Region>;
/** @internal */
export interface ResolvedFrame {
  readonly rows: number;
  readonly cols: number;
  readonly regions: RegionMap;
}
/** @internal */
export interface PaintRun {
  readonly col: number;
  readonly cols: number;
  readonly text: string;
  readonly style: Ansi.AnsiStyle;
}
/** @internal */
export interface FrameEncodingView {
  readonly rows: number;
  readonly cols: number;
  readonly lines: readonly (readonly PaintRun[])[];
}
/** @internal */
export interface InputLayer {
  readonly box: Box.Box<unknown>;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
/** @internal */
export class FrameResolutionError extends Data.TaggedError(
  "FrameResolutionError"
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

interface Occurrence {
  readonly id: string;
  readonly key: string;
  readonly bounds: Bounds;
  readonly clipped: Bounds;
  readonly visible: Bounds[];
}
interface Glyph {
  readonly col: number;
  readonly cols: number;
  readonly text: string;
}
interface Cell {
  readonly glyph?: Glyph;
  readonly style: Ansi.AnsiStyle;
  readonly owners: readonly Occurrence[];
}
interface Storage {
  readonly view: FrameEncodingView;
  readonly hits: readonly (readonly (readonly string[])[])[];
}
const storage = new WeakMap<ResolvedFrame, Storage>();
const emptyStyle: Ansi.AnsiStyle = Object.freeze([]);
const fail = (message: string): never => {
  throw new FrameResolutionError({ message });
};
const integer = (value: number, name: string, nonnegative = false): number => {
  if (!Number.isSafeInteger(value) || (nonnegative && value < 0)) {
    fail(`${name} must be ${nonnegative ? "a nonnegative" : "a"} safe integer`);
  }
  return value;
};
const add = (left: number, right: number): number =>
  integer(left + right, "Logical coordinate");
const bounds = (
  row: number,
  col: number,
  rows: number,
  cols: number
): Bounds => {
  add(row, rows);
  add(col, cols);
  return Object.freeze({ row, col, rows, cols });
};
const intersect = (left: Bounds, right: Bounds): Bounds => {
  const row = Math.max(left.row, right.row);
  const col = Math.max(left.col, right.col);
  return bounds(
    row,
    col,
    Math.max(
      0,
      Math.min(add(left.row, left.rows), add(right.row, right.rows)) - row
    ),
    Math.max(
      0,
      Math.min(add(left.col, left.cols), add(right.col, right.cols)) - col
    )
  );
};
const alignment = (value: Box.Alignment): Box.Alignment => {
  if (
    !["AlignFirst", "AlignLast", "AlignCenter1", "AlignCenter2"].includes(value)
  ) {
    fail("Unsupported Box alignment");
  }
  return value;
};

// Store active terminal state, rather than inherited escape sequences. Off/default
// codes remove their category, and reset clears every inherited category.
const styles = (inherited: Ansi.AnsiStyle, data: unknown): Ansi.AnsiStyle => {
  if (!Array.isArray(data)) return fail("Unsupported frame annotation");
  const active = new Map(
    inherited.map((attribute) => [styleKey(attribute), attribute])
  );
  for (const attribute of data) {
    if (
      typeof attribute !== "object" ||
      attribute === null ||
      !("_tag" in attribute) ||
      !("name" in attribute) ||
      !("code" in attribute) ||
      typeof attribute.name !== "string" ||
      typeof attribute.code !== "string"
    )
      fail("Malformed ANSI annotation");
    const { _tag, name, code } = attribute;
    if (_tag === "CommandAttribute")
      fail("Commands cannot be resolved into frames");
    if (_tag === "ForegroundColor" || _tag === "BackgroundColor") {
      const foreground = _tag === "ForegroundColor";
      const prefix = foreground ? "38" : "48";
      const basic = foreground
        ? /^(?:3[0-7]|9[0-7]|39)$/
        : /^(?:4[0-7]|10[0-7]|49)$/;
      const parts = code.split(";");
      const extended =
        parts[0] === prefix &&
        ((parts[1] === "5" && parts.length === 3) ||
          (parts[1] === "2" && parts.length === 5)) &&
        parts
          .slice(2)
          .every(
            (part: string) =>
              /^(?:0|[1-9]\d*)$/.test(part) && Number(part) <= 255
          );
      if (!basic.test(code) && !extended)
        fail(`Unsupported ANSI color code: ${code}`);
      if (code === "39" || code === "49") active.delete(_tag);
      else active.set(_tag, Object.freeze({ _tag, name, code }));
    } else if (_tag === "TextAttribute") {
      const number = Number(code);
      if (!/^(?:0|1|2|3|4|5|7|8|9|22|23|24|25|27|28|29|53|55)$/.test(code)) {
        fail(`Unsupported ANSI text code: ${code}`);
      }
      if (number === 0) active.clear();
      else if (number === 22) {
        active.delete("1");
        active.delete("2");
      } else if ([23, 24, 25, 27, 28, 29, 55].includes(number)) {
        active.delete(number === 55 ? "53" : String(number - 20));
      } else active.set(code, Object.freeze({ _tag, name, code }));
    } else fail("Unsupported ANSI attribute tag");
  }
  return Object.freeze([...active.values()]);
};
const styleKey = (attribute: Ansi.AnsiAttribute): string =>
  attribute._tag === "TextAttribute" ? attribute.code : attribute._tag;
const sameStyle = (left: Ansi.AnsiStyle, right: Ansi.AnsiStyle): boolean =>
  left.length === right.length &&
  left.every(
    (attribute, index) =>
      attribute._tag === right[index]?._tag &&
      attribute.code === right[index]?.code
  );

const coalesce = (fragments: readonly Bounds[]): readonly Bounds[] => {
  const rectangles: Bounds[] = [];
  const last = new Map<string, number>();
  for (const fragment of fragments) {
    const key = `${fragment.col}:${fragment.cols}`;
    const index = last.get(key);
    const previous = index === undefined ? undefined : rectangles[index];
    if (previous && previous.row + previous.rows === fragment.row) {
      rectangles[index ?? 0] = bounds(
        previous.row,
        previous.col,
        previous.rows + fragment.rows,
        previous.cols
      );
    } else {
      last.set(key, rectangles.length);
      rectangles.push(fragment);
    }
  }
  return Object.freeze(rectangles);
};

/** @internal */
export const resolveLayers = (
  layers: readonly InputLayer[],
  width: number,
  height: number
): ResolvedFrame => {
  try {
    integer(width, "Frame width", true);
    integer(height, "Frame height", true);
    integer(width * height, "Frame area", true);
    const viewport = bounds(0, 0, height, width);
    const cells: Cell[][] = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ style: emptyStyle, owners: [] }))
    );
    const occurrences: Occurrence[] = [];
    const visiting = new Set<Box.Box<unknown>>();
    const fill = (clip: Bounds, cell: Cell): void => {
      for (let row = clip.row; row < clip.row + clip.rows; row++) {
        for (let col = clip.col; col < clip.col + clip.cols; col++) {
          const line = cells[row];
          if (line) line[col] = cell;
        }
      }
    };
    const walk = (
      box: Box.Box<unknown>,
      row: number,
      col: number,
      parentClip: Bounds,
      inherited: Ansi.AnsiStyle,
      ancestors: readonly Occurrence[]
    ): void => {
      if (!isBox(box)) fail("Frame layers require Box values");
      if (visiting.has(box)) fail("Cyclic Box tree");
      visiting.add(box);
      integer(box.rows, "Box rows", true);
      integer(box.cols, "Box columns", true);
      const logical = bounds(row, col, box.rows, box.cols);
      const clip = intersect(logical, parentClip);
      let style = inherited;
      let owners = ancestors;
      if (box.annotation) {
        const data = box.annotation.data;
        if (isReactive(data)) {
          const occurrence: Occurrence = {
            id: data.id,
            key: String(occurrences.length),
            bounds: logical,
            clipped: clip,
            visible: [],
          };
          occurrences.push(occurrence);
          owners = [...ancestors, occurrence];
        } else style = styles(inherited, data);
      }
      fill(clip, { style, owners });
      switch (box.content._tag) {
        case "Blank":
          break;
        case "Text": {
          const text = box.content.text;
          if (
            typeof text !== "string" ||
            [...text].some((character) => {
              const code = character.codePointAt(0) ?? 0;
              return code < 32 || (code >= 127 && code <= 159);
            })
          ) {
            fail("Frame text cannot contain terminal controls");
          }
          let offset = 0;
          for (const segment of Width.segments(text)) {
            const size = Width.ofString(segment);
            const start = add(col, offset);
            const end = add(start, size);
            if (
              size > 0 &&
              row >= clip.row &&
              row < clip.row + clip.rows &&
              start >= clip.col &&
              end <= clip.col + clip.cols
            ) {
              const glyph = Object.freeze({
                col: start,
                cols: size,
                text: segment,
              });
              fill(bounds(row, start, 1, size), { glyph, style, owners });
            }
            offset = add(offset, size);
          }
          break;
        }
        case "Row": {
          let offset = col;
          for (const child of box.content.boxes) {
            walk(child, row, offset, clip, style, owners);
            offset = add(offset, child.cols);
          }
          break;
        }
        case "Col": {
          let offset = row;
          for (const child of box.content.boxes) {
            walk(child, offset, col, clip, style, owners);
            offset = add(offset, child.rows);
          }
          break;
        }
        case "SubBox": {
          const inner = box.content.box;
          integer(inner.rows, "Box rows", true);
          integer(inner.cols, "Box columns", true);
          walk(
            inner,
            add(
              row,
              Width.alignmentOffset(
                alignment(box.content.yAlign),
                inner.rows,
                box.rows
              )
            ),
            add(
              col,
              Width.alignmentOffset(
                alignment(box.content.xAlign),
                inner.cols,
                box.cols
              )
            ),
            clip,
            style,
            owners
          );
          break;
        }
        default:
          fail("Unsupported Box content");
      }
      visiting.delete(box);
    };
    const ordered = layers
      .map((layer, index) => {
        integer(layer.x, "Layer x");
        integer(layer.y, "Layer y");
        integer(layer.z, "Layer z");
        return { layer, index };
      })
      .sort((left, right) =>
        left.layer.z < right.layer.z
          ? -1
          : left.layer.z > right.layer.z
            ? 1
            : left.index - right.index
      );
    for (const { layer } of ordered)
      walk(layer.box, layer.y, layer.x, viewport, emptyStyle, []);

    // A wide glyph is emitted only if every column still belongs to it. Its
    // surviving cells retain their style/regions when another layer covers half.
    const unionVisible = new Map<string, Bounds[]>();
    const lines: (readonly PaintRun[])[] = [];
    const hits: (readonly (readonly string[])[])[] = [];
    for (let row = 0; row < height; row++) {
      const line = cells[row];
      if (!line) continue;
      const runs: PaintRun[] = [];
      const rowHits: (readonly string[])[] = [];
      const fragments = new Map<Occurrence, { start: number; end: number }>();
      const idFragments = new Map<string, { start: number; end: number }>();
      for (let col = 0; col < width; col++) {
        const cell = line[col];
        if (!cell) continue;
        rowHits.push(
          Object.freeze([
            ...new Set([...cell.owners].reverse().map((owner) => owner.id)),
          ])
        );
        for (const owner of cell.owners) {
          const fragment = fragments.get(owner);
          if (fragment?.end === col) fragment.end++;
          else {
            if (fragment)
              owner.visible.push(
                bounds(row, fragment.start, 1, fragment.end - fragment.start)
              );
            fragments.set(owner, { start: col, end: col + 1 });
          }
        }
        for (const id of new Set(cell.owners.map((owner) => owner.id))) {
          const fragment = idFragments.get(id);
          if (fragment?.end === col) fragment.end++;
          else {
            if (fragment) {
              const visible = unionVisible.get(id) ?? [];
              visible.push(
                bounds(row, fragment.start, 1, fragment.end - fragment.start)
              );
              unionVisible.set(id, visible);
            }
            idFragments.set(id, { start: col, end: col + 1 });
          }
        }
        const glyph = cell.glyph;
        const whole =
          glyph &&
          Array.from(
            { length: glyph.cols },
            (_, offset) => line[glyph.col + offset]?.glyph === glyph
          ).every(Boolean);
        if (whole && col !== glyph.col) continue;
        const text = whole ? glyph.text : " ";
        const cols = whole ? glyph.cols : 1;
        const previous = runs.at(-1);
        if (previous && sameStyle(previous.style, cell.style)) {
          runs[runs.length - 1] = {
            ...previous,
            cols: previous.cols + cols,
            text: previous.text + text,
          };
        } else runs.push({ col, cols, text, style: cell.style });
      }
      for (const [owner, fragment] of fragments) {
        owner.visible.push(
          bounds(row, fragment.start, 1, fragment.end - fragment.start)
        );
      }
      for (const [id, fragment] of idFragments) {
        const visible = unionVisible.get(id) ?? [];
        visible.push(
          bounds(row, fragment.start, 1, fragment.end - fragment.start)
        );
        unionVisible.set(id, visible);
      }
      lines.push(Object.freeze(runs.map((run) => Object.freeze(run))));
      hits.push(Object.freeze(rowHits));
    }
    const grouped = new Map<string, RegionOccurrence[]>();
    for (const occurrence of occurrences) {
      const value = Object.freeze({
        key: occurrence.key,
        bounds: occurrence.bounds,
        clipped: occurrence.clipped,
        visible: coalesce(occurrence.visible),
      });
      const group = grouped.get(occurrence.id) ?? [];
      group.push(value);
      grouped.set(occurrence.id, group);
    }
    let regions: RegionMap = HashMap.empty();
    for (const [id, values] of grouped) {
      regions = HashMap.set(
        regions,
        id,
        Object.freeze({
          id,
          occurrences: Object.freeze(values),
          visible: coalesce(unionVisible.get(id) ?? []),
        })
      );
    }
    const frame = Object.freeze({ rows: height, cols: width, regions });
    storage.set(
      frame,
      Object.freeze({
        view: Object.freeze({
          rows: height,
          cols: width,
          lines: Object.freeze(lines),
        }),
        hits: Object.freeze(hits),
      })
    );
    return frame;
  } catch (cause) {
    if (cause instanceof FrameResolutionError) throw cause;
    throw new FrameResolutionError({
      message: "Unable to resolve frame",
      cause,
    });
  }
};
/** @internal */
export const encodingView = (frame: ResolvedFrame): FrameEncodingView =>
  storage.get(frame)?.view ?? fail("Unknown resolved frame");
/** @internal */
export const hitTest = (
  frame: ResolvedFrame,
  position: { readonly row: number; readonly col: number }
): readonly string[] => {
  if (
    !Number.isSafeInteger(position.row) ||
    !Number.isSafeInteger(position.col)
  ) {
    throw new RangeError("Hit coordinates must be safe integers");
  }
  const data = storage.get(frame) ?? fail("Unknown resolved frame");
  return data.hits[position.row]?.[position.col] ?? Object.freeze([]);
};
