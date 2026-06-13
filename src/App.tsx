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
  // undefined = still checking session; null = not logged in
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
      <div className="flex min-h-full items-center justify-center bg-slate-900 text-slate-400">
        <Spinner />
      </div>
    );
  }

  if (role === null) {
    return <LoginScreen onLogin={setRole} />;
  }

  const isManager = role === "manager";
  const showingMine = !isManager || tab === "mine";

  return (
    <div className="min-h-full bg-slate-900 text-slate-100">
      <header className="print-hide border-b border-slate-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
          <button
            onClick={() => setSelectedId(null)}
            className="text-left text-xl font-semibold tracking-tight"
          >
            Call<span className="text-amber-400">Coach</span>
          </button>
          {isManager && !selectedId && (
            <nav className="flex gap-1 rounded-lg bg-slate-800 p-1 text-sm">
              <TabButton active={tab === "team"} onClick={() => setTab("team")}>
                Team Coaching
              </TabButton>
              <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
                My Coaching
              </TabButton>
            </nav>
          )}
          <div className="ml-auto flex items-center gap-4 text-sm text-slate-400">
            <span>{isManager ? "Sales head" : "Salesperson"}</span>
            <button onClick={() => void handleLogout()} className="hover:text-slate-200">
              Log out
            </button>
          </div>
        </div>
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 transition-colors ${
        active ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
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
    <div className="flex min-h-full items-center justify-center bg-slate-900 px-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold text-slate-100">
          Call<span className="text-amber-400">Coach</span>
        </h1>
        <p className="mt-2 mb-6 text-center text-sm text-slate-400">
          Enter your team password to continue.
        </p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder:text-slate-500"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-4 w-full rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Log in"}
        </button>
      </form>
    </div>
  );
}

// --- Name gate (which salesperson am I?) ------------------------------------

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
      <h1 className="mb-1 text-2xl font-semibold">Who are you?</h1>
      <p className="mb-5 text-slate-400">
        Pick your name so your calls and coaching show up here. This is remembered on this device.
      </p>
      {known.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {known.map((n) => (
            <button
              key={n}
              onClick={() => onChoose(n)}
              className="rounded-full bg-slate-800 px-4 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
            >
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
        className="flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Type your name"
          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50"
        >
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
          <h1 className="text-2xl font-semibold">Hi {myName} 👋</h1>
          <button onClick={onChangeName} className="text-xs text-slate-500 hover:text-slate-300">
            (not you?)
          </button>
        </div>
        <p className="text-slate-400">Your coaching dashboard — upload a call and see how you did.</p>
      </section>

      {stats && (
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-800/60 p-4">
            <div className="text-3xl font-bold text-slate-100">{stats.avgScore.toFixed(1)}</div>
            <div className="text-xs text-slate-400">average / 10 over {stats.calls} call{stats.calls === 1 ? "" : "s"}</div>
          </div>
          {stats.calls > 1 && (
            <div className="rounded-xl bg-slate-800/60 p-4">
              <div
                className={`text-3xl font-bold ${
                  stats.lastScore - stats.avgScore > 0.2
                    ? "text-emerald-400"
                    : stats.lastScore - stats.avgScore < -0.2
                      ? "text-red-400"
                      : "text-slate-100"
                }`}
              >
                {stats.lastScore}
              </div>
              <div className="text-xs text-slate-400">your latest call</div>
            </div>
          )}
          {stats.weakest && (
            <div className="rounded-xl bg-amber-400/10 p-4">
              <div className="text-sm font-semibold text-amber-300">Focus this week</div>
              <div className="mt-1 text-sm text-slate-200">{stats.weakest.name}</div>
              <div className="text-xs text-slate-400">your lowest skill (avg {stats.weakest.avg.toFixed(1)}/5)</div>
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
        <h1 className="mb-1 text-2xl font-semibold">Team coaching</h1>
        <p className="text-slate-400">
          {queue.length > 0
            ? `${queue.length} call${queue.length === 1 ? "" : "s"} waiting for your review.`
            : "All caught up — no calls waiting for coaching."}
        </p>
      </section>

      {queue.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Coaching queue</h2>
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
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
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
    return <p className="text-sm text-slate-500">No calls here yet.</p>;
  }
  return (
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
                <span className="truncate font-medium">{r.client ?? r.filename}</span>
                {showRep && r.rep && (
                  <span className="shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">
                    {r.rep}
                  </span>
                )}
                {r.status === "completed" &&
                  (r.coachReviewed ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                      Coached ✓
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-amber-400/40 px-2 py-0.5 text-xs text-amber-300">
                      Awaiting coach
                    </span>
                  ))}
              </div>
              <div className="truncate text-sm text-slate-400">
                {r.status === "failed" ? r.error : (r.summary ?? STATUS_LABELS[r.status])}
              </div>
            </div>
            <span className="shrink-0 text-xs text-slate-500">
              {new Date(r.createdAt).toLocaleString()}
            </span>
          </button>
        </li>
      ))}
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await saveCoachFeedback(job.id, notes, reviewed);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const saved = job.coach;

  // Reps with no feedback yet see nothing (keeps their page clean).
  if (!canEdit && !saved?.notes) return null;

  return (
    <section className="mb-8 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-100">Coach's notes</h2>
        {saved?.reviewed && (
          <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
            Reviewed with rep ✓
          </span>
        )}
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="print-hide ml-auto rounded-lg border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
          >
            {saved?.notes ? "Edit" : "Add notes"}
          </button>
        )}
      </div>

      {!editing ? (
        saved?.notes ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">{saved.notes}</p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No coach feedback yet — add commendations and corrections here after reading the report.
          </p>
        )
      ) : (
        <div className="print-hide mt-3 space-y-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="What this rep should keep doing, stop doing, and try on the next call…"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
                className="h-4 w-4"
              />
              Reviewed with the salesperson
            </label>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => void save()}
                disabled={saving}
                className="rounded-lg bg-sky-500/80 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}
    </section>
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
      <button
        onClick={onBack}
        className="print-hide mb-6 text-sm text-slate-400 hover:text-slate-200"
      >
        ← Back
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
            <h1 className="min-w-0 truncate text-2xl font-semibold">
              {job.client ?? job.filename}
            </h1>
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
          <CoachPanel job={job} canEdit={canCoach} onUpdated={onUpdated} />
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
        Long calls can take a few minutes — transcription and review run in the background, you can
        leave this page and come back.
      </p>
    </div>
  );
}
