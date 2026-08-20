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
 * Targets. The score and objection bars are Coach Jon's stated goals. The
 * delivery bars are derived from the team's OWN distribution (Aug 2026, 214
 * two-track calls) at roughly the top quartile — a bar about a quarter of
 * calls already clear, so it reads as a stretch rather than as noise.
 *
 * The previous defaults were absolute per-call counts and were never checked
 * against real data: filler ≤5 against a median of 50 failed 99% of calls, and
 * "long pauses ≥3" passed 100% because the underlying value was capped at 12.
 * A panel that fails everyone on every call teaches nothing.
 *
 * PROVISIONAL: the filler, question, pause and interruption bars should be
 * re-derived once the corrected metrics have been re-run across the archive.
 */
export const METRIC_MEASURES: MeasureConfig[] = [
  { key: "overallScore", label: "Overall score", direction: "higher", target: 7, format: (v) => `${v}/10` },
  { key: "talkRatio", label: "Talk ratio", direction: "lower", target: 55, format: (v) => `${v}%` },
  { key: "fillerWords", label: "Filler words", direction: "lower", target: 30, format: (v) => `${v}/hr` },
  { key: "questionsAsked", label: "Questions asked", direction: "higher", target: 40, format: (v) => `${v}/hr` },
  { key: "interruptions", label: "Interruptions", direction: "lower", target: 6, format: (v) => `${v}/hr` },
  { key: "longPausesHeld", label: "Long pauses held", direction: "higher", target: 8, format: (v) => `${v}/hr` },
  { key: "objectionRate", label: "Objections handled", direction: "higher", target: 80, format: (v) => `${v}%` },
];

/** Every framework skill is scored 1-5; "good" is >= 4. */
export const SKILL_TARGET = 4;

export function skillMeasure(criterionId: string, criterionName: string): MeasureConfig {
  return { key: `skill:${criterionId}`, label: criterionName, direction: "higher", target: SKILL_TARGET, format: (v) => `${v}/5` };
}
