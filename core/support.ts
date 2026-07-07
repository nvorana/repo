import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// The in-app support assistant. Answers ONLY from coach-curated help notes so
// it can't invent features; when the notes don't cover a problem it escalates
// honestly into a ticket instead of guessing. Runs on Haiku — this is
// high-volume user-facing chat, not the heavy review analysis.

const MODEL = "claude-haiku-4-5-20251001";

export interface SupportOptions {
  client?: Anthropic;
  model?: string;
}

export interface SupportMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SupportInput {
  messages: SupportMessage[];
  helpNotes: string;
}

export interface SupportResult {
  reply: string;
  resolved: boolean;
  ticketSummary: string | null;
}

const answerSchema = z.object({
  reply: z.string().describe("The message shown to the user. Warm, concise, plain language."),
  resolved: z
    .boolean()
    .describe("True if you fully answered from the HELP NOTES. False if it needs the team."),
  ticketSummary: z
    .string()
    .describe(
      "When resolved is false, a one-line description of the user's problem for the team. " +
        "Empty string when resolved is true.",
    ),
});

export async function answerSupport(
  input: SupportInput,
  options: SupportOptions = {},
): Promise<SupportResult> {
  const client = options.client ?? new Anthropic();
  const model = options.model ?? MODEL;

  const system = `You are CallCoach's in-app technical support assistant, helping sales reps
and their coach with the app. Be warm, brief, and practical.

Answer ONLY from the HELP NOTES below. If the notes genuinely cover the question,
answer it and set resolved=true. If the problem is NOT covered — an error you
can't explain, a bug, anything beyond the notes — do NOT guess or invent steps.
Tell the user you've logged it for the team, set resolved=false, and put a
one-line description in ticketSummary.

HELP NOTES:
${input.helpNotes || "(no help notes available)"}`;

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system,
    output_config: { format: zodOutputFormat(answerSchema) },
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const block = response.content.find((b) => b.type === "text");
  const parsed = answerSchema.parse(JSON.parse(block?.text ?? "{}"));
  return {
    reply: parsed.reply,
    resolved: parsed.resolved,
    ticketSummary: parsed.resolved ? null : parsed.ticketSummary || "Unspecified issue",
  };
}
