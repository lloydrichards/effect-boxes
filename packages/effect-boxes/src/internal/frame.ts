import {
  Array as Arr,
  Data,
  HashMap,
  Option,
  Order,
  Result,
  Schema,
} from "effect";
import type * as Ansi from "../Ansi.js";
import type * as Box from "../Box.js";
import { isBox } from "./box.js";
import * as Validation from "./layout-validation.js";
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
const fail = (message: string): Result.Result<never, FrameResolutionError> =>
  Result.fail(new FrameResolutionError({ message }));
const integer = (
  value: number,
  name: string,
  nonnegative = false
): Result.Result<number, FrameResolutionError> =>
  Result.mapError(
    nonnegative ? Validation.dimension(value) : Validation.integer(value),
    (cause) =>
      new FrameResolutionError({
        message: `${name} must be ${nonnegative ? "a nonnegative" : "a"} safe integer`,
        cause,
      })
  );
const add = (
  left: number,
  right: number
): Result.Result<number, FrameResolutionError> =>
  integer(left + right, "Logical coordinate");
// Logical extents are checked before clipping. Paint and region rectangles
// are bounded by the validated viewport, so their construction cannot overflow.
const bounds = (row: number, col: number, rows: number, cols: number): Bounds =>
  Object.freeze({ row, col, rows, cols });
const intersect = (left: Bounds, right: Bounds): Bounds => {
  const row = Math.max(left.row, right.row);
  const col = Math.max(left.col, right.col);
  return bounds(
    row,
    col,
    Math.max(0, Math.min(left.row + left.rows, right.row + right.rows) - row),
    Math.max(0, Math.min(left.col + left.cols, right.col + right.cols) - col)
  );
};
const decodeAlignment = Schema.decodeUnknownResult(
  Schema.Literals(["AlignFirst", "AlignLast", "AlignCenter1", "AlignCenter2"])
);
const alignment = (
  value: Box.Alignment
): Result.Result<Box.Alignment, FrameResolutionError> =>
  Result.mapError(
    decodeAlignment(value),
    (cause) =>
      new FrameResolutionError({ message: "Unsupported Box alignment", cause })
  );
const decodeStyles = Schema.decodeUnknownResult(
  Schema.Array(
    Schema.Struct({
      _tag: Schema.Literals([
        "ForegroundColor",
        "BackgroundColor",
        "TextAttribute",
        "CommandAttribute",
      ]),
      name: Schema.String,
      code: Schema.String,
    })
  )
);
const decodeText = Schema.decodeUnknownResult(
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Frames reject C0 and C1 terminal controls.
  Schema.String.check(Schema.isPattern(/^[^\u0000-\u001f\u007f-\u009f]*$/u))
);

// Store active terminal state, rather than inherited escape sequences. Off/default
// codes remove their category, and reset clears every inherited category.
const styles = (
  inherited: Ansi.AnsiStyle,
  data: unknown
): Result.Result<Ansi.AnsiStyle, FrameResolutionError> =>
  Result.gen(function* () {
    const attributes = yield* Result.mapError(
      decodeStyles(data),
      (cause) =>
        new FrameResolutionError({
          message: "Unsupported frame annotation",
          cause,
        })
    );
    const active = new Map(
      inherited.map((attribute) => [styleKey(attribute), attribute])
    );
    for (const attribute of attributes) {
      const { _tag, name, code } = attribute;
      if (_tag === "CommandAttribute")
        yield* fail("Commands cannot be resolved into frames");
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
          yield* fail(`Unsupported ANSI color code: ${code}`);
        if (code === "39" || code === "49") active.delete(_tag);
        else active.set(_tag, Object.freeze({ _tag, name, code }));
      } else if (_tag === "TextAttribute") {
        const number = Number(code);
        if (!/^(?:0|1|2|3|4|5|7|8|9|22|23|24|25|27|28|29|53|55)$/.test(code)) {
          yield* fail(`Unsupported ANSI text code: ${code}`);
        }
        if (number === 0) active.clear();
        else if (number === 22) {
          active.delete("1");
          active.delete("2");
        } else if ([23, 24, 25, 27, 28, 29, 55].includes(number)) {
          active.delete(number === 55 ? "53" : String(number - 20));
        } else active.set(code, Object.freeze({ _tag, name, code }));
      } else yield* fail("Unsupported ANSI attribute tag");
    }
    return Object.freeze([...active.values()]);
  });
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
): Result.Result<ResolvedFrame, FrameResolutionError> =>
  Result.gen(function* () {
    yield* integer(width, "Frame width", true);
    yield* integer(height, "Frame height", true);
    yield* integer(width * height, "Frame area", true);
    // Dense cells and per-row output need bounded storage, even at zero width.
    const limit = 1_000_000;
    if (width > limit || height > limit || width * height > limit) {
      return yield* fail(
        "Frame viewport exceeds the dense storage limit of 1000000 cells or rows/columns"
      );
    }
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
    ): Result.Result<void, FrameResolutionError> =>
      Result.gen(function* () {
        if (!isBox(box)) yield* fail("Frame layers require Box values");
        if (visiting.has(box)) yield* fail("Cyclic Box tree");
        visiting.add(box);
        yield* integer(box.rows, "Box rows", true);
        yield* integer(box.cols, "Box columns", true);
        yield* add(row, box.rows);
        yield* add(col, box.cols);
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
          } else style = yield* styles(inherited, data);
        }
        fill(clip, { style, owners });
        switch (box.content._tag) {
          case "Blank":
            break;
          case "Text": {
            const text = yield* Result.mapError(
              decodeText(box.content.text),
              (cause) =>
                new FrameResolutionError({
                  message: "Frame text cannot contain terminal controls",
                  cause,
                })
            );
            const glyphs: { text: string; cols: number }[] = [];
            let separators = "";
            let textWidth = 0;
            for (const segment of Width.segments(text)) {
              const size = Width.ofString(segment);
              if (size === 0) {
                separators += segment;
              } else {
                textWidth += size;
                glyphs.push({ text: separators + segment, cols: size });
                separators = "";
              }
            }
            // Separators travel with the next glyph, or the last glyph when
            // trailing, so clipping and occlusion remove their source text too.
            const lastGlyph = glyphs.at(-1);
            if (lastGlyph) lastGlyph.text += separators;
            // Check the final extent once. Every positive-width glyph lies between
            // this checked endpoint and the checked starting column.
            yield* add(col, textWidth);
            let offset = 0;
            for (const segment of glyphs) {
              const size = segment.cols;
              const start = col + offset;
              const end = start + size;
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
                  text: segment.text,
                });
                fill(bounds(row, start, 1, size), {
                  glyph,
                  style,
                  owners,
                });
              }
              offset += size;
            }
            break;
          }
          case "Row": {
            let offset = col;
            for (const child of box.content.boxes) {
              yield* walk(child, row, offset, clip, style, owners);
              offset = yield* add(offset, child.cols);
            }
            break;
          }
          case "Col": {
            let offset = row;
            for (const child of box.content.boxes) {
              yield* walk(child, offset, col, clip, style, owners);
              offset = yield* add(offset, child.rows);
            }
            break;
          }
          case "SubBox": {
            const inner = box.content.box;
            yield* integer(inner.rows, "Box rows", true);
            yield* integer(inner.cols, "Box columns", true);
            yield* walk(
              inner,
              yield* add(
                row,
                Width.alignmentOffset(
                  yield* alignment(box.content.yAlign),
                  inner.rows,
                  box.rows
                )
              ),
              yield* add(
                col,
                Width.alignmentOffset(
                  yield* alignment(box.content.xAlign),
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
            yield* fail("Unsupported Box content");
        }
        visiting.delete(box);
      });
    const validated = yield* Result.all(
      layers.map((layer, index) =>
        Result.gen(function* () {
          yield* integer(layer.x, "Layer x");
          yield* integer(layer.y, "Layer y");
          yield* integer(layer.z, "Layer z");
          return { layer, index };
        })
      )
    );
    const ordered = Arr.sortBy(
      Order.mapInput(
        Order.Number,
        (entry: { layer: InputLayer; index: number }) => entry.layer.z
      ),
      Order.mapInput(
        Order.Number,
        (entry: { layer: InputLayer; index: number }) => entry.index
      )
    )(validated);
    for (const { layer } of ordered)
      yield* walk(layer.box, layer.y, layer.x, viewport, emptyStyle, []);

    return yield* finalize(cells, width, height, occurrences);
  });

const finalize = (
  cells: readonly (readonly Cell[])[],
  width: number,
  height: number,
  occurrences: readonly Occurrence[]
): Result.Result<ResolvedFrame, FrameResolutionError> => {
  // A wide glyph is emitted only if every column still belongs to it. Its
  // surviving cells retain their style/regions when another layer covers half.
  const unionVisible = new Map<string, Bounds[]>();
  const lines: (readonly PaintRun[])[] = [];
  const hits: (readonly (readonly string[])[])[] = [];
  for (let row = 0; row < height; row++) {
    const line = cells[row];
    if (!line) continue;
    const runs: PaintRun[] = [];
    const glyphTexts: string[] = [];
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
      for (const segment of Width.segments(text)) glyphTexts.push(segment);
      const previous = runs.at(-1);
      if (previous && sameStyle(previous.style, cell.style)) {
        runs[runs.length - 1] = {
          ...previous,
          cols: previous.cols + cols,
          text: previous.text + text,
        };
      } else runs.push({ col, cols, text, style: cell.style });
    }
    // Adjacent source glyphs can join after composition, changing their
    // columns even across style runs. Reject before exposing stale ownership.
    const composedSegments = Width.segments(glyphTexts.join(""));
    if (
      composedSegments.length !== glyphTexts.length ||
      composedSegments.some((text, index) => text !== glyphTexts[index])
    ) {
      return fail("Composed frame text changes resolved grapheme boundaries");
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
  return Result.succeed(frame);
};

/** @internal */
export const encodingView = (
  frame: ResolvedFrame
): Option.Option<FrameEncodingView> =>
  Option.map(Option.fromUndefinedOr(storage.get(frame)), (data) => data.view);

/** @internal */
export const hitTestResult = (
  frame: ResolvedFrame,
  position: { readonly row: number; readonly col: number }
): Result.Result<
  readonly string[],
  Validation.LayoutValidationError | FrameResolutionError
> =>
  Result.gen(function* () {
    const { row, col } = yield* Result.mapError(
      Validation.decodePosition(position),
      Validation.invalidInput
    );
    const data = storage.get(frame);
    if (!data) return yield* fail("Unknown resolved frame");
    return data.hits[row]?.[col] ?? Object.freeze([]);
  });

/** @internal */
export const hitTest = (
  frame: ResolvedFrame,
  position: { readonly row: number; readonly col: number }
): readonly string[] =>
  Result.match(hitTestResult(frame, position), {
    onSuccess: (value) => value,
    onFailure: (error) => {
      if (error instanceof Validation.LayoutValidationError)
        throw new RangeError(error.message, { cause: error });
      throw error;
    },
  });
