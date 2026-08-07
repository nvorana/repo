import type { MeasureConfig } from "./trends.ts";

/** Delivery-metric + headline targets (spec table). Skill targets are derived per-framework. */
export const METRIC_MEASURES: MeasureConfig[] = [
  { key: "overallScore", label: "Overall score", direction: "higher", target: 7, format: (v) => `${v}/10` },
  { key: "talkRatio", label: "Talk ratio", direction: "lower", target: 55, format: (v) => `${v}%` },
  { key: "longPausesHeld", label: "Long pauses held", direction: "higher", target: 3, format: (v) => `${v}` },
  { key: "fillerWords", label: "Filler words", direction: "lower", target: 5, format: (v) => `${v}` },
  { key: "questionsAsked", label: "Questions asked", direction: "higher", target: 12, format: (v) => `${v}` },
  { key: "interruptions", label: "Interruptions", direction: "lower", target: 3, format: (v) => `${v}` },
  { key: "objectionRate", label: "Objections handled", direction: "higher", target: 80, format: (v) => `${v}%` },
];

/** Every framework skill is scored 1-5; "good" is >= 4. */
export const SKILL_TARGET = 4;

export function skillMeasure(criterionId: string, criterionName: string): MeasureConfig {
  return { key: `skill:${criterionId}`, label: criterionName, direction: "higher", target: SKILL_TARGET, format: (v) => `${v}/5` };
}
