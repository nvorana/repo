import { useRef, useState } from "react";
import type {
  CallReview,
  CallReviewResult,
  DeliveryMetrics,
  Objection,
  Transcript,
} from "../../core/types.ts";
import { audioUrl } from "../api.ts";

export function Report({ result, reviewId }: { result: CallReviewResult; reviewId: string }) {
  const { review, metrics } = result;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasAudio, setHasAudio] = useState(true);

  function seek(seconds: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, seconds - 3); // small lead-in for context
    void el.play();
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const onSeek = hasAudio ? seek : undefined;

  return (
    <div className="space-y-8">
      {hasAudio && (
        <div className="print-hide sticky top-0 z-10 -mx-2 rounded-box bg-base-100/95 p-2 backdrop-blur">
          <audio
            ref={audioRef}
            controls
            preload="none"
            src={audioUrl(reviewId)}
            onError={() => setHasAudio(false)}
            className="w-full"
          />
          <p className="mt-1 px-1 text-xs opacity-50">
            Click any timestamp in the report to jump to that moment in the call.
          </p>
        </div>
      )}
      <Overview review={review} />
      <MetricsStrip metrics={metrics} />
      <div className="grid gap-6 lg:grid-cols-2">
        <FindingList title="What went right" tone="good" items={review.whatWentRight} onSeek={onSeek} />
        <FindingList title="What went wrong" tone="bad" items={review.whatWentWrong} onSeek={onSeek} />
      </div>
      <Objections objections={review.objections} onSeek={onSeek} />
      <Delivery review={review} />
      <Scorecard review={review} />
      <Coaching review={review} />
      <TranscriptView transcript={result.transcript} onSeek={onSeek} />
    </div>
  );
}

function parseTimestamp(ts: string): number | null {
  const m = ts.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, h, mm, ss] = m;
  return (h ? Number(h) * 3600 : 0) + Number(mm) * 60 + Number(ss);
}

function TsButton({ at, onSeek }: { at: string; onSeek?: (seconds: number) => void }) {
  const seconds = parseTimestamp(at);
  if (onSeek && seconds !== null) {
    return (
      <button onClick={() => onSeek(seconds)} title="Play this moment" className="btn btn-xs btn-ghost text-primary">
        ▶ {at}
      </button>
    );
  }
  return <span className="shrink-0 text-xs opacity-50">{at}</span>;
}

function Overview({ review }: { review: CallReview }) {
  const score = review.overallScore;
  const tone = score >= 7 ? "text-success" : score >= 4 ? "text-warning" : "text-error";
  return (
    <div className="card bg-base-200">
      <div className="card-body flex-row items-start gap-6 p-6">
        <div className="shrink-0 text-center">
          <div className={`text-5xl font-bold ${tone}`}>{score}</div>
          <div className="text-xs uppercase tracking-wide opacity-50">/ 10</div>
        </div>
        <div>
          <p>{review.summary}</p>
          <p className="mt-3 text-sm opacity-70">
            <span className="font-semibold">Outcome: </span>
            {review.callOutcome}
          </p>
        </div>
      </div>
    </div>
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
        <div key={label} className="card bg-base-200 p-3 text-center">
          <div className="text-lg font-semibold">{value}</div>
          <div className="mt-0.5 text-xs opacity-60">{label}</div>
        </div>
      ))}
    </section>
  );
}

function FindingList({
  title,
  tone,
  items,
  onSeek,
}: {
  title: string;
  tone: "good" | "bad";
  items: CallReview["whatWentRight"];
  onSeek?: (seconds: number) => void;
}) {
  const accent = tone === "good" ? "border-success" : "border-error";
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="space-y-3">
        {items.map((f, i) => (
          <div key={i} className={`card border-l-4 ${accent} bg-base-200 p-4`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">{f.point}</p>
              <TsButton at={f.timestamp} onSeek={onSeek} />
            </div>
            <p className="mt-1 text-sm opacity-80">{f.detail}</p>
            <blockquote className="mt-2 border-l-2 border-base-300 pl-3 text-sm italic opacity-60">
              “{f.quote}”
            </blockquote>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm opacity-50">Nothing noted.</p>}
      </div>
    </section>
  );
}

const HANDLED_BADGE: Record<Objection["handled"], [string, string]> = {
  handled: ["Handled", "badge-success"],
  partially_handled: ["Partially handled", "badge-warning"],
  unhandled: ["Never handled", "badge-error"],
};

function Objections({
  objections,
  onSeek,
}: {
  objections: Objection[];
  onSeek?: (seconds: number) => void;
}) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Objections &amp; concerns</h2>
      <p className="mb-3 text-sm opacity-60">
        Including implicit concerns the prospect signaled but never said outright.
      </p>
      <div className="space-y-3">
        {objections.map((o, i) => {
          const [label, badge] = HANDLED_BADGE[o.handled];
          return (
            <div key={i} className="card bg-base-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge badge-sm ${badge}`}>{label}</span>
                <span className="badge badge-ghost badge-sm">
                  {o.kind === "implicit" ? "Implicit — not stated outright" : "Explicit"}
                </span>
                <span className="ml-auto">
                  <TsButton at={o.timestamp} onSeek={onSeek} />
                </span>
              </div>
              <p className="mt-2 font-medium">{o.summary}</p>
              <blockquote className="mt-2 border-l-2 border-base-300 pl-3 text-sm italic opacity-60">
                “{o.quote}”
              </blockquote>
              {o.howItWasHandled && (
                <p className="mt-2 text-sm opacity-80">
                  <span className="font-semibold">What the rep did: </span>
                  {o.howItWasHandled}
                </p>
              )}
              <div className="mt-2 rounded-box bg-warning/10 p-3 text-sm">
                <span className="font-semibold text-warning">Better approach: </span>
                {o.recommendedHandling}
              </div>
            </div>
          );
        })}
        {objections.length === 0 && <p className="text-sm opacity-50">No objections detected.</p>}
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
      <h2 className="mb-3 text-lg font-semibold">Tonality &amp; delivery</h2>
      <div className="card divide-y divide-base-300 overflow-hidden bg-base-200">
        {rows.map(([label, text]) => (
          <div key={label} className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-50">{label}</div>
            <p className="mt-1 text-sm opacity-90">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Scorecard({ review }: { review: CallReview }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Scorecard</h2>
      <div className="card space-y-3 bg-base-200 p-4">
        {review.scorecard.map((item) => (
          <div key={item.criterionId}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{item.criterionName}</span>
              <span className="text-sm opacity-60">{item.score}/5</span>
            </div>
            <progress
              className={`progress mt-1 w-full ${
                item.score >= 4 ? "progress-success" : item.score >= 3 ? "progress-warning" : "progress-error"
              }`}
              value={item.score}
              max={5}
            />
            <p className="mt-1 text-xs opacity-60">{item.rationale}</p>
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
      <h2 className="mb-3 text-lg font-semibold">Coaching priorities</h2>
      <ol className="space-y-3">
        {items.map((c) => (
          <li key={c.priority} className="card flex-row gap-4 bg-base-200 p-4">
            <div className="badge badge-warning badge-lg shrink-0 font-semibold">{c.priority}</div>
            <div>
              <p className="font-medium">{c.title}</p>
              <p className="mt-1 text-sm opacity-80">{c.advice}</p>
              <div className="mt-2 rounded-box bg-base-300/60 p-3 text-sm italic">
                Try: “{c.example}”
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${m}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : mmss;
}

function TranscriptView({
  transcript,
  onSeek,
}: {
  transcript: Transcript;
  onSeek?: (seconds: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="print-hide">
      <button onClick={() => setOpen(!open)} className="mb-3 text-lg font-semibold hover:text-primary">
        Full transcript {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="card max-h-[32rem] space-y-3 overflow-y-auto bg-base-200 p-4">
          {transcript.utterances.map((u, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-20 shrink-0 pt-0.5">
                <TsButton at={formatMs(u.startMs)} onSeek={onSeek} />
              </div>
              <div>
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    u.role === "salesperson" ? "text-primary" : "text-info"
                  }`}
                >
                  {u.role === "salesperson" ? "Rep" : "Prospect"}
                </span>
                <p className="text-sm opacity-80">{u.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
