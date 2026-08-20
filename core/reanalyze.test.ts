import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { reanalyzeCall } from "./pipeline.ts";
import type { CallReview, CallReviewResult, Transcript } from "./types.ts";

const transcript: Transcript = {
  utterances: [
    {
      speaker: "rep",
      role: "salesperson",
      text: "Our program gives you a complete system for closing clients.",
      startMs: 0,
      endMs: 8000,
      words: [],
    },
    {
      speaker: "client",
      role: "prospect",
      text: "Honestly the price feels really steep for a team our size.",
      startMs: 8000,
      endMs: 16000,
      words: [],
    },
  ],
  durationMs: 16000,
  text: "Our program gives you a complete system for closing clients. Honestly the price feels really steep for a team our size.",
};

const freshReview: CallReview = {
  summary: "s",
  callOutcome: "o",
  overallScore: 6,
  whatWentRight: [],
  whatWentWrong: [],
  objections: [
    {
      summary: "Price concern",
      kind: "explicit",
      quote: "the price feels really steep",
      timestamp: "0:08",
      handled: "unhandled",
      howItWasHandled: "",
      recommendedHandling: "r",
    },
    {
      summary: "Invented",
      kind: "implicit",
      quote: "we already picked a different vendor last month",
      timestamp: "0:10",
      handled: "unhandled",
      howItWasHandled: "",
      recommendedHandling: "r",
    },
  ],
  delivery: { overall: "", talkListenBalance: "", pacing: "", useOfPauses: "", confidenceSignals: "" },
  scorecard: [],
  coaching: [],
};

function fakeClient(behavior: "ok" | "throw"): Anthropic {
  return {
    messages: {
      stream: () => {
        if (behavior === "throw") throw new Error("model unavailable");
        return {
          finalMessage: async () => ({
            stop_reason: "end_turn",
            content: [{ type: "text", text: JSON.stringify(freshReview) }],
          }),
        };
      },
    },
  } as unknown as Anthropic;
}

const previous: CallReviewResult = {
  review: { ...freshReview, overallScore: 3 },
  metrics: {
    durationMs: 0,
    salespersonTalkRatio: 0,
    paceWpm: { salesperson: 0, prospect: 0 },
    pauseCount: 0,
    pauses: [],
    longestMonologues: [],
    interruptions: [],
    questionCounts: { salesperson: 0, prospect: 0 },
    fillerWordCounts: { salesperson: 0, prospect: 0 },
  },
  transcript,
  frameworkId: "general-sales-best-practices",
};

describe("reanalyzeCall", () => {
  it("re-runs analysis on the stored transcript and attaches verification", async () => {
    const result = await reanalyzeCall(previous, { analyzer: { client: fakeClient("ok") } });
    expect(result.review.overallScore).toBe(6); // fresh review, not the stored one
    expect(result.transcript).toEqual(transcript); // transcript reused, not re-transcribed
    // metrics recomputed from the transcript, not copied from `previous`
    expect(result.metrics.durationMs).toBe(16000);
    expect(result.metrics.salespersonTalkRatio).toBeCloseTo(0.5);
    // verification ran: real quote verified, invented one flagged
    expect(result.verification).toEqual({
      claimsChecked: 2,
      claimsVerified: 1,
      unverified: [{ section: "objections", index: 1 }],
    });
  });

  it("propagates analysis errors to the caller", async () => {
    await expect(
      reanalyzeCall(previous, { analyzer: { client: fakeClient("throw") } }),
    ).rejects.toThrow("model unavailable");
  });

  it("rejects a result whose stored transcript is empty", async () => {
    await expect(
      reanalyzeCall(
        { ...previous, transcript: { utterances: [], durationMs: 0, text: "" } },
        { analyzer: { client: fakeClient("ok") } },
      ),
    ).rejects.toThrow(/no utterances/);
  });
});
