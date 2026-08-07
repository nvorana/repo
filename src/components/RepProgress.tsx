import type { ReviewSummary } from "../api.ts";
import { buildRepProgress } from "../lib/repProgress.ts";
import type { MeasureTrend } from "../lib/trends.ts";

const STATE_CHIP: Record<MeasureTrend["state"], { label: string; cls: string } | null> = {
  fixed: { label: "✓ Fixed", cls: "badge-success" },
  recurring: { label: "⟳ Recurring", cls: "badge-warning" },
  steady: { label: "→ Steady", cls: "badge-ghost" },
  insufficient: null,
};

function fmt(t: MeasureTrend): string {
  if (t.current === null) return "—";
  return t.config.format ? t.config.format(t.current) : String(t.current);
}

function MeasureRow({ t }: { t: MeasureTrend }) {
  const chip = STATE_CHIP[t.state];
  return (
    <tr>
      <td className="font-medium">{t.config.label}</td>
      <td className={t.meetsTarget ? "text-success" : "text-warning"}>{fmt(t)}</td>
      <td className="opacity-60">
        {t.config.direction === "lower" ? "≤" : "≥"}{" "}
        {t.config.format ? t.config.format(t.config.target) : t.config.target}
      </td>
      <td>{chip && <span className={`badge badge-sm ${chip.cls}`}>{chip.label}</span>}</td>
    </tr>
  );
}

/**
 * Trend-first view of one rep's progress. Leads with the single measure most
 * worth working on rather than a list of calls to grind through.
 */
export function RepProgress({
  reviews,
  rep,
  heading = "Your progress",
}: {
  reviews: ReviewSummary[];
  rep: { id: string; name: string };
  heading?: string;
}) {
  const progress = buildRepProgress(reviews, rep);
  const { coachNext, measures, eligible, awaitingRelease } = progress;

  if (eligible === 0) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold">{heading}</h2>
        <div className="alert">
          <span>
            No calls are feeding trends yet. Upload a call recorded as two separate tracks (you
            and the client) and your numbers will start here.
          </span>
        </div>
      </section>
    );
  }

  // Only measures with something to say — an "insufficient" line is noise.
  const shown = measures.filter((m) => m.state !== "insufficient" || m.current !== null);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{heading}</h2>
        <span className="text-sm opacity-60">
          across {eligible} call{eligible === 1 ? "" : "s"}
        </span>
      </div>

      {coachNext ? (
        <div className="card mb-4 border border-warning/40 bg-warning/10">
          <div className="card-body p-5">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
              Work on this
            </span>
            <h3 className="text-xl font-bold">{coachNext.config.label}</h3>
            <p className="opacity-80">
              You're at <span className="font-semibold">{fmt(coachNext)}</span>, and the target is{" "}
              {coachNext.config.direction === "lower" ? "at most" : "at least"}{" "}
              <span className="font-semibold">
                {coachNext.config.format
                  ? coachNext.config.format(coachNext.config.target)
                  : coachNext.config.target}
              </span>
              . This has come up on more than one call — it's the habit most worth changing before
              your next one.
            </p>
          </div>
        </div>
      ) : (
        <div className="alert alert-success mb-4">
          <span>Nothing is recurring below target right now — keep it up.</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Measure</th>
              <th>Now</th>
              <th>Target</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <MeasureRow key={m.config.key} t={m} />
            ))}
          </tbody>
        </table>
      </div>

      {awaitingRelease > 0 && (
        <p className="mt-3 text-sm opacity-60">
          {awaitingRelease} of these call{awaitingRelease === 1 ? " is" : "s are"} still waiting on
          your coach. The measured numbers above already include{" "}
          {awaitingRelease === 1 ? "it" : "them"}; scores and written feedback appear once your
          coach releases the call.
        </p>
      )}
    </section>
  );
}
