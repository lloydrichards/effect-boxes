import { BunServices } from "@effect/platform-bun";
import { Data, Effect, Match, pipe, Queue, Terminal } from "effect";
import { Prompt } from "effect/unstable/cli";
import * as Ansi from "effect-boxes/Ansi";
import * as Box from "effect-boxes/Box";
import * as Cmd from "effect-boxes/Cmd";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type LogLevel = "INFO" | "DEBUG" | "WARN" | "ERROR" | "FATAL";

type LogEntry = readonly [timestamp: string, level: LogLevel, message: string];

type LogViewerState = {
  readonly lines: ReadonlyArray<LogEntry>;
  readonly scrollOffset: number;
  readonly prevRows: number;
};

interface LogViewerOptions {
  readonly title: string;
  readonly height?: number;
  readonly events: Queue.Dequeue<LogEntry>;
}

const Action = Data.taggedEnum<Prompt.ActionDefinition>();

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const DEFAULT_HEIGHT = 16;

// ----------------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------------

const renderLayout = (
  state: LogViewerState,
  title: string,
  height: number,
  submitted: boolean
) =>
  Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal;
    const termWidth = yield* terminal.columns;
    const innerWidth = termWidth - 4; // border + padding

    if (submitted) {
      return Box.hsep(
        [
          Box.text("\u2714").pipe(Box.annotate(Ansi.green)),
          Box.text(title).pipe(Box.annotate(Ansi.bold)),
          Box.text(`(${state.lines.length} lines)`).pipe(
            Box.annotate(Ansi.dim)
          ),
        ],
        1,
        Box.top
      );
    }

    // Compute visible window
    const totalLines = state.lines.length;
    const visibleLines = state.lines.slice(
      state.scrollOffset,
      state.scrollOffset + height
    );

    // Build content box
    const contentBox =
      visibleLines.length === 0
        ? Box.text("Waiting for log data...").pipe(Box.annotate(Ansi.dim))
        : pipe(
            visibleLines.map((entry) => renderLogLine(entry)),
            (boxes) => Box.vcat(boxes, Box.left)
          );

    // Apply constraints: fixed height, max width with truncation
    const constrainedContent = pipe(
      contentBox,
      Box.minHeight(height),
      Box.maxHeight(height),
      Box.minWidth(innerWidth),
      Box.truncate(innerWidth, Box.left)
    );

    // Header
    const header = Box.hsep(
      [
        Box.text(`  ${title}`).pipe(Box.annotate(Ansi.bold)),
        Box.text(
          `[${Math.min(state.scrollOffset + 1, totalLines)}–${Math.min(state.scrollOffset + height, totalLines)} / ${totalLines}]`
        ).pipe(Box.annotate(Ansi.dim)),
      ],
      1,
      Box.top
    );

    // Footer
    const footer = Box.hsep(
      [
        Box.text("  \u2191/\u2193 scroll").pipe(Box.annotate(Ansi.dim)),
        Box.text("\u00B7").pipe(Box.annotate(Ansi.dim)),
        Box.text("enter exit").pipe(Box.annotate(Ansi.dim)),
      ],
      1,
      Box.top
    );

    return Box.vcat(
      [
        header,
        constrainedContent.pipe(Box.pad(0, 1), Box.border("rounded")),
        footer,
      ],
      Box.left
    );
  });

// Log-level styling
const levelIcon = Match.type<LogLevel>().pipe(
  Match.when("FATAL", () => "\u2620"),
  Match.when("ERROR", () => "\u2716"),
  Match.when("WARN", () => "\u26A0"),
  Match.when("DEBUG", () => "\u00B7"),
  Match.when("INFO", () => "\u25CF"),
  Match.exhaustive
);

const levelStyle = Match.type<LogLevel>().pipe(
  Match.when("FATAL", () => Ansi.combine(Ansi.bold, Ansi.bgRed, Ansi.white)),
  Match.when("ERROR", () => Ansi.combine(Ansi.bold, Ansi.red)),
  Match.when("WARN", () => Ansi.combine(Ansi.yellow)),
  Match.when("DEBUG", () => Ansi.dim),
  Match.when("INFO", () => Ansi.cyan),
  Match.exhaustive
);

const renderLogLine = (entry: LogEntry): Box.Box<Ansi.AnsiStyle> => {
  const [timestamp, level, message] = entry;
  const style = levelStyle(level);
  const icon = levelIcon(level);

  const levelBox =
    level === "FATAL"
      ? Box.text(` ${level} `).pipe(Box.annotate(style))
      : Box.text(level.padEnd(5)).pipe(Box.annotate(style));

  return Box.hsep(
    [
      Box.text(timestamp).pipe(Box.annotate(Ansi.dim)),
      Box.text(icon).pipe(Box.annotate(style)),
      levelBox,
      Box.text(message).pipe(
        Box.annotate(
          level === "FATAL" ? Ansi.combine(Ansi.bold, Ansi.red) : style
        )
      ),
    ],
    1,
    Box.top
  );
};

// ----------------------------------------------------------------------------
// LogViewer Prompt
// ----------------------------------------------------------------------------

export const LogViewer = ({
  title,
  height = DEFAULT_HEIGHT,
  events,
}: LogViewerOptions): Prompt.Prompt<string> => {
  const initialState: LogViewerState = {
    lines: [],
    scrollOffset: 0,
    prevRows: 0,
  };

  return Prompt.custom<LogViewerState, string, LogEntry>(initialState, events, {
    render: Effect.fnUntraced(function* (
      state: LogViewerState,
      action: Prompt.Action<LogViewerState, string>
    ) {
      const rendered = yield* Action.$match(action, {
        Beep: () => Effect.succeed(Box.nullBox),

        NextFrame: Effect.fnUntraced(function* ({ state: nextState }) {
          const layout = yield* renderLayout(nextState, title, height, false);
          const clear =
            nextState.prevRows > 0
              ? Cmd.clearLines(nextState.prevRows)
              : Cmd.cursorHide;
          return Box.combine(clear, layout);
        }),

        Submit: Effect.fnUntraced(function* () {
          const layout = yield* renderLayout(initialState, title, height, true);
          const clear =
            state.prevRows > 0 ? Cmd.clearLines(state.prevRows) : Box.nullBox;
          return Box.combineAll([
            clear,
            layout,
            Box.text("") as Box.Box<Ansi.AnsiStyle>,
          ]);
        }),
      });

      return yield* Box.renderPretty(rendered);
    }),

    process: Effect.fnUntraced(function* (input, state) {
      const maxOffset = Math.max(0, state.lines.length - height);
      const layout = yield* renderLayout(state, title, height, false);

      return Match.value(input).pipe(
        Match.tag("Input", ({ input }) => {
          return Match.value(input.key.name).pipe(
            Match.when("up", () =>
              Action.NextFrame({
                state: {
                  ...state,
                  scrollOffset: Math.max(0, state.scrollOffset - 1),
                  prevRows: layout.rows,
                },
              })
            ),
            Match.when("down", () =>
              Action.NextFrame({
                state: {
                  ...state,
                  scrollOffset: Math.min(maxOffset, state.scrollOffset + 1),
                  prevRows: layout.rows,
                },
              })
            ),
            Match.whenOr("enter", "return", () =>
              Action.Submit({ value: "done" })
            ),
            Match.orElse(() => Action.Beep())
          );
        }),
        Match.tag("Event", ({ value: entry }) => {
          // Append new log entry
          const newLines = [...state.lines, entry];
          const newMaxOffset = Math.max(0, newLines.length - height);
          // Auto-scroll if user was at the bottom
          const atBottom = state.scrollOffset >= maxOffset;
          const newOffset = atBottom ? newMaxOffset : state.scrollOffset;
          return Action.NextFrame({
            state: {
              lines: newLines,
              scrollOffset: newOffset,
              prevRows: layout.rows,
            },
          });
        }),
        Match.exhaustive
      );
    }),

    clear: () => Effect.succeed(""),
  });
};

// ----------------------------------------------------------------------------
// Demo: Simulated log stream
// ----------------------------------------------------------------------------

const logMessages: ReadonlyArray<LogEntry> = [
  ["00:01.1", "INFO", "Application starting up..."],
  ["00:01.4", "INFO", "Loading configuration from /etc/app/config.yaml"],
  ["00:01.7", "DEBUG", "Config keys found: database, cache, auth, logging"],
  ["00:02.0", "INFO", "Connecting to PostgreSQL at db.internal:5432"],
  ["00:02.3", "INFO", "Database connection established (pool: 10)"],
  ["00:02.6", "INFO", "Initializing Redis cache at cache.internal:6379"],
  [
    "00:03.0",
    "WARN",
    "Redis connection slow (latency: 120ms > threshold: 100ms)",
  ],
  ["00:03.2", "INFO", "Cache warmed with 1,247 entries"],
  ["00:03.5", "INFO", "Starting HTTP server on :8080"],
  ["00:03.8", "INFO", "Registered 24 API routes"],
  ["00:04.1", "DEBUG", "Route: GET  /api/v1/users"],
  ["00:04.4", "DEBUG", "Route: POST /api/v1/users"],
  ["00:04.7", "DEBUG", "Route: GET  /api/v1/users/:id"],
  ["00:05.0", "DEBUG", "Route: PUT  /api/v1/users/:id"],
  ["00:05.3", "INFO", "Health check endpoint: /healthz"],
  ["00:05.6", "INFO", "Server ready, accepting connections"],
  [
    "00:06.0",
    "INFO",
    "Incoming request: GET /api/v1/users (client: 10.0.1.42)",
  ],
  ["00:06.2", "INFO", "Response: 200 OK (23ms)"],
  [
    "00:06.5",
    "WARN",
    "Rate limit approaching for client 10.0.1.42 (85/100 req/min)",
  ],
  [
    "00:06.8",
    "INFO",
    "Incoming request: POST /api/v1/users (client: 10.0.1.55)",
  ],
  ["00:07.1", "INFO", "Response: 201 Created (45ms)"],
  [
    "00:07.4",
    "ERROR",
    "Query timeout: SELECT * FROM analytics WHERE date > '2024-01-01'",
  ],
  ["00:07.7", "WARN", "Retrying query (attempt 2/3)..."],
  ["00:08.0", "INFO", "Query succeeded on retry (1,203ms)"],
  [
    "00:08.3",
    "INFO",
    "Incoming request: GET /api/v1/users/42 (client: 10.0.1.42)",
  ],
  ["00:08.6", "INFO", "Cache HIT for user:42"],
  ["00:09.0", "INFO", "Response: 200 OK (2ms)"],
  ["00:09.2", "DEBUG", "GC pause: 12ms (heap: 245MB / 512MB)"],
  ["00:09.5", "INFO", "Scheduled job: cleanup_sessions started"],
  ["00:09.8", "INFO", "Cleaned 342 expired sessions"],
  ["00:10.1", "WARN", "Disk usage at 78% on /var/data"],
  [
    "00:10.4",
    "INFO",
    "Incoming request: PUT /api/v1/users/42 (client: 10.0.1.42)",
  ],
  ["00:10.7", "INFO", "Response: 200 OK (31ms)"],
  ["00:11.0", "ERROR", "Connection reset by peer: cache.internal:6379"],
  ["00:11.3", "WARN", "Redis reconnecting (attempt 1/5)..."],
  ["00:11.6", "INFO", "Redis reconnected successfully"],
  ["00:12.0", "INFO", "Cache re-synced (delta: 23 entries)"],
  [
    "00:12.2",
    "INFO",
    "Incoming request: GET /api/v1/users?page=2 (client: 10.0.1.88)",
  ],
  ["00:12.5", "INFO", "Response: 200 OK (18ms)"],
  ["00:12.8", "FATAL", "Out of memory: heap limit reached (512MB)"],
  ["00:13.1", "INFO", "Initiating graceful shutdown..."],
  ["00:13.4", "INFO", "Draining 3 active connections..."],
  ["00:13.7", "INFO", "All connections drained"],
  ["00:14.0", "INFO", "Closing database pool..."],
  ["00:14.3", "INFO", "Database pool closed"],
  ["00:14.6", "INFO", "Shutdown complete"],
];

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

export const main = Effect.gen(function* () {
  // Create a queue for streaming log entries
  const logQueue = yield* Queue.make<LogEntry>();

  // Spawn a fiber that drips log entries one at a time
  yield* Effect.gen(function* () {
    for (const entry of logMessages) {
      yield* Queue.offer(logQueue, entry);
      yield* Effect.sleep("300 millis");
    }
  }).pipe(Effect.forkScoped);

  // Run the viewer — logs will appear as they stream in
  yield* Prompt.run(
    LogViewer({
      title: "Application Logs",
      height: 10,
      events: Queue.asDequeue(logQueue),
    })
  );
}).pipe(Effect.scoped, Effect.provide(BunServices.layer));
