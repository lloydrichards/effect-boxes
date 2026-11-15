/** @effect-diagnostics unstableApiUsage:skip-file */
import { BunServices } from "@effect/platform-bun";
import { Data, Effect, Match, Queue, Stream, Terminal } from "effect";
import { Prompt } from "effect/cli";
import * as Ansi from "effect-boxes/Ansi";
import * as Box from "effect-boxes/Box";
import * as Cmd from "effect-boxes/Cmd";
import { Place } from "effect-boxes/Layout";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type LogLevel = "INFO" | "DEBUG" | "WARN" | "ERROR" | "FATAL";

type LogEntry = readonly [timestamp: string, level: LogLevel, message: string];

type LogViewerState = {
  readonly lines: ReadonlyArray<LogEntry>;
  readonly scrollOffset: number;
  readonly size: Terminal.Size;
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

const visibleRows = (size: Terminal.Size, height: number) =>
  Math.max(0, Math.min(height, size.rows - 4));

const renderLayout = (state: LogViewerState, title: string, height: number) => {
  const width = Math.max(0, state.size.columns - 1);
  if (width < 8 || state.size.rows < 5) {
    return Box.line("Resize to view logs").pipe(Place.horizontal(width, "left"));
  }
  const rows = visibleRows(state.size, height);
  const entries = state.lines.slice(
    state.scrollOffset,
    state.scrollOffset + rows
  );
  const content = entries.length
    ? Box.vcat(entries.map(renderLogLine), Box.left)
    : Box.text("Waiting for log data...").pipe(Box.annotate(Ansi.dim));
  const count = state.lines.length;
  const header = Box.hsep(
    [
      Box.text(title).pipe(Box.annotate(Ansi.bold)),
      Box.text(
        `[${count ? state.scrollOffset + 1 : 0}–${state.scrollOffset + entries.length} / ${count}]`
      ).pipe(Box.annotate(Ansi.dim)),
    ],
    1,
    Box.top
  );
  return Box.vcat(
    [
      header.pipe(Place.horizontal(width, "left")),
      Place.make(content, { width: width - 4, height: rows }).pipe(
        Box.pad(0, 1),
        Box.border("rounded")
      ),
      Box.text("↑/↓ scroll · enter exit").pipe(
        Place.horizontal(width, "left"),
        Box.annotate(Ansi.dim)
      ),
    ],
    Box.left
  );
};

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

type ViewerEvent =
  | { readonly entry: LogEntry }
  | { readonly size: Terminal.Size };

export const LogViewer = ({
  title,
  height = DEFAULT_HEIGHT,
  events,
}: LogViewerOptions) =>
  Effect.gen(function* () {
    const terminal = yield* Terminal.Terminal;
    const sizes = yield* terminal.size;
    const size = yield* Queue.take(sizes);
    const updates = yield* Queue.make<ViewerEvent>();
    yield* Stream.fromQueue(sizes).pipe(
      Stream.runForEach((size) => Queue.offer(updates, { size })),
      Effect.forkScoped
    );
    yield* Stream.fromQueue(events).pipe(
      Stream.runForEach((entry) => Queue.offer(updates, { entry })),
      Effect.forkScoped
    );
    yield* Effect.acquireRelease(
      terminal.display(
        Box.renderPrettySync(Box.combine(Cmd.altScreenEnter, Cmd.cursorHide))
      ),
      () =>
        terminal
          .display(
            Box.renderPrettySync(
              Box.combine(Cmd.altScreenLeave, Cmd.cursorShow)
            )
          )
          .pipe(Effect.orDie)
    );
    const initial: LogViewerState = { size, lines: [], scrollOffset: 0 };
    return yield* Prompt.Custom<LogViewerState, number, ViewerEvent>(
      initial,
      updates,
      {
        render: (_, action) =>
          Effect.sync(() =>
            action._tag === "NextFrame"
              ? `\x1b[H\x1b[2J${Box.renderPrettySync(renderLayout(action.state, title, height))}`
              : ""
          ),
        clear: () => Effect.succeed(""),
        process: (input, state) =>
          Effect.sync(() => {
            const maxOffset = Math.max(
              0,
              state.lines.length - visibleRows(state.size, height)
            );
            if (input._tag === "Event") {
              const update = input.value;
              const size = "size" in update ? update.size : state.size;
              const lines =
                "entry" in update
                  ? [...state.lines, update.entry]
                  : state.lines;
              const nextMax = Math.max(
                0,
                lines.length - visibleRows(size, height)
              );
              const scrollOffset =
                state.scrollOffset === maxOffset
                  ? nextMax
                  : Math.min(state.scrollOffset, nextMax);
              return Action.NextFrame({ state: { size, lines, scrollOffset } });
            }
            switch (input.input.key.name) {
              case "up":
                return Action.NextFrame({
                  state: {
                    ...state,
                    scrollOffset: Math.max(0, state.scrollOffset - 1),
                  },
                });
              case "down":
                return Action.NextFrame({
                  state: {
                    ...state,
                    scrollOffset: Math.min(maxOffset, state.scrollOffset + 1),
                  },
                });
              case "enter":
              case "return":
                return Action.Submit({ value: state.lines.length });
              default:
                return Action.Beep();
            }
          }),
      }
    );
  }).pipe(Effect.scoped);

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
  const count = yield* LogViewer({
    title: "Application Logs",
    height: 10,
    events: Queue.asDequeue(logQueue),
  });
  const terminal = yield* Terminal.Terminal;
  yield* terminal.display(`✔ Application Logs (${count} lines)\n`);
}).pipe(Effect.scoped, Effect.provide(BunServices.layer));
