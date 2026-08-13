import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  getReview,
  getSession,
  isInProgress,
  listReviews,
  login,
  logout,
  reanalyzeMine,
  reanalyzeReview,
  saveCoachFeedback,
  deleteReview,
  forgotPassword,
  passwordResetAvailable,
  resetPassword,
  audioUrl,
  STATUS_LABELS,
  type ReviewJob,
  type ReviewSummary,
  type Session,
} from "./api.ts";
import { countsTowardTrends } from "./lib/eligibility.ts";
import { UploadCard } from "./components/UploadCard.tsx";
import { Report } from "./components/Report.tsx";
import { LessonsPanel } from "./components/Lessons.tsx";
import { UsersAdmin } from "./components/UsersAdmin.tsx";
import { Reports } from "./components/Reports.tsx";
import { ChatBubble } from "./components/ChatBubble.tsx";
import { SupportInbox } from "./components/SupportInbox.tsx";
import { TeamCoachingHome } from "./components/TeamCoachingHome.tsx";
import { RepProgress } from "./components/RepProgress.tsx";

const POLL_MS = 4000;
type ManagerTab = "team" | "mine" | "reports" | "people";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // Read once on mount: the reset token lives in the URL the email linked to.
  const [resetToken, setResetToken] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("reset"),
  );
  const [tab, setTab] = useState<ManagerTab>("team");

  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReviewJob | null>(null);
  // Bumping this restarts the detail fetch/poll loop below — used after actions
  // (like re-analysis) that change a job's status once its poll has stopped.
  const [detailRefresh, setDetailRefresh] = useState(0);

  useEffect(() => {
    getSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  // Re-verify the session when the page is restored from the browser's
  // back/forward cache, so logging out can't be "undone" with the Back button.
  useEffect(() => {
    const recheck = () => getSession().then(setSession).catch(() => setSession(null));
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void recheck();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const refreshList = useCallback(() => {
    listReviews().then(setReviews).catch(console.error);
  }, []);

  useEffect(() => {
    if (session) refreshList();
  }, [session, refreshList]);

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
  }, [selectedId, detailRefresh]);

  async function handleLogout() {
    await logout();
    setSession(null);
    setSelectedId(null);
    setReviews([]);
  }

  if (session === undefined) {
    return (
      <div className="flex min-h-full items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  // Arriving from a reset email (/?reset=<token>) takes priority over the login
  // form — the user has a link in hand and no working password to type.
  if (resetToken) {
    return (
      <ResetPasswordScreen
        token={resetToken}
        onLogin={setSession}
        onDone={() => {
          // Drop the token from the URL so a refresh can't replay a spent link.
          window.history.replaceState(null, "", window.location.pathname);
          setResetToken(null);
        }}
      />
    );
  }

  if (session === null) {
    return <LoginScreen onLogin={setSession} />;
  }

  const isManager = session.role === "manager";
  const showingMine = !isManager || tab === "mine";
  // The owner's own calls are personal — keep them out of the owner's team views.
  // Everyone else (reps AND other managers, e.g. Mike) reports to the team as normal.
  const teamReviews = session.personal
    ? reviews.filter((r) => r.repId !== session.id)
    : reviews;

  const managerTabs: { id: ManagerTab; label: string; short: string }[] = [
    { id: "team", label: "Team Coaching", short: "Team" },
    { id: "mine", label: "My Coaching", short: "Mine" },
    { id: "reports", label: "Reports", short: "Reports" },
    { id: "people", label: "People", short: "People" },
  ];

  return (
    <div className="min-h-full bg-base-100 text-base-content">
      <header className="print-hide border-b border-base-300 bg-base-200/40">
        <div className="navbar mx-auto max-w-5xl px-6">
          <div className="flex-1 items-center">
            <button onClick={() => setSelectedId(null)} className="text-xl font-bold tracking-tight">
              SalesCall<span className="text-primary">OS</span>
            </button>
            {isManager && !selectedId && (
              <div role="tablist" className="tabs tabs-box ml-6 hidden sm:flex">
                {managerTabs.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    className={`tab ${tab === t.id ? "tab-active" : ""}`}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm opacity-70 sm:inline">{session.name}</span>
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
            {managerTabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                className={`tab flex-1 ${tab === t.id ? "tab-active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.short}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {selectedId ? (
          <DetailView
            job={selected?.id === selectedId ? selected : null}
            canCoach={isManager}
            onUpdated={setSelected}
            refresh={() => setDetailRefresh((n) => n + 1)}
            onBack={() => {
              setSelectedId(null);
              refreshList();
            }}
          />
        ) : isManager && tab === "reports" ? (
          <Reports reviews={teamReviews} />
        ) : isManager && tab === "people" ? (
          <UsersAdmin />
        ) : showingMine ? (
          <RepHome
            reviews={reviews}
            myName={session.name}
            myId={session.id}
            canReanalyze={isManager}
            onReanalyzeQueued={refreshList}
            onUploaded={(id) => {
              refreshList();
              setSelectedId(id);
            }}
            onSelect={setSelectedId}
          />
        ) : (
          <ManagerHome reviews={teamReviews} onSelect={setSelectedId} />
        )}
      </main>
      <ChatBubble />
    </div>
  );
}

// --- Login ------------------------------------------------------------------

function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-base-100 px-6">
      <div className="card w-full max-w-sm bg-base-200 shadow-xl">
        <div className="card-body">
          <h1 className="text-center text-2xl font-bold">
            SalesCall<span className="text-primary">OS</span>
          </h1>
          {children}
        </div>
      </div>
    </div>
  );
}

const MIN_PASSWORD = 8;

/** Shown when the user arrives from a reset email (?reset=<token>). */
function ResetPasswordScreen({
  token,
  onLogin,
  onDone,
}: {
  token: string;
  onLogin: (s: Session) => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && password !== confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await resetPassword(token, password);
      onDone(); // strip ?reset= so a refresh doesn't retry a spent token
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard>
      <p className="mb-2 text-center text-sm opacity-60">Choose a new password.</p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`New password (min ${MIN_PASSWORD} characters)`}
          className="input input-bordered w-full"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className="input input-bordered w-full"
        />
        {(tooShort || mismatch || error) && (
          <div className="alert alert-error py-2 text-sm">
            <span>
              {error ??
                (tooShort ? `Use at least ${MIN_PASSWORD} characters.` : "Passwords don't match.")}
            </span>
          </div>
        )}
        <button
          type="submit"
          disabled={busy || password.length < MIN_PASSWORD || password !== confirm}
          className="btn btn-primary w-full"
        >
          {busy ? <span className="loading loading-spinner loading-sm" /> : "Set password and log in"}
        </button>
        <button type="button" onClick={onDone} className="btn btn-ghost btn-sm w-full">
          Back to log in
        </button>
      </form>
    </AuthCard>
  );
}

function LoginScreen({ onLogin }: { onLogin: (s: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [canReset, setCanReset] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    void passwordResetAvailable().then(setCanReset);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLogin(await login(email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset email");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "forgot") {
    return (
      <AuthCard>
        {sent ? (
          <>
            {/* Worded so it reveals nothing about whether the account exists. */}
            <div className="alert alert-success py-2 text-sm">
              <span>
                If an account exists for <strong>{email}</strong>, a reset link is on its way. It
                works once and expires in an hour.
              </span>
            </div>
            <p className="mt-2 text-center text-xs opacity-60">
              Nothing after a few minutes? Check spam, or ask Mike to reset it for you.
            </p>
            <button
              onClick={() => {
                setMode("login");
                setSent(false);
              }}
              className="btn btn-ghost btn-sm mt-2 w-full"
            >
              Back to log in
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 text-center text-sm opacity-60">
              Enter your email and we'll send a reset link.
            </p>
            <form onSubmit={submitForgot} className="space-y-3">
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="input input-bordered w-full"
              />
              {error && (
                <div className="alert alert-error py-2 text-sm">
                  <span>{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={busy || !email}
                className="btn btn-primary w-full"
              >
                {busy ? <span className="loading loading-spinner loading-sm" /> : "Send reset link"}
              </button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="btn btn-ghost btn-sm w-full"
              >
                Back to log in
              </button>
            </form>
          </>
        )}
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <p className="mb-2 text-center text-sm opacity-60">Log in to continue.</p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="input input-bordered w-full"
        />
        <input
          type="password"
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
          disabled={busy || !email || !password}
          className="btn btn-primary w-full"
        >
          {busy ? <span className="loading loading-spinner loading-sm" /> : "Log in"}
        </button>
      </form>
      {canReset && (
        <button
          onClick={() => {
            setMode("forgot");
            setError(null);
          }}
          className="btn btn-link btn-sm mt-1 w-full no-underline opacity-70"
        >
          Forgot password?
        </button>
      )}
    </AuthCard>
  );
}

// --- Rep hero: "My Coaching" ------------------------------------------------

function ReanalyzeAllButton({
  count,
  onQueued,
}: {
  count: number;
  /** Called once the jobs are queued, so the caller can refetch the list. */
  onQueued?: () => void;
}) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [queued, setQueued] = useState(0);
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2">
      {state === "done" && (
        <span className="text-xs opacity-60">
          Queued {queued} call{queued === 1 ? "" : "s"} — reports refresh as each finishes.
        </span>
      )}
      {state === "error" && <span className="text-xs text-error">Couldn&apos;t queue — try again.</span>}
      <button
        className="btn btn-outline btn-sm"
        disabled={state === "working" || state === "done"}
        onClick={() => {
          setState("working");
          reanalyzeMine()
            .then((r) => {
              setQueued(r.queued);
              setState("done");
              onQueued?.();
            })
            .catch(() => setState("error"));
        }}
        title="Re-run the AI analysis on all your completed calls with the current scoring engine"
      >
        ↻ Re-analyze all my calls ({count})
      </button>
    </div>
  );
}

function RepHome({
  reviews,
  myName,
  myId,
  onUploaded,
  onSelect,
  canReanalyze = false,
  onReanalyzeQueued,
}: {
  reviews: ReviewSummary[];
  myName: string;
  myId: string;
  onUploaded: (id: string) => void;
  onSelect: (id: string) => void;
  /** Managers get the bulk re-analyze button on their own calls. */
  canReanalyze?: boolean;
  /** Called after bulk re-analysis is queued, so the list refetch/poll kicks in. */
  onReanalyzeQueued?: () => void;
}) {
  const mine = reviews.filter((r) => (r.repId ? r.repId === myId : r.rep === myName));
  const stats = computeRepStats(mine)[0];

  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-1 text-2xl font-bold">Hi {myName} 👋</h1>
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
        </section>
      )}

      {/* Trend-first: what to change before the next call, derived across
          recent calls. Replaces the old "lowest skill average" stat — two
          different answers to "what should I focus on" would contradict. */}
      <RepProgress reviews={reviews} rep={{ id: myId, name: myName }} />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Upload a call</h2>
        <UploadCard onUploaded={onUploaded} fixedRep={myName} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Your calls</h2>
          {canReanalyze && (
            <ReanalyzeAllButton
              count={mine.filter((r) => r.status === "completed").length}
              onQueued={onReanalyzeQueued}
            />
          )}
        </div>
        <ReviewBrowser reviews={mine} onSelect={onSelect} showRep={false} statusFilter />
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
  const reps = [...new Set(reviews.map((r) => r.rep).filter((r): r is string => Boolean(r)))].sort();

  // One person filter for the whole page — narrows BOTH lists below at once.
  const [repFilter, setRepFilter] = useState("");
  const byRep = (list: ReviewSummary[]) =>
    repFilter ? list.filter((r) => r.rep === repFilter) : list;
  const shownQueue = byRep(queue);
  const shownReviews = byRep(reviews);

  return (
    <div className="space-y-6">
      <SupportInbox />
      <LessonsPanel />

      <TeamCoachingHome
        reviews={reviews}
        onSelect={onSelect}
        onJumpToQueue={() => document.getElementById("coach-queue")?.scrollIntoView({ behavior: "smooth" })}
      />

      {reps.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium opacity-70">Show calls for:</span>
          <select
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value)}
            className="select select-bordered select-sm"
          >
            <option value="">Everyone</option>
            {reps.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {repFilter && (
            <button className="btn btn-ghost btn-xs" onClick={() => setRepFilter("")}>
              Clear
            </button>
          )}
        </div>
      )}

      {shownQueue.length > 0 && (
        <div id="coach-queue" className="collapse-arrow collapse rounded-box border border-base-300 bg-base-100">
          <input type="checkbox" />
          <div className="collapse-title font-semibold">
            Needs your coaching <span className="badge badge-warning badge-sm">{shownQueue.length}</span>
          </div>
          <div className="collapse-content">
            <ReviewBrowser reviews={shownQueue} onSelect={onSelect} showRep />
          </div>
        </div>
      )}

      <div className="collapse-arrow collapse rounded-box border border-base-300 bg-base-100">
        <input type="checkbox" />
        <div className="collapse-title font-semibold">
          All reviews <span className="opacity-50">({shownReviews.length})</span>
        </div>
        <div className="collapse-content">
          <ReviewBrowser reviews={shownReviews} onSelect={onSelect} showRep statusFilter />
        </div>
      </div>
    </div>
  );
}

// --- Shared list ------------------------------------------------------------

function ReviewRow({
  r,
  onSelect,
  showRep,
}: {
  r: ReviewSummary;
  onSelect: (id: string) => void;
  showRep: boolean;
}) {
  const pending = r.status === "completed" && r.overallScore == null && r.released === false;
  return (
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
              <span className="badge badge-warning badge-outline badge-sm">Awaiting coach</span>
            ))}
          {r.status === "completed" && r.mixedAudio && (
            <span
              className="badge badge-ghost badge-sm"
              title="Analyzed from one mixed recording — speaker attribution may be inaccurate; excluded from trends"
            >
              Mixed audio
            </span>
          )}
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
        {new Date(r.callDate ?? r.createdAt).toLocaleDateString()}
      </span>
    </button>
  );
}

function dateBucket(iso: string): { order: number; label: string } {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return { order: 0, label: "Today" };
  if (days === 1) return { order: 1, label: "Yesterday" };
  if (days < 7) return { order: 2, label: "Earlier this week" };
  if (days < 31) return { order: 3, label: "Earlier this month" };
  return { order: 4, label: "Older" };
}

const PAGE = 15;

function ReviewBrowser({
  reviews,
  onSelect,
  showRep,
  reps,
  statusFilter = false,
}: {
  reviews: ReviewSummary[];
  onSelect: (id: string) => void;
  showRep: boolean;
  /** When provided, shows a per-salesperson dropdown (manager view). */
  reps?: string[];
  statusFilter?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "awaiting" | "coached">("all");
  const [repFilter, setRepFilter] = useState("");
  const [limit, setLimit] = useState(PAGE);

  function reset() {
    setLimit(PAGE);
  }

  let filtered = reviews;
  if (repFilter) filtered = filtered.filter((r) => r.rep === repFilter);
  if (statusFilter && status !== "all") {
    filtered = filtered.filter((r) =>
      status === "coached"
        ? r.coachReviewed
        : r.status === "completed" && !r.coachReviewed,
    );
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((r) => (r.client ?? r.filename).toLowerCase().includes(q));
  }

  const shown = filtered.slice(0, limit);
  // shown is already newest-first; bucket into date groups in that order.
  const groups: { label: string; items: ReviewSummary[] }[] = [];
  for (const r of shown) {
    const { label } = dateBucket(r.callDate ?? r.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(r);
    else groups.push({ label, items: [r] });
  }

  const hasControls = Boolean(reps?.length) || statusFilter || reviews.length > 6;

  return (
    <div>
      {hasControls && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reset();
            }}
            placeholder="Search client…"
            className="input input-bordered input-sm w-48"
          />
          {statusFilter && (
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as typeof status);
                reset();
              }}
              className="select select-bordered select-sm"
            >
              <option value="all">All statuses</option>
              <option value="awaiting">Awaiting coach</option>
              <option value="coached">Coached</option>
            </select>
          )}
          {reps && reps.length > 0 && (
            <select
              value={repFilter}
              onChange={(e) => {
                setRepFilter(e.target.value);
                reset();
              }}
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
          <span className="ml-auto text-xs opacity-50">
            {filtered.length} call{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm opacity-50">No calls here.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-40">
                {g.label}
              </div>
              <ul className="space-y-2">
                {g.items.map((r) => (
                  <li key={r.id}>
                    <ReviewRow r={r} onSelect={onSelect} showRep={showRep} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {filtered.length > limit && (
        <button
          onClick={() => setLimit((l) => l + PAGE)}
          className="btn btn-outline btn-sm mt-4 w-full"
        >
          Show more ({filtered.length - limit} more)
        </button>
      )}
    </div>
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
    if (r.rep && countsTowardTrends(r)) {
      const list = byRep.get(r.rep) ?? [];
      list.push(r);
      byRep.set(r.rep, list);
    }
  }
  // Order each rep's calls newest-first by when the call happened (not upload time).
  const dateOf = (r: ReviewSummary) => new Date(r.callDate ?? r.createdAt).getTime();
  for (const list of byRep.values()) list.sort((a, b) => dateOf(b) - dateOf(a));
  const priority = (s: { avgScore: number; lastScore: number; calls: number }) => {
    const trend = s.calls > 1 ? s.lastScore - s.avgScore : 0;
    if (trend < -0.2) return 0; // slipping
    if (trend > 0.2) return 2; // improving
    return 1; // steady / single-call
  };
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
    .sort((a, b) => priority(a) - priority(b) || a.avgScore - b.avgScore);
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

// Accelerator pricing was corrected on 2026-06-28; reviews scored before then
// judged "Pricing & The Silence" against the old figures. Flag them in the UI.
const PRICING_FIX_AT = new Date("2026-06-28T20:00:00Z");

function DetailView({
  job,
  canCoach,
  onBack,
  onUpdated,
  refresh,
}: {
  job: ReviewJob | null;
  canCoach: boolean;
  onBack: () => void;
  onUpdated: (job: ReviewJob) => void;
  /** Refetches the job and restarts the in-progress poll (owned by App). */
  refresh: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!job) return;
    if (!window.confirm(`Delete this call (${job.client ?? job.filename})? This also removes the recording and frees disk space. This can't be undone.`)) return;
    setDeleting(true);
    try {
      await deleteReview(job.id);
      onBack();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete");
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="print-hide mb-6 flex items-center justify-between">
        <button onClick={onBack} className="btn btn-ghost btn-sm">
          ← Back
        </button>
        {job && canCoach && (
          <button onClick={() => void remove()} disabled={deleting} className="btn btn-ghost btn-sm text-error">
            {deleting ? <span className="loading loading-spinner loading-sm" /> : "🗑 Delete call"}
          </button>
        )}
      </div>

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
        <PendingReleaseView job={job} />
      ) : job.status !== "completed" || !job.result ? (
        <ProgressView job={job} />
      ) : (
        <div>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 truncate text-2xl font-bold">{job.client ?? job.filename}</h1>
            {job.rep && <span className="badge badge-info">{job.rep}</span>}
            {job.reanalyzedAt && (
              <span
                className="badge badge-ghost badge-sm"
                title="This report was re-scored from its transcript with the current scoring engine"
              >
                Re-scored {new Date(job.reanalyzedAt).toLocaleDateString()}
              </span>
            )}
            {canCoach && (
              <button
                onClick={() => {
                  void reanalyzeReview(job.id)
                    .then(refresh)
                    .catch((err) => console.error("Re-analyze failed:", err));
                }}
                className="print-hide btn btn-outline btn-sm"
                title="Re-run the AI analysis on this call's transcript with the current scoring engine"
              >
                ↻ Re-analyze
              </button>
            )}
            <button onClick={() => window.print()} className="print-hide btn btn-outline btn-sm ml-auto">
              🖨 Print / Save PDF
            </button>
          </div>
          {job.result.frameworkId === "accelerator-program" &&
            new Date(job.createdAt) < PRICING_FIX_AT && (
              <div className="alert alert-warning mb-4">
                <div>
                  <p className="font-medium">⚠ Scored under the old pricing</p>
                  <p className="text-sm opacity-80">
                    This review was generated before pricing was corrected (June 2026). If the call
                    discussed pricing, read the “Pricing &amp; The Silence” score with caution — it
                    may have been judged against the previous figures (₱29,000 one-time / ₱14,500×2)
                    rather than the current ₱28,000 / ₱15,500×2.
                  </p>
                </div>
              </div>
            )}
          <CoachPanel job={job} canEdit={canCoach} onUpdated={onUpdated} />
          <Report
            result={job.result}
            reviewId={job.id}
            separateTracks={Boolean(job.clientAudioFile)}
            mixedAudio={Boolean(job.mixedAudio)}
            flags={job.flags}
          />
        </div>
      )}
    </div>
  );
}

function PendingReleaseView({ job }: { job: ReviewJob }) {
  const m = job.metrics;
  // Measured from audio timings, not judged by the model — so the owner sees
  // these while the report itself is still with the coach.
  const rows = m
    ? [
        { label: "Talk ratio", value: `${m.talkRatio}%`, target: "≤ 55%", ok: m.talkRatio <= 55 },
        {
          label: "Questions asked",
          value: `${m.questionsAsked}`,
          target: "≥ 12",
          ok: m.questionsAsked >= 12,
        },
        { label: "Filler words", value: `${m.fillerWords}`, target: "≤ 5", ok: m.fillerWords <= 5 },
        {
          label: "Long pauses held",
          value: `${m.longPausesHeld}`,
          target: "≥ 3",
          ok: m.longPausesHeld >= 3,
        },
        {
          label: "Interruptions",
          value: `${m.interruptions}`,
          target: "≤ 3",
          ok: m.interruptions <= 3,
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="card bg-base-200">
        <div className="card-body items-center py-10 text-center">
          <div className="text-5xl">🔒</div>
          <h2 className="mt-2 text-lg font-semibold">
            Your coach is reviewing this call{job.client ? ` with ${job.client}` : ""}
          </h2>
          <p className="max-w-md text-sm opacity-60">
            The score and written feedback come from your sales head first — you'll see the full
            report here right after your 1:1. In the meantime, here's how you sounded.
          </p>
        </div>
      </div>

      {(job.repAudioFile || job.audioFile || job.clientAudioFile) && (
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h3 className="card-title text-base">Listen back</h3>
            <p className="text-sm opacity-60">
              Your own recording. Hearing yourself is the fastest way to make the numbers below
              mean something.
            </p>
            {job.clientAudioFile ? (
              <div className="mt-2 space-y-3">
                <div>
                  <div className="mb-1 text-sm font-medium">Your track</div>
                  <audio controls preload="none" className="w-full" src={audioUrl(job.id, "rep")} />
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium">Client track</div>
                  <audio
                    controls
                    preload="none"
                    className="w-full"
                    src={audioUrl(job.id, "client")}
                  />
                </div>
              </div>
            ) : (
              <audio controls preload="none" className="mt-2 w-full" src={audioUrl(job.id)} />
            )}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h3 className="card-title text-base">How you sounded</h3>
            <p className="text-sm opacity-60">
              Measured from the recording's timings — these aren't a grade, they're signals you can
              act on before your next call.
            </p>

            {job.mixedAudio && (
              <div className="alert alert-warning mt-2">
                <span className="text-sm">
                  This call was uploaded as one mixed recording, so who-spoke-when was estimated —
                  <strong> talk ratio in particular may be well off</strong>. Upload your calls as
                  two separate tracks (you and the client) for exact numbers.
                </span>
              </div>
            )}

            <div className="mt-2 overflow-x-auto">
              <table className="table table-sm">
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <td className="font-medium">{r.label}</td>
                      <td className={r.ok ? "text-success" : "text-warning"}>{r.value}</td>
                      <td className="opacity-60">{r.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STAGES = [
  { id: "queued", icon: "📥", label: "Queued", blurb: "Your call is in line." },
  { id: "transcribing", icon: "✍️", label: "Transcribing audio", blurb: "Turning speech into text, word by word." },
  { id: "identifying_speakers", icon: "🗣️", label: "Identifying speakers", blurb: "Working out who's the rep and who's the prospect." },
  { id: "analyzing", icon: "🧠", label: "Reviewing the call", blurb: "Scoring it against your sales framework." },
] as const;

const STAGE_PROGRESS: Record<string, number> = {
  queued: 8,
  transcribing: 40,
  identifying_speakers: 65,
  analyzing: 88,
};

const TIPS = [
  "Top reps aim to talk about 40% of the time — let the prospect do the talking.",
  "Silence after stating the price is a power move. Don't fill it.",
  "The real objection is usually the one they didn't say out loud.",
  "Discovery before pitch: find the pain, quantify it, then prescribe.",
  "End every call with a specific, time-bound next step.",
  "One level deeper: when they answer, ask 'what do you mean by that?'",
];

function ProgressView({ job }: { job: ReviewJob }) {
  const current = STAGES.findIndex((s) => s.id === job.status);
  const pct = STAGE_PROGRESS[job.status] ?? 5;
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto max-w-xl">
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body items-center gap-5 py-10 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/20" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
              {STAGES[Math.max(0, current)].icon}
            </span>
          </div>

          <div>
            <h2 className="text-xl font-bold">{STATUS_LABELS[job.status]}</h2>
            <p className="mt-1 text-sm opacity-60">
              {STAGES[Math.max(0, current)].blurb}
            </p>
          </div>

          <div className="w-full">
            <progress className="progress progress-primary w-full transition-all" value={pct} max={100} />
            <div className="mt-4 grid grid-cols-4 gap-2">
              {STAGES.map((s, i) => {
                const done = i < current;
                const active = i === current;
                return (
                  <div key={s.id} className="flex flex-col items-center gap-1">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
                        done
                          ? "bg-success text-success-content"
                          : active
                            ? "bg-primary text-primary-content animate-pulse"
                            : "bg-base-300 opacity-50"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className={`text-[10px] leading-tight ${active ? "font-semibold" : "opacity-50"}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 w-full rounded-box bg-base-100 p-4 text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
              💡 While you wait
            </div>
            <p key={tip} className="animate-[fadeIn_0.5s_ease] opacity-90">
              {TIPS[tip]}
            </p>
          </div>

          <p className="text-xs opacity-50">
            Long calls take a few minutes — this runs in the background, so you can leave and come
            back.
          </p>
        </div>
      </div>
    </div>
  );
}
