import { Effect, Equal, Exit, Result } from "effect";
import { describe, expect, it } from "vitest";
import * as Ansi from "../src/Ansi";
import * as Box from "../src/Box";
import * as Cmd from "../src/Cmd";
import * as FrameEncoder from "../src/FrameEncoder";
import { Layer, LayoutValidationError, Place, Stack } from "../src/Layout";
import * as Reactive from "../src/Reactive";
import * as Renderer from "../src/Renderer";

const source = Box.text("Hello").pipe(Box.annotate(Ansi.red));

describe("layout validation results", () => {
  it("preserves annotated placement and both invocation forms", () => {
    const options = { width: 3, height: 1, x: -1 };
    const expected = Place.make(source, options);
    expect(
      Equal.equals(
        Result.getOrThrow(Place.makeResult(source, options)),
        expected
      )
    ).toBe(true);
    expect(
      Equal.equals(
        Result.getOrThrow(source.pipe(Place.makeResult(options))),
        expected
      )
    ).toBe(true);
  });

  it.each([-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "returns invalid dimensions as data for %s",
    (width) => {
      const results: ReadonlyArray<
        Result.Result<unknown, LayoutValidationError>
      > = [
        Place.makeResult(source, { width, height: 1 }),
        Stack.makeResult([], { width, height: 1 }),
      ];
      for (const result of results) {
        expect(Result.isFailure(result)).toBe(true);
        if (Result.isFailure(result)) {
          expect(result.failure).toBeInstanceOf(LayoutValidationError);
          expect(result.failure.reason).toBe("InvalidInput");
        }
      }
      expect(() => Place.make(source, { width, height: 1 })).toThrow(
        RangeError
      );
    }
  );

  it("accepts signed offsets and zero extents, but rejects fractional layer positions", () => {
    const layer = Result.getOrThrow(
      source.pipe(Layer.makeResult({ x: -2, y: 1, z: -1 }))
    );
    expect(layer).toEqual(Layer.make(source, { x: -2, y: 1, z: -1 }));
    expect(
      Result.getOrThrow(Stack.makeResult([layer], { width: 0, height: 0 }))
        .layers
    ).toEqual([layer]);
    expect(Layer.makeResult(source, { x: 0.5 })).toMatchObject({
      _tag: "Failure",
      failure: { reason: "InvalidInput" },
    });
    expect(
      Stack.makeResult([{ box: source, x: 0.5, y: 0, z: 0 }], {
        width: 1,
        height: 1,
      })
    ).toMatchObject({ _tag: "Failure" });
  });

  it("keeps absent and explicitly undefined option defaults", () => {
    expect(
      Result.getOrThrow(
        Place.makeResult(source, {
          width: 5,
          height: 1,
          x: undefined,
          y: undefined,
        })
      )
    ).toEqual(Place.make(source, { width: 5, height: 1 }));
    expect(
      Result.getOrThrow(
        Layer.makeResult(source, { x: undefined, y: undefined, z: undefined })
      )
    ).toEqual(Layer.make(source));
  });

  it("reports unsupported commands even when fully cropped", () => {
    const commanded = Cmd.clearScreen;
    expect(Place.makeResult(commanded, { width: 0, height: 0 })).toMatchObject({
      _tag: "Failure",
      failure: { reason: "UnsupportedCommand" },
    });
  });

  it("returns query failures and preserves outside-viewport misses", () => {
    const frame = Effect.runSync(
      Renderer.resolve(Reactive.makeReactive(Box.text("A"), "button"))
    );
    expect(
      Result.getOrThrow(Reactive.hitTestResult(frame, { row: 0, col: 0 }))
    ).toEqual(["button"]);
    expect(
      Result.getOrThrow(Reactive.hitTestResult({ row: -1, col: 0 })(frame))
    ).toEqual([]);
    expect(Reactive.hitTestResult(frame, { row: 0.5, col: 0 })).toMatchObject({
      _tag: "Failure",
      failure: { reason: "InvalidInput" },
    });
    expect(
      Reactive.hitTestResult({ ...frame }, { row: 0, col: 0 })
    ).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "FrameResolutionError" },
    });
  });
});

describe("frame failures", () => {
  it("keeps expected invalid content in the typed error channel", () => {
    expect(
      Effect.runSync(Effect.result(Renderer.resolve(Box.text("\u001b[0m"))))
    ).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "FrameResolutionError" },
    });
  });

  it("preserves unexpected resolver exceptions as defects", () => {
    const box = Box.text("A");
    const error = new Error("unexpected content access");
    // Inject a real exception in the tree access, without mocking the resolver.
    Object.defineProperty(box.content, "_tag", {
      get: () => {
        throw error;
      },
    });
    const exit = Effect.runSyncExit(Renderer.resolve(box));
    expect(Exit.hasDies(exit)).toBe(true);
  });

  it.each([null, {}, [42], ["A", "B"]])(
    "reports malformed custom encoder output %j as a typed failure",
    (response) => {
      const implementation: FrameEncoder.Shape = {
        encodeResolved: () => Effect.succeed(["A"]),
      };
      // Simulate a JavaScript plugin that violates the TypeScript return contract.
      Object.defineProperty(implementation, "encodeResolved", {
        value: () => Effect.succeed(response),
      });
      const result = Effect.runSync(
        Effect.result(
          Renderer.frame(Box.text("A")).pipe(
            Effect.provide(FrameEncoder.layer(implementation))
          )
        )
      );
      expect(result).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "FrameEncodingError" },
      });
    }
  );

  it("rejects a copied frame through the encoding error channel", () => {
    const frame = Effect.runSync(Renderer.resolve(Box.text("A")));
    const result = Effect.runSync(
      Effect.result(
        Renderer.encode({ ...frame }).pipe(
          Effect.provide(FrameEncoder.PlainFrameEncoderLive)
        )
      )
    );
    expect(result).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "FrameEncodingError" },
    });
  });
});
