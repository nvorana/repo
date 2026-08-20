import { describe, expect, it } from "vitest";
import type { CallReview } from "../../core/types.ts";
import { draftCoachNote } from "./coachNote.ts";

function review(over: Partial<CallReview> = {}): CallReview {
  return {
    summary: "A discovery call that lost momentum at pricing.",
    callOutcome: "open",
    overallScore: 5,
    whatWentRight: [
      {
        point: "Opened with a strong, specific question about her goals",
        detail: "Set the frame early.",
        quote: "Ano po talaga yung gusto niyong mangyari this year?",
        timestamp: "02:14",
        impact: "medium",
      },
    ],
    whatWentWrong: [
      {
        point: "Filled the silence right after quoting the price",
        detail: "Removed the pressure to decide.",
        quote: "Pero okay lang po kung mag-isip muna kayo",
        timestamp: "32:10",
        impact: "high",
      },
    ],
    objections: [],
    delivery: {} as CallReview["delivery"],
    scorecard: [],
    coaching: [
      {
        priority: 1,
        title: "Hold the silence after you say the price",
        advice: "When you gave the number at 32:10 you kept talking. Say it, then stop.",
        example: "The investment is 40,000 pesos. [silence]",
      },
      {
        priority: 2,
        title: "Ask for the decision directly",
        advice: "You ended without asking. Give her two options and let her pick.",
        example: "Would you rather start this week or next?",
      },
    ],
    ...over,
  } as CallReview;
}

describe("draftCoachNote", () => {
  it("greets the rep by first name only", () => {
    expect(draftCoachNote(review(), "Edgar Santos").startsWith("Hi Edgar —")).toBe(true);
  });

  it("still works with no name", () => {
    expect(draftCoachNote(review()).startsWith("Went through your call.")).toBe(true);
  });

  it("names something that worked, with the moment it happened", () => {
    const n = draftCoachNote(review(), "Edgar");
    expect(n).toContain("What worked:");
    expect(n).toContain("02:14");
  });

  it("leads the coaching with the highest-priority item", () => {
    const n = draftCoachNote(review(), "Edgar");
    expect(n).toContain("The main thing to work on: Hold the silence after you say the price.");
    expect(n.indexOf("Hold the silence")).toBeLessThan(n.indexOf("Ask for the decision"));
  });

  it("includes a line they could actually say", () => {
    expect(draftCoachNote(review(), "Edgar")).toContain("The investment is 40,000 pesos.");
  });

  it("reads as a message, not a report", () => {
    const n = draftCoachNote(review(), "Edgar");
    // Nothing to strip before pasting into Viber.
    expect(n).not.toMatch(/^#|^\s*[-*•]\s|\*\*|\|/m);
    expect(n).toContain("you");
  });

  it("ends with an opening for the rep to disagree", () => {
    expect(draftCoachNote(review(), "Edgar")).toContain("push back");
  });

  it("survives a sparse report without inventing anything", () => {
    const n = draftCoachNote(
      review({ whatWentRight: [], whatWentWrong: [], coaching: [] }),
      "Edgar",
    );
    expect(n).toContain("Hi Edgar");
    expect(n).not.toContain("undefined");
    expect(n).not.toContain("What worked:");
  });

  it("punctuates model fragments so they read as sentences", () => {
    const n = draftCoachNote(
      review({
        coaching: [
          { priority: 1, title: "Slow down discovery", advice: "You rushed it", example: "" },
        ],
      }),
      "Edgar",
    );
    expect(n).toContain("Slow down discovery.");
    expect(n).toContain("You rushed it.");
  });

  it("shortens a long example rather than pasting a wall of text", () => {
    const long = "x".repeat(400);
    const n = draftCoachNote(
      review({ coaching: [{ priority: 1, title: "T", advice: "A", example: long }] }),
      "Edgar",
    );
    expect(n).toContain("…");
    // The EXAMPLE is what gets capped; the note around it is expected to exist.
    expect(n).not.toContain(long);
  });
});
