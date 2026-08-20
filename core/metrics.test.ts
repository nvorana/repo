import { describe, expect, it } from "vitest";
import { computeDeliveryMetrics } from "./metrics.ts";
import type { Transcript, TranscriptUtterance, SpeakerRole } from "./types.ts";

/** Builds one utterance; word timings are irrelevant here beyond the count. */
function u(
  role: SpeakerRole,
  startMs: number,
  endMs: number,
  text: string,
): TranscriptUtterance {
  const words = text.split(/\s+/).filter(Boolean);
  return {
    speaker: role === "salesperson" ? "rep" : "client",
    role,
    text,
    startMs,
    endMs,
    words: words.map((w, i) => ({ text: w, startMs: startMs + i, endMs: startMs + i + 1, speaker: role })),
  };
}

const t = (utterances: TranscriptUtterance[]): Transcript => ({
  utterances,
  durationMs: Math.max(...utterances.map((x) => x.endMs)),
  text: utterances.map((x) => x.text).join(" "),
});

describe("interruption detection", () => {
  it("does NOT count an overlapping acknowledgment", () => {
    // Client says "opo tama" over the rep — the rep keeps the floor.
    const m = computeDeliveryMetrics(
      t([
        u("salesperson", 0, 20000, "So the way the accelerator program works is we take you through it step by step"),
        u("prospect", 5000, 5800, "opo tama"),
        u("salesperson", 20000, 30000, "and then we move on to the next phase of the program together"),
      ]),
    );
    expect(m.interruptions).toHaveLength(0);
  });

  it("counts a real cut-in where the other speaker takes the floor", () => {
    const m = computeDeliveryMetrics(
      t([
        u("salesperson", 0, 20000, "So the investment for the accelerator program is only"),
        u("prospect", 8000, 14000, "wait hold on how much did you say that was again because"),
      ]),
    );
    expect(m.interruptions).toHaveLength(1);
    expect(m.interruptions[0].interrupter).toBe("prospect");
    expect(m.interruptions[0].interrupted).toBe("salesperson");
  });

  it("ignores a brief overlap even when the incoming turn is long", () => {
    // 400ms of overlap at a natural handover is not an interruption.
    const m = computeDeliveryMetrics(
      t([
        u("salesperson", 0, 10000, "and that is really the whole idea behind it"),
        u("prospect", 9600, 16000, "okay that makes sense to me so what happens after that part"),
      ]),
    );
    expect(m.interruptions).toHaveLength(0);
  });

  it("does not count a speaker overlapping themselves", () => {
    const m = computeDeliveryMetrics(
      t([
        u("salesperson", 0, 10000, "so here is the thing about the program that matters most"),
        u("salesperson", 5000, 15000, "and this is the part that most people completely miss out on"),
      ]),
    );
    expect(m.interruptions).toHaveLength(0);
  });

  it("a call full of backchannel reads as calm, not as 80+ interruptions", () => {
    // Reproduces the production shape: one long rep turn, many short agreements.
    const utts: TranscriptUtterance[] = [u("salesperson", 0, 120000, "long explanation " .repeat(20))];
    for (let i = 1; i <= 40; i++) utts.push(u("prospect", i * 2500, i * 2500 + 700, "opo"));
    const m = computeDeliveryMetrics(t(utts));
    expect(m.interruptions).toHaveLength(0);
  });
});
