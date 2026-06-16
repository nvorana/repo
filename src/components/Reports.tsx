import { useState } from "react";
import type { ReviewSummary } from "../api.ts";

interface Scored {
  date: number;
  score: number;
  repKey: string;
  repName: string;
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

const RANGES: { label: string; weeks: number }[] = [
  { label: "6 weeks", weeks: 6 },
  { label: "12 weeks", weeks: 12 },
  { label: "All time", weeks: 9999 },
];

export function Reports({ reviews }: { reviews: ReviewSummary[] }) {
  const [rangeIdx, setRangeIdx] = useState(1);
  const [now] = useState(() => Date.now());
  const weeks = RANGES[rangeIdx].weeks;
  const cutoff = weeks >= 9999 ? 0 : now - weeks * 7 * 86_400_000;

  const scored: Scored[] = reviews
    .filter((r) => r.status === "completed" && r.overallScore != null)
    .map((r) => ({
      date: new Date(r.createdAt).getTime(),
      score: r.overallScore!,
      repKey: r.repId ?? r.rep ?? "—",
      repName: r.rep ?? "—",
      scorecard: r.scorecard ?? [],
    }))
    .filter((s) => s.date >= cutoff)
    .sort((a, b) => a.date - b.date);

  if (scored.length === 0) {
    return (
      <div>
        <h1 className="mb-1 text-2xl font-bold">Reports</h1>
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
      label: new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      avg: avg(scores),
      count: scores.length,
    }));

  const overallAvg = avg(scored.map((s) => s.score));
  const firstHalf = scored.slice(0, Math.floor(scored.length / 2));
  const secondHalf = scored.slice(Math.floor(scored.length / 2));
  const teamChange = avg(secondHalf.map((s) => s.score)) - avg(firstHalf.map((s) => s.score));

  // --- Per-rep ---
  const repMap = new Map<string, Scored[]>();
  for (const s of scored) (repMap.get(s.repKey) ?? repMap.set(s.repKey, []).get(s.repKey)!).push(s);
  const reps = [...repMap.entries()]
    .map(([, list]) => {
      const sorted = [...list].sort((a, b) => a.date - b.date);
      const half = Math.max(1, Math.floor(sorted.length / 2));
      const early = avg(sorted.slice(0, half).map((s) => s.score));
      const late = avg(sorted.slice(-half).map((s) => s.score));
      return {
        name: sorted[0].repName,
        calls: sorted.length,
        early,
        late,
        change: late - early,
        scores: sorted.map((s) => s.score),
      };
    })
    .sort((a, b) => b.change - a.change);

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

  const maxWeekAvg = 10;

  return (
    <div className="space-y-10">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="mb-1 text-2xl font-bold">Reports</h1>
            <p className="opacity-60">How the team is trending — over {scored.length} reviewed calls.</p>
          </div>
          <div role="tablist" className="tabs tabs-box">
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                role="tab"
                className={`tab ${i === rangeIdx ? "tab-active" : ""}`}
                onClick={() => setRangeIdx(i)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Headline numbers */}
      <section className="stats stats-vertical w-full bg-base-200 shadow sm:stats-horizontal">
        <div className="stat">
          <div className="stat-title">Team average</div>
          <div className="stat-value text-primary">{overallAvg.toFixed(1)}</div>
          <div className="stat-desc">out of 10</div>
        </div>
        <div className="stat">
          <div className="stat-title">Trend this period</div>
          <div
            className={`stat-value ${teamChange > 0.2 ? "text-success" : teamChange < -0.2 ? "text-error" : ""}`}
          >
            {teamChange >= 0 ? "+" : ""}
            {teamChange.toFixed(1)}
          </div>
          <div className="stat-desc">first half → second half</div>
        </div>
        <div className="stat">
          <div className="stat-title">Calls reviewed</div>
          <div className="stat-value">{scored.length}</div>
          <div className="stat-desc">{reps.length} salesperson{reps.length === 1 ? "" : "s"}</div>
        </div>
      </section>

      {/* Team average by week */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Team average by week</h2>
        <div className="card bg-base-200 p-4">
          <div className="flex items-end gap-2" style={{ height: 160 }}>
            {weekRows.map((w) => (
              <div key={w.key} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs font-semibold">{w.avg.toFixed(1)}</span>
                <div
                  className="w-full rounded-t bg-primary"
                  style={{ height: `${(w.avg / maxWeekAvg) * 120}px` }}
                  title={`${w.count} call${w.count === 1 ? "" : "s"}`}
                />
                <span className="text-[10px] opacity-50">{w.label}</span>
                <span className="text-[10px] opacity-40">{w.count}×</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Per-rep improvement */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Each salesperson's progress</h2>
        <div className="overflow-x-auto rounded-box bg-base-200">
          <table className="table">
            <thead>
              <tr>
                <th>Salesperson</th>
                <th>Calls</th>
                <th>Started</th>
                <th>Now</th>
                <th>Change</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {reps.map((r) => (
                <tr key={r.name}>
                  <td className="font-medium">{r.name}</td>
                  <td>{r.calls}</td>
                  <td className="opacity-70">{r.early.toFixed(1)}</td>
                  <td className="font-semibold">{r.late.toFixed(1)}</td>
                  <td>
                    <span
                      className={`badge badge-sm ${
                        r.change > 0.2 ? "badge-success" : r.change < -0.2 ? "badge-error" : "badge-ghost"
                      }`}
                    >
                      {r.change >= 0 ? "▲ +" : "▼ "}
                      {r.change.toFixed(1)}
                    </span>
                  </td>
                  <td>
                    <Sparkline values={r.scores} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-xs opacity-40">—</span>;
  const w = 80;
  const h = 24;
  const max = 10;
  const min = 0;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "var(--color-success)" : "var(--color-error)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
