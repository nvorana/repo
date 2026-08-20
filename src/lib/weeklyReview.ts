import type { ReviewSummary } from "../api.ts";
import { countsTowardMetricTrends, countsTowardTrends } from "./eligibility.ts";
import { isRealCriterion } from "./teamHome.ts";
import { METRIC_MEASURES, PER_HOUR_KEYS } from "./targets.ts";

/**
 * The Monday review: each advisor's last 7 days against the 7 before, with the
 * talking points already written.
 *
 * ROLLING 7-DAY WINDOWS, not calendar weeks. Mike runs this every Monday, and
 * on a Monday morning a calendar "this week" is empty — he would be comparing
 * nothing against something. Rolling windows are always populated, always the
 * same length, and work whichever day he actually opens it. The exact dates are
 * shown so there is never ambiguity about what "this week" meant.
 *
 * Talking points are generated in code, not by the model: this gets opened at
 * the start of a meeting, so it has to be instant, free, and incapable of
 * inventing a number that isn't in the data.
 */

const WINDOW_DAYS = 7;
/** Below this, a week-over-week delta is noise, and is labelled as such. */
export const RELIABLE_CALLS_PER_WEEK = 3;

export interface WeekWindow {
  /** Inclusive YYYY-MM-DD bounds. */
  start: string;
  end: string;
  label: string;
}

export interface MeasureDelta {
  key: string;
  label: string;
  now: number | null;
  prev: number | null;
  delta: number | null;
  /** True when the change moved toward the target, whichever direction that is. */
  improved: boolean | null;
  meetsTarget: boolean;
  target: number;
  format: (v: number) => string;
}

export interface SkillDelta {
  name: string;
  now: number | null;
  prev: number | null;
  delta: number | null;
}

export interface RepWeek {
  rep: string;
  repId?: string;
  callsNow: number;
  callsPrev: number;
  scoreNow: number | null;
  scorePrev: number | null;
  scoreDelta: number | null;
  /** False when there were too few calls for the comparison to mean much. */
  reliable: boolean;
  measures: MeasureDelta[];
  skills: SkillDelta[];
  talkingPoints: string[];
  /** Paste-ready note for Viber/Messenger, addressed to the rep. */
  message: string;
}

export interface WeeklyReview {
  now: WeekWindow;
  prev: WeekWindow;
  reps: RepWeek[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ymd = (d: Date): string => d.toISOString().slice(0, 10);
const shift = (d: Date, days: number): Date => new Date(d.getTime() + days * 86400000);
const dayOf = (r: ReviewSummary): string => r.callDate ?? r.createdAt.slice(0, 10);

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

function pretty(iso: string): string {
  const [, m, d] = iso.split("-");
  return MONTHS[Number(m) - 1] + " " + Number(d);
}

function windowEndingOn(end: Date): WeekWindow {
  const start = shift(end, -(WINDOW_DAYS - 1));
  return { start: ymd(start), end: ymd(end), label: pretty(ymd(start)) + "–" + pretty(ymd(end)) };
}

/** Per-hour normalisation, matching the rep progress view exactly. */
function measureValue(key: string, r: ReviewSummary): number | null {
  if (key === "overallScore") return r.overallScore ?? null;
  if (key === "objectionRate") return r.objectionRate ?? null;
  const m = r.metrics as unknown as Record<string, number | undefined> | undefined;
  if (!m) return null;
  const raw = m[key];
  if (raw == null) return null;
  if (!PER_HOUR_KEYS.has(key)) return raw;
  const mins = r.metrics?.durationMin;
  if (!mins) return null;
  return Math.round((raw * 60) / mins);
}

function skillMap(list: ReviewSummary[]): Map<string, { name: string; scores: number[] }> {
  const out = new Map<string, { name: string; scores: number[] }>();
  for (const r of list) {
    for (const c of r.scorecard ?? []) {
      if (!isRealCriterion(c)) continue;
      const entry = out.get(c.criterionId) ?? { name: c.criterionName, scores: [] };
      entry.scores.push(c.score);
      out.set(c.criterionId, entry);
    }
  }
  return out;
}

function buildTalkingPoints(w: RepWeek): string[] {
  const out: string[] = [];

  if (w.callsNow === 0) {
    out.push(
      w.callsPrev > 0
        ? "No calls uploaded this week — " +
            w.callsPrev +
            " the week before. Start here: nothing else on this page means anything without calls."
        : "No calls uploaded in either week. Start here.",
    );
    return out;
  }

  out.push(
    w.callsNow +
      " call" +
      (w.callsNow === 1 ? "" : "s") +
      " this week, " +
      w.callsPrev +
      " the week before." +
      (w.reliable ? "" : " Too few to read the changes below as more than a hint."),
  );

  if (w.scoreNow != null && w.scorePrev != null && w.scoreDelta != null) {
    if (Math.abs(w.scoreDelta) <= 0.15) {
      out.push("Score held at " + w.scoreNow + "/10 (was " + w.scorePrev + ").");
    } else {
      out.push(
        "Score " +
          (w.scoreDelta > 0 ? "up" : "down") +
          " — " +
          w.scorePrev +
          " → " +
          w.scoreNow +
          "/10 (" +
          (w.scoreDelta > 0 ? "+" : "") +
          w.scoreDelta +
          ").",
      );
    }
  } else if (w.scoreNow != null) {
    out.push("Score " + w.scoreNow + "/10 this week; nothing released last week to compare against.");
  } else {
    out.push("No released scores this week — these calls have not been released yet.");
  }

  const moved = w.measures.filter((m) => m.delta != null && m.improved != null);
  const best = moved
    .filter((m) => m.improved)
    .sort((a, b) => Math.abs(b.delta as number) - Math.abs(a.delta as number))[0];
  const worst = moved
    .filter((m) => !m.improved)
    .sort((a, b) => Math.abs(b.delta as number) - Math.abs(a.delta as number))[0];

  if (best) {
    out.push(
      best.label +
        " moved the right way: " +
        best.format(best.prev as number) +
        " → " +
        best.format(best.now as number) +
        "." +
        (best.meetsTarget ? " That is inside target now." : ""),
    );
  }
  if (worst) {
    out.push(
      worst.label +
        " went the wrong way: " +
        worst.format(worst.prev as number) +
        " → " +
        worst.format(worst.now as number) +
        (worst.meetsTarget ? " (still inside target)." : " — target is " + worst.format(worst.target) + "."),
    );
  }

  const stuck = w.measures.filter(
    (m) => !m.meetsTarget && m.now != null && (m.delta == null || m.improved !== true),
  );
  const stuckOther = stuck.filter((m) => !worst || m.key !== worst.key);
  if (stuckOther.length) {
    out.push("Outside target and not moving: " + stuckOther.map((m) => m.label).join(", ") + ".");
  }

  const weakest = w.skills
    .filter((s) => s.now != null)
    .sort((a, b) => (a.now as number) - (b.now as number))[0];
  if (weakest) {
    const trend =
      weakest.delta == null
        ? ""
        : weakest.delta > 0.2
          ? " (improving)"
          : weakest.delta < -0.2
            ? " (slipping)"
            : "";
    out.push("Weakest skill: " + weakest.name + " at " + weakest.now + "/5" + trend + ".");
  }

  return out;
}

/** A short note the coach can paste straight into Viber or Messenger. */
function buildMessage(w: RepWeek): string {
  if (w.callsNow === 0) {
    return (
      "Hi " +
      w.rep +
      " — wala pa tayong upload this week. Send me your calls today para may mapag-usapan tayo, kahit dalawa lang muna."
    );
  }

  const lines: string[] = ["Hi " + w.rep + " — quick recap of your week."];

  if (w.scoreNow != null && w.scorePrev != null && w.scoreDelta != null) {
    if (w.scoreDelta > 0.15) {
      lines.push(
        "Score went up, " + w.scorePrev + " to " + w.scoreNow + " out of 10 across " + w.callsNow + " calls. Good movement.",
      );
    } else if (w.scoreDelta < -0.15) {
      lines.push("Score dipped, " + w.scorePrev + " to " + w.scoreNow + " out of 10 across " + w.callsNow + " calls.");
    } else {
      lines.push("Score held steady at " + w.scoreNow + " out of 10 across " + w.callsNow + " calls.");
    }
  } else if (w.scoreNow != null) {
    lines.push("You are at " + w.scoreNow + " out of 10 across " + w.callsNow + " calls this week.");
  }

  const best = w.measures
    .filter((m) => m.improved === true && m.prev != null && m.now != null)
    .sort((a, b) => Math.abs(b.delta as number) - Math.abs(a.delta as number))[0];
  if (best) {
    lines.push(
      best.label +
        " improved from " +
        best.format(best.prev as number) +
        " to " +
        best.format(best.now as number) +
        " — keep doing whatever you changed there.",
    );
  }

  const focus = w.measures
    .filter((m) => !m.meetsTarget && m.now != null)
    .sort((a, b) => Math.abs((b.now as number) - b.target) - Math.abs((a.now as number) - a.target))[0];
  if (focus) {
    lines.push(
      "One thing for this week: " +
        focus.label.toLowerCase() +
        " is at " +
        focus.format(focus.now as number) +
        " and we want it " +
        focus.format(focus.target) +
        ". Let us work on that.",
    );
  }

  const weakest = w.skills
    .filter((s) => s.now != null)
    .sort((a, b) => (a.now as number) - (b.now as number))[0];
  if (weakest && (weakest.now as number) < 3) {
    lines.push("Biggest skill gap is still " + weakest.name + ". We will drill that on our call.");
  }

  return lines.join("\n\n");
}

export function buildWeeklyReview(reviews: ReviewSummary[], now: Date = new Date()): WeeklyReview {
  const nowWin = windowEndingOn(now);
  const prevWin = windowEndingOn(shift(now, -WINDOW_DAYS));

  const inWindow = (r: ReviewSummary, w: WeekWindow): boolean => {
    const d = dayOf(r);
    return d >= w.start && d <= w.end;
  };

  const named = reviews.filter((r) => r.rep && r.status === "completed");
  const repNames = [...new Set(named.map((r) => r.rep as string))].sort();

  const cards: RepWeek[] = repNames.map((rep) => {
    const mine = named.filter((r) => r.rep === rep);
    const nowCalls = mine.filter((r) => inWindow(r, nowWin));
    const prevCalls = mine.filter((r) => inWindow(r, prevWin));

    // Scores come only from released, trend-eligible calls; delivery metrics
    // from any finished two-track call. Same split the rest of the app uses.
    const scoreNow = avg(
      nowCalls.filter(countsTowardTrends).map((r) => r.overallScore as number),
    );
    const scorePrev = avg(
      prevCalls.filter(countsTowardTrends).map((r) => r.overallScore as number),
    );
    const metricNow = nowCalls.filter(countsTowardMetricTrends);
    const metricPrev = prevCalls.filter(countsTowardMetricTrends);

    const measures: MeasureDelta[] = METRIC_MEASURES.filter((c) => c.key !== "overallScore").map(
      (cfg) => {
        const from = (list: ReviewSummary[]) =>
          avg(list.map((r) => measureValue(cfg.key, r)).filter((v): v is number => v != null));
        // objectionRate is model judgment, so it follows the score's eligibility.
        const nowVal = from(cfg.key === "objectionRate" ? nowCalls.filter(countsTowardTrends) : metricNow);
        const prevVal = from(cfg.key === "objectionRate" ? prevCalls.filter(countsTowardTrends) : metricPrev);
        const delta =
          nowVal != null && prevVal != null ? Math.round((nowVal - prevVal) * 10) / 10 : null;
        return {
          key: cfg.key,
          label: cfg.label,
          now: nowVal,
          prev: prevVal,
          delta,
          improved:
            delta == null || Math.abs(delta) < 0.05
              ? null
              : cfg.direction === "lower"
                ? delta < 0
                : delta > 0,
          meetsTarget:
            nowVal != null && (cfg.direction === "lower" ? nowVal <= cfg.target : nowVal >= cfg.target),
          target: cfg.target,
          format: cfg.format ?? ((v: number) => String(v)),
        };
      },
    );

    const sNow = skillMap(nowCalls);
    const sPrev = skillMap(prevCalls);
    const skills: SkillDelta[] = [...new Set([...sNow.keys(), ...sPrev.keys()])].map((id) => {
      const a = sNow.get(id);
      const b = sPrev.get(id);
      const nowV = a ? avg(a.scores) : null;
      const prevV = b ? avg(b.scores) : null;
      return {
        name: a?.name ?? b?.name ?? id,
        now: nowV,
        prev: prevV,
        delta: nowV != null && prevV != null ? Math.round((nowV - prevV) * 10) / 10 : null,
      };
    });

    const card: RepWeek = {
      rep,
      repId: mine.find((r) => r.repId)?.repId,
      callsNow: nowCalls.length,
      callsPrev: prevCalls.length,
      scoreNow,
      scorePrev,
      scoreDelta:
        scoreNow != null && scorePrev != null ? Math.round((scoreNow - scorePrev) * 10) / 10 : null,
      reliable: nowCalls.length >= RELIABLE_CALLS_PER_WEEK,
      measures,
      skills,
      talkingPoints: [],
      message: "",
    };
    card.talkingPoints = buildTalkingPoints(card);
    card.message = buildMessage(card);
    return card;
  });

  // Whoever needs the conversation most goes first: nobody who uploaded nothing
  // should be buried under someone having a good week.
  cards.sort((a, b) => {
    if ((a.callsNow === 0) !== (b.callsNow === 0)) return a.callsNow === 0 ? -1 : 1;
    return (a.scoreDelta ?? 0) - (b.scoreDelta ?? 0);
  });

  return { now: nowWin, prev: prevWin, reps: cards };
}
