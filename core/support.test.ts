import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { answerSupport } from "./support.ts";

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

const helpNotes = "## Upload\nUse two files: your recording and the client's.";

describe("answerSupport", () => {
  it("answers a covered question and does not escalate", async () => {
    const out = await answerSupport(
      { messages: [{ role: "user", content: "how do I upload?" }], helpNotes },
      { client: fakeClient({ reply: "Upload two files: yours and the client's.", resolved: true, ticketSummary: "" }) },
    );
    expect(out.resolved).toBe(true);
    expect(out.ticketSummary).toBeNull();
    expect(out.reply).toContain("two files");
  });

  it("escalates when the notes don't cover it, keeping a ticket summary", async () => {
    const out = await answerSupport(
      { messages: [{ role: "user", content: "the page is totally blank on Safari" }], helpNotes },
      { client: fakeClient({ reply: "I've logged this for the team.", resolved: false, ticketSummary: "Blank page on Safari" }) },
    );
    expect(out).toEqual({
      reply: "I've logged this for the team.",
      resolved: false,
      ticketSummary: "Blank page on Safari",
    });
  });

  it("coerces ticketSummary to null when resolved even if the model returns text", async () => {
    const out = await answerSupport(
      { messages: [{ role: "user", content: "hi" }], helpNotes },
      { client: fakeClient({ reply: "Hello!", resolved: true, ticketSummary: "stray" }) },
    );
    expect(out.ticketSummary).toBeNull();
  });

  it("falls back to a generic ticket summary when escalating with no summary", async () => {
    const out = await answerSupport(
      { messages: [{ role: "user", content: "weird glitch" }], helpNotes },
      { client: fakeClient({ reply: "I've logged this.", resolved: false, ticketSummary: "" }) },
    );
    expect(out.ticketSummary).toBe("Unspecified issue");
    expect(out.resolved).toBe(false);
  });

  it("propagates model errors", async () => {
    await expect(
      answerSupport({ messages: [{ role: "user", content: "x" }], helpNotes }, { client: fakeClient("throw") }),
    ).rejects.toThrow("model unavailable");
  });
});
