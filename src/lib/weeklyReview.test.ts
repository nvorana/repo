import { describe, expect, it } from "vitest";
import type { ReviewSummary } from "../api.ts";
import { buildWeeklyReview } from "./weeklyReview.ts";

// "Today" for every test. Windows are Aug 13–19 (this) and Aug 6–12 (prev).
const NOW = new Date("2026-08-19T12:00:00.000Z");

function call(over: Partial<ReviewSummary> = {}): ReviewSummary {
  return {
    id: Math.random().toString(36).slice(2),
    filename: "c.mp3",
    createdAt: "2026-08-19T00:00:00.000Z",
    status: "completed",
    rep: "Edgar",
    repId: "u1",
    mixedAudio: false,
    released: true,
    overallScore: 5,
    metrics: {
      talkRatio: 50,
      longPausesHeld: 60,
      fillerWords: 20,
      questionsAsked: 130,
      interruptions: 2,
      durationMin: 60,
    },
    ...over,
  } as ReviewSummary;
}

const edgar = (r: ReturnType<typeof buildWeeklyReview>) => r.reps.find((x) => x.rep === "Edgar")!;

describe("weekly review windows", () => {
  it("labels the two rolling 7-day windows", () => {
    const r = buildWeeklyReview([call({ callDate: "2026-08-19" })], NOW);
    expect(r.now).toMatchObject({ start: "2026-08-13", end: "2026-08-19" });
    expect(r.prev).toMatchObject({ start: "2026-08-06", end: "2026-08-12" });
    expect(r.now.label).toBe("Aug 13–Aug 19");
  });

  it("puts each call in the right window and ignores older ones", () => {
    const r = buildWeeklyReview(
      [
        call({ callDate: "2026-08-19" }),
        call({ callDate: "2026-08-13" }), // first day of this window
        call({ callDate: "2026-08-12" }), // last day of previous window
        call({ callDate: "2026-08-06" }),
        call({ callDate: "2026-08-05" }), // too old for either
      ],
      NOW,
    );
    expect(edgar(r).callsNow).toBe(2);
    expect(edgar(r).callsPrev).toBe(2);
  });

  it("buckets by the date the call happened, not the upload date", () => {
    const r = buildWeeklyReview(
      [call({ createdAt: "2026-08-19T00:00:00.000Z", callDate: "2026-08-10" })],
      NOW,
    );
    expect(edgar(r).callsNow).toBe(0);
    expect(edgar(r).callsPrev).toBe(1);
  });
});

describe("week-over-week comparison", () => {
  it("reports the score movement between windows", () => {
    const r = buildWeeklyReview(
      [
        call({ callDate: "2026-08-08", overallScore: 4 }),
        call({ callDate: "2026-08-09", overallScore: 4 }),
        call({ callDate: "2026-08-17", overallScore: 5 }),
        call({ callDate: "2026-08-18", overallScore: 5 }),
      ],
      NOW,
    );
    const e = edgar(r);
    expect(e.scorePrev).toBe(4);
    expect(e.scoreNow).toBe(5);
    expect(e.scoreDelta).toBe(1);
    expect(e.talkingPoints.some((t) => t.includes("Score up") && t.includes("4 → 5"))).toBe(true);
  });

  it("knows which direction is an improvement for each measure", () => {
    const r = buildWeeklyReview(
      [
        // filler is lower-is-better: 60/hr last week, 20/hr this week = improved
        call({ callDate: "2026-08-08", metrics: { ...call().metrics!, fillerWords: 60 } }),
        call({ callDate: "2026-08-18", metrics: { ...call().metrics!, fillerWords: 20 } }),
      ],
      NOW,
    );
    const filler = edgar(r).measures.find((m) => m.key === "fillerWords")!;
    expect(filler.prev).toBe(60);
    expect(filler.now).toBe(20);
    expect(filler.improved).toBe(true);
    expect(filler.meetsTarget).toBe(true);
  });

  it("flags a measure that moved the wrong way", () => {
    const r = buildWeeklyReview(
      [
        call({ callDate: "2026-08-08", metrics: { ...call().metrics!, talkRatio: 45 } }),
        call({ callDate: "2026-08-18", metrics: { ...call().metrics!, talkRatio: 70 } }),
      ],
      NOW,
    );
    const talk = edgar(r).measures.find((m) => m.key === "talkRatio")!;
    expect(talk.improved).toBe(false);
    expect(talk.meetsTarget).toBe(false);
    expect(edgar(r).talkingPoints.some((t) => t.includes("went the wrong way"))).toBe(true);
  });

  it("normalises counts per hour, so a longer call is not penalised", () => {
    const r = buildWeeklyReview(
      [
        // Same rate (30/hr) despite very different call lengths.
        call({ callDate: "2026-08-08", metrics: { ...call().metrics!, fillerWords: 15, durationMin: 30 } }),
        call({ callDate: "2026-08-18", metrics: { ...call().metrics!, fillerWords: 60, durationMin: 120 } }),
      ],
      NOW,
    );
    const filler = edgar(r).measures.find((m) => m.key === "fillerWords")!;
    expect(filler.prev).toBe(30);
    expect(filler.now).toBe(30);
    expect(filler.improved).toBeNull(); // no meaningful change
  });
});

describe("eligibility is respected", () => {
  it("keeps an unreleased call out of the score but in the metrics", () => {
    const r = buildWeeklyReview(
      [call({ callDate: "2026-08-18", released: false, overallScore: undefined })],
      NOW,
    );
    const e = edgar(r);
    expect(e.callsNow).toBe(1);
    expect(e.scoreNow).toBeNull();
    expect(e.measures.find((m) => m.key === "talkRatio")!.now).toBe(50);
    expect(e.talkingPoints.some((t) => t.includes("not been released"))).toBe(true);
  });

  it("excludes mixed-audio calls from the metric comparison", () => {
    const r = buildWeeklyReview(
      [call({ callDate: "2026-08-18", mixedAudio: true, metrics: { ...call().metrics!, talkRatio: 95 } })],
      NOW,
    );
    expect(edgar(r).measures.find((m) => m.key === "talkRatio")!.now).toBeNull();
  });

  it("ignores placeholder scorecard rows when picking the weakest skill", () => {
    const r = buildWeeklyReview(
      [
        call({
          callDate: "2026-08-18",
          scorecard: [
            { criterionId: "", criterionName: "", score: 0 },
            { criterionId: "binary", criterionName: "Binary Close", score: 2 },
          ],
        }),
      ],
      NOW,
    );
    const e = edgar(r);
    expect(e.skills.map((s) => s.name)).toEqual(["Binary Close"]);
    expect(e.talkingPoints.some((t) => t.includes("Binary Close at 2/5"))).toBe(true);
  });
});

describe("what the coach actually reads", () => {
  it("leads with the person who uploaded nothing", () => {
    const r = buildWeeklyReview(
      [
        call({ rep: "Edgar", callDate: "2026-08-18" }),
        call({ rep: "Ferdie", callDate: "2026-08-08" }), // last week only
      ],
      NOW,
    );
    expect(r.reps[0].rep).toBe("Ferdie");
    expect(r.reps[0].callsNow).toBe(0);
    expect(r.reps[0].talkingPoints[0]).toContain("No calls uploaded this week");
  });

  it("warns when too few calls to trust the delta", () => {
    const r = buildWeeklyReview([call({ callDate: "2026-08-18" })], NOW);
    expect(edgar(r).reliable).toBe(false);
    expect(edgar(r).talkingPoints[0]).toContain("more than a hint");
  });

  it("writes a message addressed to the rep, ready to send", () => {
    const r = buildWeeklyReview(
      [
        call({ callDate: "2026-08-08", overallScore: 4 }),
        call({ callDate: "2026-08-17", overallScore: 5 }),
        call({ callDate: "2026-08-18", overallScore: 5 }),
        call({ callDate: "2026-08-19", overallScore: 5 }),
      ],
      NOW,
    );
    const msg = edgar(r).message;
    expect(msg.startsWith("Hi Edgar")).toBe(true);
    expect(msg).toContain("Score went up");
    // No report furniture — it has to paste into Viber as-is.
    expect(msg).not.toMatch(/[#*|]|^- /m);
  });

  it("asks for uploads when there are none, instead of showing an empty card", () => {
    const r = buildWeeklyReview([call({ callDate: "2026-08-08" })], NOW);
    expect(edgar(r).message).toContain("Send me your calls");
  });
});
