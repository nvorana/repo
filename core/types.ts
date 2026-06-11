import { z } from "zod";

// ---------------------------------------------------------------------------
// Transcript — the normalized output every TranscriptionProvider must produce.
// Speaker roles are resolved after transcription (diarization only gives A/B).
// ---------------------------------------------------------------------------

export type SpeakerRole = "salesperson" | "prospect" | "unknown";

export interface TranscriptWord {
  text: string;
  /** Start time in milliseconds from the beginning of the audio. */
  startMs: number;
  endMs: number;
  /** Diarization label as emitted by the provider, e.g. "A" / "B". */
  speaker: string;
}

export interface TranscriptUtterance {
  speaker: string;
  role: SpeakerRole;
  text: string;
  startMs: number;
  endMs: number;
  words: TranscriptWord[];
}

export interface Transcript {
  utterances: TranscriptUtterance[];
  /** Total audio duration in milliseconds. */
  durationMs: number;
  /** Full text, convenience field. */
  text: string;
  language?: string;
}

// ---------------------------------------------------------------------------
// Delivery metrics — computed deterministically from word timings, never by
// the LLM. These ground the tonality/pacing review in real numbers.
// ---------------------------------------------------------------------------

export interface PauseEvent {
  /** Time the pause starts, ms. */
  atMs: number;
  durationMs: number;
  /** Speaker who held the floor before the pause. */
  afterSpeaker: SpeakerRole;
  /** Last few words spoken before the silence — context for the review. */
  precedingText: string;
}

export interface MonologueEvent {
  role: SpeakerRole;
  startMs: number;
  durationMs: number;
  wordCount: number;
}

export interface InterruptionEvent {
  atMs: number;
  interrupter: SpeakerRole;
  interrupted: SpeakerRole;
}

export interface DeliveryMetrics {
  durationMs: number;
  /** Fraction of speaking time held by the salesperson (0..1). */
  salespersonTalkRatio: number;
  /** Words per minute, per role, over their own speaking time. */
  paceWpm: { salesperson: number; prospect: number };
  /** Silences longer than the pause threshold. */
  pauses: PauseEvent[];
  longestMonologues: MonologueEvent[];
  interruptions: InterruptionEvent[];
  /** Questions asked, per role (sentences ending in "?"). */
  questionCounts: { salesperson: number; prospect: number };
  fillerWordCounts: { salesperson: number; prospect: number };
}

// ---------------------------------------------------------------------------
// Review report — the structured output of the analysis. Defined with zod so
// the same schema drives the Claude structured-output format, server
// validation, and the UI types.
// ---------------------------------------------------------------------------

const timestampedFinding = z.object({
  point: z.string().describe("One-sentence statement of the finding."),
  detail: z
    .string()
    .describe("Why it matters and what effect it had on the call."),
  quote: z
    .string()
    .describe("Short verbatim quote from the transcript supporting this."),
  timestamp: z
    .string()
    .describe("Approximate position in the call, mm:ss format."),
});

export const objectionSchema = z.object({
  summary: z.string().describe("The objection or concern in one sentence."),
  kind: z
    .enum(["explicit", "implicit"])
    .describe(
      "explicit = stated directly; implicit = a hesitation, concern or " +
        "buying-risk the prospect signaled without saying it outright.",
    ),
  quote: z.string().describe("Verbatim words from the prospect that raised it."),
  timestamp: z.string().describe("mm:ss position where it was raised."),
  handled: z
    .enum(["handled", "partially_handled", "unhandled"])
    .describe("Whether the salesperson resolved it during the call."),
  howItWasHandled: z
    .string()
    .describe(
      "What the salesperson actually did about it, or empty if ignored.",
    ),
  recommendedHandling: z
    .string()
    .describe("How a top performer would have addressed this objection."),
});

export const deliveryAssessmentSchema = z.object({
  overall: z
    .string()
    .describe(
      "Narrative assessment of the salesperson's tonality, energy, pacing " +
        "and use of silence, grounded in the computed metrics provided.",
    ),
  talkListenBalance: z
    .string()
    .describe("Assessment of the talk/listen ratio and what to change."),
  pacing: z.string().describe("Assessment of speaking pace and monologues."),
  useOfPauses: z
    .string()
    .describe(
      "Assessment of silences: rushed answers, missed thinking time, or " +
        "well-used strategic pauses.",
    ),
  confidenceSignals: z
    .string()
    .describe(
      "Language-level confidence read: hedging, filler words, upspeak " +
        "phrasings, assertiveness of closes.",
    ),
});

export const scorecardItemSchema = z.object({
  criterionId: z.string().describe("Id of the framework criterion."),
  criterionName: z.string().describe("Name of the framework criterion."),
  score: z
    .number()
    .describe("Score from 1 (poor) to 5 (excellent) for this criterion."),
  rationale: z.string().describe("Evidence-based justification for the score."),
});

export const coachingItemSchema = z.object({
  priority: z.number().describe("1 = most important improvement."),
  title: z.string().describe("Short imperative title, e.g. 'Slow down the discovery phase'."),
  advice: z.string().describe("Concrete, actionable coaching advice."),
  example: z
    .string()
    .describe(
      "A rewritten line or behavior the salesperson could have used in " +
        "this exact call.",
    ),
});

export const callReviewSchema = z.object({
  summary: z
    .string()
    .describe("3-5 sentence overview of the call: context, flow, outcome."),
  callOutcome: z
    .string()
    .describe("Where the deal stands after this call and the agreed next step, if any."),
  overallScore: z
    .number()
    .describe("Overall call quality from 1 (poor) to 10 (excellent)."),
  whatWentRight: z.array(timestampedFinding),
  whatWentWrong: z.array(timestampedFinding),
  objections: z
    .array(objectionSchema)
    .describe(
      "Every objection and concern raised — explicit ones AND the subtle, " +
        "implicit ones that were never voiced directly.",
    ),
  delivery: deliveryAssessmentSchema,
  scorecard: z.array(scorecardItemSchema),
  coaching: z
    .array(coachingItemSchema)
    .describe("Prioritized list of what to improve on the next call."),
});

export type TimestampedFinding = z.infer<typeof timestampedFinding>;
export type Objection = z.infer<typeof objectionSchema>;
export type DeliveryAssessment = z.infer<typeof deliveryAssessmentSchema>;
export type ScorecardItem = z.infer<typeof scorecardItemSchema>;
export type CoachingItem = z.infer<typeof coachingItemSchema>;
export type CallReview = z.infer<typeof callReviewSchema>;

// ---------------------------------------------------------------------------
// Full result returned by the pipeline.
// ---------------------------------------------------------------------------

export interface CallReviewResult {
  review: CallReview;
  metrics: DeliveryMetrics;
  transcript: Transcript;
  frameworkId: string;
}
