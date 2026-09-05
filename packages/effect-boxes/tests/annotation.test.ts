import * as Equal from "effect/Equal";
import * as Hash from "effect/Hash";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import { describe, expect, it } from "vitest";
import * as Annotation from "../src/Annotation";

describe("Annotation", () => {
  describe("createAnnotation", () => {
    it("creates annotation with correct data", () => {
      const data = { type: "test", value: 42 };
      const annotation = Annotation.createAnnotation(data);
      expect(annotation.data).toEqual(data);
      expect(Annotation.isAnnotation(annotation)).toBe(true);
    });

    it("creates annotation with primitive data", () => {
      const annotation = Annotation.createAnnotation("simple string");
      expect(annotation.data).toBe("simple string");
    });

    it("creates annotation with complex nested data", () => {
      const complexData = {
        id: "nested-test",
        config: {
          enabled: true,
          options: ["a", "b", "c"],
          nested: {
            deep: { value: 100 },
          },
        },
      };
      const annotation = Annotation.createAnnotation(complexData);
      expect(annotation.data).toEqual(complexData);
    });
  });

  describe("Equal interface", () => {
    it("compares annotations with identical data as equal", () => {
      const data = { type: "equal-test", value: 123 };
      expect(
        Equal.equals(
          Annotation.createAnnotation(data),
          Annotation.createAnnotation(data)
        )
      ).toBe(true);
    });

    it("compares annotations with different data as not equal", () => {
      expect(
        Equal.equals(
          Annotation.createAnnotation({ type: "test1" }),
          Annotation.createAnnotation({ type: "test2" })
        )
      ).toBe(false);
    });

    it("compares annotations with same primitive data as equal", () => {
      expect(
        Equal.equals(
          Annotation.createAnnotation("hello"),
          Annotation.createAnnotation("hello")
        )
      ).toBe(true);
    });

    it("compares annotations with different primitive data as not equal", () => {
      expect(
        Equal.equals(
          Annotation.createAnnotation("hello"),
          Annotation.createAnnotation("world")
        )
      ).toBe(false);
    });

    it("compares annotations with nested objects correctly", () => {
      const sharedData = {
        config: { enabled: true, count: 5 },
        metadata: { tags: ["a", "b"] },
      };
      const differentData = {
        config: { enabled: false, count: 5 },
        metadata: { tags: ["a", "b"] },
      };
      const annotation1 = Annotation.createAnnotation(sharedData);
      const annotation2 = Annotation.createAnnotation(sharedData); // Same reference
      const annotation3 = Annotation.createAnnotation(differentData);

      expect(Equal.equals(annotation1, annotation2)).toBe(true);
      expect(Equal.equals(annotation1, annotation3)).toBe(false);
    });

    it("compares annotation with non-annotation as not equal", () => {
      const annotation = Annotation.createAnnotation("test");
      const notAnnotation = { data: "test" };
      expect(Equal.equals(annotation, notAnnotation)).toBe(false);
    });

    it("handles null and undefined data correctly", () => {
      const annotation1 = Annotation.createAnnotation(null);
      const annotation2 = Annotation.createAnnotation(null);
      const annotation3 = Annotation.createAnnotation(undefined);
      expect(Equal.equals(annotation1, annotation2)).toBe(true);
      expect(Equal.equals(annotation1, annotation3)).toBe(false);
    });
  });

  describe("Hash interface", () => {
    it("generates same hash for annotations with identical data", () => {
      const data = { key: "hash-test", value: [1, 2, 3] };
      const annotation1 = Annotation.createAnnotation(data);
      const annotation2 = Annotation.createAnnotation(data);
      expect(Hash.hash(annotation1)).toBe(Hash.hash(annotation2));
    });

    it("generates different hashes for annotations with different data", () => {
      const annotation1 = Annotation.createAnnotation({ id: 1 });
      const annotation2 = Annotation.createAnnotation({ id: 2 });
      expect(Hash.hash(annotation1)).not.toBe(Hash.hash(annotation2));
    });

    it("generates same hash for annotations with equivalent primitive data", () => {
      const annotation1 = Annotation.createAnnotation(42);
      const annotation2 = Annotation.createAnnotation(42);
      expect(Hash.hash(annotation1)).toBe(Hash.hash(annotation2));
    });

    it("generates different hashes for annotations with different primitive data", () => {
      const annotation1 = Annotation.createAnnotation("abc");
      const annotation2 = Annotation.createAnnotation("xyz");
      expect(Hash.hash(annotation1)).not.toBe(Hash.hash(annotation2));
    });

    it("generates consistent hashes for complex nested structures", () => {
      const complexData = {
        level1: {
          level2: {
            array: [1, 2, { nested: true }],
            string: "test",
            number: 123,
          },
        },
      };
      const annotation1 = Annotation.createAnnotation(complexData);
      const annotation2 = Annotation.createAnnotation(complexData);
      expect(Hash.hash(annotation1)).toBe(Hash.hash(annotation2));
    });

    it("should retrieve values when equivalent annotations are used as HashMap keys", () => {
      const storedKey = Annotation.createAnnotation("key");
      const equivalentKey = Annotation.createAnnotation("key");
      const map = HashMap.make([storedKey, "value"]);

      expect(Option.getOrUndefined(HashMap.get(map, equivalentKey))).toBe(
        "value"
      );
    });

    it("should find equivalent annotations when stored in a HashSet", () => {
      const stored = Annotation.createAnnotation("item");
      const equivalent = Annotation.createAnnotation("item");
      const set = HashSet.make(stored);

      expect(HashSet.has(set, equivalent)).toBe(true);
      expect(HashSet.size(HashSet.add(set, equivalent))).toBe(1);
    });
  });

  describe("Pipeable interface", () => {
    it("supports pipe method for functional composition", () => {
      const annotation = Annotation.createAnnotation("pipeable");
      const result = annotation.pipe((x) => x);
      expect(Equal.equals(annotation, result)).toBe(true);
    });

    it("works with effect pipe function", () => {
      const annotation = Annotation.createAnnotation({ initial: true });
      const result = annotation.pipe((ann) =>
        Annotation.createAnnotation({ ...ann.data, transformed: true })
      );
      expect(result.data).toEqual({ initial: true, transformed: true });
    });
  });

  describe("Type guards", () => {
    it("isAnnotation correctly identifies annotations", () => {
      expect(Annotation.isAnnotation(Annotation.createAnnotation("test"))).toBe(
        true
      );
      expect(Annotation.isAnnotation({ data: "test" })).toBe(false);
      expect(Annotation.isAnnotation("just a string")).toBe(false);
      expect(Annotation.isAnnotation(null)).toBe(false);
      expect(Annotation.isAnnotation(undefined)).toBe(false);
    });

    it("isAnnotationWithData correctly validates data types", () => {
      const stringAnnotation = Annotation.createAnnotation("string data");
      const numberAnnotation = Annotation.createAnnotation(42);
      const objectAnnotation = Annotation.createAnnotation({ type: "object" });
      const isString = (data: unknown): data is string =>
        typeof data === "string";
      const isNumber = (data: unknown): data is number =>
        typeof data === "number";
      const isObject = (data: unknown): data is object =>
        typeof data === "object" && data !== null;
      expect(Annotation.isAnnotationWithData(stringAnnotation, isString)).toBe(
        true
      );
      expect(Annotation.isAnnotationWithData(stringAnnotation, isNumber)).toBe(
        false
      );
      expect(Annotation.isAnnotationWithData(numberAnnotation, isNumber)).toBe(
        true
      );
      expect(Annotation.isAnnotationWithData(numberAnnotation, isString)).toBe(
        false
      );
      expect(Annotation.isAnnotationWithData(objectAnnotation, isObject)).toBe(
        true
      );
    });
  });

  describe("Utility functions", () => {
    it("getAnnotationData extracts data correctly", () => {
      const data = { extracted: true, value: 999 };
      const annotation = Annotation.createAnnotation(data);
      expect(Annotation.getAnnotationData(annotation)).toEqual(data);
    });

    it("mapAnnotationData transforms data correctly", () => {
      const annotation = Annotation.createAnnotation(10);
      const transformed = Annotation.mapAnnotationData(
        annotation,
        (n) => n * 2
      );
      expect(transformed.data).toBe(20);
      expect(Annotation.isAnnotation(transformed)).toBe(true);
    });

    it("combineAnnotations merges data using provided function", () => {
      const annotation1 = Annotation.createAnnotation({ count: 5 });
      const annotation2 = Annotation.createAnnotation({ count: 3 });
      const combined = Annotation.combineAnnotations(
        annotation1,
        annotation2,
        (a, b) => ({ count: a.count + b.count })
      );
      expect(combined.data).toEqual({ count: 8 });
    });

    it("filterAnnotation returns annotation when predicate passes", () => {
      const annotation = Annotation.createAnnotation(15);
      const filtered = Annotation.filterAnnotation(annotation, (n) => n > 10);
      expect(filtered).toBe(annotation);
    });

    it("filterAnnotation returns undefined when predicate fails", () => {
      const annotation = Annotation.createAnnotation(5);
      const filtered = Annotation.filterAnnotation(annotation, (n) => n > 10);
      expect(filtered).toBeUndefined();
    });

    it("createAnnotations creates array of annotations", () => {
      const dataArray = ["a", "b", "c"];
      const annotations = Annotation.createAnnotations(dataArray);
      expect(annotations).toHaveLength(3);
      expect(annotations[0]?.data).toBe("a");
      expect(annotations[1]?.data).toBe("b");
      expect(annotations[2]?.data).toBe("c");
      for (const ann of annotations) {
        expect(Annotation.isAnnotation(ann)).toBe(true);
      }
    });

    it("extractAnnotationData extracts data from annotation array", () => {
      const originalData = [1, 2, 3];
      const annotations = Annotation.createAnnotations(originalData);
      const extractedData = Annotation.extractAnnotationData(annotations);
      expect(extractedData).toEqual(originalData);
    });

    it("cloneAnnotation creates identical copy", () => {
      const annotation = Annotation.createAnnotation({ clone: "test" });
      const cloned = Annotation.cloneAnnotation(annotation);
      expect(Equal.equals(annotation, cloned)).toBe(true);
      expect(Hash.hash(annotation)).toBe(Hash.hash(cloned));
      expect(cloned.data).toEqual(annotation.data);
    });
  });

  describe("Constants", () => {
    it("provides empty annotation constant", () => {
      expect(Annotation.isAnnotation(Annotation.empty)).toBe(true);
      expect(Annotation.empty.data).toBe(undefined);
    });
  });
});
