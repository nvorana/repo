import type { ReviewSummary } from "../api.ts";
import { countsTowardMetricTrends } from "./eligibility.ts";
import { buildRepMeasures, type RepMeasures, type RepReview } from "./repHistory.ts";

/** Calls belonging to one rep, newest last. Matches on the stable id, falling
 *  back to display name for calls created before ids existed. */
export function callsFor(
  reviews: ReviewSummary[],
  rep: { id: string; name: string },
): ReviewSummary[] {
  return reviews.filter((r) => (r.repId ? r.repId === rep.id : r.rep === rep.name));
}

/** Trends bucket by the date the call HAPPENED, not when it was uploaded. */
function dateOf(r: ReviewSummary): string {
  return r.callDate ?? r.createdAt.slice(0, 10);
}

export interface RepProgress extends RepMeasures {
  /** Calls that fed the trends (mixed-audio and in-flight calls excluded). */
  eligible: number;
  /** Eligible calls still awaiting coach release — metrics only, no score. */
  awaitingRelease: number;
}

/**
 * The rep's progress view-model.
 *
 * Unreleased calls are included: they carry measured metrics but no
 * overallScore/scorecard/objectionRate, so `buildRepMeasures` naturally reads
 * null for those measures on those calls and skips them. The delivery lines
 * move immediately; the judgment lines wait for the coach.
 */
export function buildRepProgress(
  reviews: ReviewSummary[],
  rep: { id: string; name: string },
): RepProgress {
  const eligible = callsFor(reviews, rep).filter(countsTowardMetricTrends);

  const rr: RepReview[] = eligible.map((r) => ({
    id: r.id,
    date: dateOf(r),
    overallScore: r.overallScore,
    metrics: r.metrics,
    objectionRate: r.objectionRate,
    scorecard: r.scorecard,
  }));

  return {
    ...buildRepMeasures(rr),
    eligible: eligible.length,
    awaitingRelease: eligible.filter((r) => !r.released).length,
  };
}
