import { describe, expect, it } from "vitest";
import { verifyReviewClaims } from "./verify.ts";
import type { CallReview, Transcript } from "./types.ts";

function transcriptOf(...texts: string[]): Transcript {
  const utterances = texts.map((text, i) => ({
    speaker: "A",
    role: "prospect" as const,
    text,
    startMs: i * 10_000,
    endMs: i * 10_000 + 9_000,
    words: [],
  }));
  return { utterances, durationMs: texts.length * 10_000, text: texts.join(" ") };
}

function reviewWith(quotes: {
  right?: string[];
  wrong?: string[];
  objections?: string[];
}): CallReview {
  const finding = (quote: string) => ({
    point: "p",
    detail: "d",
    quote,
    timestamp: "0:10",
    impact: "high" as const,
  });
  const objection = (quote: string) => ({
    summary: "s",
    kind: "explicit" as const,
    quote,
    timestamp: "0:10",
    handled: "handled" as const,
    howItWasHandled: "h",
    recommendedHandling: "r",
  });
  return {
    summary: "s",
    callOutcome: "o",
    overallScore: 5,
    whatWentRight: (quotes.right ?? []).map(finding),
    whatWentWrong: (quotes.wrong ?? []).map(finding),
    objections: (quotes.objections ?? []).map(objection),
    delivery: {
      overall: "",
      talkListenBalance: "",
      pacing: "",
      useOfPauses: "",
      confidenceSignals: "",
    },
    scorecard: [],
    coaching: [],
  };
}

describe("verifyReviewClaims", () => {
  const t = transcriptOf(
    "Well, honestly the price feels really steep for a team our size.",
    "Let me talk to my business partner and get back to you next week.",
  );

  it("verifies an exact quote", () => {
    const v = verifyReviewClaims(reviewWith({ objections: ["the price feels really steep"] }), t);
    expect(v).toEqual({ claimsChecked: 1, claimsVerified: 1, unverified: [] });
  });

  it("verifies despite punctuation and case differences", () => {
    const v = verifyReviewClaims(
      reviewWith({ right: ["The price feels REALLY steep, for a team our size!"] }),
      t,
    );
    expect(v.claimsVerified).toBe(1);
  });

  it("verifies a lightly paraphrased quote (>=80% tokens in order, one utterance)", () => {
    // "talk to my partner and get back to you next week" — drops "business";
    // all 11 quote tokens appear in order in utterance 2 (which merely has
    // the extra token "business" between "my" and "partner").
    const v = verifyReviewClaims(
      reviewWith({ wrong: ["talk to my partner and get back to you next week"] }),
      t,
    );
    expect(v.claimsVerified).toBe(1);
  });

  it("verifies a quote with one substituted word mid-quote", () => {
    // "price is really steep for a team our size" — 9 tokens; "is" appears
    // nowhere in utterance 1, but the other 8 appear there in order;
    // need ceil(9 * 0.8) = 8. A token missing mid-quote must not derail
    // matching of the tokens that follow it.
    const v = verifyReviewClaims(
      reviewWith({ objections: ["price is really steep for a team our size"] }),
      t,
    );
    expect(v.claimsVerified).toBe(1);
  });

  it("does not verify a quote that only reaches 80% by spanning utterances", () => {
    // 12 tokens, need ceil(12 * 0.8) = 10; utterance 1 supplies 5 in order
    // and utterance 2 supplies 7, but no single utterance reaches 10 — and
    // it is not a substring of the full text ("for a team our size" is
    // missing between the two halves).
    const v = verifyReviewClaims(
      reviewWith({
        wrong: ["the price feels really steep let me talk to my business partner"],
      }),
      t,
    );
    expect(v).toEqual({
      claimsChecked: 1,
      claimsVerified: 0,
      unverified: [{ section: "whatWentWrong", index: 0 }],
    });
  });

  it("flags a fabricated quote with its section and index", () => {
    const v = verifyReviewClaims(
      reviewWith({ objections: ["we already signed with your competitor yesterday"] }),
      t,
    );
    expect(v).toEqual({
      claimsChecked: 1,
      claimsVerified: 0,
      unverified: [{ section: "objections", index: 0 }],
    });
  });

  it("counts across all three sections and keeps indexes per section", () => {
    const v = verifyReviewClaims(
      reviewWith({
        right: ["the price feels really steep"],
        wrong: ["totally invented sentence that was never spoken here"],
        objections: ["get back to you next week"],
      }),
      t,
    );
    expect(v.claimsChecked).toBe(3);
    expect(v.claimsVerified).toBe(2);
    expect(v.unverified).toEqual([{ section: "whatWentWrong", index: 0 }]);
  });

  it("gives very short quotes the benefit of the doubt", () => {
    const v = verifyReviewClaims(reviewWith({ right: ["Hmm, okay"] }), t);
    expect(v.claimsVerified).toBe(1);
  });

  it("skips claims with empty quotes and reports 0/0 when nothing is checkable", () => {
    const v = verifyReviewClaims(reviewWith({ right: [""] }), t);
    expect(v).toEqual({ claimsChecked: 0, claimsVerified: 0, unverified: [] });
  });
});
