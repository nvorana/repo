import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { AnalyzerOptions } from "./analyzer.ts";
import type { SalesFramework } from "./frameworks/types.ts";
import type { Transcript } from "./types.ts";

// Judging a flag + drafting a lesson is strong-reasoning work but not the
// crown-jewel review — Sonnet handles it well, and every lesson passes the
// coach's Apply/Discard gate before it can shape a future review.
const MODEL = "claude-sonnet-5";
const LESSON_MAX_CHARS = 240;

// A rep flagged a finding as inaccurate. Re-examine it skeptically against the
// transcript: most flags are just disagreement with fair coaching, but real
// analyzer mistakes should become a short, generalizable lesson the coach can
// approve into future reviews.

const verdictSchema = z.object({
  hasLesson: z
    .boolean()
    .describe("True ONLY if the finding misstates what happened on the call."),
  lesson: z
    .string()
    .optional()
    .describe(
      `One generalizable instruction (max ${LESSON_MAX_CHARS} chars) for judging FUTURE calls. ` +
        "Never call-specific: no names, no quotes from this call.",
    ),
  rationale: z.string().describe("Two sentences: why the flag is right or wrong."),
});

export interface DistillInput {
  finding: { point: string; detail: string; quote: string; timestamp: string };
  section: "whatWentRight" | "whatWentWrong";
  note?: string;
  transcript: Transcript;
  framework: SalesFramework;
}

export interface DistillResult {
  lesson: string | null;
  rationale: string;
}

export async function distillLesson(
  input: DistillInput,
  options: AnalyzerOptions = {},
): Promise<DistillResult> {
  const client = options.client ?? new Anthropic();
  const model = options.model ?? MODEL;

  const transcriptText = input.transcript.utterances
    .map((u) => `${u.role.toUpperCase()}: ${u.text}`)
    .join("\n");

  // Long transcripts mean long input; stream to avoid request timeouts.
  // Thinking off: Sonnet defaults to adaptive thinking, which would eat into the
  // 1024-token cap and risk truncating the structured verdict.
  const stream = client.messages.stream({
    model,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    output_config: { format: zodOutputFormat(verdictSchema) },
    messages: [
      {
        role: "user",
        content: `A salesperson flagged one finding of an AI call review as inaccurate.
Judge the flag SKEPTICALLY: the finding stands unless the transcript concretely
contradicts it. Disliking fair coaching is not grounds. Ties go to the finding.

THE FINDING (from "${input.section}"):
- Point: ${input.finding.point}
- Detail: ${input.finding.detail}
- Supporting quote: "${input.finding.quote}" at ${input.finding.timestamp}

THE SALESPERSON'S REASON: ${input.note?.trim() || "(none given)"}

SCORING FRAMEWORK IN USE: ${input.framework.name}

FULL TRANSCRIPT:
${transcriptText}

If (and only if) the finding truly misstates the call, write ONE generalizable
lesson for reviewing future calls (max ${LESSON_MAX_CHARS} chars, no specifics from this call).`,
      },
    ],
  });

  const response = await stream.finalMessage();

  const block = response.content.find((b) => b.type === "text");
  const verdict = verdictSchema.parse(JSON.parse(block?.text ?? "{}"));
  const lesson = verdict.hasLesson ? (verdict.lesson ?? null) : null;
  return {
    lesson: lesson === null ? null : lesson.slice(0, LESSON_MAX_CHARS),
    rationale: verdict.rationale,
  };
}
