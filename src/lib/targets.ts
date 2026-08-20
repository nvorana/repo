import type { MeasureConfig } from "./trends.ts";

/**
 * Measures counted per hour of call, not per call. See valueFor() in
 * repHistory.ts — the raw count is divided by call length before comparison.
 */
export const PER_HOUR_KEYS = new Set([
  "fillerWords",
  "questionsAsked",
  "interruptions",
  "longPausesHeld",
]);

/**
 * Targets, per hour of call.
 *
 * Score and objection bars are Coach Jon's stated goals. The delivery bars sit
 * at the TOP QUARTILE of the team's own CORRECTED distribution (214 two-track
 * calls, Aug 2026, median call 56 min): p25 where lower is better, p75 where
 * higher is better. Roughly a quarter of calls already clear each bar — a
 * stretch that is visibly reachable rather than noise.
 *
 * The previous defaults were absolute per-call counts never checked against
 * data: filler ≤5 against a median of 50 failed 99% of calls, and "long pauses
 * ≥3" passed 100% because the value behind it was capped at 12. A panel that
 * fails everyone on every call teaches nothing.
 *
 * Caveat on "Long pauses held": it counts every silence over 1.5s, so it
 * tracks conversational pace, not the deliberate silence after a price. The
 * framework's "Pricing & The Silence" criterion judges that. Weakest line here.
 */
export const METRIC_MEASURES: MeasureConfig[] = [
  { key: "overallScore", label: "Overall score", direction: "higher", target: 7, format: (v) => `${v}/10` },
  { key: "talkRatio", label: "Talk ratio", direction: "lower", target: 55, format: (v) => `${v}%` },
  { key: "fillerWords", label: "Filler words", direction: "lower", target: 29, format: (v) => `${v}/hr` },
  { key: "questionsAsked", label: "Questions asked", direction: "higher", target: 124, format: (v) => `${v}/hr` },
  { key: "interruptions", label: "Interruptions", direction: "lower", target: 3, format: (v) => `${v}/hr` },
  { key: "longPausesHeld", label: "Long pauses held", direction: "higher", target: 56, format: (v) => `${v}/hr` },
  { key: "objectionRate", label: "Objections handled", direction: "higher", target: 80, format: (v) => `${v}%` },
];

/** Every framework skill is scored 1-5; "good" is >= 4. */
export const SKILL_TARGET = 4;

export function skillMeasure(criterionId: string, criterionName: string): MeasureConfig {
  return { key: `skill:${criterionId}`, label: criterionName, direction: "higher", target: SKILL_TARGET, format: (v) => `${v}/5` };
}
