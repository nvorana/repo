import { describe, expect, it } from "vitest";
import { buildTeamHome, filterByRange, TEAM_SCORE_TARGET } from "./teamHome.ts";
import type { ReviewSummary } from "../api.ts";

// Minimal review factory — only the fields teamHome reads.
function rev(p: Partial<ReviewSummary> & { id: string }): ReviewSummary {
  return {
    filename: "f",
    createdAt: "2026-07-01T00:00:00.000Z",
    status: "completed",
    mixedAudio: false,
    overallScore: 5,
    ...p,
  } as ReviewSummary;
}

const NOW = new Date("2026-07-07T00:00:00.000Z").getTime();

describe("filterByRange", () => {
  const list = [
    rev({ id: "old", callDate: "2026-05-01" }),
    rev({ id: "recent", callDate: "2026-07-05" }),
  ];
  it("keeps only in-range calls for a day window", () => {
    expect(filterByRange(list, 30, NOW).map((r) => r.id)).toEqual(["recent"]);
  });
  it("keeps everything for 'all'", () => {
    expect(filterByRange(list, "all", NOW).map((r) => r.id).sort()).toEqual(["old", "recent"]);
  });
});

describe("buildTeamHome", () => {
  it("returns an empty model for no reviews", () => {
    const t = buildTeamHome([], "all", NOW);
    expect(t.reps).toEqual([]);
    expect(t.teamAvg).toBe(0);
    expect(t.coachFirst).toBeUndefined();
    expect(t.target).toBe(TEAM_SCORE_TARGET);
  });

  it("aggregates a rep: avg, last, delta, momentum, weakest, series, call ids", () => {
    // Ana: two calls. Oldest 6 (id a1), newest 4 (id a2) → avg 5, last 4, delta -1 → slipping.
    const reviews = [
      rev({ id: "a1", rep: "Ana", repId: "u-ana", callDate: "2026-07-02", overallScore: 6,
            scorecard: [{ criterionId: "disc", criterionName: "Discovery", score: 2 }] }),
      rev({ id: "a2", rep: "Ana", repId: "u-ana", callDate: "2026-07-05", overallScore: 4,
            scorecard: [{ criterionId: "disc", criterionName: "Discovery", score: 3 }] }),
    ];
    const t = buildTeamHome(reviews, "all", NOW);
    const ana = t.reps[0];
    expect(ana.rep).toBe("Ana");
    expect(ana.repId).toBe("u-ana");
    expect(ana.calls).toBe(2);
    expect(ana.avgScore).toBe(5);
    expect(ana.lastScore).toBe(4);
    expect(ana.delta).toBe(-1);
    expect(ana.momentum).toBe("slipping");
    expect(ana.sampleSize).toBe("small");
    expect(ana.callsToScore).toBe(0);
    expect(ana.weakest).toEqual({ name: "Discovery", avg: 2.5 });
    expect(ana.scoreSeries).toEqual([6, 4]); // chronological oldest→newest
    expect(ana.recentCallId).toBe("a2"); // newest
    expect(ana.worstCallId).toBe("a2"); // lowest score
  });

  it("labels sample size and marks insufficient reps needing more calls", () => {
    const reviews = [
      rev({ id: "e1", rep: "Edgar", overallScore: 5, callDate: "2026-07-05" }),
    ];
    const t = buildTeamHome(reviews, "all", NOW);
    const edgar = t.reps.find((r) => r.rep === "Edgar")!;
    expect(edgar.sampleSize).toBe("insufficient");
    expect(edgar.callsToScore).toBe(1); // needs 1 more to reach MIN_CALLS_FOR_SCORE=2
    expect(edgar.momentum).toBe("steady");
  });

  it("computes team average and momentum over SCORED reps only, and sinks insufficient reps last", () => {
    const reviews = [
      // Bea: improving (4 then 6) avg 5
      rev({ id: "b1", rep: "Bea", callDate: "2026-07-01", overallScore: 4 }),
      rev({ id: "b2", rep: "Bea", callDate: "2026-07-05", overallScore: 6 }),
      // Cy: slipping (8 then 6) avg 7
      rev({ id: "c1", rep: "Cy", callDate: "2026-07-01", overallScore: 8 }),
      rev({ id: "c2", rep: "Cy", callDate: "2026-07-05", overallScore: 6 }),
      // Dan: single call — insufficient, excluded from teamAvg/momentum
      rev({ id: "d1", rep: "Dan", callDate: "2026-07-05", overallScore: 2 }),
    ];
    const t = buildTeamHome(reviews, "all", NOW);
    expect(t.teamAvg).toBe(6); // mean of Bea(5) and Cy(7); Dan excluded
    expect(t.momentum).toEqual({ slipping: 1, steady: 0, improving: 1 });
    // priority: slipping first (Cy), then improving (Bea); insufficient (Dan) last
    expect(t.reps.map((r) => r.rep)).toEqual(["Cy", "Bea", "Dan"]);
    expect(t.coachFirst?.rep).toBe("Cy");
  });

  it("counts callsReviewed in range but keeps queueCount all-time", () => {
    const reviews = [
      // in range (last 30d from NOW=07-07)
      rev({ id: "x1", rep: "Ana", overallScore: 5, callDate: "2026-07-05", coachReviewed: true }),
      rev({ id: "x2", rep: "Ana", overallScore: 5, callDate: "2026-07-05", coachReviewed: false }),
      // OLD, out of a 30-day range, still un-coached → must still count in the queue
      rev({ id: "x3", rep: "Ana", overallScore: 5, callDate: "2026-05-01", coachReviewed: false }),
    ];
    const t = buildTeamHome(reviews, 30, NOW);
    expect(t.callsReviewed).toBe(2); // x1, x2 in range; x3 excluded from range
    expect(t.queueCount).toBe(2); // x2 (in range) AND x3 (old) — queue is all-time
  });

  it("excludes mixed-audio reviews from rep aggregation", () => {
    const reviews = [
      rev({ id: "m1", rep: "Ana", overallScore: 9, mixedAudio: true, callDate: "2026-07-05" }),
      rev({ id: "m2", rep: "Ana", overallScore: 3, mixedAudio: false, callDate: "2026-07-05" }),
    ];
    const t = buildTeamHome(reviews, "all", NOW);
    expect(t.reps[0].calls).toBe(1);
    expect(t.reps[0].avgScore).toBe(3);
  });
});
