/**
 * Terminal command sequences for cursor control and screen manipulation.
 *
 * Provides ANSI escape sequences as pure string values for cursor movement,
 * screen clearing, and alternate screen buffer management. Intended for
 * composing terminal UIs alongside box rendering.
 *
 * @see {@link cursorTo} — move cursor to absolute position
 * @see {@link clearScreen} — clear entire terminal screen
 * @see {@link altScreenEnter} — switch to alternate screen buffer
 *
 * @module
 */
import type { AnsiStyle } from "./Ansi.js";
import type { Box } from "./Box.js";
import * as internalAnsi from "./internal/cmd.js";

//  --------------------------------------------------------------------------------
//  --  Cursor Movement Commands  --------------------------------------------------
//  --------------------------------------------------------------------------------

/**
 * Moves the cursor up by the specified number of lines (default: 1).
 *
 * Creates a Box containing ANSI escape sequence for upward cursor movement.
 * Essential for building interactive terminal applications, animations,
 * and dynamic content updates.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 *
 * const moveUp = Cmd.cursorUp(3)
 * const output = Box.renderPrettySync(moveUp)
 * // Contains ANSI escape sequence to move cursor up 3 lines
 * ```
 *
 * @category movement
 */
export const cursorUp: (lines?: number) => Box<AnsiStyle> =
  internalAnsi.cursorUp;

/**
 * Moves the cursor down by the specified number of lines (default: 1).
 *
 * Creates a Box containing ANSI escape sequence for downward cursor movement.
 * Useful for advancing to next sections in terminal output or building
 * vertical navigation interfaces.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const stepByStepOutput = pipe(
 *   Box.vcat([
 *     Box.text("Step 1: Initialize").pipe(Box.annotate(Ansi.green)),
 *     Cmd.cursorDown(1),
 *     Box.text("Step 2: Process").pipe(Box.annotate(Ansi.yellow)),
 *     Cmd.cursorDown(1),
 *     Box.text("Step 3: Complete").pipe(Box.annotate(Ansi.green))
 *   ], Box.left)
 * )
 * ```
 *
 * @category movement
 */
export const cursorDown: (lines?: number) => Box<AnsiStyle> =
  internalAnsi.cursorDown;

/**
 * Moves the cursor right by the specified number of columns (default: 1).
 *
 * Creates a Box containing ANSI escape sequence for rightward cursor movement.
 * Essential for precise positioning within lines, creating indentation,
 * or building horizontal navigation interfaces.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import { pipe } from "effect"
 *
 * const indentedList = pipe(
 *   Box.vcat([
 *     Box.text("Main Item"),
 *     Box.hcat([
 *       Cmd.cursorForward(4),    // Indent 4 spaces
 *       Box.text("- Sub item 1")
 *     ], Box.left),
 *     Box.hcat([
 *       Cmd.cursorForward(4),
 *       Box.text("- Sub item 2")
 *     ], Box.left)
 *   ], Box.left)
 * )
 * ```
 *
 * @category movement
 */
export const cursorForward: (columns?: number) => Box<AnsiStyle> =
  internalAnsi.cursorForward;

/**
 * Moves the cursor left by the specified number of columns (default: 1).
 *
 * Creates a Box containing ANSI escape sequence for leftward cursor movement.
 * Useful for backtracking, correcting output positioning, or creating
 * dynamic updates that overwrite previous content.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const progressUpdate = pipe(
 *   Box.hcat([
 *     Box.text("Progress: 45%"),
 *     Cmd.cursorBackward(3),     // Move back to overwrite percentage
 *     Box.text("67%").pipe(Box.annotate(Ansi.green))
 *   ], Box.left)
 * )
 * ```
 *
 * @category movement
 */
export const cursorBackward: (columns?: number) => Box<AnsiStyle> =
  internalAnsi.cursorBackward;

/**
 * Moves the cursor to the specified position (0-based coordinates).
 *
 * Creates a Box containing ANSI escape sequence for absolute cursor positioning.
 * Essential for creating complex terminal layouts, updating specific screen
 * regions, or implementing cursor-based interfaces.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const statusAtPosition = pipe(
 *   Box.vcat([
 *     Cmd.cursorTo(0, 0),        // Top-left corner
 *     Box.text("System Status").pipe(Box.annotate(Ansi.bold)),
 *     Cmd.cursorTo(50, 0),       // Top-right area
 *     Box.text("Online").pipe(Box.annotate(Ansi.green))
 *   ], Box.left)
 * )
 * ```
 *
 * @category movement
 */
export const cursorTo: (column?: number, row?: number) => Box<AnsiStyle> =
  internalAnsi.cursorTo;

/**
 * Moves the cursor by the specified offset relative to current position.
 * Positive values move right/down, negative values move left/up.
 *
 * Creates a Box containing ANSI escape sequence for relative cursor movement.
 * Ideal for making incremental adjustments to cursor position without
 * knowing the absolute coordinates.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const correctTypo = pipe(
 *   Box.hcat([
 *     Box.text("Hello wrold!"),
 *     Cmd.cursorMove(-6, 0),     // Move back 6 characters
 *     Box.text("world").pipe(Box.annotate(Ansi.green))
 *   ], Box.left)
 * )
 * ```
 *
 * @category movement
 */
export const cursorMove: (column?: number, row?: number) => Box<AnsiStyle> =
  internalAnsi.cursorMove;

/**
 * Moves the cursor to the beginning of the next line, specified number of rows down.
 *
 * Creates a Box containing ANSI escape sequence that combines downward movement
 * with positioning at column 0. Equivalent to moving down and then to the
 * start of the line.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const structuredOutput = pipe(
 *   Box.vcat([
 *     Box.text("Section 1: Configuration"),
 *     Cmd.cursorNextLine(2),     // Skip a line, start fresh
 *     Box.text("Section 2: Processing").pipe(Box.annotate(Ansi.blue)),
 *     Cmd.cursorNextLine(2),
 *     Box.text("Section 3: Results").pipe(Box.annotate(Ansi.green))
 *   ], Box.left)
 * )
 * ```
 *
 * @category movement
 */
export const cursorNextLine: (rows?: number) => Box<AnsiStyle> =
  internalAnsi.cursorNextLine;

/**
 * Moves the cursor to the beginning of the previous line, specified number of rows up.
 *
 * Creates a Box containing ANSI escape sequence that combines upward movement
 * with positioning at column 0. Useful for updating previous output or
 * creating scrolling effects.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const updatePreviousStatus = pipe(
 *   Box.vcat([
 *     Box.text("Task 1: Running..."),
 *     Box.text("Task 2: Pending"),
 *     Cmd.cursorPrevLine(2),     // Go back to Task 1 line
 *     Box.text("Task 1: ✓ Complete").pipe(Box.annotate(Ansi.green))
 *   ], Box.left)
 * )
 * ```
 *
 * @category movement
 */
export const cursorPrevLine: (rows?: number) => Box<AnsiStyle> =
  internalAnsi.cursorPrevLine;

/*
 *  --------------------------------------------------------------------------------
 *  --  Position Save/Restore Commands  --------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Saves the current cursor position, encoding shift state, and formatting attributes.
 *
 * Creates a Box containing ANSI escape sequence that saves the current terminal
 * state. Essential for implementing complex terminal applications where you
 * need to temporarily move the cursor and then return to the original position.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const temporaryStatus = pipe(
 *   Box.vcat([
 *     Box.text("Main content here..."),
 *     Cmd.cursorSavePosition,     // Save current position
 *     Cmd.cursorTo(0, 0),         // Move to top for status
 *     Box.text("Status: Processing...").pipe(Box.annotate(Ansi.yellow)),
 *     Cmd.cursorRestorePosition,  // Return to saved position
 *     Box.text("Continuing main content...")
 *   ], Box.left)
 * )
 * ```
 *
 * @category state
 */
export const cursorSavePosition: Box<AnsiStyle> =
  internalAnsi.cursorSavePosition;

/**
 * Restores the cursor to the last saved position with encoding shift state and formatting.
 *
 * Creates a Box containing ANSI escape sequence that restores the terminal
 * state saved by `cursorSavePosition`. Must be used in pair with save operations
 * to properly restore cursor position and terminal attributes.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const saveRestoreDemo = pipe(
 *   Box.vcat([
 *     Box.text("Original position"),
 *     Cmd.cursorSavePosition,     // Save this position
 *     Cmd.cursorTo(30, 5),        // Move elsewhere
 *     Box.text("Temporary content").pipe(Box.annotate(Ansi.red)),
 *     Cmd.cursorRestorePosition,  // Back to original position
 *     Box.text(" - continued").pipe(Box.annotate(Ansi.green))
 *   ], Box.left)
 * )
 * ```
 *
 * @category state
 */
export const cursorRestorePosition: Box<AnsiStyle> =
  internalAnsi.cursorRestorePosition;

/*
 *  --------------------------------------------------------------------------------
 *  --  Cursor Visibility Commands  ------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Makes the cursor visible in the terminal.
 *
 * Creates a Box containing ANSI escape sequence to show the terminal cursor.
 * Essential for restoring normal cursor visibility after hiding it for
 * clean output displays or animation sequences.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const cleanOutputSequence = pipe(
 *   Box.vcat([
 *     Cmd.cursorHide,             // Hide cursor for clean display
 *     Box.text("Processing data...").pipe(Box.annotate(Ansi.blue)),
 *     Box.text("████████████████ 100%").pipe(Box.annotate(Ansi.green)),
 *     Box.text("Complete!").pipe(Box.annotate(Ansi.bold)),
 *     Cmd.cursorShow              // Restore cursor for user input
 *   ], Box.left)
 * )
 * ```
 *
 * @category visibility
 */
export const cursorShow: Box<AnsiStyle> = internalAnsi.cursorShow;

/**
 * Hides the cursor in the terminal.
 *
 * Creates a Box containing ANSI escape sequence to hide the terminal cursor.
 * Useful for creating clean output displays, progress indicators, or
 * animations where the blinking cursor would be distracting.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const progressBar = pipe(
 *   Box.vcat([
 *     Cmd.cursorHide,             // Hide cursor for clean display
 *     Box.text("Downloading...").pipe(Box.annotate(Ansi.blue)),
 *     Box.text("▓▓▓▓▓▓▓░░░ 70%").pipe(Box.annotate(Ansi.cyan)),
 *     Box.text("ETA: 30 seconds").pipe(Box.annotate(Ansi.dim))
 *   ], Box.left)
 * )
 * ```
 *
 * @category visibility
 */
export const cursorHide: Box<AnsiStyle> = internalAnsi.cursorHide;

/*
 *  --------------------------------------------------------------------------------
 *  --  Screen Erase Commands  -----------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Clears the entire screen and moves cursor to top-left position.
 *
 * Creates a Box containing ANSI escape sequence to completely clear the
 * terminal screen and reset cursor to home position. Essential for
 * creating fresh displays and implementing screen-based applications.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const newScreenDisplay = pipe(
 *   Box.vcat([
 *     Cmd.eraseScreen,            // Clear everything, cursor to top
 *     Box.text("╔═══════════════════════════════╗").pipe(Box.annotate(Ansi.cyan)),
 *     Box.text("║      APPLICATION STARTUP      ║").pipe(Box.annotate(Ansi.cyan)),
 *     Box.text("╚═══════════════════════════════╝").pipe(Box.annotate(Ansi.cyan)),
 *     Box.text(""),
 *     Box.text("Initializing...").pipe(Box.annotate(Ansi.yellow))
 *   ], Box.left)
 * )
 * ```
 *
 * @category erase
 */
export const eraseScreen: Box<AnsiStyle> = internalAnsi.eraseScreen;
/**
 * Clears the screen from current cursor position to the beginning.
 *
 * Creates a Box containing ANSI escape sequence to clear all content
 * from the current cursor position upward to the top of the screen.
 * Useful for clearing headers or top sections while preserving content below.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const refreshHeader = pipe(
 *   Box.vcat([
 *     Cmd.cursorTo(0, 5),         // Position below header area
 *     Cmd.eraseUp,                // Clear everything above this point
 *     Cmd.cursorTo(0, 0),         // Go to top for new header
 *     Box.text("NEW HEADER").pipe(Box.annotate(Ansi.bold)),
 *     Box.text("Updated: " + new Date().toLocaleTimeString())
 *   ], Box.left)
 * )
 * ```
 *
 * @category erase
 */
export const eraseUp: Box<AnsiStyle> = internalAnsi.eraseUp;

/**
 * Clears the screen from current cursor position to the end.
 *
 * Creates a Box containing ANSI escape sequence to clear all content
 * from the current cursor position downward to the bottom of the screen.
 * Ideal for clearing content below while preserving headers or navigation.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const refreshContent = pipe(
 *   Box.vcat([
 *     Box.text("═══ APPLICATION HEADER ═══").pipe(Box.annotate(Ansi.bold)),
 *     Box.text("Status: Online").pipe(Box.annotate(Ansi.green)),
 *     Cmd.eraseDown,              // Clear everything below header
 *     Box.text(""),
 *     Box.text("New content area").pipe(Box.annotate(Ansi.blue)),
 *     Box.text("Data refreshed at: " + new Date().toLocaleTimeString())
 *   ], Box.left)
 * )
 * ```
 *
 * @category erase
 */
export const eraseDown: Box<AnsiStyle> = internalAnsi.eraseDown;

/**
 * Clears the entire current line. The cursor position remains unchanged.
 *
 * Creates a Box containing ANSI escape sequence to completely clear the
 * current line while keeping the cursor at its current position. Perfect
 * for updating status lines or replacing line content.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const updateStatus = pipe(
 *   Box.vcat([
 *     Box.text("Processing file: document.txt"),
 *     Box.text("Status: Parsing..."),
 *     Cmd.cursorUp(1),            // Go back to status line
 *     Cmd.eraseLine,              // Clear the status line
 *     Box.text("Status: ✓ Complete").pipe(Box.annotate(Ansi.green))
 *   ], Box.left)
 * )
 * ```
 *
 * @category erase
 */
export const eraseLine: Box<AnsiStyle> = internalAnsi.eraseLine;

/**
 * Clears the current line from cursor position to the beginning.
 *
 * Creates a Box containing ANSI escape sequence to clear content from
 * the current cursor position backward to the start of the line.
 * Useful for selective line editing and partial content replacement.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const updateLinePrefix = pipe(
 *   Box.vcat([
 *     Box.text("ERROR: Failed to connect to server"),
 *     Cmd.cursorBackward(28),     // Move back to before "Failed"
 *     Cmd.eraseStartLine,         // Clear "ERROR: " prefix
 *     Box.text("SUCCESS:").pipe(Box.annotate(Ansi.green))
 *   ], Box.left)
 * )
 * ```
 *
 * @category erase
 */
export const eraseStartLine: Box<AnsiStyle> = internalAnsi.eraseStartLine;

/**
 * Clears the current line from cursor position to the end.
 *
 * Creates a Box containing ANSI escape sequence to clear content from
 * the current cursor position forward to the end of the line.
 * Essential for truncating lines and cleaning up trailing content.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const truncateOutput = pipe(
 *   Box.vcat([
 *     Box.text("File: very-long-filename-that-should-be-truncated.txt"),
 *     Cmd.cursorBackward(30),     // Move back to truncation point
 *     Cmd.eraseEndLine,           // Clear everything after cursor
 *     Box.text("...").pipe(Box.annotate(Ansi.dim))  // Add ellipsis
 *   ], Box.left)
 * )
 * ```
 *
 * @category erase
 */
export const eraseEndLine: Box<AnsiStyle> = internalAnsi.eraseEndLine;

/**
 * Erases content from current cursor position upwards by specified number of rows.
 *
 * Creates a Box containing ANSI escape sequence to clear a specific number
 * of lines above the current cursor position. Useful for clearing known
 * amounts of content while preserving other screen areas.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const clearPreviousOutput = pipe(
 *   Box.vcat([
 *     Box.text("Line 1: Old output"),
 *     Box.text("Line 2: Old output"),
 *     Box.text("Line 3: Old output"),
 *     Cmd.eraseLines(3),          // Clear the 3 lines above
 *     Box.text("Line 1: New output").pipe(Box.annotate(Ansi.green)),
 *     Box.text("Line 2: New output").pipe(Box.annotate(Ansi.green)),
 *     Box.text("Line 3: New output").pipe(Box.annotate(Ansi.green))
 *   ], Box.left)
 * )
 * ```
 *
 * @category erase
 */
export const eraseLines: (rows: number) => Box<AnsiStyle> =
  internalAnsi.eraseLines;

/**
 * Clears the content of the specified number of lines above the cursor
 * without deleting them from the scroll buffer.
 *
 * Unlike {@link eraseLines} which uses the DL (Delete Line) escape to remove
 * lines and scroll content upward, `clearLines` erases each line's content
 * in place and repositions the cursor to the beginning of the topmost
 * cleared line. This is the approach used by libraries like `ansi-escapes`
 * for rewriting previous output (spinners, progress bars, etc.).
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 *
 * // Clear 3 lines of previous output and overwrite
 * const update = Box.vcat([
 *   Cmd.clearLines(3),
 *   Box.text("Replaced line 1"),
 *   Box.text("Replaced line 2"),
 *   Box.text("Replaced line 3"),
 * ], Box.left)
 * ```
 *
 * @category erase
 */
export const clearLines: (rows: number) => Box<AnsiStyle> =
  internalAnsi.clearLines;

/*
 *  --------------------------------------------------------------------------------
 *  --  Utility Commands  ----------------------------------------------------------
 *  --------------------------------------------------------------------------------
 */

/**
 * Clears the entire screen and moves cursor to home position (0,0).
 *
 * Creates a Box containing ANSI escape sequence to completely clear the
 * terminal screen and position cursor at the top-left. Similar to `eraseScreen`
 * but specifically optimized for full screen resets.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const initializeApp = pipe(
 *   Box.vcat([
 *     Cmd.clearScreen,            // Start with clean screen
 *     Box.text("╔════════════════════════════════════════╗").pipe(Box.annotate(Ansi.cyan)),
 *     Box.text("║               WELCOME TO               ║").pipe(Box.annotate(Ansi.cyan)),
 *     Box.text("║            EFFECT BOXES CLI            ║").pipe(Box.annotate(Ansi.cyan)),
 *     Box.text("╚════════════════════════════════════════╝").pipe(Box.annotate(Ansi.cyan)),
 *     Box.text(""),
 *     Box.text("Loading...").pipe(Box.annotate(Ansi.yellow))
 *   ], Box.left)
 * )
 * ```
 *
 * @category utilities
 */
export const clearScreen: Box<AnsiStyle> = internalAnsi.clearScreen;

/**
 * Moves the cursor to the home position (top-left corner, 0,0).
 *
 * Creates a Box containing ANSI escape sequence to move the cursor to
 * the top-left corner of the terminal. Essential for returning to a
 * known position without clearing screen content.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const updateTopStatus = pipe(
 *   Box.vcat([
 *     Cmd.home,                   // Go to top-left
 *     Box.text("STATUS: ").pipe(Box.annotate(Ansi.bold)),
 *     Box.text("Connected").pipe(Box.annotate(Ansi.green)),
 *     Box.text(" | "),
 *     Box.text("Users: 42").pipe(Box.annotate(Ansi.blue))
 *   ], Box.left)
 * )
 * ```
 *
 * @category utilities
 */
export const home: Box<AnsiStyle> = internalAnsi.home;

/**
 * Triggers the terminal bell (beep sound).
 *
 * Creates a Box containing ANSI escape sequence to produce an audible
 * bell or visual flash in the terminal. Useful for alerts, notifications,
 * or indicating completion of long-running operations.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 * import * as Ansi from "effect-boxes/Ansi"
 * import { pipe } from "effect"
 *
 * const criticalAlert = pipe(
 *   Box.vcat([
 *     Cmd.bell,                   // Sound alert
 *     Box.text("⚠️  CRITICAL ERROR").pipe(Box.annotate(Ansi.red)),
 *     Box.text("System requires immediate attention"),
 *     Cmd.bell                    // Second alert for emphasis
 *   ], Box.left)
 * )
 * ```
 *
 * @category utilities
 */
export const bell: Box<AnsiStyle> = internalAnsi.bell;

/**
 * Switches the terminal to the alternate screen buffer.
 *
 * The alternate screen buffer is a separate terminal buffer (used by tools
 * like `vim`, `less`, and `fzf`) that has no scrollback history. Content
 * rendered on the alternate screen disappears completely when the terminal
 * switches back to the main screen via {@link altScreenLeave}.
 *
 * This is the correct primitive for rendering tall interactive content that
 * must be fully removed on dismiss, since `cursorUp` and `eraseDown` cannot
 * reach lines that have scrolled into the main buffer's scrollback.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 *
 * // Enter alternate screen, render content, then leave
 * const fullScreenUI = Box.combineAll([
 *   Cmd.altScreenEnter,
 *   Box.text("Full-screen interactive content"),
 * ])
 * ```
 *
 * @category utilities
 */
export const altScreenEnter: Box<AnsiStyle> = internalAnsi.altScreenEnter;

/**
 * Switches the terminal back to the main screen buffer.
 *
 * Restores the main screen buffer that was saved when {@link altScreenEnter}
 * was invoked. All content rendered on the alternate screen is discarded,
 * and the terminal display returns to its previous state.
 *
 * @example
 * ```typescript
 * import * as Cmd from "effect-boxes/Cmd"
 * import * as Box from "effect-boxes/Box"
 *
 * // Leave alternate screen to restore main buffer
 * const cleanup = Cmd.altScreenLeave
 * ```
 *
 * @category utilities
 */
export const altScreenLeave: Box<AnsiStyle> = internalAnsi.altScreenLeave;
