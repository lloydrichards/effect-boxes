# Contributing to Effect Boxes

Thank you for your interest in contributing to Effect Boxes! This guide covers
everything you need to get started with development.

## Development Setup

### Option A: Nix (recommended)

The project includes a `flake.nix` that provides Bun, Node.js, and all other
tools automatically. Nothing else to install.

```bash
git clone https://github.com/lloydrichards/effect-boxes.git
cd effect-boxes

# If you use direnv (recommended alongside nix):
direnv allow

# Otherwise, enter the dev shell manually:
nix develop

# Then install dependencies
bun install
```

### Option B: Manual setup

Install these yourself:

- [Bun](https://bun.sh/) runtime
- Node.js 24+

```bash
git clone https://github.com/lloydrichards/effect-boxes.git
cd effect-boxes
bun install
```

## Development Commands

Run these commands from the repository root. The root test script delegates to
Vitest through Turbo; `bun test` invokes a different test runner.

```bash
# Run tests
bun run test

# Run tests in watch mode
bun run --cwd packages/effect-boxes test --watch

# Type check
bun run type-check

# Lint code
bun run lint

# Format code
bun run format

# Validate documentation
bun run docs:check

# Run examples/scratchpad
bun run --cwd apps/scratchpad dev
```

## Project Structure

```txt
packages/effect-boxes/
├── src/           # Public modules and internal implementations
├── tests/         # Vitest suites
├── benchmarks/    # Vitest benchmarks
└── scripts/       # Documentation validation
apps/
├── docs/          # Documentation website
└── scratchpad/    # Runnable examples; 00-index.ts is the launcher
```

## Development Workflow

### Using the Scratchpad

The `apps/scratchpad/` directory is your playground for experimenting with the
library:

```bash
# Create a test file
touch apps/scratchpad/my-experiment.ts

# Run it
bun run apps/scratchpad/my-experiment.ts

# Clean up when done
rm apps/scratchpad/my-experiment.ts
```

### Running Specific Tests

```bash
# Run a single test file
bun run --cwd packages/effect-boxes test tests/box.test.ts

# Run tests matching a pattern
bun run --cwd packages/effect-boxes test -t "alignment"
```

## Testing Guidelines

- Use regular `vitest` for pure functions that don't return Effect types
- Use regular `vitest` with `Effect.runSync` or `Effect.runPromise` for the current renderer tests. Provide the renderer layer explicitly.
- If tests need managed fibers, scopes, or a test clock, choose a compatible Effect test runner and document that setup when introducing it.
- Focus on testing mathematical properties and edge cases
- See existing tests in `packages/effect-boxes/tests/` for patterns

## Code Style

This project uses [Biome](https://biomejs.dev/) for linting and formatting. Run
`bun run lint` and `bun run format` before committing.

Key conventions:

- Pure functions with immutable data
- Use `pipe()` for function composition
- Implement Effect interfaces (`Pipeable`, `Equal`, `Hash`) where appropriate
- All public functions need JSDoc with `@example` blocks

## Generating the Demo GIF

The demo GIF in the README is generated using
[VHS](https://github.com/charmbracelet/vhs):

```bash
# Install VHS (macOS)
brew install vhs

# Generate the demo GIF
vhs media/demo.tape
```

## Releasing a New Version

This project uses [changesets](https://github.com/changesets/changesets) for
versioning and publishing.

### Adding a Changeset

When making a noteworthy change, add a changeset:

```bash
bunx changeset
```

Follow the prompts to:

1. Select a semver bump type (patch/minor/major)
2. Describe the change

This creates a markdown file in `.changeset/`.

### Release Process

1. **Commit the changeset** along with your code changes
2. **Push to `main`**: CI detects pending changesets and opens a "Version
   Packages" PR
3. **Merge the release PR**: This bumps `package.json`, updates `CHANGELOG.md`,
   and removes consumed changeset files
4. **Automatic publish**: After merging, CI publishes to npm automatically
5. **Verify**: Check
   [GitHub Actions](https://github.com/lloydrichards/effect-boxes/actions)
   and [npm](https://www.npmjs.com/package/effect-boxes)

## Getting Help

- Review inline TSDoc comments in `src/` for API documentation
- Check the [API Reference](https://effect-boxes.lloydrichards.dev/api/box) for module guides
- Review [AGENTS.md](./AGENTS.md) for detailed coding patterns (useful for AI
  assistants)
- Open an issue for bugs or feature requests
