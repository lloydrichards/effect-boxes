import { describe, expect, it } from "vitest";
import * as TextCache from "../src/internal/textCache";
import * as Width from "../src/internal/width";

describe("text cache", () => {
  it("evicts the oldest entry after 1,024 distinct keys, even when read", () => {
    const cache = TextCache.make<number>();
    for (let index = 0; index < 1024; index++) {
      cache.set(`key ${index}`, index);
    }
    expect(cache.get("key 0")).toBe(0);
    cache.set("next", 1024);
    expect(cache.get("key 0")).toBeUndefined();
    expect(cache.get("key 1")).toBe(1);
    expect(cache.get("next")).toBe(1024);
  });

  it("updates an existing key without evicting another entry", () => {
    const cache = TextCache.make<number>();
    for (let index = 0; index < 1024; index++) {
      cache.set(`key ${index}`, index);
    }
    cache.set("key 1", 42);
    expect(cache.get("key 0")).toBe(0);
    expect(cache.get("key 1")).toBe(42);
  });

  it("retains keys up to 1,000 code units and skips longer keys", () => {
    const cache = TextCache.make<number>();
    cache.set("", 0);
    cache.set("x".repeat(1000), 1000);
    cache.set("x".repeat(1001), 1001);
    expect(cache.get("")).toBe(0);
    expect(cache.get("x".repeat(1000))).toBe(1000);
    expect(cache.get("x".repeat(1001))).toBeUndefined();
  });

  it("recomputes evicted graphemes without changing segmentation or width", () => {
    const text = "界👩‍💻é";
    const original = Width.segments(text);
    expect(Width.segments(text)).toBe(original);
    expect(Width.ofString(text)).toBe(5);
    for (let index = 0; index < 2048; index++) {
      Width.ofString(`status ${index}`);
    }
    const recomputed = Width.segments(text);
    expect(recomputed).not.toBe(original);
    expect(recomputed).toEqual(["界", "👩‍💻", "é"]);
    expect(Width.ofString(text)).toBe(5);
  });

  it("keeps ANSI-only width zero through cache churn and for long input", () => {
    for (let index = 0; index < 2048; index++) {
      expect(Width.ofString(`\x1b]0;title ${index}\x07`)).toBe(0);
    }
    expect(Width.ofString("\x1b[31m".repeat(300))).toBe(0);
    expect(Width.ofString("\x1b[31m".repeat(300))).toBe(0);
    expect(Width.ofString("\x1b[31mred\x1b[0m")).toBe(3);
  });
});
