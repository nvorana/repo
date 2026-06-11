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
      <header className="border-b border-slate-800">
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
                    <div className="truncate font-medium">{r.filename}</div>
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
      <button onClick={onBack} className="mb-6 text-sm text-slate-400 hover:text-slate-200">
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
          <h1 className="mb-6 truncate text-2xl font-semibold">{job.filename}</h1>
          <Report result={job.result} />
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
