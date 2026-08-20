import type { ReviewSummary } from "../api.ts";
import { countsTowardTrends } from "./eligibility.ts";

/** Placeholder rows the analyzer sometimes emits; never a real framework skill. */
const PLACEHOLDER_CRITERION_IDS = new Set(["", "coaching", "placeholder"]);

export function isRealCriterion(c: { criterionId: string; criterionName: string }): boolean {
  return (
    Boolean(c.criterionName?.trim()) && !PLACEHOLDER_CRITERION_IDS.has(c.criterionId.trim())
  );
}

export type Momentum = "slipping" | "steady" | "improving";
export type SampleSize = "reliable" | "small" | "insufficient";
export type Range = 30 | 90 | "all";

export const TEAM_SCORE_TARGET = 7;
const MIN_CALLS_FOR_SCORE = 2;
const RELIABLE_CALLS = 5;
const TREND_BAND = 0.2;

export interface RepCard {
  rep: string;
  repId?: string;
  calls: number;
  avgScore: number;
  lastScore: number;
  delta: number;
  momentum: Momentum;
  weakest?: { name: string; avg: number };
  sampleSize: SampleSize;
  callsToScore: number;
  scoreSeries: number[];
  recentCallId?: string;
  worstCallId?: string;
}

export interface TeamHome {
  reps: RepCard[];
  teamAvg: number;
  target: number;
  callsReviewed: number;
  queueCount: number;
  momentum: { slipping: number; steady: number; improving: number };
  coachFirst?: RepCard;
}

function callTime(r: ReviewSummary): number {
  return new Date(r.callDate ?? r.createdAt).getTime();
}

export function filterByRange(reviews: ReviewSummary[], range: Range, now: number): ReviewSummary[] {
  if (range === "all") return reviews;
  const cutoff = now - range * 86_400_000;
  return reviews.filter((r) => callTime(r) >= cutoff);
}

function momentumOf(calls: number, delta: number): Momentum {
  if (calls < MIN_CALLS_FOR_SCORE) return "steady";
  if (delta < -TREND_BAND) return "slipping";
  if (delta > TREND_BAND) return "improving";
  return "steady";
}

function sampleOf(calls: number): SampleSize {
  if (calls >= RELIABLE_CALLS) return "reliable";
  if (calls >= MIN_CALLS_FOR_SCORE) return "small";
  return "insufficient";
}

function cardFor(rep: string, list: ReviewSummary[]): RepCard {
  // list is newest-first.
  const scores = list.map((r) => r.overallScore!);
  const calls = list.length;
  const avgScore = scores.reduce((a, b) => a + b, 0) / calls;
  const lastScore = scores[0];
  const delta = calls > 1 ? lastScore - avgScore : 0;

  const criteria = new Map<string, { name: string; scores: number[] }>();
  for (const r of list) {
    for (const c of r.scorecard ?? []) {
      // A handful of stored reports carry junk scorecard rows — an empty
      // criterion name, or ids like "coaching"/"placeholder" — always scored 0.
      // Being 0 they won every "weakest skill" contest, so the team home told
      // the coach to work on a nameless skill while hiding the real one.
      if (!isRealCriterion(c)) continue;
      const e = criteria.get(c.criterionId) ?? { name: c.criterionName, scores: [] };
      e.scores.push(c.score);
      criteria.set(c.criterionId, e);
    }
  }
  const weakest = [...criteria.values()]
    .map(({ name, scores }) => ({ name, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
    .sort((a, b) => a.avg - b.avg)[0];

  const worst = list.reduce((lo, r) => (r.overallScore! < lo.overallScore! ? r : lo), list[0]);

  return {
    rep,
    repId: list[0].repId,
    calls,
    avgScore,
    lastScore,
    delta,
    momentum: momentumOf(calls, delta),
    weakest,
    sampleSize: sampleOf(calls),
    callsToScore: Math.max(0, MIN_CALLS_FOR_SCORE - calls),
    scoreSeries: [...scores].reverse(), // oldest→newest
    recentCallId: list[0].id,
    worstCallId: worst.id,
  };
}

export function buildTeamHome(reviews: ReviewSummary[], range: Range, now: number): TeamHome {
  // Range scopes rep aggregation and callsReviewed; the queue is deliberately
  // all-time so the sales head never loses sight of the backlog.
  const inRange = filterByRange(reviews, range, now);
  const eligible = inRange.filter(countsTowardTrends);
  const byRep = new Map<string, ReviewSummary[]>();
  for (const r of eligible) {
    if (!r.rep) continue;
    (byRep.get(r.rep) ?? byRep.set(r.rep, []).get(r.rep)!).push(r);
  }
  for (const list of byRep.values()) list.sort((a, b) => callTime(b) - callTime(a));

  const cards = [...byRep.entries()].map(([rep, list]) => cardFor(rep, list));

  const priority = (c: RepCard) =>
    c.momentum === "slipping" ? 0 : c.momentum === "improving" ? 2 : 1;
  const scored = cards
    .filter((c) => c.sampleSize !== "insufficient")
    .sort((a, b) => priority(a) - priority(b) || a.avgScore - b.avgScore);
  const insufficient = cards
    .filter((c) => c.sampleSize === "insufficient")
    .sort((a, b) => a.rep.localeCompare(b.rep));
  const repsSorted = [...scored, ...insufficient];

  const teamAvg = scored.length ? scored.reduce((a, c) => a + c.avgScore, 0) / scored.length : 0;
  const momentum = {
    slipping: scored.filter((c) => c.momentum === "slipping").length,
    steady: scored.filter((c) => c.momentum === "steady").length,
    improving: scored.filter((c) => c.momentum === "improving").length,
  };

  return {
    reps: repsSorted,
    teamAvg,
    target: TEAM_SCORE_TARGET,
    callsReviewed: eligible.length,
    queueCount: reviews.filter((r) => r.status === "completed" && !r.coachReviewed).length,
    momentum,
    coachFirst: scored[0],
  };
}
