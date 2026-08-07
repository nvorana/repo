import { describe, expect, it } from "vitest";
import {
  computeMeasureTrend,
  pickCoachNext,
  type MeasureConfig,
} from "./trends.ts";

const lower: MeasureConfig = { key: "talk", label: "Talk ratio", direction: "lower", target: 55 };
const higher: MeasureConfig = { key: "skill", label: "Skill", direction: "higher", target: 4 };

const pts = (vals: (number | null)[]) =>
  vals.map((v, i) => ({
    date: `2026-05-${String(i + 1).padStart(2, "0")}`,
    value: v,
  }));

describe("computeMeasureTrend", () => {
  it("flags 'fixed' when it crossed the target and now passes", () => {
    const t = computeMeasureTrend(lower, pts([72, 68, 60, 51]));
    expect(t.state).toBe("fixed");
    expect(t.current).toBe(51);
    expect(t.meetsTarget).toBe(true);
  });

  it("flags 'recurring' when the latest call still fails", () => {
    const t = computeMeasureTrend({ ...lower, target: 5 }, pts([14, 12, 15, 13]));
    expect(t.state).toBe("recurring");
    expect(t.meetsTarget).toBe(false);
  });

  it("flags 'steady' when every call passes", () => {
    const t = computeMeasureTrend(higher, pts([4, 5, 4]));
    expect(t.state).toBe("steady");
  });

  it("flags 'insufficient' with fewer than two data points", () => {
    const t = computeMeasureTrend(higher, pts([4]));
    expect(t.state).toBe("insufficient");
  });

  it("ignores null values when counting data points", () => {
    const t = computeMeasureTrend(higher, pts([null, 4]));
    expect(t.state).toBe("insufficient");
  });
});

describe("pickCoachNext", () => {
  it("returns the recurring measure over a fixed one", () => {
    const fixed = computeMeasureTrend(lower, pts([72, 51]));
    const recurring = computeMeasureTrend({ ...lower, target: 5, key: "filler", label: "Filler" }, pts([14, 13]));
    expect(pickCoachNext([fixed, recurring])?.config.key).toBe("filler");
  });

  it("returns null when nothing is recurring", () => {
    const fixed = computeMeasureTrend(lower, pts([72, 51]));
    expect(pickCoachNext([fixed])).toBeNull();
  });

  it("picks the recurring measure furthest from target", () => {
    const r1 = computeMeasureTrend({ ...lower, target: 55, key: "a", label: "A" }, pts([60, 58])); // gap 3
    const r2 = computeMeasureTrend({ ...lower, target: 55, key: "b", label: "B" }, pts([60, 70])); // gap 15
    expect(pickCoachNext([r1, r2])?.config.key).toBe("b");
  });
});
