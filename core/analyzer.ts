import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  callReviewSchema,
  type CallReview,
  type DeliveryMetrics,
  type Transcript,
} from "./types.ts";
import { formatTimestamp } from "./metrics.ts";
import type { SalesFramework } from "./frameworks/types.ts";

const MODEL = "claude-opus-4-8";

export interface AnalyzerOptions {
  client?: Anthropic;
  model?: string;
}

export class CallAnalyzer {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: AnalyzerOptions = {}) {
    this.client = options.client ?? new Anthropic();
    this.model = options.model ?? MODEL;
  }

  /**
   * Maps diarization labels (e.g. "A"/"B") to salesperson/prospect roles.
   * Mutates the transcript's utterance roles in place and returns it.
   */
  async identifySpeakers(transcript: Transcript): Promise<Transcript> {
    const labels = [...new Set(transcript.utterances.map((u) => u.speaker))];
    if (labels.length === 0) return transcript;

    const sample = transcript.utterances
      .slice(0, 30)
      .map((u) => `[Speaker ${u.speaker}] ${u.text}`)
      .join("\n");

    const schema = z.object({
      salespersonLabel: z
        .string()
        .describe(`The diarization label of the SELLER. One of: ${labels.join(", ")}`),
    });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      output_config: { format: zodOutputFormat(schema) },
      messages: [
        {
          role: "user",
          content:
            "This is the start of a one-on-one sales call transcript with " +
            "anonymous speaker labels. Identify which speaker is the " +
            "salesperson (the one selling/representing the vendor) versus " +
            `the prospect.\n\n${sample}`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    const { salespersonLabel } = schema.parse(JSON.parse(block?.text ?? "{}"));

    for (const u of transcript.utterances) {
      u.role = u.speaker === salespersonLabel ? "salesperson" : "prospect";
    }
    return transcript;
  }

  /** Runs the full structured review of the call. */
  async analyze(
    transcript: Transcript,
    metrics: DeliveryMetrics,
    framework: SalesFramework,
  ): Promise<CallReview> {
    // Long transcripts mean long input; stream to avoid request timeouts.
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      system: buildSystemPrompt(framework),
      output_config: { format: zodOutputFormat(callReviewSchema) },
      messages: [
        { role: "user", content: buildUserPrompt(transcript, metrics, framework) },
      ],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      throw new Error("The review model declined to process this call recording.");
    }
    if (message.stop_reason === "max_tokens") {
      throw new Error("Review output was truncated; transcript may be too long for one pass.");
    }

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    return callReviewSchema.parse(JSON.parse(text));
  }
}

function buildSystemPrompt(framework: SalesFramework): string {
  return `
You are an elite sales coach reviewing a recorded one-on-one sales call. Your
review is read by the salesperson and their manager; its purpose is to make
the salesperson measurably better on their next call. Be direct, specific,
and evidence-based — every claim must be tied to a quote and timestamp from
the transcript. Praise only what is genuinely good.

Pay particular attention to:

1. OBJECTIONS — find every objection and concern, not just the obvious ones.
   Explicit objections are stated outright ("that's too expensive"). Implicit
   objections are hesitations, deflections, lukewarm responses, repeated
   topic-changes, or risk signals the prospect raised without saying them
   directly ("I'd have to run that by my team...", a long silence after
   pricing, "interesting..."). For each, judge honestly whether the
   salesperson handled it, partially handled it, or let it slip by unresolved.
   Unhandled implicit objections are the single biggest source of lost deals —
   surface all of them.

2. TONALITY AND DELIVERY — you are given objective delivery metrics computed
   from the audio timings (talk ratio, pace, pauses, interruptions, filler
   words, monologues). Ground your delivery assessment in those numbers plus
   the language in the transcript (hedging, filler, weak closes). Do not
   invent acoustic qualities you cannot observe.

3. COACHING — the output must end in a short, prioritized list of changes,
   each with a concrete example rewritten from THIS call.

ACCURACY IS CRITICAL — a review that misstates what happened destroys trust:
- Tell HYPOTHETICAL EXAMPLES apart from ACTUAL facts and commitments. When the
  salesperson paints a "what if" to create urgency — e.g. "if you decide late,
  say by Saturday, you'd lose the discount" — that illustration is NOT the real
  deadline. Report the deadline/decision the PROSPECT actually committed to
  (e.g. "decide today after consulting the family"), never the example the rep
  invented. The same holds for price, next steps, and any commitment.
- Keep timing and cause-and-effect honest. Do not say something happened "right
  after" a moment (e.g. after pricing) if it actually occurred much later in the
  call. Tie each observation to what genuinely followed at that point.
- Every quote must be the ACTUAL words spoken at the moment you're describing —
  never attach a quote from one part of the call to a claim about another.

SCORING FRAMEWORK — "${framework.name}":
${framework.guidance}

Score each of these criteria from 1 (poor) to 5 (excellent), using the exact
criterionId given:
${framework.criteria.map((c) => `- ${c.id}: ${c.name} — ${c.description}`).join("\n")}
`.trim();
}

function buildUserPrompt(
  transcript: Transcript,
  metrics: DeliveryMetrics,
  framework: SalesFramework,
): string {
  const metricsSummary = `
COMPUTED DELIVERY METRICS (objective, from audio timings):
- Call duration: ${formatTimestamp(metrics.durationMs)}
- Salesperson talk ratio: ${(metrics.salespersonTalkRatio * 100).toFixed(0)}% of speaking time
- Pace: salesperson ${metrics.paceWpm.salesperson} wpm, prospect ${metrics.paceWpm.prospect} wpm
- Questions asked: salesperson ${metrics.questionCounts.salesperson}, prospect ${metrics.questionCounts.prospect}
- Filler words: salesperson ${metrics.fillerWordCounts.salesperson}, prospect ${metrics.fillerWordCounts.prospect}
- Interruptions: ${metrics.interruptions.length}${metrics.interruptions
    .map((i) => `\n  - ${formatTimestamp(i.atMs)}: ${i.interrupter} interrupted ${i.interrupted}`)
    .join("")}
- Notable pauses (>1.5s):${
    metrics.pauses.length === 0
      ? " none"
      : metrics.pauses
          .map(
            (p) =>
              `\n  - ${formatTimestamp(p.atMs)}: ${(p.durationMs / 1000).toFixed(1)}s after ${p.afterSpeaker} said "...${p.precedingText}"`,
          )
          .join("")
  }
- Longest monologues:${metrics.longestMonologues
    .map(
      (m) =>
        `\n  - ${formatTimestamp(m.startMs)}: ${m.role} for ${(m.durationMs / 1000).toFixed(0)}s (${m.wordCount} words)`,
    )
    .join("")}
`.trim();

  const transcriptText = transcript.utterances
    .map((u) => `[${formatTimestamp(u.startMs)}] ${u.role.toUpperCase()}: ${u.text}`)
    .join("\n");

  return `Review this sales call against the "${framework.name}" framework.

${metricsSummary}

FULL TRANSCRIPT (timestamps are mm:ss):
${transcriptText}`;
}
