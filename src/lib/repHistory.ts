import { computeMeasureTrend, pickCoachNext, type MeasureTrend, type MeasurePoint } from "./trends.ts";
import { METRIC_MEASURES, PER_HOUR_KEYS, skillMeasure } from "./targets.ts";

export interface RepReview {
  id: string;
  /** YYYY-MM-DD (callDate, falling back to the upload date). */
  date: string;
  overallScore?: number;
  metrics?: {
    talkRatio: number;
    longPausesHeld: number;
    fillerWords: number;
    questionsAsked: number;
    interruptions: number;
    /** Call length. Absent on reviews scored before this was recorded. */
    durationMin?: number;
  };
  objectionRate?: number | null;
  scorecard?: { criterionId: string; criterionName: string; score: number }[];
  diagnosis?: { painDepthReached: string; earnedThePitch: boolean } | null;
}

export interface RepMeasures {
  measures: MeasureTrend[];
  coachNext: MeasureTrend | null;
}

function valueFor(key: string, r: RepReview): number | null {
  if (key === "overallScore") return r.overallScore ?? null;
  if (key === "objectionRate") return r.objectionRate ?? null;
  if (key.startsWith("skill:")) {
    const id = key.slice("skill:".length);
    return r.scorecard?.find((c) => c.criterionId === id)?.score ?? null;
  }
  const m = r.metrics;
  if (!m) return null;

  // Counts are judged as PER-HOUR RATES. A 90-minute call inevitably contains
  // more filler words than a 20-minute one; scoring the raw count punishes the
  // longer conversation for being longer. talkRatio is already a ratio and is
  // left alone.
  if (PER_HOUR_KEYS.has(key)) {
    const raw = (m as Record<string, number | undefined>)[key];
    if (raw == null) return null;
    // No duration (older reviews) means no honest rate — better a gap in the
    // line than a number that quietly means something different.
    if (!m.durationMin || m.durationMin <= 0) return null;
    return Math.round((raw * 60) / m.durationMin);
  }
  return (m as Record<string, number>)[key] ?? null;
}

export function buildRepMeasures(reviews: RepReview[]): RepMeasures {
  const sorted = reviews.slice().sort((a, b) => a.date.localeCompare(b.date));

  // Collect framework skills in first-seen order.
  const skills = new Map<string, string>();
  for (const r of sorted) for (const c of r.scorecard ?? []) if (!skills.has(c.criterionId)) skills.set(c.criterionId, c.criterionName);

  const configs = [
    ...METRIC_MEASURES,
    ...[...skills.entries()].map(([id, name]) => skillMeasure(id, name)),
  ];

  const measures = configs.map((cfg) => {
    const points: MeasurePoint[] = sorted.map((r) => ({ date: r.date, value: valueFor(cfg.key, r) }));
    return computeMeasureTrend(cfg, points);
  });

  return { measures, coachNext: pickCoachNext(measures) };
}
