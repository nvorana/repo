import { useState } from "react";
import type { ReviewSummary } from "../api.ts";
import { buildWeeklyReview, type MeasureDelta, type RepWeek } from "../lib/weeklyReview.ts";

function Arrow({ m }: { m: MeasureDelta }) {
  if (m.delta == null || m.improved == null) return <span className="opacity-40">→</span>;
  return (
    <span className={m.improved ? "text-success" : "text-error"}>{m.improved ? "▲" : "▼"}</span>
  );
}

function MeasureRow({ m }: { m: MeasureDelta }) {
  const val = (v: number | null) => (v == null ? "—" : m.format(v));
  return (
    <tr>
      <td className="font-medium">{m.label}</td>
      <td className="opacity-60">{val(m.prev)}</td>
      <td className={m.now == null ? "" : m.meetsTarget ? "text-success" : "text-warning"}>
        {val(m.now)}
      </td>
      <td>
        <Arrow m={m} />
      </td>
      <td className="opacity-50">{m.format(m.target)}</td>
    </tr>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={`btn btn-sm ${copied ? "btn-success" : "btn-primary"}`}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
    >
      {copied ? "Copied" : "Copy message"}
    </button>
  );
}

function RepWeekCard({ w, onOpenCalls }: { w: RepWeek; onOpenCalls: (rep: string) => void }) {
  const noCalls = w.callsNow === 0;
  return (
    <div
      className={`card border bg-base-100 shadow ${noCalls ? "border-error/40" : "border-base-300"}`}
    >
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-3">
            <h3 className="card-title">{w.rep}</h3>
            {w.scoreNow != null && (
              <span className="text-2xl font-bold">
                {w.scoreNow}
                <span className="text-sm font-normal opacity-50"> / 10</span>
              </span>
            )}
            {w.scoreDelta != null && Math.abs(w.scoreDelta) > 0.15 && (
              <span className={w.scoreDelta > 0 ? "text-success" : "text-error"}>
                {w.scoreDelta > 0 ? "▲" : "▼"} {Math.abs(w.scoreDelta)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!w.reliable && !noCalls && (
              <span className="badge badge-ghost badge-sm">small sample</span>
            )}
            <span className="text-sm opacity-60">
              {w.callsNow} this week · {w.callsPrev} last
            </span>
          </div>
        </div>

        {/* What to say, in order. This is the part read out loud. */}
        <ul className="space-y-1.5 text-sm">
          {w.talkingPoints.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="opacity-30">•</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        {!noCalls && (
          <div className="overflow-x-auto">
            <table className="table table-xs">
              <thead>
                <tr>
                  <th>Measure</th>
                  <th>Last week</th>
                  <th>This week</th>
                  <th />
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {w.measures.map((m) => (
                  <MeasureRow key={m.key} m={m} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={w.message} />
          <button className="btn btn-outline btn-sm" onClick={() => onOpenCalls(w.rep)}>
            Open {w.rep}&apos;s calls
          </button>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer opacity-60">Preview the message</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-base-200 p-3 font-sans text-sm">
            {w.message}
          </pre>
        </details>
      </div>
    </div>
  );
}

/**
 * The Monday review. One card per advisor, worst first, each carrying the
 * talking points and a message ready to send — so the meeting can start with
 * what to say rather than with someone reading numbers off a dashboard.
 */
export function WeeklyReview({
  reviews,
  onOpenCalls,
}: {
  reviews: ReviewSummary[];
  onOpenCalls: (rep: string) => void;
}) {
  const review = buildWeeklyReview(reviews);

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-2xl font-bold">This week vs last</h1>
        <p className="opacity-60">
          {review.now.label} compared with {review.prev.label}. Worst first.
        </p>
      </section>

      {review.reps.length === 0 ? (
        <div className="alert">
          <span>No calls on record yet for anyone.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {review.reps.map((w) => (
            <RepWeekCard key={w.rep} w={w} onOpenCalls={onOpenCalls} />
          ))}
        </div>
      )}
    </div>
  );
}
