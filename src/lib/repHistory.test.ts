import { describe, expect, it } from "vitest";
import { buildRepMeasures, type RepReview } from "./repHistory.ts";

const review = (over: Partial<RepReview>): RepReview => ({
  id: over.id ?? "x",
  date: over.date ?? "2026-05-01",
  overallScore: over.overallScore,
  metrics: over.metrics,
  objectionRate: over.objectionRate ?? null,
  scorecard: over.scorecard ?? [],
  diagnosis: over.diagnosis ?? null,
});

describe("buildRepMeasures", () => {
  it("orders points oldest-first by date and maps metric keys", () => {
    const reviews = [
      review({ id: "b", date: "2026-05-10", metrics: m(60), overallScore: 6 }),
      review({ id: "a", date: "2026-05-01", metrics: m(72), overallScore: 4 }),
    ];
    const { measures } = buildRepMeasures(reviews);
    const talk = measures.find((x) => x.config.key === "talkRatio")!;
    expect(talk.points.map((p) => p.value)).toEqual([72, 60]);
  });

  it("creates a measure per framework skill", () => {
    const reviews = [
      review({ date: "2026-05-01", scorecard: [{ criterionId: "pricing", criterionName: "Pricing", score: 2 }] }),
      review({ date: "2026-05-08", scorecard: [{ criterionId: "pricing", criterionName: "Pricing", score: 4 }] }),
    ];
    const { measures } = buildRepMeasures(reviews);
    const skill = measures.find((x) => x.config.key === "skill:pricing")!;
    expect(skill.points.map((p) => p.value)).toEqual([2, 4]);
    expect(skill.state).toBe("fixed");
  });
});

function m(talkRatio: number) {
  return { talkRatio, longPausesHeld: 4, fillerWords: 3, questionsAsked: 15, interruptions: 1 };
}
