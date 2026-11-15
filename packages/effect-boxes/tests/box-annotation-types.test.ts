import { pipe } from "effect";
import { expectTypeOf, it } from "vitest";
import * as Annotation from "../src/Annotation";
import * as Box from "../src/Box";

it("retains array element annotations through collection combinators", () => {
  const children: ReadonlyArray<Box.Box<number>> = [
    Box.annotate(Box.line("a"), Annotation.createAnnotation(1)),
  ];
  const separator = Box.annotate(
    Box.line("|"),
    Annotation.createAnnotation("separator")
  );

  expectTypeOf(Box.combineAll(children)).toEqualTypeOf<Box.Box<number>>();
  expectTypeOf(Box.hcat(children, Box.top)).toEqualTypeOf<Box.Box<number>>();
  expectTypeOf(Box.vcat(children, Box.left)).toEqualTypeOf<Box.Box<number>>();

  const row = Box.hcat(Box.top);
  const column = Box.vcat(Box.left);
  const rowWithSeparator = Box.punctuateH(Box.top, separator);
  const columnWithSeparator = Box.punctuateV(Box.left, separator);
  expectTypeOf(pipe(children, row)).toEqualTypeOf<Box.Box<number>>();
  expectTypeOf(pipe(children, column)).toEqualTypeOf<Box.Box<number>>();
  expectTypeOf(pipe(children, rowWithSeparator)).toEqualTypeOf<
    Box.Box<number | string>
  >();
  expectTypeOf(pipe(children, columnWithSeparator)).toEqualTypeOf<
    Box.Box<number | string>
  >();
  expectTypeOf(Box.punctuateH(children, Box.top, separator)).toEqualTypeOf<
    Box.Box<number | string>
  >();
  expectTypeOf(Box.punctuateV(children, Box.left, separator)).toEqualTypeOf<
    Box.Box<number | string>
  >();
});

it("combines annotation types in mixed tuples and preserves an empty tuple", () => {
  const number = Box.annotate(Box.line("n"), Annotation.createAnnotation(1));
  const string = Box.annotate(Box.line("s"), Annotation.createAnnotation("s"));
  const mixed = [number, string] as const;
  expectTypeOf(Box.hcat(mixed, Box.top)).toEqualTypeOf<
    Box.Box<number | string>
  >();
  expectTypeOf(Box.hcat<typeof mixed>(Box.top)(mixed)).toEqualTypeOf<
    Box.Box<number | string>
  >();
  expectTypeOf(Box.combineAll([])).toEqualTypeOf<Box.Box<never>>();
});
