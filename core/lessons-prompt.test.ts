import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { CallAnalyzer } from "./analyzer.ts";
import { defaultFramework } from "./frameworks/default.ts";
import type { CallReview, DeliveryMetrics, Transcript } from "./types.ts";

const transcript: Transcript = {
  utterances: [
    { speaker: "A", role: "salesperson", text: "Hello there.", startMs: 0, endMs: 1000, words: [] },
  ],
  durationMs: 1000,
  text: "Hello there.",
};

const metrics: DeliveryMetrics = {
  durationMs: 1000,
  salespersonTalkRatio: 1,
  paceWpm: { salesperson: 100, prospect: 0 },
  pauses: [],
  longestMonologues: [],
  interruptions: [],
  questionCounts: { salesperson: 0, prospect: 0 },
  fillerWordCounts: { salesperson: 0, prospect: 0 },
};

const emptyReview: CallReview = {
  summary: "s",
  callOutcome: "o",
  overallScore: 5,
  whatWentRight: [],
  whatWentWrong: [],
  objections: [],
  delivery: { overall: "", talkListenBalance: "", pacing: "", useOfPauses: "", confidenceSignals: "" },
  scorecard: [],
  coaching: [],
};

/** Fake client that records the params passed to messages.stream. */
function capturingClient(captured: { system?: string }): Anthropic {
  return {
    messages: {
      stream: (params: { system: string }) => {
        captured.system = params.system;
        return {
          finalMessage: async () => ({
            stop_reason: "end_turn",
            content: [{ type: "text", text: JSON.stringify(emptyReview) }],
          }),
        };
      },
    },
  } as unknown as Anthropic;
}

describe("lesson injection into the analyzer system prompt", () => {
  it("appends a LEARNED CALIBRATIONS block when the framework has lessons", async () => {
    const captured: { system?: string } = {};
    const analyzer = new CallAnalyzer({ client: capturingClient(captured) });
    await analyzer.analyze(transcript, metrics, {
      ...defaultFramework,
      lessons: ["Do not treat value re-statements after pricing as caving."],
    });
    expect(captured.system).toContain("LEARNED CALIBRATIONS");
    expect(captured.system).toContain("Do not treat value re-statements after pricing as caving.");
  });

  it("omits the block when there are no lessons", async () => {
    const captured: { system?: string } = {};
    const analyzer = new CallAnalyzer({ client: capturingClient(captured) });
    await analyzer.analyze(transcript, metrics, { ...defaultFramework, lessons: [] });
    expect(captured.system).not.toContain("LEARNED CALIBRATIONS");
    const captured2: { system?: string } = {};
    const analyzer2 = new CallAnalyzer({ client: capturingClient(captured2) });
    await analyzer2.analyze(transcript, metrics, defaultFramework);
    expect(captured2.system).not.toContain("LEARNED CALIBRATIONS");
  });
});
