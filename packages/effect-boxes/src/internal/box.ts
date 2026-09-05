import {
  Array,
  Equal,
  Function,
  Hash,
  Inspectable,
  Match,
  Option,
  pipe,
  String,
} from "effect";
import { dual } from "effect/Function";
import { pipeArguments } from "effect/Pipeable";
import type * as Annotation from "../Annotation.js";
import type * as Box from "../Box.js";
import * as Width from "./width.js";

/** @internal */
const BoxSymbolKey = "@effect/boxes/Box";

/** @internal */
export const BoxTypeId: Box.BoxTypeId = Symbol.for(
  BoxSymbolKey
) as Box.BoxTypeId;

const contentEquals = <A>(self: Box.Box<A>, that: Box.Box<A>): boolean => {
  if (self.content._tag !== that.content._tag) {
    return false;
  }

  return match(self, {
    blank: () => true,
    text: (text: string) => text === (that.content as Box.Text).text,
    row: (boxes: Box.Box<A>[]) =>
      boxes.length === (that.content as Box.Row<A>).boxes.length &&
      boxes.every((box: Box.Box<A>, i: number) =>
        Equal.equals(box, (that.content as Box.Row<A>).boxes[i])
      ),
    col: (boxes: Box.Box<A>[]) =>
      boxes.length === (that.content as Box.Col<A>).boxes.length &&
      boxes.every((box: Box.Box<A>, i: number) =>
        Equal.equals(box, (that.content as Box.Col<A>).boxes[i])
      ),
    subBox: (box: Box.Box<A>, xAlign: Box.Alignment, yAlign: Box.Alignment) =>
      xAlign === (that.content as Box.SubBox<A>).xAlign &&
      yAlign === (that.content as Box.SubBox<A>).yAlign &&
      Equal.equals(box, (that.content as Box.SubBox<A>).box),
  });
};

const contentHash = <A>(box: Box.Box<A>): number =>
  match(box, {
    blank: () => Hash.hash("Blank"),
    text: (text: string) => Hash.combine(Hash.hash("Text"))(Hash.hash(text)),
    row: (boxes: Box.Box<A>[]) =>
      boxes.reduce(
        (acc: number, box: Box.Box<A>) => Hash.combine(acc)(Hash.hash(box)),
        Hash.hash("Row")
      ),
    col: (boxes: Box.Box<A>[]) =>
      boxes.reduce(
        (acc: number, box: Box.Box<A>) => Hash.combine(acc)(Hash.hash(box)),
        Hash.hash("Col")
      ),
    subBox: (box: Box.Box<A>, xAlign: Box.Alignment, yAlign: Box.Alignment) =>
      pipe(
        Hash.hash("SubBox"),
        Hash.combine(Hash.hash(xAlign)),
        Hash.combine(Hash.hash(yAlign)),
        Hash.combine(Hash.hash(box))
      ),
  });

const proto: Omit<Box.Box, "rows" | "content" | "cols" | "annotation"> = {
  [BoxTypeId]: { _A: Function.identity },
  [Equal.symbol]<A>(this: Box.Box<A>, that: unknown): boolean {
    return (
      isBox<A>(that) &&
      this.rows === that.rows &&
      this.cols === that.cols &&
      contentEquals(this, that) &&
      Equal.equals(this.annotation, that.annotation)
    );
  },
  [Hash.symbol]<A>(this: Box.Box<A>) {
    return pipe(
      Hash.hash(this.rows),
      Hash.combine(Hash.hash(this.cols)),
      Hash.combine(contentHash(this)),
      Hash.combine(Hash.hash(this.annotation))
    );
  },
  [Inspectable.NodeInspectSymbol]<A>(this: Box.Box<A>): unknown {
    return {
      _tag: "Box",
      rows: this.rows,
      cols: this.cols,
      content: this.content,
    };
  },
  toString<A>(this: Box.Box<A>) {
    const dimension = `${this.rows}x${this.cols}`;
    const tag = this.content._tag;
    const contentInfo = (<A>(box: Box.Box<A>): string =>
      match(box, {
        blank: () => " [empty]",
        text: (text) =>
          text.length > 20 ? ` "${text.slice(0, 17)}..."` : ` "${text}"`,
        row: (boxes) => ` [${boxes.length} boxes horizontal]`,
        col: (boxes) => ` [${boxes.length} boxes vertical]`,
        subBox: (_, xAlign, yAlign) => ` [aligned ${xAlign}/${yAlign}]`,
      }))(this);
    const annotationInfo = this.annotation ? " annotated" : "";

    return `Box(${dimension} ${tag}${contentInfo}${annotationInfo})`;
  },
  toJSON<A>(this: Box.Box<A>) {
    return {
      _tag: "Box",
      rows: this.rows,
      cols: this.cols,
      content: this.content,
    };
  },
  pipe() {
    return pipeArguments(this, arguments);
  },
};

// -----------------------------------------------------------------------------
// Refinements
// -----------------------------------------------------------------------------

/** @internal */

export const isBox = <A>(u: unknown): u is Box.Box<A> =>
  typeof u === "object" && u != null && BoxTypeId in u;

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------

/** @internal */

export const top: Box.Alignment = "AlignFirst";

/** @internal */

export const bottom: Box.Alignment = "AlignLast";

/** @internal */

export const left: Box.Alignment = "AlignFirst";

/** @internal */

export const right: Box.Alignment = "AlignLast";

/** @internal */

export const center1: Box.Alignment = "AlignCenter1";

/** @internal */

export const center2: Box.Alignment = "AlignCenter2";

const alignmentOffset = (alignment: Box.Alignment, space: number): number =>
  Match.value(alignment).pipe(
    Match.when("AlignFirst", () => 0),
    Match.when("AlignLast", () => space),
    Match.when("AlignCenter1", () => Math.trunc(space / 2)),
    Match.when("AlignCenter2", () => space - Math.trunc(space / 2)),
    Match.exhaustive
  );

// -----------------------------------------------------------------------------
// Constructors
// -----------------------------------------------------------------------------

/** @internal */

export const make = <A>(self: {
  rows: number;
  cols: number;
  content: Box.Content<A>;
  annotation?: import("../Annotation.js").Annotation<A> | undefined;
}): Box.Box<A> => {
  const box = Object.create(proto);
  box.rows = Math.max(0, self.rows);
  box.cols = Math.max(0, self.cols);
  box.content = self.content;
  if (self.annotation) {
    box.annotation = self.annotation;
  }

  return box;
};

/** @internal */

export const nullBox: Box.Box<never> = make({
  rows: 0,
  cols: 0,
  content: { _tag: "Blank" },
});

/** @internal */

export const emptyBox = (rows = 0, cols = 0): Box.Box<never> =>
  make({
    rows,
    cols,
    content: { _tag: "Blank" },
  });

/** @internal */

export const char = (c: string): Box.Box<never> => {
  const grapheme = pipe(
    Width.segments(c),
    Array.head,
    Option.getOrElse(() => " ")
  );
  return make({
    rows: 1,
    cols: Width.ofString(grapheme),
    content: { _tag: "Text", text: grapheme },
  });
};

const unsafeLine = (t: string): Box.Box<never> =>
  make({
    rows: 1,
    cols: Width.ofString(t),
    content: { _tag: "Text", text: t },
  });

/** @internal */

export const text = (s: string): Box.Box<never> =>
  pipe(s, String.split("\n"), Array.map(unsafeLine), vcat(left));

/** @internal */

export const line = (s: string): Box.Box<never> =>
  unsafeLine(String.replace(/\n|\r/g, "")(s));

/** @internal */

export const para = dual<
  (a: Box.Alignment, w: number) => (self: string) => Box.Box<never>,
  (self: string, a: Box.Alignment, w: number) => Box.Box<never>
>(3, (self, a, w) => {
  const lines = flow(self, w);
  return mkParaBox(lines, a, lines.length);
});

/** @internal */

export const combine = dual<
  <B>(that: Box.Box<B>) => <A>(self: Box.Box<A>) => Box.Box<A | B>,
  <A, B>(self: Box.Box<A>, that: Box.Box<B>) => Box.Box<A | B>
>(
  2,
  <A, B>(self: Box.Box<A>, that: Box.Box<B>): Box.Box<A | B> =>
    hcat([self, that], top)
);

/** @internal */
export const combineMany = dual<
  <A>(start: Box.Box<A>) => <B>(self: Iterable<Box.Box<B>>) => Box.Box<A | B>,
  <A, B>(self: Iterable<Box.Box<B>>, start: Box.Box<A>) => Box.Box<A | B>
>(
  2,
  <A, B>(self: Iterable<Box.Box<B>>, start: Box.Box<A>): Box.Box<A | B> =>
    hcat([start, ...Array.fromIterable(self)], top)
);

/** @internal */
export const combineAll = <T extends readonly Box.Box<unknown>[]>(
  collection: T
): Box.Box<Box.BoxAnnotations<T>> => {
  const boxes = Array.fromIterable(collection);
  return boxes.length === 0 ? nullBox : hcat(boxes, top);
};

/** @internal */
export const rows = <A>(self: Box.Box<A>): number => self.rows;

/** @internal */
export const cols = <A>(self: Box.Box<A>): number => self.cols;

const sumMax = <A>(
  f: (a: A) => number,
  defaultMax: number,
  g: (a: A) => number,
  as: readonly A[]
): [number, number] => {
  let sum = 0;
  let max = defaultMax;
  for (const a of as) {
    sum += f(a);
    max = Math.max(max, g(a));
  }
  return [sum, max];
};

/** @internal */
export const hcat = dual<
  <T extends readonly Box.Box<unknown>[]>(
    a: Box.Alignment
  ) => (self: T) => Box.Box<Box.BoxAnnotations<T>>,
  <T extends readonly Box.Box<unknown>[]>(
    self: T,
    a: Box.Alignment
  ) => Box.Box<Box.BoxAnnotations<T>>
>(
  2,
  <T extends readonly Box.Box<unknown>[]>(
    self: T,
    a: Box.Alignment
  ): Box.Box<Box.BoxAnnotations<T>> => {
    const [w, h] = sumMax(cols, 0, rows, self);
    return make({
      rows: h,
      cols: w,
      content: {
        _tag: "Row",
        // Safe cast: alignVert preserves annotation types, so Box.Box<unknown>[] becomes Box.Box<Box.BoxAnnotations<T>>[]
        boxes: self.map(alignVert(a, h)) as Box.Box<Box.BoxAnnotations<T>>[],
      } as Box.Content<Box.BoxAnnotations<T>>, // Safe cast: matches the Box.Box<Box.BoxAnnotations<T>> return type
    });
  }
);

/** @internal */
export const vcat = dual<
  <T extends readonly Box.Box<unknown>[]>(
    a: Box.Alignment
  ) => (self: T) => Box.Box<Box.BoxAnnotations<T>>,
  <T extends readonly Box.Box<unknown>[]>(
    self: T,
    a: Box.Alignment
  ) => Box.Box<Box.BoxAnnotations<T>>
>(
  2,
  <T extends readonly Box.Box<unknown>[]>(
    self: T,
    a: Box.Alignment
  ): Box.Box<Box.BoxAnnotations<T>> => {
    const [h, w] = sumMax(rows, 0, cols, self);
    return make({
      rows: h,
      cols: w,
      content: {
        _tag: "Col",
        // Safe cast: alignHoriz preserves annotation types, so Box.Box<unknown>[] becomes Box.Box<Box.BoxAnnotations<T>>[]
        boxes: self.map(alignHoriz(a, w)) as Box.Box<Box.BoxAnnotations<T>>[],
      } as Box.Content<Box.BoxAnnotations<T>>, // Safe cast: matches the Box.Box<Box.BoxAnnotations<T>> return type
    });
  }
);

/** @internal */
export const hAppend = dual<
  <B>(that: Box.Box<B>) => <A>(self: Box.Box<A>) => Box.Box<A | B>,
  <A, B>(self: Box.Box<A>, that: Box.Box<B>) => Box.Box<A | B>
>(
  2,
  <A, B>(self: Box.Box<A>, that: Box.Box<B>): Box.Box<A | B> =>
    hcat([self, that], top)
);

/** @internal */
export const hcatWithSpace = dual<
  <B>(that: Box.Box<B>) => <A>(self: Box.Box<A>) => Box.Box<A | B>,
  <A, B>(self: Box.Box<A>, that: Box.Box<B>) => Box.Box<A | B>
>(
  2,
  <A, B>(self: Box.Box<A>, that: Box.Box<B>): Box.Box<A | B> =>
    hcat([self, emptyBox(0, 1), that], top)
);

/** @internal */
export const vAppend = dual<
  <B>(that: Box.Box<B>) => <A>(self: Box.Box<A>) => Box.Box<A | B>,
  <A, B>(self: Box.Box<A>, that: Box.Box<B>) => Box.Box<A | B>
>(
  2,
  <A, B>(self: Box.Box<A>, that: Box.Box<B>): Box.Box<A | B> =>
    vcat([self, that], left)
);

/** @internal */
export const vcatWithSpace = dual<
  <B>(that: Box.Box<B>) => <A>(self: Box.Box<A>) => Box.Box<A | B>,
  <A, B>(self: Box.Box<A>, that: Box.Box<B>) => Box.Box<A | B>
>(
  2,
  <A, B>(self: Box.Box<A>, that: Box.Box<B>): Box.Box<A | B> =>
    vcat([self, emptyBox(1, 0), that], left)
);

/** @internal */
export const punctuateH = dual<
  <A, T extends readonly Box.Box<unknown>[]>(
    a: Box.Alignment,
    p: Box.Box<A>
  ) => (self: T) => Box.Box<A | Box.BoxAnnotations<T>>,
  <A, T extends readonly Box.Box<unknown>[]>(
    self: T,
    a: Box.Alignment,
    p: Box.Box<A>
  ) => Box.Box<A | Box.BoxAnnotations<T>>
>(
  3,
  <A, T extends readonly Box.Box<unknown>[]>(
    self: T,
    a: Box.Alignment,
    p: Box.Box<A>
  ): Box.Box<A | Box.BoxAnnotations<T>> => {
    if (self.length === 0) {
      return nullBox;
    }
    return hcat(Array.intersperse(self, p), a);
  }
);

/** @internal */
export const punctuateV = dual<
  <A, T extends readonly Box.Box<unknown>[]>(
    a: Box.Alignment,
    p: Box.Box<A>
  ) => (self: T) => Box.Box<A | Box.BoxAnnotations<T>>,
  <A, T extends readonly Box.Box<unknown>[]>(
    self: T,
    a: Box.Alignment,
    p: Box.Box<A>
  ) => Box.Box<A | Box.BoxAnnotations<T>>
>(
  3,
  <A, T extends readonly Box.Box<unknown>[]>(
    self: T,
    a: Box.Alignment,
    p: Box.Box<A>
  ): Box.Box<A | Box.BoxAnnotations<T>> => {
    if (self.length === 0) {
      return nullBox;
    }
    return vcat(Array.intersperse(self, p), a);
  }
);

/** @internal */
export const hsep = dual<
  (
    sep: number,
    a: Box.Alignment
  ) => <A>(self: readonly Box.Box<A>[]) => Box.Box<A>,
  <A>(self: readonly Box.Box<A>[], sep: number, a: Box.Alignment) => Box.Box<A>
>(
  3,
  <A>(self: readonly Box.Box<A>[], sep: number, a: Box.Alignment): Box.Box<A> =>
    punctuateH(self, a, emptyBox(0, sep))
);

/** @internal */
export const vsep = dual<
  (
    sep: number,
    a: Box.Alignment
  ) => <A>(self: readonly Box.Box<A>[]) => Box.Box<A>,
  <A>(self: readonly Box.Box<A>[], sep: number, a: Box.Alignment) => Box.Box<A>
>(
  3,
  <A>(self: readonly Box.Box<A>[], sep: number, a: Box.Alignment): Box.Box<A> =>
    punctuateV(self, a, emptyBox(sep, 0))
);

/*
 *  --------------------------------------------------------------------------------
 *  --  Paragraph flowing  ---------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

interface ParaContent {
  readonly fullLines: readonly (readonly string[])[];
  readonly lastLine: readonly string[];
}

interface Para {
  readonly width: number;
  readonly content: ParaContent;
}

const emptyPara = (paraWidth: number): Para => ({
  width: paraWidth,
  content: {
    fullLines: [],
    lastLine: [],
  },
});

/** @internal */
export const columns = dual<
  (a: Box.Alignment, w: number, h: number) => (self: string) => Box.Box[],
  (self: string, a: Box.Alignment, w: number, h: number) => Box.Box[]
>(4, (self, a, w, h) =>
  pipe(self, flow(w), Array.chunksOf(h), Array.map(mkParaBox(a, h)))
);

const mkParaBox = dual<
  (a: Box.Alignment, n: number) => (self: string[]) => Box.Box,
  (self: string[], a: Box.Alignment, n: number) => Box.Box
>(3, (self, a, n) => {
  if (self.length === 0) {
    return emptyBox(n, 0);
  }
  if (self.length === 1 && self[0] === "") {
    return emptyBox(n, 0);
  }
  return pipe(self, Array.map(text), vcat(a), alignVert(top, n));
});

const whitespaceRegex = /\s+/;

const flow = dual<
  (width: number) => (self: string) => string[],
  (self: string, width: number) => string[]
>(2, (self, width) => {
  if (self.trim() === "") {
    return [""];
  }

  return pipe(
    self,
    String.split(whitespaceRegex),
    Array.filter((word) => word.length > 0),
    Array.reduce(emptyPara(width), addWordP),
    getLines,
    Array.map((line) => Width.sliceColumns(line, 0, width))
  );
});

const getLines = ({ content: { fullLines, lastLine } }: Para): string[] => {
  const process = (lines: readonly (readonly string[])[]): string[] =>
    pipe(
      Array.fromIterable(lines),
      Array.reverse,
      Array.map((line) => pipe(line, Array.reverse, Array.join(" ")))
    );

  return process(lastLine.length === 0 ? fullLines : [lastLine, ...fullLines]);
};

const addWordP = (para: Para, word: string): Para => ({
  width: para.width,
  content: wordFits(para, word)
    ? {
        fullLines: para.content.fullLines,
        lastLine: [word, ...para.content.lastLine] as readonly string[],
      }
    : {
        fullLines:
          para.content.lastLine.length === 0
            ? para.content.fullLines
            : ([
                para.content.lastLine,
                ...para.content.fullLines,
              ] as readonly (readonly string[])[]),
        lastLine: [word] as readonly string[],
      },
});

const wordFits = (
  { content: paraContent, width: paraWidth }: Para,
  word: string
): boolean => {
  if (paraContent.lastLine.length === 0) {
    return Width.ofString(word) <= paraWidth;
  }
  const currentLength = paraContent.lastLine.reduce(
    (acc: number, word: string) => acc + Width.ofString(word),
    paraContent.lastLine.length - 1
  );
  return currentLength + 1 + Width.ofString(word) <= paraWidth;
};

/*
 *  --------------------------------------------------------------------------------
 *  --  Box.Alignment  -----------------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/** @internal */
export const alignHoriz = dual<
  (a: Box.Alignment, c: number) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, a: Box.Alignment, c: number) => Box.Box<A>
>(
  3,
  <A>(self: Box.Box<A>, a: Box.Alignment, c: number): Box.Box<A> =>
    align(self, a, left, self.rows, c)
);

/** @internal */
export const alignVert = dual<
  (a: Box.Alignment, r: number) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, a: Box.Alignment, r: number) => Box.Box<A>
>(
  3,
  <A>(self: Box.Box<A>, a: Box.Alignment, r: number): Box.Box<A> =>
    align(self, top, a, r, self.cols)
);

/** @internal */
export const align = dual<
  (
    ah: Box.Alignment,
    av: Box.Alignment,
    r: number,
    c: number
  ) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(
    self: Box.Box<A>,
    ah: Box.Alignment,
    av: Box.Alignment,
    r: number,
    c: number
  ) => Box.Box<A>
>(
  5,
  <A>(
    self: Box.Box<A>,
    ah: Box.Alignment,
    av: Box.Alignment,
    r: number,
    c: number
  ): Box.Box<A> =>
    make({
      rows: r,
      cols: c,
      content: {
        _tag: "SubBox",
        xAlign: ah,
        yAlign: av,
        box: self,
      },
    })
);

/** @internal */
export const alignLeft = <A>(self: Box.Box<A>): Box.Box<A> =>
  alignHoriz(self, left, self.cols);

/** @internal */
export const moveUp = dual<
  (n: number) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, n: number) => Box.Box<A>
>(
  2,
  <A>(self: Box.Box<A>, n: number): Box.Box<A> =>
    alignVert(self, top, self.rows + n)
);

/** @internal */
export const moveDown = dual<
  (n: number) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, n: number) => Box.Box<A>
>(
  2,
  <A>(self: Box.Box<A>, n: number): Box.Box<A> =>
    alignVert(self, bottom, self.rows + n)
);

/** @internal */
export const moveLeft = dual<
  (n: number) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, n: number) => Box.Box<A>
>(
  2,
  <A>(self: Box.Box<A>, n: number): Box.Box<A> =>
    alignHoriz(self, left, self.cols + n)
);

/** @internal */
export const moveRight = dual<
  (n: number) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, n: number) => Box.Box<A>
>(
  2,
  <A>(self: Box.Box<A>, n: number): Box.Box<A> =>
    alignHoriz(self, right, self.cols + n)
);

/** @internal */
export const merge = (renderedBoxes: string[][]): string[] => {
  if (renderedBoxes.length === 0) {
    return [];
  }

  const maxLines = Math.max(...renderedBoxes.map((lines) => lines.length));
  const result: string[] = [];

  // Optimize string concatenation with Array.join() instead of O(n²) += operations
  for (let rowIndex = 0; rowIndex < maxLines; rowIndex++) {
    const lineParts: string[] = [];
    for (const box of renderedBoxes) {
      lineParts.push(box[rowIndex] ?? "");
    }
    result.push(lineParts.join(""));
  }

  return result;
};

/** @internal */
export const takeP = dual<
  <A>(a: A, n: number) => (self: readonly A[]) => A[],
  <A>(self: readonly A[], a: A, n: number) => A[]
>(3, (self, a, n) => {
  if (n <= 0) {
    return [];
  }
  if (self.length === 0) {
    return Array.makeBy(n, () => a);
  }
  if (n <= self.length) {
    return self.slice(0, n);
  }
  return [...self, ...Array.makeBy(n - self.length, () => a)];
});

/** @internal */
export const takePA = dual<
  <A>(alignment: Box.Alignment, a: A, n: number) => (self: readonly A[]) => A[],
  <A>(self: readonly A[], alignment: Box.Alignment, a: A, n: number) => A[]
>(4, <A>(self: readonly A[], alignment: Box.Alignment, a: A, n: number) => {
  if (n <= 0) {
    return [];
  }

  const numRev = (align: Box.Alignment, size: number): number =>
    Match.value(align).pipe(
      Match.when("AlignFirst", () => 0),
      Match.when("AlignLast", () => size),
      Match.when("AlignCenter1", () => Math.ceil(size / 2)),
      Match.when("AlignCenter2", () => Math.floor(size / 2)),
      Match.exhaustive
    );

  const numFwd = (align: Box.Alignment, size: number): number =>
    Match.value(align).pipe(
      Match.when("AlignFirst", () => size),
      Match.when("AlignLast", () => 0),
      Match.when("AlignCenter1", () => Math.floor(size / 2)),
      Match.when("AlignCenter2", () => Math.ceil(size / 2)),
      Match.exhaustive
    );

  const splitPos = numRev(alignment, self.length);
  const prefix = [...self.slice(0, splitPos)].reverse();
  const suffix = self.slice(splitPos);

  return [
    ...takeP(prefix, a, numRev(alignment, n)).reverse(),
    ...takeP(suffix, a, numFwd(alignment, n)),
  ];
});

/** @internal */
export const blanks = (n: number): string =>
  pipe(" ", String.repeat(Math.max(0, n)));

/** @internal */
export const resizeBox = dual<
  (r: number, c: number) => (self: string[]) => string[],
  (self: string[], r: number, c: number) => string[]
>(3, (self, r, c) =>
  pipe(
    self.map((line) => Width.fitString(line, c, left)),
    takeP(blanks(c), r)
  )
);

/** @internal */
export const resizeBoxAligned =
  (r: number, c: number, ha: Box.Alignment, va: Box.Alignment) =>
  (self: string[]) =>
    takePA(
      self.map((line) => Width.fitString(line, c, ha)),
      va,
      blanks(c),
      r
    );

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

/** @internal */
export const match = dual<
  <A, R>(patterns: {
    readonly blank: () => R;
    readonly text: (text: string) => R;
    readonly row: (boxes: Box.Box<A>[]) => R;
    readonly col: (boxes: Box.Box<A>[]) => R;
    readonly subBox: (
      box: Box.Box<A>,
      xAlign: Box.Alignment,
      yAlign: Box.Alignment
    ) => R;
  }) => (self: Box.Box<A>) => R,
  <A, R>(
    self: Box.Box<A>,
    patterns: {
      readonly blank: () => R;
      readonly text: (text: string) => R;
      readonly row: (boxes: Box.Box<A>[]) => R;
      readonly col: (boxes: Box.Box<A>[]) => R;
      readonly subBox: (
        box: Box.Box<A>,
        xAlign: Box.Alignment,
        yAlign: Box.Alignment
      ) => R;
    }
  ) => R
>(
  2,
  <A, R>(
    self: Box.Box<A>,
    patterns: {
      readonly blank: () => R;
      readonly text: (text: string) => R;
      readonly row: (boxes: Box.Box<A>[]) => R;
      readonly col: (boxes: Box.Box<A>[]) => R;
      readonly subBox: (
        box: Box.Box<A>,
        xAlign: Box.Alignment,
        yAlign: Box.Alignment
      ) => R;
    }
  ): R => {
    switch (self.content._tag) {
      case "Blank": {
        return patterns.blank();
      }
      case "Text": {
        return patterns.text(self.content.text);
      }
      case "Row": {
        return patterns.row(self.content.boxes);
      }
      case "Col": {
        return patterns.col(self.content.boxes);
      }
      case "SubBox": {
        return patterns.subBox(
          self.content.box,
          self.content.xAlign,
          self.content.yAlign
        );
      }
    }
  }
);

/*
 *  --------------------------------------------------------------------------------
 *  --  Annotation Functions  ------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/** @internal */
export const annotate = dual<
  <A>(
    annotation: import("../Annotation.js").Annotation<A>
  ) => <B>(self: Box.Box<B>) => Box.Box<A>,
  <B, A>(
    self: Box.Box<B>,
    annotation: import("../Annotation.js").Annotation<A>
  ) => Box.Box<A>
>(
  2,
  <B, A>(
    self: Box.Box<B>,
    annotation: import("../Annotation.js").Annotation<A>
  ): Box.Box<A> =>
    make({
      rows: self.rows,
      cols: self.cols,
      content: self.content as Box.Content<A>, // Cast is safe - content structure is preserved
      annotation,
    })
);

/** @internal */
export const unAnnotate = <A>(self: Box.Box<A>): Box.Box<never> => {
  let content: Box.Content<never>;
  switch (self.content._tag) {
    case "Blank": {
      content = { _tag: "Blank" };
      break;
    }
    case "Text": {
      content = { _tag: "Text", text: self.content.text };
      break;
    }
    case "Row": {
      content = { _tag: "Row", boxes: self.content.boxes.map(unAnnotate) };
      break;
    }
    case "Col": {
      content = { _tag: "Col", boxes: self.content.boxes.map(unAnnotate) };
      break;
    }
    case "SubBox": {
      content = {
        _tag: "SubBox",
        xAlign: self.content.xAlign,
        yAlign: self.content.yAlign,
        box: unAnnotate(self.content.box),
      };
      break;
    }
  }

  return make({
    rows: self.rows,
    cols: self.cols,
    content,
  });
};

/** @internal */
export const reAnnotate = dual<
  <A, B>(transform: (annotation: A) => B) => (self: Box.Box<A>) => Box.Box<B>,
  <A, B>(self: Box.Box<A>, transform: (annotation: A) => B) => Box.Box<B>
>(2, <A, B>(self: Box.Box<A>, transform: (annotation: A) => B): Box.Box<B> => {
  if (!self.annotation) {
    throw new Error("Cannot reAnnotate: Box has no annotation to transform");
  }

  return make({
    rows: self.rows,
    cols: self.cols,
    content: self.content as Box.Content<B>, // Safe cast - content structure preserved
    annotation: {
      ...self.annotation,
      data: transform(self.annotation.data),
    } as Annotation.Annotation<B>,
  });
});

/** @internal */
export const alterAnnotation = dual<
  <A, B>(alter: (annotation: A) => B[]) => (self: Box.Box<A>) => Box.Box<B>[],
  <A, B>(self: Box.Box<A>, alter: (annotation: A) => B[]) => Box.Box<B>[]
>(2, <A, B>(self: Box.Box<A>, alter: (annotation: A) => B[]): Box.Box<B>[] => {
  // Box must have an annotation to alter
  if (!self.annotation) {
    throw new Error("Cannot alter annotations on a box without annotation");
  }

  // Apply alter function to get array of new annotations
  const newAnnotations = alter(self.annotation.data);

  // Helper to recursively process content
  // We don't alter annotations in nested content - only the top-level box annotation
  const processContent = (content: Box.Content<A>): Box.Content<B> => {
    return pipe(
      content,
      Match.type<Box.Content<A>>().pipe(
        Match.tag("Blank", (blank) => blank),
        Match.tag("Text", (text) => text),
        Match.tag("Row", ({ boxes }) => ({
          _tag: "Row" as const,
          boxes: boxes as unknown as Box.Box<B>[], // Type cast - nested boxes maintain their structure
        })),
        Match.tag("Col", ({ boxes }) => ({
          _tag: "Col" as const,
          boxes: boxes as unknown as Box.Box<B>[], // Type cast - nested boxes maintain their structure
        })),
        Match.tag("SubBox", ({ box, xAlign, yAlign }) => ({
          _tag: "SubBox" as const,
          box: box as unknown as Box.Box<B>, // Type cast - nested box maintains its structure
          xAlign,
          yAlign,
        })),
        Match.exhaustive
      )
    );
  };

  // Create a box for each new annotation
  return newAnnotations.map((newAnnotation) =>
    make({
      rows: self.rows,
      cols: self.cols,
      content: processContent(self.content),
      annotation: {
        ...self.annotation,
        data: newAnnotation,
      } as import("../Annotation.js").Annotation<B>,
    })
  );
});

/** @internal */
export const alterAnnotate = alterAnnotation;

// --------------------------------------------------------------------------------
// --  Border  --------------------------------------------------------------------
// --------------------------------------------------------------------------------

/** @internal */
export interface BorderChars {
  readonly topLeft: string;
  readonly topRight: string;
  readonly bottomLeft: string;
  readonly bottomRight: string;
  readonly horizontal: string;
  readonly vertical: string;
}

/** @internal */
export const singleBorder: BorderChars = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
};

/** @internal */
export const doubleBorder: BorderChars = {
  topLeft: "╔",
  topRight: "╗",
  bottomLeft: "╚",
  bottomRight: "╝",
  horizontal: "═",
  vertical: "║",
};

/** @internal */
export const roundedBorder: BorderChars = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
};

/** @internal */
export const thickBorder: BorderChars = {
  topLeft: "┏",
  topRight: "┓",
  bottomLeft: "┗",
  bottomRight: "┛",
  horizontal: "━",
  vertical: "┃",
};

/** @internal */
export const asciiBorder: BorderChars = {
  topLeft: "+",
  topRight: "+",
  bottomLeft: "+",
  bottomRight: "+",
  horizontal: "-",
  vertical: "|",
};

/** @internal */
export type BorderStyle = "single" | "double" | "rounded" | "thick" | "ascii";

/** @internal */
const borderStyleToChars = (style: BorderStyle): BorderChars => {
  switch (style) {
    case "single":
      return singleBorder;
    case "double":
      return doubleBorder;
    case "rounded":
      return roundedBorder;
    case "thick":
      return thickBorder;
    case "ascii":
      return asciiBorder;
  }
};

/** @internal */
export interface BorderOptions<A> {
  readonly annotation?: Annotation.Annotation<A>;
  readonly sides?: {
    readonly top?: boolean; // default: true
    readonly right?: boolean; // default: true
    readonly bottom?: boolean; // default: true
    readonly left?: boolean; // default: true
  };
}

/** @internal */
export const border = dual<
  <B>(
    style?: BorderStyle,
    options?: BorderOptions<B>
  ) => <A>(self: Box.Box<A>) => Box.Box<A | B>,
  <A, B>(
    self: Box.Box<A>,
    style?: BorderStyle,
    options?: BorderOptions<B>
  ) => Box.Box<A | B>
>(
  (args) => isBox(args[0]),
  <A, B>(
    self: Box.Box<A>,
    style: BorderStyle = "single",
    options?: BorderOptions<B>
  ): Box.Box<A | B> => {
    const chars = borderStyleToChars(style);

    const borderChar = (c: string): Box.Box<A | B> =>
      options?.annotation ? annotate(char(c), options.annotation) : char(c);

    const borderText = (s: string): Box.Box<A | B> =>
      options?.annotation ? annotate(text(s), options.annotation) : text(s);

    const when = (cond: boolean, box: Box.Box<A | B>): Box.Box<A | B> =>
      cond ? box : nullBox;

    const sideCol = vcat(
      Array.makeBy(self.rows, () => borderChar(chars.vertical)),
      left
    );

    const {
      top: wTop = true,
      right: wRight = true,
      bottom: wBottom = true,
      left: wLeft = true,
    } = options?.sides ?? {};

    const topBorder = when(
      wTop,
      hcat(
        [
          when(wLeft, borderChar(chars.topLeft)),
          borderText(chars.horizontal.repeat(self.cols)),
          when(wRight, borderChar(chars.topRight)),
        ],
        top
      )
    );

    const bottomBorder = when(
      wBottom,
      hcat(
        [
          when(wLeft, borderChar(chars.bottomLeft)),
          borderText(chars.horizontal.repeat(self.cols)),
          when(wRight, borderChar(chars.bottomRight)),
        ],
        top
      )
    );

    return vcat(
      [
        topBorder,
        hcat([when(wLeft, sideCol), self, when(wRight, sideCol)], top),
        bottomBorder,
      ],
      left
    );
  }
);

// --------------------------------------------------------------------------------
// --  Padding  -------------------------------------------------------------------
// --------------------------------------------------------------------------------

/** @internal */
const resolvePadding = (
  args: readonly number[]
): readonly [top: number, right: number, bottom: number, left: number] => {
  const a = args[0] ?? 0;
  const b = args[1] ?? a;
  const c = args[2] ?? a;
  const d = args[3] ?? b;
  return Match.value(args.length).pipe(
    Match.when(0, () => [0, 0, 0, 0] as const),
    Match.when(1, () => [a, a, a, a] as const),
    Match.when(2, () => [a, b, a, b] as const),
    Match.when(4, () => [a, b, c, d] as const),
    Match.orElse(() => [0, 0, 0, 0] as const)
  );
};

/** @internal */
export const pad = dual<
  <A>(
    first: number,
    second?: number,
    third?: number,
    fourth?: number
  ) => (self: Box.Box<A>) => Box.Box<A>,
  <A>(
    self: Box.Box<A>,
    first: number,
    second?: number,
    third?: number,
    fourth?: number
  ) => Box.Box<A>
>(
  (args) => isBox(args[0]),
  <A>(
    self: Box.Box<A>,
    first: number,
    second?: number,
    third?: number,
    fourth?: number
  ): Box.Box<A> => {
    const args = Array.filter(
      [second, third, fourth],
      (n): n is number => n !== undefined
    );
    const [t, r, b, l] = resolvePadding([first, ...args]);
    const totalCols = l + self.cols + r;

    return vcat(
      [
        emptyBox(t, totalCols),
        hcat([emptyBox(self.rows, l), self, emptyBox(self.rows, r)], top),
        emptyBox(b, totalCols),
      ],
      left
    );
  }
);

// --------------------------------------------------------------------------------
// --  Truncation  ----------------------------------------------------------------
// --------------------------------------------------------------------------------

/** @internal */
const truncateWidth = <A>(
  self: Box.Box<A>,
  width: number,
  onText: (text: string) => Box.Box<A>
): Box.Box<A> => {
  if (self.cols <= width) return self;

  const go = (box: Box.Box<A>): Box.Box<A> =>
    match(box, {
      blank: () => emptyBox(box.rows, width),
      text: (t) => onText(t),
      row: () =>
        make({
          rows: box.rows,
          cols: width,
          content: { _tag: "SubBox", xAlign: left, yAlign: top, box },
          annotation: box.annotation,
        }),
      col: (boxes) =>
        make({
          rows: box.rows,
          cols: width,
          content: { _tag: "Col", boxes: boxes.map(go) },
          annotation: box.annotation,
        }),
      subBox: (inner, xAlign, yAlign) =>
        make({
          rows: box.rows,
          cols: width,
          content: { _tag: "SubBox", xAlign, yAlign, box: go(inner) },
          annotation: box.annotation,
        }),
    });

  const result = go(self);
  if (self.annotation && !result.annotation) {
    return make({
      rows: result.rows,
      cols: result.cols,
      content: result.content,
      annotation: self.annotation,
    });
  }
  return result;
};

const preserveAnnotation = <A>(
  self: Box.Box<A>,
  that: Box.Box<A>
): Box.Box<A> =>
  self.annotation && !that.annotation
    ? make({
        rows: that.rows,
        cols: that.cols,
        content: that.content,
        annotation: self.annotation,
      })
    : that;

const alignedCrop = (
  alignment: Box.Alignment,
  outerSize: number,
  innerSize: number,
  offset: number,
  size: number
): {
  readonly leadingBlank: number;
  readonly innerOffset: number;
  readonly innerSize: number;
  readonly trailingBlank: number;
} => {
  const innerStart = alignmentOffset(alignment, outerSize - innerSize);
  const innerEnd = innerStart + innerSize;
  const cropEnd = offset + size;
  const visibleStart = Math.max(offset, innerStart);
  const visibleEnd = Math.min(cropEnd, innerEnd);
  const visibleSize = Math.max(0, visibleEnd - visibleStart);
  const leadingBlank = Math.min(size, Math.max(0, innerStart - offset));

  return {
    leadingBlank,
    innerOffset: Math.max(0, offset - innerStart),
    innerSize: visibleSize,
    trailingBlank: size - leadingBlank - visibleSize,
  };
};

/** @internal */
export const cropWidth = dual<
  (offset: number, width: number) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, offset: number, width: number) => Box.Box<A>
>(3, <A>(self: Box.Box<A>, offset: number, width: number): Box.Box<A> => {
  const start = Math.max(0, offset);
  const targetWidth = Math.min(
    Math.max(0, width),
    Math.max(0, self.cols - start)
  );

  if (start === 0 && self.cols <= targetWidth) return self;

  const go = (
    box: Box.Box<A>,
    columnOffset: number,
    columnsToKeep: number
  ): Box.Box<A> =>
    match(box, {
      blank: () =>
        preserveAnnotation(
          box,
          emptyBox(
            box.rows,
            Math.min(columnsToKeep, Math.max(0, box.cols - columnOffset))
          )
        ),
      text: (text) =>
        preserveAnnotation(
          box,
          unsafeLine(Width.sliceColumns(text, columnOffset, columnsToKeep))
        ),
      row: (boxes) => {
        const cropped: Box.Box<A>[] = [];
        let skipped = columnOffset;
        let remaining = columnsToKeep;

        for (const child of boxes) {
          if (remaining <= 0) break;
          if (skipped >= child.cols) {
            skipped -= child.cols;
            continue;
          }

          const childCols = Math.min(remaining, child.cols - skipped);
          cropped.push(go(child, skipped, childCols));
          remaining -= childCols;
          skipped = 0;
        }

        return cropped.length === 0
          ? emptyBox(box.rows, columnsToKeep)
          : hcat(cropped, top);
      },
      col: (boxes) =>
        make({
          rows: box.rows,
          cols: columnsToKeep,
          content: {
            _tag: "Col",
            boxes: boxes.map((child) => go(child, columnOffset, columnsToKeep)),
          },
          annotation: box.annotation,
        }),
      subBox: (inner, xAlign, yAlign) => {
        const crop = alignedCrop(
          xAlign,
          box.cols,
          inner.cols,
          columnOffset,
          columnsToKeep
        );

        if (crop.innerSize === 0) {
          return preserveAnnotation(box, emptyBox(box.rows, columnsToKeep));
        }

        const content = alignVert(
          go(inner, crop.innerOffset, crop.innerSize),
          yAlign,
          box.rows
        );

        return preserveAnnotation(
          box,
          hcat(
            [
              emptyBox(box.rows, crop.leadingBlank),
              content,
              emptyBox(box.rows, crop.trailingBlank),
            ],
            top
          )
        );
      },
    });

  const result = go(self, start, targetWidth);
  return preserveAnnotation(self, result);
});

const cropHeightInternal = <A>(
  self: Box.Box<A>,
  offset: number,
  height: number
): Box.Box<A> => {
  const start = Math.max(0, offset);
  const targetHeight = Math.min(
    Math.max(0, height),
    Math.max(0, self.rows - start)
  );

  if (start === 0 && self.rows <= targetHeight) return self;

  const go = (
    box: Box.Box<A>,
    rowOffset: number,
    rowsToKeep: number
  ): Box.Box<A> =>
    match(box, {
      blank: () =>
        preserveAnnotation(
          box,
          emptyBox(
            Math.min(rowsToKeep, Math.max(0, box.rows - rowOffset)),
            box.cols
          )
        ),
      text: () =>
        rowOffset === 0 && rowsToKeep > 0 ? box : emptyBox(0, box.cols),
      row: (boxes) =>
        make({
          rows: rowsToKeep,
          cols: box.cols,
          content: {
            _tag: "Row",
            boxes: boxes.map((child) => go(child, rowOffset, rowsToKeep)),
          },
          annotation: box.annotation,
        }),
      col: (boxes) => {
        const cropped: Box.Box<A>[] = [];
        let skipped = rowOffset;
        let remaining = rowsToKeep;

        for (const child of boxes) {
          if (remaining <= 0) break;
          if (skipped >= child.rows) {
            skipped -= child.rows;
            continue;
          }

          const childRows = Math.min(remaining, child.rows - skipped);
          cropped.push(go(child, skipped, childRows));
          remaining -= childRows;
          skipped = 0;
        }

        return cropped.length === 0
          ? emptyBox(rowsToKeep, box.cols)
          : make({
              rows: rowsToKeep,
              cols: box.cols,
              content: { _tag: "Col", boxes: cropped },
              annotation: box.annotation,
            });
      },
      subBox: (inner, xAlign, yAlign) => {
        const crop = alignedCrop(
          yAlign,
          box.rows,
          inner.rows,
          rowOffset,
          rowsToKeep
        );

        if (crop.innerSize === 0) {
          return preserveAnnotation(box, emptyBox(rowsToKeep, box.cols));
        }

        const content = alignHoriz(
          go(inner, crop.innerOffset, crop.innerSize),
          xAlign,
          box.cols
        );

        return preserveAnnotation(
          box,
          vcat(
            [
              emptyBox(crop.leadingBlank, box.cols),
              content,
              emptyBox(crop.trailingBlank, box.cols),
            ],
            left
          )
        );
      },
    });

  const result = go(self, start, targetHeight);
  return preserveAnnotation(self, result);
};

/** @internal */
export const cropHeight = dual<
  (offset: number, height: number) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, offset: number, height: number) => Box.Box<A>
>(3, cropHeightInternal);

/** @internal */
export const truncate = dual<
  (width: number, pos: Box.Alignment) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, width: number, pos: Box.Alignment) => Box.Box<A>
>(3, <A>(self: Box.Box<A>, width: number, pos: Box.Alignment): Box.Box<A> => {
  const ellipsis = "…";

  const truncateLine = (text: string): Box.Box<A> => {
    const textWidth = Width.ofString(text);

    if (textWidth <= width) {
      return unsafeLine(text);
    }

    if (width <= 1) {
      return unsafeLine(ellipsis);
    }

    const available = width - 1; // reserve 1 column for ellipsis

    const [prefixWidth, suffixWidth] = Match.value(pos).pipe(
      Match.when("AlignFirst", () => [available, 0] as const),
      Match.when("AlignLast", () => [0, available] as const),
      Match.when(
        "AlignCenter1",
        () =>
          [Math.ceil(available / 2), Math.floor(available / 2)] as const
      ),
      Match.when(
        "AlignCenter2",
        () =>
          [Math.floor(available / 2), Math.ceil(available / 2)] as const
      ),
      Match.exhaustive
    );

    return unsafeLine(
      Width.sliceColumns(text, 0, prefixWidth) +
        ellipsis +
        Width.sliceColumns(text, textWidth - suffixWidth, suffixWidth)
    );
  };

  return truncateWidth(self, width, truncateLine);
});

/** @internal */
export const minWidth = dual<
  (n: number) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, n: number) => Box.Box<A>
>(
  2,
  <A>(self: Box.Box<A>, n: number): Box.Box<A> =>
    self.cols >= n ? self : alignHoriz(self, left, n)
);

/** @internal */
export const maxWidth = dual<
  (n: number) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, n: number) => Box.Box<A>
>(
  2,
  <A>(self: Box.Box<A>, n: number): Box.Box<A> =>
    truncateWidth(self, n, (t) => unsafeLine(Width.sliceColumns(t, 0, n)))
);

/** @internal */
export const minHeight = dual<
  (n: number) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, n: number) => Box.Box<A>
>(
  2,
  <A>(self: Box.Box<A>, n: number): Box.Box<A> =>
    self.rows >= n ? self : alignVert(self, top, n)
);

/** @internal */
export const maxHeight = dual<
  (n: number) => <A>(self: Box.Box<A>) => Box.Box<A>,
  <A>(self: Box.Box<A>, n: number) => Box.Box<A>
>(2, <A>(self: Box.Box<A>, n: number): Box.Box<A> => {
  if (self.rows <= n) return self;

  return make({
    rows: n,
    cols: self.cols,
    content: { _tag: "SubBox", xAlign: left, yAlign: top, box: self },
    annotation: self.annotation,
  });
});
