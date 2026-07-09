import { describe, expect, it } from "vitest";
import { clampSkip } from "./audio.ts";

describe("clampSkip", () => {
  it("skips forward and back within range", () => {
    expect(clampSkip(30, 5, 100)).toBe(35);
    expect(clampSkip(30, -5, 100)).toBe(25);
    expect(clampSkip(30, 10, 100)).toBe(40);
    expect(clampSkip(30, -10, 100)).toBe(20);
  });

  it("clamps at the start", () => {
    expect(clampSkip(3, -5, 100)).toBe(0);
    expect(clampSkip(0, -10, 100)).toBe(0);
  });

  it("clamps at the end", () => {
    expect(clampSkip(98, 5, 100)).toBe(100);
    expect(clampSkip(95, 10, 100)).toBe(100);
  });

  it("does not upper-clamp when duration is unknown (NaN or 0), but still lower-clamps", () => {
    expect(clampSkip(30, 5, NaN)).toBe(35);
    expect(clampSkip(30, 5, 0)).toBe(35);
    expect(clampSkip(2, -5, NaN)).toBe(0);
  });
});
