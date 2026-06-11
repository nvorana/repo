import type {
  CallReview,
  CallReviewResult,
  DeliveryMetrics,
  Objection,
} from "../../core/types.ts";

export function Report({ result }: { result: CallReviewResult }) {
  const { review, metrics } = result;
  return (
    <div className="space-y-8">
      <Overview review={review} />
      <MetricsStrip metrics={metrics} />
      <div className="grid gap-6 lg:grid-cols-2">
        <FindingList title="What went right" tone="good" items={review.whatWentRight} />
        <FindingList title="What went wrong" tone="bad" items={review.whatWentWrong} />
      </div>
      <Objections objections={review.objections} />
      <Delivery review={review} />
      <Scorecard review={review} />
      <Coaching review={review} />
    </div>
  );
}

function Overview({ review }: { review: CallReview }) {
  const score = review.overallScore;
  const tone = score >= 7 ? "text-emerald-400" : score >= 4 ? "text-amber-400" : "text-red-400";
  return (
    <section className="rounded-2xl bg-slate-800/60 p-6">
      <div className="flex items-start gap-6">
        <div className="shrink-0 text-center">
          <div className={`text-5xl font-bold ${tone}`}>{score}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">/ 10</div>
        </div>
        <div>
          <p className="text-slate-200">{review.summary}</p>
          <p className="mt-3 text-sm text-slate-400">
            <span className="font-semibold text-slate-300">Outcome: </span>
            {review.callOutcome}
          </p>
        </div>
      </div>
    </section>
  );
}

function MetricsStrip({ metrics }: { metrics: DeliveryMetrics }) {
  const minutes = Math.round(metrics.durationMs / 60000);
  const talk = Math.round(metrics.salespersonTalkRatio * 100);
  const cells: [string, string][] = [
    ["Duration", `${minutes} min`],
    ["Rep talk ratio", `${talk}%`],
    ["Rep pace", `${metrics.paceWpm.salesperson} wpm`],
    ["Questions asked", `${metrics.questionCounts.salesperson}`],
    ["Filler words", `${metrics.fillerWordCounts.salesperson}`],
    ["Interruptions", `${metrics.interruptions.length}`],
    ["Long pauses", `${metrics.pauses.length}`],
  ];
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {cells.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-slate-800/60 p-3 text-center">
          <div className="text-lg font-semibold text-slate-100">{value}</div>
          <div className="mt-0.5 text-xs text-slate-400">{label}</div>
        </div>
      ))}
    </section>
  );
}

function FindingList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "good" | "bad";
  items: CallReview["whatWentRight"];
}) {
  const accent = tone === "good" ? "border-emerald-500/50" : "border-red-500/50";
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-slate-100">{title}</h2>
      <div className="space-y-3">
        {items.map((f, i) => (
          <div key={i} className={`rounded-xl border-l-4 ${accent} bg-slate-800/60 p-4`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium text-slate-100">{f.point}</p>
              <span className="shrink-0 text-xs text-slate-500">{f.timestamp}</span>
            </div>
            <p className="mt-1 text-sm text-slate-300">{f.detail}</p>
            <blockquote className="mt-2 border-l-2 border-slate-600 pl-3 text-sm italic text-slate-400">
              “{f.quote}”
            </blockquote>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-500">Nothing noted.</p>}
      </div>
    </section>
  );
}

const HANDLED_BADGE: Record<Objection["handled"], [string, string]> = {
  handled: ["Handled", "bg-emerald-500/20 text-emerald-300"],
  partially_handled: ["Partially handled", "bg-amber-500/20 text-amber-300"],
  unhandled: ["Never handled", "bg-red-500/20 text-red-300"],
};

function Objections({ objections }: { objections: Objection[] }) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold text-slate-100">Objections & concerns</h2>
      <p className="mb-3 text-sm text-slate-400">
        Including implicit concerns the prospect signaled but never said outright.
      </p>
      <div className="space-y-3">
        {objections.map((o, i) => {
          const [label, badge] = HANDLED_BADGE[o.handled];
          return (
            <div key={i} className="rounded-xl bg-slate-800/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge}`}>
                  {label}
                </span>
                <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs text-slate-300">
                  {o.kind === "implicit" ? "Implicit — not stated outright" : "Explicit"}
                </span>
                <span className="ml-auto text-xs text-slate-500">{o.timestamp}</span>
              </div>
              <p className="mt-2 font-medium text-slate-100">{o.summary}</p>
              <blockquote className="mt-2 border-l-2 border-slate-600 pl-3 text-sm italic text-slate-400">
                “{o.quote}”
              </blockquote>
              {o.howItWasHandled && (
                <p className="mt-2 text-sm text-slate-300">
                  <span className="font-semibold text-slate-200">What the rep did: </span>
                  {o.howItWasHandled}
                </p>
              )}
              <p className="mt-2 rounded-lg bg-slate-900/60 p-3 text-sm text-amber-200/90">
                <span className="font-semibold text-amber-300">Better approach: </span>
                {o.recommendedHandling}
              </p>
            </div>
          );
        })}
        {objections.length === 0 && (
          <p className="text-sm text-slate-500">No objections detected.</p>
        )}
      </div>
    </section>
  );
}

function Delivery({ review }: { review: CallReview }) {
  const d = review.delivery;
  const rows: [string, string][] = [
    ["Overall", d.overall],
    ["Talk / listen balance", d.talkListenBalance],
    ["Pacing", d.pacing],
    ["Use of pauses", d.useOfPauses],
    ["Confidence signals", d.confidenceSignals],
  ];
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-slate-100">Tonality & delivery</h2>
      <div className="space-y-px overflow-hidden rounded-xl">
        {rows.map(([label, text]) => (
          <div key={label} className="bg-slate-800/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {label}
            </div>
            <p className="mt-1 text-sm text-slate-200">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Scorecard({ review }: { review: CallReview }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-slate-100">Scorecard</h2>
      <div className="space-y-3 rounded-xl bg-slate-800/60 p-4">
        {review.scorecard.map((item) => (
          <div key={item.criterionId}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-200">{item.criterionName}</span>
              <span className="text-sm text-slate-400">{item.score}/5</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full rounded-full ${
                  item.score >= 4 ? "bg-emerald-400" : item.score >= 3 ? "bg-amber-400" : "bg-red-400"
                }`}
                style={{ width: `${(item.score / 5) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">{item.rationale}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Coaching({ review }: { review: CallReview }) {
  const items = [...review.coaching].sort((a, b) => a.priority - b.priority);
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-slate-100">Coaching priorities</h2>
      <ol className="space-y-3">
        {items.map((c) => (
          <li key={c.priority} className="flex gap-4 rounded-xl bg-slate-800/60 p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/20 font-semibold text-amber-300">
              {c.priority}
            </div>
            <div>
              <p className="font-medium text-slate-100">{c.title}</p>
              <p className="mt-1 text-sm text-slate-300">{c.advice}</p>
              <p className="mt-2 rounded-lg bg-slate-900/60 p-3 text-sm italic text-slate-300">
                Try: “{c.example}”
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
