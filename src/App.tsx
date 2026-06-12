import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  getReview,
  isInProgress,
  listReviews,
  STATUS_LABELS,
  type ReviewJob,
  type ReviewSummary,
} from "./api.ts";
import { UploadCard } from "./components/UploadCard.tsx";
import { Report } from "./components/Report.tsx";

const POLL_MS = 4000;

export default function App() {
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReviewJob | null>(null);

  const refreshList = useCallback(() => {
    listReviews().then(setReviews).catch(console.error);
  }, []);

  useEffect(refreshList, [refreshList]);

  // Poll the list while anything is processing.
  useEffect(() => {
    if (!reviews.some((r) => isInProgress(r.status))) return;
    const t = setInterval(refreshList, POLL_MS);
    return () => clearInterval(t);
  }, [reviews, refreshList]);

  // Load + poll the selected review.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const job = await getReview(selectedId);
        if (cancelled) return;
        setSelected(job);
        if (isInProgress(job.status)) timer = setTimeout(load, POLL_MS);
      } catch (err) {
        console.error(err);
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedId]);

  return (
    <div className="min-h-full bg-slate-900 text-slate-100">
      <header className="print-hide border-b border-slate-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <button
            onClick={() => setSelectedId(null)}
            className="text-left text-xl font-semibold tracking-tight"
          >
            Call<span className="text-amber-400">Coach</span>
          </button>
          <span className="text-sm text-slate-400">AI sales call review</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {selectedId ? (
          <DetailView
            job={selected?.id === selectedId ? selected : null}
            onBack={() => {
              setSelectedId(null);
              refreshList();
            }}
          />
        ) : (
          <HomeView
            reviews={reviews}
            onUploaded={(id) => {
              refreshList();
              setSelectedId(id);
            }}
            onSelect={setSelectedId}
          />
        )}
      </main>
    </div>
  );
}

function HomeView({
  reviews,
  onUploaded,
  onSelect,
}: {
  reviews: ReviewSummary[];
  onUploaded: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-1 text-2xl font-semibold">Review a sales call</h1>
        <p className="mb-5 text-slate-400">
          Upload a one-on-one call recording. You'll get back what went right, what went
          wrong, every objection (handled or missed), delivery analysis, and coaching
          priorities.
        </p>
        <UploadCard onUploaded={onUploaded} />
      </section>

      <RepDashboard reviews={reviews} />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-500">No calls reviewed yet.</p>
        ) : (
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => onSelect(r.id)}
                  className="flex w-full items-center gap-4 rounded-xl bg-slate-800/60 px-4 py-3 text-left transition-colors hover:bg-slate-800"
                >
                  <ScoreBadge status={r.status} score={r.overallScore} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{r.filename}</span>
                      {r.rep && (
                        <span className="shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">
                          {r.rep}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-sm text-slate-400">
                      {r.status === "failed"
                        ? r.error
                        : (r.summary ?? STATUS_LABELS[r.status])}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface RepStats {
  rep: string;
  calls: number;
  avgScore: number;
  lastScore: number;
  weakest?: { name: string; avg: number };
}

function computeRepStats(reviews: ReviewSummary[]): RepStats[] {
  const byRep = new Map<string, ReviewSummary[]>();
  for (const r of reviews) {
    if (r.rep && r.status === "completed" && r.overallScore != null) {
      const list = byRep.get(r.rep) ?? [];
      list.push(r);
      byRep.set(r.rep, list);
    }
  }
  return [...byRep.entries()]
    .map(([rep, list]) => {
      // list is newest-first from the API
      const scores = list.map((r) => r.overallScore!);
      const criteria = new Map<string, { name: string; scores: number[] }>();
      for (const r of list) {
        for (const c of r.scorecard ?? []) {
          const entry = criteria.get(c.criterionId) ?? { name: c.criterionName, scores: [] };
          entry.scores.push(c.score);
          criteria.set(c.criterionId, entry);
        }
      }
      const weakest = [...criteria.values()]
        .map(({ name, scores }) => ({ name, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
        .sort((a, b) => a.avg - b.avg)[0];
      return {
        rep,
        calls: list.length,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        lastScore: scores[0],
        weakest,
      };
    })
    .sort((a, b) => b.calls - a.calls);
}

function RepDashboard({ reviews }: { reviews: ReviewSummary[] }) {
  const stats = computeRepStats(reviews);
  if (stats.length === 0) return null;
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">By salesperson</h2>
      <p className="mb-3 text-sm text-slate-400">
        Where each rep stands across their reviewed calls — and the single skill to coach next.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => {
          const trend = s.lastScore - s.avgScore;
          return (
            <div key={s.rep} className="rounded-xl bg-slate-800/60 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-semibold text-slate-100">{s.rep}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {s.calls} call{s.calls === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-2 flex items-end gap-3">
                <span className="text-3xl font-bold text-slate-100">{s.avgScore.toFixed(1)}</span>
                <span className="pb-1 text-xs text-slate-400">avg / 10</span>
                {s.calls > 1 && (
                  <span
                    className={`pb-1 text-xs ${
                      trend > 0.2 ? "text-emerald-400" : trend < -0.2 ? "text-red-400" : "text-slate-500"
                    }`}
                  >
                    {trend > 0.2 ? "↑ improving" : trend < -0.2 ? "↓ slipping" : "→ steady"} (last:{" "}
                    {s.lastScore})
                  </span>
                )}
              </div>
              {s.weakest && (
                <p className="mt-3 rounded-lg bg-slate-900/60 p-2.5 text-xs text-slate-300">
                  <span className="font-semibold text-amber-300">Coach next: </span>
                  {s.weakest.name} (avg {s.weakest.avg.toFixed(1)}/5)
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScoreBadge({ status, score }: { status: ReviewSummary["status"]; score?: number }) {
  if (status === "failed") {
    return <Badge className="bg-red-500/20 text-red-300">✕</Badge>;
  }
  if (score == null) {
    return (
      <Badge className="bg-slate-700 text-slate-300">
        <Spinner />
      </Badge>
    );
  }
  const tone =
    score >= 7
      ? "bg-emerald-500/20 text-emerald-300"
      : score >= 4
        ? "bg-amber-500/20 text-amber-300"
        : "bg-red-500/20 text-red-300";
  return <Badge className={tone}>{score}</Badge>;
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
  );
}

function DetailView({ job, onBack }: { job: ReviewJob | null; onBack: () => void }) {
  return (
    <div>
      <button
        onClick={onBack}
        className="print-hide mb-6 text-sm text-slate-400 hover:text-slate-200"
      >
        ← All reviews
      </button>

      {!job ? (
        <p className="text-slate-400">Loading…</p>
      ) : job.status === "failed" ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6">
          <p className="font-medium text-red-300">Review failed</p>
          <p className="mt-1 text-sm text-red-200/80">{job.error}</p>
        </div>
      ) : job.status !== "completed" || !job.result ? (
        <ProgressView job={job} />
      ) : (
        <div>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 truncate text-2xl font-semibold">{job.filename}</h1>
            {job.rep && (
              <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sm text-sky-300">
                {job.rep}
              </span>
            )}
            <button
              onClick={() => window.print()}
              className="print-hide ml-auto rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              🖨 Print / Save PDF
            </button>
          </div>
          <Report result={job.result} reviewId={job.id} />
        </div>
      )}
    </div>
  );
}

const STAGES = ["queued", "transcribing", "identifying_speakers", "analyzing"] as const;

function ProgressView({ job }: { job: ReviewJob }) {
  const current = STAGES.indexOf(job.status as (typeof STAGES)[number]);
  return (
    <div className="rounded-2xl bg-slate-800/60 p-8">
      <div className="mb-6 flex items-center gap-3">
        <Spinner />
        <span className="font-medium">{STATUS_LABELS[job.status]}</span>
      </div>
      <ol className="space-y-2">
        {STAGES.map((stage, i) => (
          <li key={stage} className="flex items-center gap-3 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                i < current ? "bg-emerald-400" : i === current ? "bg-amber-400" : "bg-slate-600"
              }`}
            />
            <span className={i <= current ? "text-slate-200" : "text-slate-500"}>
              {STATUS_LABELS[stage]}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-slate-500">
        Long calls can take a few minutes — transcription and review run in the background,
        you can leave this page and come back.
      </p>
    </div>
  );
}
