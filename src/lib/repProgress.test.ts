import { describe, expect, it } from "vitest";
import type { ReviewSummary } from "../api.ts";
import { buildRepProgress } from "./repProgress.ts";

const REP = { id: "u1", name: "Edgar" };

function call(over: Partial<ReviewSummary> = {}): ReviewSummary {
  return {
    id: Math.random().toString(36).slice(2),
    filename: "call.mp3",
    createdAt: "2026-08-01T00:00:00.000Z",
    status: "completed",
    repId: "u1",
    mixedAudio: false,
    released: true,
    metrics: {
      talkRatio: 50,
      longPausesHeld: 4,
      fillerWords: 3,
      questionsAsked: 14,
      interruptions: 1,
    },
    ...over,
  } as ReviewSummary;
}

function measure(p: ReturnType<typeof buildRepProgress>, key: string) {
  return p.measures.find((m) => m.config.key === key)!;
}

describe("buildRepProgress", () => {
  it("lets an unreleased call move delivery trends but contribute no score point", () => {
    const p = buildRepProgress(
      [
        call({ callDate: "2026-08-01", overallScore: 8, released: true }),
        // Not released: metrics present, judgment withheld by the server.
        call({
          callDate: "2026-08-02",
          released: false,
          overallScore: undefined,
          metrics: {
            talkRatio: 71,
            longPausesHeld: 1,
            fillerWords: 12,
            questionsAsked: 4,
            interruptions: 5,
          },
        }),
      ],
      REP,
    );

    // Delivery line reflects the newest (unreleased) call.
    expect(measure(p, "talkRatio").current).toBe(71);
    // Score line still reads the last RELEASED call — no score leaked.
    expect(measure(p, "overallScore").current).toBe(8);
    expect(p.eligible).toBe(2);
    expect(p.awaitingRelease).toBe(1);
  });

  it("excludes mixed-audio calls — a guessed talk ratio must not move a trend", () => {
    const p = buildRepProgress(
      [
        call({ callDate: "2026-08-01", metrics: { ...call().metrics!, talkRatio: 50 } }),
        call({
          callDate: "2026-08-02",
          mixedAudio: true,
          metrics: { ...call().metrics!, talkRatio: 95 },
        }),
      ],
      REP,
    );
    expect(p.eligible).toBe(1);
    expect(measure(p, "talkRatio").current).toBe(50);
  });

  it("excludes calls that have not finished analyzing", () => {
    const p = buildRepProgress(
      [call({ callDate: "2026-08-01" }), call({ status: "analyzing", callDate: "2026-08-02" })],
      REP,
    );
    expect(p.eligible).toBe(1);
  });

  it("buckets by the date the call happened, not the upload date", () => {
    const p = buildRepProgress(
      [
        // Uploaded second but happened FIRST — must sort first.
        call({
          createdAt: "2026-08-09T00:00:00.000Z",
          callDate: "2026-08-01",
          metrics: { ...call().metrics!, talkRatio: 40 },
        }),
        call({
          createdAt: "2026-08-02T00:00:00.000Z",
          callDate: "2026-08-05",
          metrics: { ...call().metrics!, talkRatio: 60 },
        }),
      ],
      REP,
    );
    expect(measure(p, "talkRatio").current).toBe(60);
  });

  it("names the recurring measure furthest from target as the focus", () => {
    const bad = {
      talkRatio: 80, // target <=55, off by 25
      longPausesHeld: 4,
      fillerWords: 6, // target <=5, off by 1
      questionsAsked: 14,
      interruptions: 1,
    };
    const p = buildRepProgress(
      [
        call({ callDate: "2026-08-01", metrics: bad }),
        call({ callDate: "2026-08-02", metrics: bad }),
      ],
      REP,
    );
    expect(p.coachNext?.config.key).toBe("talkRatio");
    expect(p.coachNext?.state).toBe("recurring");
  });

  it("flags a weakness the rep has since corrected as fixed, not recurring", () => {
    const p = buildRepProgress(
      [
        call({ callDate: "2026-08-01", metrics: { ...call().metrics!, fillerWords: 20 } }),
        call({ callDate: "2026-08-02", metrics: { ...call().metrics!, fillerWords: 2 } }),
      ],
      REP,
    );
    expect(measure(p, "fillerWords").state).toBe("fixed");
  });

  it("matches calls by display name when the call predates rep ids", () => {
    const p = buildRepProgress(
      [call({ repId: undefined, rep: "Edgar", callDate: "2026-08-01" })],
      REP,
    );
    expect(p.eligible).toBe(1);
  });

  it("does not mix in another rep's calls", () => {
    const p = buildRepProgress(
      [call({ repId: "u2", callDate: "2026-08-01" }), call({ callDate: "2026-08-02" })],
      REP,
    );
    expect(p.eligible).toBe(1);
  });
});
