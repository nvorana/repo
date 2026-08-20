import { useState } from "react";
import type { ReviewSummary } from "../api.ts";
import { Avatar } from "./Avatar.tsx";
import { buildTeamHome, type Range, type RepCard, type SampleSize } from "../lib/teamHome.ts";

const RANGES: { label: string; value: Range }[] = [
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
  { label: "All time", value: "all" },
];

const SAMPLE_LABEL: Record<SampleSize, string> = {
  reliable: "Reliable sample",
  small: "Small sample",
  insufficient: "Not enough data",
};

function Sparkline({ series }: { series: number[] }) {
  if (series.length < 2) return <div className="h-6 w-24" />;
  const w = 96, h = 24, max = Math.max(...series), min = Math.min(...series);
  const span = max - min || 1;
  const pts = series
    .map((v, i) => `${(i / (series.length - 1)) * w},${h - ((v - min) / span) * h}`)
    .join(" ");
  const rising = series[series.length - 1] >= series[0];
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        strokeWidth="2"
        className={rising ? "stroke-success" : "stroke-error"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MomentumBadge({ momentum, delta }: { momentum: RepCard["momentum"]; delta: number }) {
  if (momentum === "improving")
    return <span className="text-sm font-medium text-success">▲ {Math.abs(delta).toFixed(1)} · improving</span>;
  if (momentum === "slipping")
    return <span className="text-sm font-medium text-error">▼ {Math.abs(delta).toFixed(1)} · slipping</span>;
  return <span className="text-sm opacity-50">→ steady</span>;
}

export function TeamCoachingHome({
  reviews,
  onSelect,
  onReviewAll,
  onJumpToQueue,
}: {
  reviews: ReviewSummary[];
  onSelect: (id: string) => void;
  /** Open the full, filtered list of one rep's calls. */
  onReviewAll: (rep: string) => void;
  onJumpToQueue: () => void;
}) {
  const [range, setRange] = useState<Range>(30);
  const [now] = useState(() => Date.now());
  const t = buildTeamHome(reviews, range, now);

  const gap = (t.target - t.teamAvg).toFixed(1);
  const totalMomentum = t.momentum.slipping + t.momentum.steady + t.momentum.improving || 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Team coaching</h1>
          <p className="opacity-60">
            How your {t.reps.length} rep{t.reps.length === 1 ? "" : "s"} {t.reps.length === 1 ? "is" : "are"} trending — and who to coach first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="select select-bordered select-sm"
            value={String(range)}
            onChange={(e) => setRange(e.target.value === "all" ? "all" : (Number(e.target.value) as Range))}
          >
            {RANGES.map((r) => (
              <option key={String(r.value)} value={String(r.value)}>{r.label}</option>
            ))}
          </select>
          <button className="btn btn-neutral btn-sm" onClick={onJumpToQueue}>
            Review queue <span className="badge badge-sm badge-warning">{t.queueCount}</span>
          </button>
        </div>
      </div>

      {t.reps.length === 0 ? (
        <div className="rounded-box border border-base-300 bg-base-100 p-8 text-center opacity-60">
          No reviewed calls in this range yet. Trends appear as calls get reviewed.
        </div>
      ) : (
        <>
          {/* Coach-first callout */}
          {t.coachFirst && (
            <div className="rounded-box border border-base-300 border-l-4 border-l-error bg-base-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-error">Coach first</p>
                  <p className="mt-1 font-bold">
                    {t.coachFirst.rep} is {t.coachFirst.momentum === "slipping" ? "slipping" : "your lowest"} — {t.coachFirst.avgScore.toFixed(1)} avg
                    {t.coachFirst.delta < 0 ? `, down ${Math.abs(t.coachFirst.delta).toFixed(1)} over ${t.coachFirst.calls} calls` : ` over ${t.coachFirst.calls} calls`}
                  </p>
                  {t.coachFirst.weakest && (
                    <p className="mt-1 text-sm opacity-70">
                      Weakest skill: <span className="font-medium">{t.coachFirst.weakest.name}</span> at {t.coachFirst.weakest.avg.toFixed(1)} / 5.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {t.coachFirst.worstCallId && (
                    <button className="btn btn-outline btn-sm" onClick={() => onSelect(t.coachFirst!.worstCallId!)}>
                      Listen to worst call
                    </button>
                  )}
                  {t.coachFirst.recentCallId && (
                    <button className="btn btn-error btn-sm" onClick={() => onSelect(t.coachFirst!.recentCallId!)}>
                      Coach {t.coachFirst.rep}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-50">Team call score</p>
              <p className="mt-1 text-3xl font-bold">{t.teamAvg.toFixed(1)} <span className="text-base font-normal opacity-40">/ 10</span></p>
              <p className={`text-xs ${t.teamAvg >= t.target ? "text-success" : "text-error"}`}>
                {t.teamAvg >= t.target ? `${(t.teamAvg - t.target).toFixed(1)} above` : `${gap} below`} your {t.target}.0 target
              </p>
            </div>
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-50">Calls reviewed</p>
              <p className="mt-1 text-3xl font-bold">{t.callsReviewed}</p>
              <p className="text-xs opacity-50">{t.queueCount} still in queue</p>
            </div>
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-50">Team momentum</p>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-base-300">
                <div className="bg-error" style={{ width: `${(t.momentum.slipping / totalMomentum) * 100}%` }} />
                <div className="bg-warning" style={{ width: `${(t.momentum.steady / totalMomentum) * 100}%` }} />
                <div className="bg-success" style={{ width: `${(t.momentum.improving / totalMomentum) * 100}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 text-xs">
                <span className="text-error">● {t.momentum.slipping} slipping</span>
                <span className="text-warning">● {t.momentum.steady} steady</span>
                <span className="text-success">● {t.momentum.improving} improving</span>
              </div>
            </div>
          </div>

          {/* By salesperson */}
          <div>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">By salesperson</h2>
              <span className="text-xs opacity-50">Sorted by coaching priority · skill scores are out of 5</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {t.reps.map((c) => (
                <RepCardView key={c.rep} c={c} onSelect={onSelect} onReviewAll={onReviewAll} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RepCardView({
  c,
  onSelect,
  onReviewAll,
}: {
  c: RepCard;
  onSelect: (id: string) => void;
  onReviewAll: (rep: string) => void;
}) {
  const insufficient = c.sampleSize === "insufficient";
  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar userId={c.repId} name={c.rep} size={40} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{c.rep}</p>
            <p className="text-xs opacity-50">{c.calls} call{c.calls === 1 ? "" : "s"} reviewed</p>
          </div>
        </div>
        <span className={`badge badge-sm ${c.sampleSize === "reliable" ? "badge-info badge-outline" : "badge-ghost"}`}>
          {SAMPLE_LABEL[c.sampleSize]}
        </span>
      </div>

      {insufficient ? (
        <p className="mt-3 text-sm opacity-60">
          No trend yet — needs {c.callsToScore} more reviewed call{c.callsToScore === 1 ? "" : "s"} before a score.
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-3xl font-bold">{c.avgScore.toFixed(1)} <span className="text-base font-normal opacity-40">/ 10</span></p>
            <div className="flex flex-col items-end gap-1">
              <MomentumBadge momentum={c.momentum} delta={c.delta} />
              <Sparkline series={c.scoreSeries} />
            </div>
          </div>
          {c.weakest && (
            <div className="mt-3 rounded-box bg-base-200 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide opacity-50">Coach next</span>
                <span className="font-medium">{c.weakest.avg.toFixed(1)} / 5</span>
              </div>
              <p className="mt-1 text-sm font-medium">{c.weakest.name}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-base-300">
                <div className="h-full bg-error" style={{ width: `${(c.weakest.avg / 5) * 100}%` }} />
              </div>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            {c.recentCallId && (
              <button className="btn btn-error btn-sm flex-1" onClick={() => onSelect(c.recentCallId!)}>
                Coach now
              </button>
            )}
            {c.recentCallId && (
              <button className="btn btn-outline btn-sm flex-1" onClick={() => onReviewAll(c.rep)}>
                Review {c.calls} call{c.calls === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
