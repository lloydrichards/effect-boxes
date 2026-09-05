import { Array, Option, pipe } from "effect";
import type * as Ansi from "../Ansi.js";
import type * as Box from "../Box.js";
import { createAnnotation } from "./annotation.js";
import { annotate, nullBox } from "./box.js";

const ESC = "\x1b";
const CSI = `${ESC}[`;

const clamp = (n: number): number => Math.max(0, Math.floor(n));

const createCmdBox = (name: string, code: string): Box.Box<Ansi.AnsiStyle> => {
  const style: Ansi.AnsiStyle = [
    {
      _tag: "CommandAttribute",
      name,
      code,
    },
  ];
  return annotate(nullBox, createAnnotation(style));
};

//  --------------------------------------------------------------------------------
//  --  Cursor Movement Commands  --------------------------------------------------
//  --------------------------------------------------------------------------------

/** @internal */
export const cursorUp = (lines = 1): Box.Box<Ansi.AnsiStyle> =>
  createCmdBox("cursorUp", `${CSI}${clamp(lines)}A`);

/** @internal */
export const cursorDown = (lines = 1): Box.Box<Ansi.AnsiStyle> =>
  createCmdBox("cursorDown", `${CSI}${clamp(lines)}B`);

/** @internal */
export const cursorForward = (columns = 1): Box.Box<Ansi.AnsiStyle> =>
  createCmdBox("cursorForward", `${CSI}${clamp(columns)}C`);

/** @internal */
export const cursorBackward = (columns = 1): Box.Box<Ansi.AnsiStyle> =>
  createCmdBox("cursorBackward", `${CSI}${clamp(columns)}D`);

/** @internal */
export const cursorTo = (column = 0, row = 0): Box.Box<Ansi.AnsiStyle> =>
  createCmdBox("cursorTo", `${CSI}${clamp(row) + 1};${clamp(column) + 1}H`);

/** @internal */
export const cursorMove = (column = 0, row = 0): Box.Box<Ansi.AnsiStyle> =>
  createCmdBox(
    "cursorMove",
    pipe(
      [
        Option.liftPredicate(
          { value: clamp(Math.abs(row)), code: row > 0 ? "B" : "A" },
          (v) => v.value !== 0
        ),
        Option.liftPredicate(
          { value: clamp(Math.abs(column)), code: column > 0 ? "C" : "D" },
          (v) => v.value !== 0
        ),
      ],
      Array.filter(Option.isSome),
      Array.map((movement) => movement.value),
      Array.map((movement) => `${CSI}${movement.value}${movement.code}`),
      Array.join("")
    )
  );

/** @internal */
export const cursorNextLine = (rows = 1): Box.Box<Ansi.AnsiStyle> =>
  createCmdBox("cursorNextLine", `${CSI}${clamp(rows)}E`);

/** @internal */
export const cursorPrevLine = (rows = 1): Box.Box<Ansi.AnsiStyle> =>
  createCmdBox("cursorPrevLine", `${CSI}${clamp(rows)}F`);

/*
 *  --------------------------------------------------------------------------------
 *  --  Position Save/Restore Commands  --------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/** @internal */
export const cursorSavePosition: Box.Box<Ansi.AnsiStyle> = createCmdBox(
  "cursorSavePosition",
  `${ESC}7`
);

/** @internal */
export const cursorRestorePosition: Box.Box<Ansi.AnsiStyle> = createCmdBox(
  "cursorRestorePosition",
  `${ESC}8`
);

/*
 *  --------------------------------------------------------------------------------
 *  --  Cursor Visibility Commands  ------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/** @internal */
export const cursorShow: Box.Box<Ansi.AnsiStyle> = createCmdBox(
  "cursorShow",
  `${CSI}?25h`
);

/** @internal */
export const cursorHide: Box.Box<Ansi.AnsiStyle> = createCmdBox(
  "cursorHide",
  `${CSI}?25l`
);

/*
 *  --------------------------------------------------------------------------------
 *  --  Screen Erase Commands  -----------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/** @internal */
export const eraseScreen: Box.Box<Ansi.AnsiStyle> = createCmdBox(
  "eraseScreen",
  `${CSI}2J`
);

/** @internal */
export const eraseUp: Box.Box<Ansi.AnsiStyle> = createCmdBox(
  "eraseUp",
  `${CSI}1J`
);

/** @internal */
export const eraseDown: Box.Box<Ansi.AnsiStyle> = createCmdBox(
  "eraseDown",
  `${CSI}0J`
);

/** @internal */
export const eraseLine: Box.Box<Ansi.AnsiStyle> = createCmdBox(
  "eraseLine",
  `${CSI}2K`
);

/** @internal */
export const eraseStartLine: Box.Box<Ansi.AnsiStyle> = createCmdBox(
  "eraseStartLine",
  `${CSI}1K`
);

/** @internal */
export const eraseEndLine: Box.Box<Ansi.AnsiStyle> = createCmdBox(
  "eraseEndLine",
  `${CSI}0K`
);

/** @internal */
export const eraseLines = (rows: number): Box.Box<Ansi.AnsiStyle> =>
  createCmdBox("eraseLines", `${CSI}${clamp(rows)}M`);

/** @internal */
export const clearLines = (rows: number): Box.Box<Ansi.AnsiStyle> => {
  const n = clamp(rows);
  let code = "";
  for (let i = 0; i < n; i++) {
    code += `${CSI}2K${i < n - 1 ? `${CSI}1A` : ""}`;
  }
  if (n > 0) code += `${CSI}G`;
  return createCmdBox("clearLines", code);
};

/*
 *  --------------------------------------------------------------------------------
 *  --  Utility Commands  ----------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/** @internal */
export const clearScreen: Box.Box<Ansi.AnsiStyle> = createCmdBox(
  "clearScreen",
  `${CSI}2J${CSI}H`
);

/** @internal */
export const home: Box.Box<Ansi.AnsiStyle> = createCmdBox("home", `${CSI}H`);

/** @internal */
export const bell: Box.Box<Ansi.AnsiStyle> = createCmdBox("bell", "\x07");

/** @internal */
export const altScreenEnter: Box.Box<Ansi.AnsiStyle> = createCmdBox(
  "altScreenEnter",
  `${CSI}?1049h`
);

/** @internal */
export const altScreenLeave: Box.Box<Ansi.AnsiStyle> = createCmdBox(
  "altScreenLeave",
  `${CSI}?1049l`
);
