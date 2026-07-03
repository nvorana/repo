import { describe, expect, it } from "vitest";
import { countsTowardTrends } from "./eligibility.ts";

describe("countsTowardTrends", () => {
  const base = { status: "completed" as const, overallScore: 7, mixedAudio: false };

  it("accepts a completed, scored, two-track review", () => {
    expect(countsTowardTrends(base)).toBe(true);
  });

  it("rejects mixed-audio reviews", () => {
    expect(countsTowardTrends({ ...base, mixedAudio: true })).toBe(false);
  });

  it("treats a missing mixedAudio field as mixed (old cached payloads)", () => {
    expect(countsTowardTrends({ status: "completed", overallScore: 7 })).toBe(false);
  });

  it("rejects unscored or incomplete reviews", () => {
    expect(countsTowardTrends({ ...base, overallScore: undefined })).toBe(false);
    expect(countsTowardTrends({ ...base, status: "failed" })).toBe(false);
  });
});
