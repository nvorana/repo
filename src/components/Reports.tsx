import { useState } from "react";
import type { ReviewSummary } from "../api.ts";
import { Avatar } from "./Avatar.tsx";

interface Scored {
  date: number;
  score: number;
  repKey: string;
  repName: string;
  repId?: string;
  scorecard: { criterionId: string; criterionName: string; score: number }[];
}

function weekStart(ms: number): number {
  const d = new Date(ms);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function fmtDay(ms: number, withYear = false): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

const RANGES: { label: string; weeks: number }[] = [
  { label: "6 weeks", weeks: 6 },
  { label: "12 weeks", weeks: 12 },
  { label: "All time", weeks: 9999 },
];

// A rep's period-over-period movement, matching the mockup's verbal labels.
type Cat = { label: string; text: string; stroke: string; arrow: string };
function category(delta: number): Cat {
  if (delta > 0.15)
    return { label: "Improved", text: "text-success", stroke: "var(--color-success)", arrow: "▲" };
  if (delta <= -0.5)
    return { label: "Needs attention", text: "text-error", stroke: "var(--color-error)", arrow: "▼" };
  if (delta < -0.15)
    return { label: "Slight decline", text: "text-warning", stroke: "var(--color-warning)", arrow: "▼" };
  return { label: "Steady", text: "opacity-50", stroke: "var(--color-base-content)", arrow: "→" };
}

export function Reports({ reviews }: { reviews: ReviewSummary[] }) {
  const [rangeIdx, setRangeIdx] = useState(1);
  const [now] = useState(() => Date.now());
  const weeks = RANGES[rangeIdx].weeks;
  const cutoff = weeks >= 9999 ? 0 : now - weeks * 7 * 86_400_000;

  const scored: Scored[] = reviews
    .filter((r) => r.status === "completed" && r.overallScore != null)
    .map((r) => ({
      date: new Date(r.callDate ?? r.createdAt).getTime(),
      score: r.overallScore!,
      repKey: r.repId ?? r.rep ?? "—",
      repName: r.rep ?? "—",
      repId: r.repId,
      scorecard: r.scorecard ?? [],
    }))
    .filter((s) => s.date >= cutoff)
    .sort((a, b) => a.date - b.date);

  if (scored.length === 0) {
    return (
      <div>
        <h1 className="mb-1 text-2xl font-bold">Sales Team Performance</h1>
        <p className="opacity-60">
          No reviewed calls in this range yet. Trends will appear here as calls get reviewed over the
          weeks.
        </p>
      </div>
    );
  }

  // --- Team average by week ---
  const byWeek = new Map<number, number[]>();
  for (const s of scored) {
    const k = weekStart(s.date);
    (byWeek.get(k) ?? byWeek.set(k, []).get(k)!).push(s.score);
  }
  const weekRows = [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, scores]) => ({
      key: k,
      label: `${fmtDay(k)} – ${fmtDay(k + 6 * 86_400_000)}`,
      avg: avg(scores),
      count: scores.length,
    }));
  const lastWeekChange =
    weekRows.length >= 2 ? weekRows[weekRows.length - 1].avg - weekRows[weekRows.length - 2].avg : null;

  const overallAvg = avg(scored.map((s) => s.score));
  const firstHalf = scored.slice(0, Math.floor(scored.length / 2));
  const secondHalf = scored.slice(Math.floor(scored.length / 2));
  const firstAvg = avg(firstHalf.map((s) => s.score));
  const secondAvg = avg(secondHalf.map((s) => s.score));
  const teamChange = secondAvg - firstAvg;
  const totalCalls = scored.length;
  const rangeText = `${fmtDay(scored[0].date)} – ${fmtDay(scored[totalCalls - 1].date, true)}`;

  // --- Per-rep ---
  const repMap = new Map<string, Scored[]>();
  for (const s of scored) (repMap.get(s.repKey) ?? repMap.set(s.repKey, []).get(s.repKey)!).push(s);
  const reps = [...repMap.entries()]
    .map(([, list]) => {
      const sorted = [...list].sort((a, b) => a.date - b.date);
      const scores = sorted.map((s) => s.score);
      const started = scores[0];
      const nowScore = scores[scores.length - 1];
      return {
        name: sorted[0].repName,
        repId: sorted[0].repId,
        calls: sorted.length,
        pct: Math.round((sorted.length / totalCalls) * 100),
        avg: avg(scores),
        started,
        now: nowScore,
        change: nowScore - started,
        scores,
      };
    })
    // Worst-first: most-negative change on top, then lowest average.
    .sort((a, b) => a.change - b.change || a.avg - b.avg);

  const worst = reps[0];
  const scoreColor = (v: number) =>
    v >= overallAvg ? "text-success" : v >= overallAvg - 1 ? "text-warning" : "text-error";

  // --- Skill movement (team), per criterion ---
  const critMap = new Map<string, { name: string; early: number[]; late: number[] }>();
  const mid = scored[Math.floor(scored.length / 2)]?.date ?? now;
  for (const s of scored) {
    for (const c of s.scorecard) {
      const e = critMap.get(c.criterionId) ?? { name: c.criterionName, early: [], late: [] };
      (s.date < mid ? e.early : e.late).push(c.score);
      critMap.set(c.criterionId, e);
    }
  }
  const skills = [...critMap.values()]
    .filter((c) => c.early.length && c.late.length)
    .map((c) => ({ name: c.name, early: avg(c.early), late: avg(c.late), change: avg(c.late) - avg(c.early) }))
    .sort((a, b) => b.change - a.change);

  const maxBar = 120;
  const dir =
    lastWeekChange == null || Math.abs(lastWeekChange) < 0.05
      ? "held steady"
      : lastWeekChange > 0
        ? "rose"
        : "decreased";
  const insight =
    lastWeekChange == null
      ? `${worst.name} needs the most attention.`
      : dir === "held steady"
        ? `Team average held steady from last week. ${worst.name} needs the most attention.`
        : `Team average ${dir} by ${Math.abs(lastWeekChange).toFixed(1)} point${
            Math.abs(lastWeekChange) === 1 ? "" : "s"
          } from last week. ${worst.name} needs the most attention.`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Sales Team Performance</h1>
          <p className="mt-1 opacity-60">How the team is trending — over {totalCalls} reviewed calls</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="join rounded-lg border border-base-300">
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                className={`btn join-item btn-sm border-0 ${
                  i === rangeIdx ? "bg-base-100 text-primary font-semibold" : "btn-ghost opacity-70"
                }`}
                onClick={() => setRangeIdx(i)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-sm opacity-60">
            <CalendarIcon />
            {rangeText}
          </div>
        </div>
      </section>

      {/* Headline stat cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<PeopleIcon />}
          iconBg="bg-warning/15 text-warning"
          title="Team Average Score"
          value={
            <>
              <span className="text-warning">{overallAvg.toFixed(1)}</span>
              <span className="text-lg font-semibold opacity-30"> / 10</span>
            </>
          }
          caption="Team rating across all calls"
        />
        <StatCard
          icon={<TrendIcon />}
          iconBg="bg-success/15 text-success"
          title="Trend This Period"
          value={
            <span className={teamChange > 0.2 ? "text-success" : teamChange < -0.2 ? "text-error" : ""}>
              {teamChange >= 0 ? "+" : ""}
              {teamChange.toFixed(1)}
            </span>
          }
          caption={
            <>
              First half <span className="font-semibold text-success">{firstAvg.toFixed(1)}</span> →
              Second half <span className="font-semibold text-error">{secondAvg.toFixed(1)}</span>
            </>
          }
        />
        <StatCard
          icon={<DocIcon />}
          iconBg="bg-info/15 text-info"
          title="Calls Reviewed"
          value={totalCalls}
          caption={`Across ${reps.length} salesperson${reps.length === 1 ? "" : "s"}`}
        />
      </section>

      {/* Team average by week */}
      <section className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide opacity-70">Team Average by Week</h2>
        <div className="flex items-stretch gap-6">
          <div className="flex flex-1 items-end gap-3" style={{ height: 180 }}>
            {/* y-axis guide */}
            <div className="flex h-full flex-col justify-between pb-6 text-xs opacity-40">
              <span>10</span>
              <span>5</span>
              <span>0</span>
            </div>
            {weekRows.map((w) => (
              <div key={w.key} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-lg font-bold">{w.avg.toFixed(1)}</span>
                <div
                  className="w-full max-w-[220px] rounded-t-md bg-warning"
                  style={{ height: `${(w.avg / 10) * maxBar}px` }}
                  title={`${w.count} call${w.count === 1 ? "" : "s"}`}
                />
                <span className="mt-1 text-xs opacity-50">{w.label}</span>
              </div>
            ))}
          </div>
          {lastWeekChange != null && (
            <div className="flex w-40 flex-col items-center justify-center rounded-xl bg-base-200 p-4 text-center">
              <span className="text-sm opacity-60">Change</span>
              <span
                className={`text-3xl font-bold ${
                  lastWeekChange > 0.05 ? "text-success" : lastWeekChange < -0.05 ? "text-error" : ""
                }`}
              >
                {lastWeekChange >= 0 ? "+" : ""}
                {lastWeekChange.toFixed(1)}
              </span>
              <span className="text-xs opacity-50">from last week</span>
            </div>
          )}
        </div>
      </section>

      {/* Per-rep progress */}
      <section className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide opacity-70">
          Each Salesperson's Progress
        </h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr className="text-xs">
                <th>Salesperson</th>
                <th>Calls Reviewed</th>
                <th>
                  Average Score
                  <span className="block font-normal opacity-40">({RANGES[rangeIdx].label})</span>
                </th>
                <th>
                  Started
                  <span className="block font-normal opacity-40">(period start)</span>
                </th>
                <th>
                  Now
                  <span className="block font-normal opacity-40">(this week)</span>
                </th>
                <th>Change</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {reps.map((r) => {
                const cat = category(r.change);
                return (
                  <tr key={r.repId ?? r.name}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar userId={r.repId} name={r.name} size={40} />
                        <span className="font-semibold">{r.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-bold">{r.calls}</span>
                      <span className="block text-xs opacity-50">{r.pct}% of total</span>
                    </td>
                    <td>
                      <span className={`font-bold ${scoreColor(r.avg)}`}>{r.avg.toFixed(1)}</span>
                      <span className="opacity-30"> / 10</span>
                    </td>
                    <td className="opacity-60">{r.started.toFixed(1)}</td>
                    <td className="font-semibold">{r.now.toFixed(1)}</td>
                    <td>
                      <span className={`font-bold ${cat.text}`}>
                        {cat.arrow} {r.change >= 0 ? "+" : ""}
                        {r.change.toFixed(1)}
                      </span>
                      <span className={`block text-xs ${cat.text}`}>{cat.label}</span>
                    </td>
                    <td>
                      <Sparkline values={r.scores} stroke={cat.stroke} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick insight */}
      <section className="flex items-start gap-3 rounded-2xl border border-info/30 bg-info/10 p-4">
        <BulbIcon />
        <p className="text-sm">
          <span className="font-semibold">Quick insight: </span>
          {insight}
        </p>
      </section>

      {/* Skill movement */}
      {skills.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">Which skills are improving</h2>
          <p className="mb-3 text-sm opacity-60">
            Team average per scorecard skill, earlier vs. later in this period.
          </p>
          <div className="card space-y-3 bg-base-200 p-4">
            {skills.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="w-48 shrink-0 truncate text-sm font-medium">{s.name}</span>
                <span className="text-xs opacity-60">{s.early.toFixed(1)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-base-300">
                  <div
                    className={`h-full rounded-full ${s.late >= 4 ? "bg-success" : s.late >= 3 ? "bg-warning" : "bg-error"}`}
                    style={{ width: `${(s.late / 5) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-semibold">{s.late.toFixed(1)}</span>
                <span
                  className={`w-12 text-right text-xs font-semibold ${
                    s.change > 0.1 ? "text-success" : s.change < -0.1 ? "text-error" : "opacity-40"
                  }`}
                >
                  {s.change >= 0 ? "+" : ""}
                  {s.change.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  title,
  value,
  caption,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: React.ReactNode;
  caption: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-50">{title}</div>
        <div className="text-4xl font-bold leading-tight">{value}</div>
        <div className="mt-1 text-sm opacity-60">{caption}</div>
      </div>
    </div>
  );
}

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return <span className="text-xs opacity-40">—</span>;
  const w = 96;
  const h = 28;
  const max = 10;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* --- Inline icons (match the mockup's soft-tile look) --- */
function PeopleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TrendIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="17 6 23 6 23 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
      <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function BulbIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0 text-info">
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
