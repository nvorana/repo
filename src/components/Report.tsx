import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import type {
  CallReview,
  CallReviewResult,
  CoachingItem,
  DeliveryMetrics,
  Objection,
  TimestampedFinding,
  Transcript,
} from "../../core/types.ts";
import { audioUrl } from "../api.ts";

type Tab = "summary" | "winsmisses" | "objections" | "delivery" | "scorecard" | "coaching" | "transcript";

const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "winsmisses", label: "Wins & Misses" },
  { id: "objections", label: "Objections" },
  { id: "delivery", label: "Delivery" },
  { id: "scorecard", label: "Scorecard" },
  { id: "coaching", label: "Coaching" },
  { id: "transcript", label: "Transcript" },
];

export function Report({
  result,
  reviewId,
  separateTracks = false,
}: {
  result: CallReviewResult;
  reviewId: string;
  separateTracks?: boolean;
}) {
  const { review, metrics } = result;
  const repAudioRef = useRef<HTMLAudioElement>(null);
  const clientAudioRef = useRef<HTMLAudioElement>(null);
  const [hasAudio, setHasAudio] = useState(true);
  const [tab, setTab] = useState<Tab>("summary");

  function seek(seconds: number) {
    const at = Math.max(0, seconds - 3);
    // Separate tracks share the meeting timeline (each is silent when the other
    // talks), so seeking + playing both together reconstructs the moment.
    for (const el of [repAudioRef.current, clientAudioRef.current]) {
      if (!el) continue;
      el.currentTime = at;
      void el.play();
    }
    repAudioRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  const onSeek = hasAudio ? seek : undefined;

  return (
    <div className="space-y-5">
      {hasAudio && (
        <div className="print-hide sticky top-0 z-10 -mx-2 space-y-2 rounded-box bg-base-100/95 p-2 backdrop-blur">
          {separateTracks ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium opacity-60">Your track (rep)</p>
                <audio
                  ref={repAudioRef}
                  controls
                  preload="none"
                  src={audioUrl(reviewId, "rep")}
                  onError={() => setHasAudio(false)}
                  className="w-full"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium opacity-60">Client track</p>
                <audio
                  ref={clientAudioRef}
                  controls
                  preload="none"
                  src={audioUrl(reviewId, "client")}
                  className="w-full"
                />
              </div>
            </div>
          ) : (
            <audio
              ref={repAudioRef}
              controls
              preload="none"
              src={audioUrl(reviewId)}
              onError={() => setHasAudio(false)}
              className="w-full"
            />
          )}
          <p className="px-1 text-xs opacity-50">
            Tip: click any ▶ timestamp anywhere in the report to hear that exact moment.
          </p>
        </div>
      )}

      {/* Tabs hide in print; print shows everything sequentially below. */}
      <div role="tablist" className="tabs tabs-border print-hide overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            className={`tab whitespace-nowrap ${tab === t.id ? "tab-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* On screen: show only the active tab. In print: show all sections. */}
      <Pane show={tab === "summary"}>
        <Summary review={review} onSeek={onSeek} onJump={setTab} />
      </Pane>
      <Pane show={tab === "winsmisses"}>
        <div className="grid gap-6 lg:grid-cols-2">
          <FindingList title="What went right" tone="good" items={review.whatWentRight} onSeek={onSeek} />
          <FindingList title="What went wrong" tone="bad" items={review.whatWentWrong} onSeek={onSeek} />
        </div>
      </Pane>
      <Pane show={tab === "objections"}>
        <Objections objections={review.objections} onSeek={onSeek} />
      </Pane>
      <Pane show={tab === "delivery"}>
        {!separateTracks && (
          <div className="mb-4 rounded-box border border-warning/30 bg-warning/10 p-3 text-sm">
            <span className="font-semibold text-warning">Talk-time % is an estimate.</span> This call
            was a single combined recording, so who-spoke-when was inferred and the ratio may be off.
            For an exact figure, upload each person's separate audio file.
          </div>
        )}
        <MetricsStrip metrics={metrics} />
        <div className="mt-5">
          <Delivery review={review} />
        </div>
      </Pane>
      <Pane show={tab === "scorecard"}>
        <Scorecard review={review} />
      </Pane>
      <Pane show={tab === "coaching"}>
        <Coaching review={review} />
      </Pane>
      <Pane show={tab === "transcript"}>
        <TranscriptView transcript={result.transcript} onSeek={onSeek} />
      </Pane>
    </div>
  );
}

// Renders children when active (screen). For print, a parallel block below
// renders everything; here we just gate the on-screen single-tab view.
function Pane({ show, children }: { show: boolean; children: ReactNode }) {
  return <div className={`report-pane ${show ? "" : "hidden"}`}>{children}</div>;
}

const IMPACT_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function sortByImpact<T extends { impact: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (IMPACT_RANK[a.impact] ?? 1) - (IMPACT_RANK[b.impact] ?? 1));
}

function verdict(score: number): { label: string; tone: string } {
  if (score >= 8) return { label: "Strong call", tone: "text-success" };
  if (score >= 6) return { label: "Solid, with gaps", tone: "text-success" };
  if (score >= 4) return { label: "Needs work", tone: "text-warning" };
  return { label: "Rough call", tone: "text-error" };
}

// --- Summary (the calm landing) ---------------------------------------------

function Summary({
  review,
  onSeek,
  onJump,
}: {
  review: CallReview;
  onSeek?: (s: number) => void;
  onJump: (t: Tab) => void;
}) {
  const v = verdict(review.overallScore);
  const topWin = sortByImpact(review.whatWentRight)[0];
  const topMiss = sortByImpact(review.whatWentWrong)[0];
  const topFocus = [...review.coaching].sort((a, b) => a.priority - b.priority)[0];

  return (
    <div className="space-y-5">
      <div className="card bg-base-200">
        <div className="card-body gap-4 p-6">
          <div className="flex items-center gap-5">
            <div
              className="radial-progress shrink-0 text-3xl font-bold"
              style={
                {
                  "--value": review.overallScore * 10,
                  "--size": "5.5rem",
                  "--thickness": "0.5rem",
                } as CSSProperties
              }
              role="progressbar"
            >
              <span className={v.tone}>{review.overallScore}</span>
            </div>
            <div>
              <div className={`text-xl font-bold ${v.tone}`}>{v.label}</div>
              <div className="text-sm opacity-60">Overall score {review.overallScore} / 10</div>
            </div>
          </div>
          <p className="text-sm leading-relaxed opacity-90">{review.summary}</p>
          <div className="rounded-box bg-base-300/50 p-3 text-sm">
            <span className="font-semibold">Outcome: </span>
            {review.callOutcome}
          </div>
        </div>
      </div>

      {topFocus && (
        <div className="card border border-primary/30 bg-primary/5">
          <div className="card-body p-5">
            <div className="flex items-center gap-2">
              <span className="badge badge-primary badge-sm">#1 focus next time</span>
            </div>
            <p className="text-lg font-semibold">{topFocus.title}</p>
            <p className="text-sm opacity-80">{topFocus.advice}</p>
            <div className="mt-1 rounded-box bg-base-100/60 p-3 text-sm italic">
              Try: “{topFocus.example}”
            </div>
            <button onClick={() => onJump("coaching")} className="btn btn-ghost btn-sm mt-1 self-start">
              See all coaching →
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {topWin && (
          <HighlightCard
            kind="win"
            finding={topWin}
            onSeek={onSeek}
            onMore={() => onJump("winsmisses")}
          />
        )}
        {topMiss && (
          <HighlightCard
            kind="miss"
            finding={topMiss}
            onSeek={onSeek}
            onMore={() => onJump("winsmisses")}
          />
        )}
      </div>
    </div>
  );
}

function HighlightCard({
  kind,
  finding,
  onSeek,
  onMore,
}: {
  kind: "win" | "miss";
  finding: TimestampedFinding;
  onSeek?: (s: number) => void;
  onMore: () => void;
}) {
  const isWin = kind === "win";
  return (
    <div className={`card border-l-4 ${isWin ? "border-success" : "border-error"} bg-base-200`}>
      <div className="card-body gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wide ${isWin ? "text-success" : "text-error"}`}>
            {isWin ? "Biggest win" : "Biggest miss"}
          </span>
          <TsButton at={finding.timestamp} onSeek={onSeek} />
        </div>
        <p className="font-medium">{finding.point}</p>
        <button onClick={onMore} className="link link-hover self-start text-xs opacity-60">
          more detail →
        </button>
      </div>
    </div>
  );
}

// --- Shared bits ------------------------------------------------------------

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
        <div key={label} className="rounded-box bg-base-200 p-3 text-center">
          <div className="text-lg font-semibold">{value}</div>
          <div className="mt-0.5 text-xs opacity-60">{label}</div>
        </div>
      ))}
    </section>
  );
}

function ImpactChip({ impact, tone }: { impact?: string; tone: "good" | "bad" }) {
  if (!impact) return null;
  if (tone === "good") {
    return impact === "high" ? <span className="badge badge-success badge-sm">Top strength</span> : null;
  }
  const cls = impact === "high" ? "badge-error" : impact === "medium" ? "badge-warning" : "badge-ghost";
  const label = impact === "high" ? "High impact" : impact === "medium" ? "Medium" : "Low";
  return <span className={`badge badge-sm ${cls}`}>{label}</span>;
}

function FindingList({
  title,
  tone,
  items,
  onSeek,
}: {
  title: string;
  tone: "good" | "bad";
  items: TimestampedFinding[];
  onSeek?: (seconds: number) => void;
}) {
  const accent = tone === "good" ? "border-success" : "border-error";
  const sorted = sortByImpact(items);
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="space-y-3">
        {sorted.map((f, i) => (
          <div key={i} className={`card border-l-4 ${accent} bg-base-200 p-4`}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{f.point}</p>
              <div className="flex shrink-0 items-center gap-2">
                <ImpactChip impact={f.impact} tone={tone} />
                <TsButton at={f.timestamp} onSeek={onSeek} />
              </div>
            </div>
            <p className="mt-1 text-sm opacity-80">{f.detail}</p>
            <blockquote className="mt-2 border-l-2 border-base-300 pl-3 text-sm italic opacity-60">
              “{f.quote}”
            </blockquote>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-sm opacity-50">Nothing noted.</p>}
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
  // Unhandled first, then partially handled — the riskiest gaps on top.
  const order: Record<Objection["handled"], number> = {
    unhandled: 0,
    partially_handled: 1,
    handled: 2,
  };
  const sorted = [...objections].sort((a, b) => order[a.handled] - order[b.handled]);
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Objections &amp; concerns</h2>
      <p className="mb-3 text-sm opacity-60">
        Including implicit concerns the prospect signaled but never said outright. Unresolved ones
        first.
      </p>
      <div className="space-y-3">
        {sorted.map((o, i) => {
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
        {sorted.length === 0 && <p className="text-sm opacity-50">No objections detected.</p>}
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
  const items: CoachingItem[] = [...review.coaching].sort((a, b) => a.priority - b.priority);
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
              <div className="mt-2 rounded-box bg-base-300/60 p-3 text-sm italic">Try: “{c.example}”</div>
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
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Full transcript</h2>
      <div className="card max-h-[36rem] space-y-3 overflow-y-auto bg-base-200 p-4">
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
    </section>
  );
}
