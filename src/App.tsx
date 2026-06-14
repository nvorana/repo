import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  getReview,
  getSession,
  isInProgress,
  listReviews,
  login,
  logout,
  saveCoachFeedback,
  STATUS_LABELS,
  type ReviewJob,
  type ReviewSummary,
  type Role,
} from "./api.ts";
import { UploadCard } from "./components/UploadCard.tsx";
import { Report } from "./components/Report.tsx";

const POLL_MS = 4000;
const NAME_KEY = "callcoach.rep";

export default function App() {
  const [role, setRole] = useState<Role | null | undefined>(undefined);
  const [tab, setTab] = useState<"team" | "mine">("team");
  const [myName, setMyName] = useState<string>(() => localStorage.getItem(NAME_KEY) ?? "");

  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReviewJob | null>(null);

  useEffect(() => {
    getSession()
      .then(setRole)
      .catch(() => setRole(null));
  }, []);

  const refreshList = useCallback(() => {
    listReviews().then(setReviews).catch(console.error);
  }, []);

  useEffect(() => {
    if (role) refreshList();
  }, [role, refreshList]);

  useEffect(() => {
    if (!reviews.some((r) => isInProgress(r.status))) return;
    const t = setInterval(refreshList, POLL_MS);
    return () => clearInterval(t);
  }, [reviews, refreshList]);

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

  function chooseName(name: string) {
    localStorage.setItem(NAME_KEY, name);
    setMyName(name);
  }

  async function handleLogout() {
    await logout();
    setRole(null);
    setSelectedId(null);
    setReviews([]);
  }

  if (role === undefined) {
    return (
      <div className="flex min-h-full items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (role === null) {
    return <LoginScreen onLogin={setRole} />;
  }

  const isManager = role === "manager";
  const showingMine = !isManager || tab === "mine";

  return (
    <div className="min-h-full bg-base-100 text-base-content">
      <header className="print-hide border-b border-base-300 bg-base-200/40">
        <div className="navbar mx-auto max-w-5xl px-6">
          <div className="flex-1">
            <button
              onClick={() => setSelectedId(null)}
              className="text-xl font-bold tracking-tight"
            >
              SalesCall<span className="text-primary">OS</span>
            </button>
            {isManager && !selectedId && (
              <div role="tablist" className="tabs tabs-box ml-6 hidden sm:flex">
                <button
                  role="tab"
                  className={`tab ${tab === "team" ? "tab-active" : ""}`}
                  onClick={() => setTab("team")}
                >
                  Team Coaching
                </button>
                <button
                  role="tab"
                  className={`tab ${tab === "mine" ? "tab-active" : ""}`}
                  onClick={() => setTab("mine")}
                >
                  My Coaching
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-ghost badge-sm">
              {isManager ? "Sales head" : "Salesperson"}
            </span>
            <button onClick={() => void handleLogout()} className="btn btn-ghost btn-sm">
              Log out
            </button>
          </div>
        </div>
        {isManager && !selectedId && (
          <div role="tablist" className="tabs tabs-box mx-auto mb-2 max-w-5xl px-6 sm:hidden">
            <button
              role="tab"
              className={`tab flex-1 ${tab === "team" ? "tab-active" : ""}`}
              onClick={() => setTab("team")}
            >
              Team
            </button>
            <button
              role="tab"
              className={`tab flex-1 ${tab === "mine" ? "tab-active" : ""}`}
              onClick={() => setTab("mine")}
            >
              My Coaching
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {selectedId ? (
          <DetailView
            job={selected?.id === selectedId ? selected : null}
            canCoach={isManager}
            onUpdated={setSelected}
            onBack={() => {
              setSelectedId(null);
              refreshList();
            }}
          />
        ) : showingMine ? (
          myName ? (
            <RepHome
              reviews={reviews}
              myName={myName}
              onChangeName={() => chooseName("")}
              onUploaded={(id) => {
                refreshList();
                setSelectedId(id);
              }}
              onSelect={setSelectedId}
            />
          ) : (
            <NameGate reviews={reviews} onChoose={chooseName} />
          )
        ) : (
          <ManagerHome reviews={reviews} onSelect={setSelectedId} />
        )}
      </main>
    </div>
  );
}

// --- Login ------------------------------------------------------------------

function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLogin(await login(password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-base-100 px-6">
      <div className="card w-full max-w-sm bg-base-200 shadow-xl">
        <form onSubmit={submit} className="card-body">
          <h1 className="text-center text-2xl font-bold">
            SalesCall<span className="text-primary">OS</span>
          </h1>
          <p className="mb-2 text-center text-sm opacity-60">
            Enter your team password to continue.
          </p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="input input-bordered w-full"
          />
          {error && (
            <div className="alert alert-error py-2 text-sm">
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={busy || !password}
            className="btn btn-primary mt-2 w-full"
          >
            {busy ? <span className="loading loading-spinner loading-sm" /> : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- Name gate --------------------------------------------------------------

function NameGate({
  reviews,
  onChoose,
}: {
  reviews: ReviewSummary[];
  onChoose: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const known = [...new Set(reviews.map((r) => r.rep).filter((r): r is string => Boolean(r)))].sort();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold">Who are you?</h1>
      <p className="mb-5 opacity-60">
        Pick your name so your calls and coaching show up here. This is remembered on this device.
      </p>
      {known.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {known.map((n) => (
            <button key={n} onClick={() => onChoose(n)} className="btn btn-outline btn-sm">
              {n}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onChoose(name.trim());
        }}
        className="join w-full"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Type your name"
          className="input input-bordered join-item flex-1"
        />
        <button type="submit" disabled={!name.trim()} className="btn btn-primary join-item">
          Continue
        </button>
      </form>
    </div>
  );
}

// --- Rep hero: "My Coaching" ------------------------------------------------

function RepHome({
  reviews,
  myName,
  onChangeName,
  onUploaded,
  onSelect,
}: {
  reviews: ReviewSummary[];
  myName: string;
  onChangeName: () => void;
  onUploaded: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const mine = reviews.filter((r) => r.rep === myName);
  const stats = computeRepStats(mine).find((s) => s.rep === myName);

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-1 flex items-center gap-3">
          <h1 className="text-2xl font-bold">Hi {myName} 👋</h1>
          <button onClick={onChangeName} className="link link-hover text-xs opacity-60">
            (not you?)
          </button>
        </div>
        <p className="opacity-60">Your coaching dashboard — upload a call and see how you did.</p>
      </section>

      {stats && (
        <section className="stats stats-vertical w-full bg-base-200 shadow sm:stats-horizontal">
          <div className="stat">
            <div className="stat-title">Average score</div>
            <div className="stat-value text-primary">{stats.avgScore.toFixed(1)}</div>
            <div className="stat-desc">
              over {stats.calls} call{stats.calls === 1 ? "" : "s"}
            </div>
          </div>
          {stats.calls > 1 && (
            <div className="stat">
              <div className="stat-title">Latest call</div>
              <div
                className={`stat-value ${
                  stats.lastScore - stats.avgScore > 0.2
                    ? "text-success"
                    : stats.lastScore - stats.avgScore < -0.2
                      ? "text-error"
                      : ""
                }`}
              >
                {stats.lastScore}
              </div>
              <div className="stat-desc">
                {stats.lastScore - stats.avgScore > 0.2
                  ? "↑ above your average"
                  : stats.lastScore - stats.avgScore < -0.2
                    ? "↓ below your average"
                    : "→ around your average"}
              </div>
            </div>
          )}
          {stats.weakest && (
            <div className="stat">
              <div className="stat-title text-warning">Focus this week</div>
              <div className="stat-value text-base">{stats.weakest.name}</div>
              <div className="stat-desc">lowest skill — avg {stats.weakest.avg.toFixed(1)}/5</div>
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Upload a call</h2>
        <UploadCard onUploaded={onUploaded} fixedRep={myName} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your calls</h2>
        <ReviewList reviews={mine} onSelect={onSelect} showRep={false} />
      </section>
    </div>
  );
}

// --- Manager hero: "Team Coaching" ------------------------------------------

function ManagerHome({
  reviews,
  onSelect,
}: {
  reviews: ReviewSummary[];
  onSelect: (id: string) => void;
}) {
  const queue = reviews.filter((r) => r.status === "completed" && !r.coachReviewed);
  const [repFilter, setRepFilter] = useState<string>("");
  const reps = [...new Set(reviews.map((r) => r.rep).filter((r): r is string => Boolean(r)))].sort();
  const visible = repFilter ? reviews.filter((r) => r.rep === repFilter) : reviews;

  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-1 text-2xl font-bold">Team coaching</h1>
        <p className="opacity-60">
          {queue.length > 0
            ? `${queue.length} call${queue.length === 1 ? "" : "s"} waiting for your review.`
            : "All caught up — no calls waiting for coaching."}
        </p>
      </section>

      {queue.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            Coaching queue
            <span className="badge badge-warning badge-sm">{queue.length}</span>
          </h2>
          <ReviewList reviews={queue} onSelect={onSelect} showRep />
        </section>
      )}

      <RepDashboard reviews={reviews} />

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">All reviews</h2>
          {reps.length > 0 && (
            <select
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
              className="select select-bordered select-sm"
            >
              <option value="">All salespeople</option>
              {reps.map((rep) => (
                <option key={rep} value={rep}>
                  {rep}
                </option>
              ))}
            </select>
          )}
        </div>
        <ReviewList reviews={visible} onSelect={onSelect} showRep />
      </section>
    </div>
  );
}

// --- Shared list ------------------------------------------------------------

function ReviewList({
  reviews,
  onSelect,
  showRep,
}: {
  reviews: ReviewSummary[];
  onSelect: (id: string) => void;
  showRep: boolean;
}) {
  if (reviews.length === 0) {
    return <p className="text-sm opacity-50">No calls here yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {reviews.map((r) => {
        const pending = r.status === "completed" && r.overallScore == null && r.released === false;
        return (
          <li key={r.id}>
            <button
              onClick={() => onSelect(r.id)}
              className="flex w-full items-center gap-4 rounded-box bg-base-200 p-4 text-left transition-colors hover:bg-base-300"
            >
              {pending ? (
                <ScoreCircle className="bg-base-300 text-base-content/50">🔒</ScoreCircle>
              ) : (
                <ScoreBadge status={r.status} score={r.overallScore} />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{r.client ?? r.filename}</span>
                  {showRep && r.rep && <span className="badge badge-info badge-sm">{r.rep}</span>}
                  {r.status === "completed" &&
                    (pending ? (
                      <span className="badge badge-ghost badge-sm">Pending your coach</span>
                    ) : r.coachReviewed ? (
                      <span className="badge badge-success badge-sm">Coached ✓</span>
                    ) : (
                      <span className="badge badge-warning badge-outline badge-sm">
                        Awaiting coach
                      </span>
                    ))}
                </div>
                <div className="truncate text-sm opacity-60">
                  {r.status === "failed"
                    ? r.error
                    : pending
                      ? "Your coach will go over this with you, then release it here."
                      : (r.summary ?? STATUS_LABELS[r.status])}
                </div>
              </div>
              <span className="shrink-0 text-xs opacity-50">
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// --- Rep stats --------------------------------------------------------------

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
      <p className="mb-3 text-sm opacity-60">
        Where each rep stands across their reviewed calls — and the single skill to coach next.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => {
          const trend = s.lastScore - s.avgScore;
          return (
            <div key={s.rep} className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{s.rep}</span>
                  <span className="text-xs opacity-50">
                    {s.calls} call{s.calls === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-bold">{s.avgScore.toFixed(1)}</span>
                  <span className="pb-1 text-xs opacity-60">avg / 10</span>
                  {s.calls > 1 && (
                    <span
                      className={`pb-1 text-xs ${
                        trend > 0.2 ? "text-success" : trend < -0.2 ? "text-error" : "opacity-50"
                      }`}
                    >
                      {trend > 0.2 ? "↑ improving" : trend < -0.2 ? "↓ slipping" : "→ steady"}
                    </span>
                  )}
                </div>
                {s.weakest && (
                  <div className="mt-1 rounded-box bg-base-300/60 p-2.5 text-xs">
                    <span className="font-semibold text-warning">Coach next: </span>
                    {s.weakest.name} (avg {s.weakest.avg.toFixed(1)}/5)
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScoreCircle({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold ${className}`}
    >
      {children}
    </span>
  );
}

function ScoreBadge({ status, score }: { status: ReviewSummary["status"]; score?: number }) {
  if (status === "failed") {
    return <ScoreCircle className="bg-error/20 text-error">✕</ScoreCircle>;
  }
  if (score == null) {
    return (
      <ScoreCircle className="bg-base-300 text-base-content/60">
        <span className="loading loading-spinner loading-sm" />
      </ScoreCircle>
    );
  }
  const tone =
    score >= 7 ? "bg-success/20 text-success" : score >= 4 ? "bg-warning/20 text-warning" : "bg-error/20 text-error";
  return <ScoreCircle className={tone}>{score}</ScoreCircle>;
}

// --- Coach panel ------------------------------------------------------------

function CoachPanel({
  job,
  canEdit,
  onUpdated,
}: {
  job: ReviewJob;
  canEdit: boolean;
  onUpdated: (job: ReviewJob) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(job.coach?.notes ?? "");
  const [reviewed, setReviewed] = useState(job.coach?.reviewed ?? false);
  const [released, setReleased] = useState(job.coach?.released ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await saveCoachFeedback(job.id, notes, reviewed, released);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const saved = job.coach;
  if (!canEdit && !saved?.notes) return null;

  return (
    <div className="card mb-8 border border-info/30 bg-info/5">
      <div className="card-body p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Coach's notes</h2>
          {saved?.released ? (
            <span className="badge badge-success badge-sm">Released to rep ✓</span>
          ) : (
            canEdit && <span className="badge badge-warning badge-outline badge-sm">Not released yet</span>
          )}
          {saved?.reviewed && <span className="badge badge-ghost badge-sm">Discussed with rep ✓</span>}
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} className="print-hide btn btn-outline btn-sm ml-auto">
              {saved?.notes || saved?.released ? "Edit" : "Add notes"}
            </button>
          )}
        </div>

        {!editing ? (
          saved?.notes ? (
            <p className="whitespace-pre-wrap text-sm">{saved.notes}</p>
          ) : (
            <p className="text-sm opacity-50">
              No coach feedback yet — add commendations and corrections here after reading the
              report.
            </p>
          )
        ) : (
          <div className="print-hide space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="What this rep should keep doing, stop doing, and try on the next call…"
              className="textarea textarea-bordered w-full"
            />
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                  className="checkbox checkbox-sm"
                />
                I've discussed this call with the salesperson (1:1 done)
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={released}
                  onChange={(e) => setReleased(e.target.checked)}
                  className="checkbox checkbox-sm mt-0.5"
                />
                <span>
                  Release the report so the salesperson can see it
                  <span className="block text-xs opacity-50">
                    Until you tick this, the rep can't see their score or report — only that it's
                    awaiting your review.
                  </span>
                </span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button onClick={() => void save()} disabled={saving} className="btn btn-primary btn-sm">
                {saving ? <span className="loading loading-spinner loading-sm" /> : "Save"}
              </button>
            </div>
            {error && (
              <div className="alert alert-error py-2 text-sm">
                <span>{error}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Detail view ------------------------------------------------------------

function DetailView({
  job,
  canCoach,
  onBack,
  onUpdated,
}: {
  job: ReviewJob | null;
  canCoach: boolean;
  onBack: () => void;
  onUpdated: (job: ReviewJob) => void;
}) {
  return (
    <div>
      <button onClick={onBack} className="print-hide btn btn-ghost btn-sm mb-6">
        ← Back
      </button>

      {!job ? (
        <span className="loading loading-spinner text-primary" />
      ) : job.status === "failed" ? (
        <div className="alert alert-error">
          <div>
            <p className="font-medium">Review failed</p>
            <p className="text-sm opacity-80">{job.error}</p>
          </div>
        </div>
      ) : job.status === "completed" && !job.result && !canCoach ? (
        <PendingReleaseView client={job.client} />
      ) : job.status !== "completed" || !job.result ? (
        <ProgressView job={job} />
      ) : (
        <div>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 truncate text-2xl font-bold">{job.client ?? job.filename}</h1>
            {job.rep && <span className="badge badge-info">{job.rep}</span>}
            <button onClick={() => window.print()} className="print-hide btn btn-outline btn-sm ml-auto">
              🖨 Print / Save PDF
            </button>
          </div>
          <CoachPanel job={job} canEdit={canCoach} onUpdated={onUpdated} />
          <Report result={job.result} reviewId={job.id} />
        </div>
      )}
    </div>
  );
}

function PendingReleaseView({ client }: { client?: string }) {
  return (
    <div className="card bg-base-200">
      <div className="card-body items-center py-12 text-center">
        <div className="text-5xl">🔒</div>
        <h2 className="mt-2 text-lg font-semibold">
          Your coach is reviewing this call{client ? ` with ${client}` : ""}
        </h2>
        <p className="max-w-md text-sm opacity-60">
          The AI review is done, but your sales head goes over it with you first. You'll see the full
          report and feedback here right after your 1:1.
        </p>
      </div>
    </div>
  );
}

const STAGES = ["queued", "transcribing", "identifying_speakers", "analyzing"] as const;

function ProgressView({ job }: { job: ReviewJob }) {
  const current = STAGES.indexOf(job.status as (typeof STAGES)[number]);
  return (
    <div className="card bg-base-200">
      <div className="card-body">
        <div className="mb-4 flex items-center gap-3">
          <span className="loading loading-spinner text-primary" />
          <span className="font-medium">{STATUS_LABELS[job.status]}</span>
        </div>
        <ul className="steps steps-vertical">
          {STAGES.map((stage, i) => (
            <li key={stage} className={`step ${i <= current ? "step-primary" : ""}`}>
              {STATUS_LABELS[stage]}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm opacity-50">
          Long calls can take a few minutes — transcription and review run in the background, you can
          leave this page and come back.
        </p>
      </div>
    </div>
  );
}
