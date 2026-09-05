# AGENTS.md

> **Note:** This file is the authoritative source for coding agent instructions.
> If in doubt, prefer AGENTS.md over README.md.

## 🚦 Quick Reference

- **Install dependencies:** `bun install`
- **Run all tests:** `bun run test`
- **Type check:** `bun run type-check`
- **Lint & format:** `bun run lint` / `bun run format`
- **Validate docs:** `bun run docs:check`
- **Run scratchpad:** `bun run --cwd apps/scratchpad dev`
- **Test a single file:** `bun run --cwd packages/effect-boxes test tests/box.test.ts`
- **Search code:** `rg "pattern"`

---

This file provides comprehensive guidance for coding agents when working with
TypeScript and Effect.js in this Box layout library.

## Core Development Philosophy

### KISS (Keep It Simple, Stupid)

Simplicity should be a key goal in design. Choose straightforward solutions over
complex ones whenever possible. Simple solutions are easier to understand,
maintain, and debug.

### YAGNI (You Aren't Gonna Need It)

Avoid building functionality on speculation. Implement features only when they
are needed, not when you anticipate they might be useful in the future.

### Design Principles

- **Functional Composition**: Build complex behavior by composing simple, pure
  functions
- **Immutability**: All operations return new values, never mutating existing
  ones
- **Type Safety**: Leverage TypeScript's type system for compile-time
  correctness
- **Effect Integration**: Use Effect's utilities (`pipe`, `Equal`, `Hash`) for
  enhanced functionality
- **Single Responsibility**: Each function should have one clear purpose

## 🧱 Project Structure & Library Architecture

This is a **functional library** designed to be either published on NPM or
included in a monorepo. The architecture follows Effect.js patterns with pure
functional composition.

### Directory Structure

```txt
packages/effect-boxes/
├── src/           # Box, Annotation, Ansi, Cmd, Reactive, Renderer, Html, Layout
├── tests/         # Vitest suites
├── benchmarks/    # Vitest benchmarks
└── scripts/       # Documentation validation
apps/
├── docs/          # Documentation website
└── scratchpad/    # Runnable examples; 00-index.ts is the launcher
```

### Library Design Patterns

- **Pure Functions**: All Box operations are pure transformations
- **Functional Composition**: Use `pipe()` for chaining operations
- **Effect Integration**: Implement `Pipeable`, `Equal`, and `Hash` interfaces
- **Immutable Data**: Return new instances, never modify existing ones

## 🎯 Effect.js Patterns for Pure Functional Libraries

This library focuses on **pure functional composition** rather than effectful
operations. However, we leverage Effect's utilities for enhanced type safety and
composition.

### Core Effect Utilities Used

#### 1. Pipeable Interface

All Box types implement `Pipeable` for fluent composition:

```typescript
import { pipe } from "effect";
import * as Box from "effect-boxes/Box";

// Fluent composition with pipe
const layout = pipe(
  Box.text("Hello World"),
  Box.moveRight(5),
  Box.moveDown(2),
  Box.alignHoriz(Box.center1, 20)
);

// Alternative method chaining (when Pipeable is implemented)
const layout2 = Box.text("Hello World")
  .pipe(Box.moveRight(5))
  .pipe(Box.moveDown(2))
  .pipe(Box.alignHoriz(Box.center1, 20));
```

#### 2. Equal and Hash Interfaces

For structural equality and efficient comparisons:

```typescript
import { Equal, HashSet } from "effect";

// Boxes implement Equal for value-based comparison
const box1 = Box.text("hello");
const box2 = Box.text("hello");
console.log(Equal.equals(box1, box2)); // true

// Effect collections use Equal and Hash for structural equality.
const boxSet = HashSet.make(box1, box2);
console.log(HashSet.size(boxSet)); // 1
// Native Set and Map compare object references instead.
```

#### 3. Dual Functions

For flexible parameter ordering:

```typescript
import { dual } from "effect/Function"

// Supports both data-first and data-last usage
export const moveRight = dual<
  (n: number) => (self: Box) => Box,
  (self: Box, n: number) => Box
>(2, (self, n) => /* implementation */)

// Usage patterns:
Box.moveRight(box, 5)        // data-first
pipe(box, Box.moveRight(5))  // data-last
```

### Pure Function Composition Patterns

#### Function Organization

```typescript
// ✅ Prefer pure, composable functions
export const text = (content: string): Box => /* ... */
export const emptyBox = (rows: number, cols: number): Box => /* ... */
export const hcat = (boxes: Box[], alignment: Alignment): Box => /* ... */

// ✅ Use pipe for complex transformations
const createTable = (data: string[][]) =>
  pipe(
    data,
    Array.map(row => pipe(
      row,
      Array.map(Box.text),
      boxes => Box.hcat(boxes, Box.left)
    )),
    boxes => Box.vcat(boxes, Box.top)
  )
```

#### Error Handling in Pure Functions

```typescript
// ✅ Use Option for potentially missing values
import { Option } from "effect";

export const safeText = (content: string | null): Option.Option<Box> =>
  content === null ? Option.none() : Option.some(Box.text(content));

// ✅ Use Either for validation
import { Either } from "effect";

export const validateDimensions = (
  rows: number,
  cols: number
): Either.Either<Box, string> =>
  rows < 0 || cols < 0
    ? Either.left("Dimensions must be non-negative")
    : Either.right(Box.emptyBox(rows, cols));
```

## 🧪 Testing Strategy

This library uses a **dual testing approach** depending on the code being
tested.

### Testing Framework Selection

#### Use Regular Vitest for Pure Functions

**MANDATORY**: Use regular `vitest` for pure TypeScript functions that don't
return Effect types:

```typescript
import { describe, expect, it } from "vitest";
import * as Box from "../src/Box";

describe("Box", () => {
  it("text trims trailing spaces per line", () => {
    const s = "abc   \nxy  ";
    expect(Box.render(Box.text(s))).toBe("abc\nxy\n");
  });

  it("implements Equal interface correctly", () => {
    const box1 = Box.text("hello");
    const box2 = Box.text("hello");
    const box3 = Box.text("world");

    expect(Equal.equals(box1, box2)).toBe(true);
    expect(Equal.equals(box1, box3)).toBe(false);
  });
});
```

#### Test Effect-based rendering with Vitest

The current renderer suites use regular `vitest` with `Effect.runSync` or
`Effect.runPromise`. Provide the renderer layer explicitly:

```typescript
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import * as Box from "../src/Box";
import * as Renderer from "../src/Renderer";

describe("Box rendering", () => {
  it("renders text with the plain renderer", () => {
    const output = Effect.runSync(
      Renderer.render(Box.text("Hello"), {}).pipe(
        Effect.provide(Renderer.PlainRendererLive)
      )
    );
    expect(output).toBe("Hello");
  });
});
```

If future tests need managed fibers, scopes, or a test clock, choose a compatible
Effect test runner and document its setup when adding it. `@effect/vitest` is
not currently a dependency.

### Testing Pure Functions

Focus on testing the mathematical properties and edge cases:

```typescript
describe("Box composition", () => {
  it("hcat preserves height", () => {
    const box1 = Box.text("A\nB");
    const box2 = Box.text("C\nD");
    const result = Box.hcat([box1, box2], Box.top);

    expect(result.rows).toBe(Math.max(box1.rows, box2.rows));
  });

  it("vcat preserves width", () => {
    const box1 = Box.text("ABC");
    const box2 = Box.text("DEF");
    const result = Box.vcat([box1, box2], Box.left);

    expect(result.cols).toBe(Math.max(box1.cols, box2.cols));
  });
});
```

### Property-Based Testing

Consider using property-based testing for mathematical invariants:

```typescript
import { fc } from "fast-check";

describe("Box properties", () => {
  it("composition is associative for hcat", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
        (texts) => {
          const boxes = texts.map(Box.text);
          if (boxes.length < 3) return true;

          const [a, b, c] = boxes;
          const left = Box.hcat([Box.hcat([a, b], Box.top), c], Box.top);
          const right = Box.hcat([a, Box.hcat([b, c], Box.top)], Box.top);

          return Equal.equals(left, right);
        }
      )
    );
  });
});
```

### Benchmarking

For performance-critical functions, consider adding benchmarks:

```typescript
import { bench } from "vitest";
import * as Box from "../src/Box";

bench(
  "hcat with 100 boxes",
  () => {
    const boxes = Array.from({ length: 100 }, (_, i) => Box.text(`Box ${i}`));
    Box.hcat(boxes, Box.top);
  },
  { time: 500 }
);
```

## 🛠️ Development Environment

### Development Commands

Run commands from the repository root unless stated otherwise. Tests use
Vitest through the package scripts; do not substitute Bun's native `bun test`.
This project uses **Bun** as the runtime and **Biome** for linting/formatting:

```bash
# Install dependencies
bun install

# Run tests
bun run test        # Run all tests once
bun run --cwd packages/effect-boxes test --watch  # Watch mode for development
bun run --cwd packages/effect-boxes benchmark benchmarks/quick.bench.ts  # Run benchmarks

# Type checking
bun run type-check  # TypeScript compilation check

# Code quality
bun run lint        # Check for lint issues
bun run format      # Auto-format code
bun run docs:check  # Validate TSDoc/JSDoc syntax

# Development playground
bun run --cwd apps/scratchpad dev     # Run scratchpad examples
```

### Scratchpad Development Workflow

For efficient example development, use the `./apps/scratchpad/` directory:

```bash
# Create temporary development files
touch ./apps/scratchpad/test-example.ts

# Check scratchpad TypeScript compilation
bun run --cwd apps/scratchpad build

# Fix formatting using project rules
bun run format

# Test execution
bun run apps/scratchpad/test-example.ts
```

**Scratchpad Benefits:**

- ✅ Rapid prototyping of complex Box layouts
- ✅ Safe testing without affecting main codebase
- ✅ Live examples for documentation
- ✅ Type checking validation

**⚠️ Remember to Clean Up:**

```bash
# Clean up test files when done
rm apps/scratchpad/test-*.ts
rm apps/scratchpad/temp*.ts apps/scratchpad/example*.ts
```

## 📋 Style & Conventions

### Code Organization

- **Module Exports**: Use named exports for all public functions
- **Function Naming**: Use descriptive, verb-based names (`createBox`,
  `alignText`)
- **Type Definitions**: Co-locate types with their implementations
- **File Structure**: Group related functionality in single modules

### TypeScript Patterns

```typescript
// ✅ Use strict typing with branded types when needed
export type BoxId = string & { readonly _brand: "BoxId" };

// ✅ Prefer readonly for immutable data
export interface Box {
  readonly rows: number;
  readonly cols: number;
  readonly content: ReadonlyArray<string>;
}

// ✅ Use discriminated unions for variants
export type Alignment =
  "AlignFirst" | "AlignCenter1" | "AlignCenter2" | "AlignLast";
```

### Function Composition

```typescript
// ✅ Design for pipe compatibility
export const transformBox =
  (transform: (s: string) => string) =>
  (box: Box): Box => ({
    ...box,
    content: box.content.map(transform),
  });

// ✅ Use it with pipe
const result = pipe(
  Box.text("hello"),
  transformBox((s) => s.toUpperCase()),
  Box.alignHoriz(Box.center1, 20)
);
```

### API Consistency Standards

These rules ensure a predictable, learnable public API (see Issue #14):

1. **Primary parameter naming**: Always use `self` for the primary data
   parameter in all public functions. Never use `b`, `box`, or other names.

2. **Secondary parameter naming**: Use descriptive names for other parameters,
   not single-letter abbreviations. For binary box operations, use `that` for
   the second operand (not `l`, `t`, etc.).

3. **Return type annotations**: All public functions must have explicit return
   type annotations. Never rely on inference for exports.

4. **Generic naming conventions**:
   - `A` for the primary type parameter (the annotation type on `self`)
   - `B` for a secondary type parameter (e.g., the other box's annotation)
   - In data-first dual overloads, `self`'s type parameter should be `A`

5. **Parameter ordering in dual functions**:
   - Data-first: `(self: Box<A>, ...options)`
   - Data-last: `(...options) => (self: Box<A>) => Box<A>`

6. **Dual function template**:

```typescript
// ✅ Correct dual function pattern
export const functionName = dual<
  (param: Type) => <A>(self: Box<A>) => Box<A>,
  <A>(self: Box<A>, param: Type) => Box<A>
>(arity, (self, param) => /* implementation */)

// ✅ Binary box operation
export const append = dual<
  <B>(that: Box<B>) => <A>(self: Box<A>) => Box<A | B>,
  <A, B>(self: Box<A>, that: Box<B>) => Box<A | B>
>(2, (self, that) => /* implementation */)
```

## 🚨 Error Handling

### Pure Functions with Option/Either

Since this library focuses on pure functions, use Effect's Option and Either for
error handling:

```typescript
// ✅ Use Option for potentially missing values
export const safeGetChar = (
  box: Box,
  row: number,
  col: number
): Option.Option<string> =>
  row >= 0 && row < box.rows && col >= 0 && col < box.content[row]?.length
    ? Option.some(box.content[row][col])
    : Option.none();

// ✅ Use Either for validation
export const validateBox = (box: Box): Either.Either<Box, string> =>
  box.rows < 0 || box.cols < 0
    ? Either.left("Box dimensions cannot be negative")
    : Either.right(box);
```

### Input Validation

```typescript
// ✅ Validate inputs at public API boundaries
export const moveRight = dual<
  (n: number) => (self: Box) => Box,
  (self: Box, n: number) => Box
>(2, (self, n) => {
  if (n < 0) throw new Error("Move distance must be non-negative");
  return moveRightImpl(self, n);
});
```

## 🔄 Git Workflow

### Branch Strategy

- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates
- `refactor/*` - Code refactoring
- `test/*` - Test additions or fixes

### Commit Message Format

Never include "coding agent" or "written by coding agent" in commit messages

```bash
<type>(<scope>): <subject>

<body>

<footer>
```

Types: feat, fix, docs, style, refactor, test, chore

Example:

```bash
feat(box): add horizontal alignment functions

- Implement alignHoriz with center1, center2 options
- Add comprehensive tests for alignment edge cases
- Update documentation with alignment examples

Closes #123
```

## 📝 Documentation Standards

> **Authority**: See `.patterns/standard-jsdoc.md` for complete guidelines. This
> section provides essential patterns for coding agents.

### Core Principles

- **All examples MUST compile** via `bun run type-check`
- **No `any` types, type assertions, or unsafe patterns**
- **Follow Effect.js ecosystem patterns** for consistency
- **Preserve existing Haskell references** using `@note Haskell:` format

### Required JSDoc Elements

All public functions must include:

- Clear description with action verbs and specific behavior
- `@category` tag (constructors, combinators, utilities, transformations)
- At least one `@example` with compiling code
- Existing `@note Haskell:` references (preserve mathematical context)

### Standard Template

````typescript
/**
 * Brief one-line description starting with action verb.
 *
 * **Example**
 *
 * ```typescript
 * import * as Box from "effect-boxes/Box"
 *
 * const result = Box.functionName(params)
 * console.log(Box.render(result))
 * // Expected output comment
 * ```
 *
 * @note Haskell: `functionName :: InputType -> OutputType`
 * @category constructors
 */
````

### Description Guidelines

- **Start with action verbs**: "Creates", "Combines", "Transforms"
- **Be specific about behavior**: Include edge cases and constraints
- **Use present tense**: "Calculates" not "Will calculate"
- **Preserve mathematical context**: Keep existing `@note Haskell:` patterns

### Categories for effect-boxes

- `@category constructors` - Box creation functions (text, emptyBox)
- `@category combinators` - Box combination functions (hcat, vcat)
- `@category transformations` - Box modification functions (align*, move*)
- `@category utilities` - Helper functions (rows, cols, render)

### Internal Functions

Use `/** @internal */` for implementation details not part of public API.

## ℹ️ Where to Find More Information

- For human contributors: see `README.md` for project overview and contribution
  guidelines.
- For coding agents: this `AGENTS.md` is your primary source for build, test,
  and style instructions.
- For API documentation and examples: see inline TSDoc comments in `packages/effect-boxes/src/`, and
  live usage in `apps/scratchpad/00-index.ts`.
- For troubleshooting or advanced usage, consult the official
  [Effect documentation](https://effect.website/) and
  [TypeScript Handbook](https://www.typescriptlang.org/docs/).

---

## 📝 How to Update AGENTS.md

**Keep this file current!** Update AGENTS.md whenever you add new scripts,
change test commands, or update code style rules. Treat it as living
documentation for all coding agents and future maintainers.

---

## ❓ FAQ for Coding Agents

- **What if instructions here conflict with README.md?**  
  AGENTS.md takes precedence for agent tasks.
- **How do I run a specific test?**  
  Use `bun run --cwd packages/effect-boxes test tests/<file>.test.ts`
- **Where do I add new test files?**  
  Place them in the `packages/effect-boxes/tests/` directory, named `<module>.test.ts`
- **How do I check formatting?**  
  Run `bun run lint` and `bun run format`
- **How do I validate JSDoc/TSDoc comments?**  
  Run `bun run docs:check`

---

## 📚 Useful Resources

### Essential Tools

- [Effect Documentation](https://effect.website/)
- [Bun Runtime](https://bun.sh/)
- [Biome Toolchain](https://biomejs.dev/)
- [Vitest Testing](https://vitest.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## ⚠️ Important Notes

- **NEVER ASSUME OR GUESS** - When in doubt, ask for clarification
- **Always verify file paths and module names** before use
- **Keep AGENTS.md updated** when adding new patterns or dependencies
- **Test your code** - No feature is complete without tests
- **Focus on pure functions** - This library emphasizes functional composition
  over effectful operations

## 🔍 Search Command Requirements

**CRITICAL**: Always use `rg` (ripgrep) for search operations:

```bash
# ✅ Use rg for pattern searches
rg "pattern"

# ✅ Use rg for file filtering
rg --files -g "*.ts"
rg --files -g "*.test.ts"
```

## Local Source References

When answering questions about Effect, search these
cloned source repos first. When updating dependencies, pull the latest
commits in these repos to ensure the LLM references current code:

- `.reference/effect/`

If any of the folders are missing (they are git ignored), clone them into
`reference/`:

- `https://github.com/Effect-TS/effect-smol.git` -> `.reference/effect/`

---

_This document is a living guide. Update it as the project evolves and new
patterns emerge._
