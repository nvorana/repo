import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { distillLesson } from "./lessons.ts";
import { defaultFramework } from "./frameworks/default.ts";
import type { Transcript } from "./types.ts";

const transcript: Transcript = {
  utterances: [
    {
      speaker: "rep",
      role: "salesperson",
      text: "The price is 28,000 pesos. Let me explain what you get for that.",
      startMs: 0,
      endMs: 9000,
      words: [],
    },
  ],
  durationMs: 9000,
  text: "The price is 28,000 pesos. Let me explain what you get for that.",
};

const finding = {
  point: "The rep caved after pricing.",
  detail: "d",
  quote: "Let me explain what you get for that.",
  timestamp: "0:05",
};

function fakeClient(response: object | "throw"): Anthropic {
  return {
    messages: {
      create: async () => {
        if (response === "throw") throw new Error("model unavailable");
        return { content: [{ type: "text", text: JSON.stringify(response) }] };
      },
    },
  } as unknown as Anthropic;
}

describe("distillLesson", () => {
  const input = {
    finding,
    section: "whatWentWrong" as const,
    note: "I explained value, I never discounted",
    transcript,
    framework: defaultFramework,
  };

  it("returns the lesson when the model finds substance", async () => {
    const out = await distillLesson(input, {
      client: fakeClient({
        hasLesson: true,
        lesson: "Do not count value re-statements after the price as caving.",
        rationale: "The rep never lowered the price.",
      }),
    });
    expect(out).toEqual({
      lesson: "Do not count value re-statements after the price as caving.",
      rationale: "The rep never lowered the price.",
    });
  });

  it("returns null lesson when the model rejects the flag", async () => {
    const out = await distillLesson(input, {
      client: fakeClient({ hasLesson: false, rationale: "The finding is supported." }),
    });
    expect(out).toEqual({ lesson: null, rationale: "The finding is supported." });
  });

  it("propagates model errors", async () => {
    await expect(distillLesson(input, { client: fakeClient("throw") })).rejects.toThrow(
      "model unavailable",
    );
  });
});
