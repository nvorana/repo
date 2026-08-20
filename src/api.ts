// Thin client for the review API. Types come straight from the core engine so
// the UI, server and engine can never drift apart.
import type { CallReviewResult } from "../core/types.ts";

export type JobStatus =
  | "queued"
  | "transcribing"
  | "identifying_speakers"
  | "analyzing"
  | "completed"
  | "failed";

export interface ScorecardScore {
  criterionId: string;
  criterionName: string;
  score: number;
}

export interface CoachFeedback {
  notes: string;
  reviewed: boolean;
  released: boolean;
  updatedAt: string;
}

export interface ReviewSummary {
  id: string;
  filename: string;
  createdAt: string;
  callDate?: string;
  status: JobStatus;
  rep?: string;
  repId?: string;
  client?: string;
  error?: string;
  released?: boolean;
  coachReviewed?: boolean;
  hasCoachNotes?: boolean;
  overallScore?: number;
  summary?: string;
  scorecard?: ScorecardScore[];
  /** True when the review was analyzed from one mixed file (guessed speakers). */
  mixedAudio?: boolean;
  /**
   * Measured from word timings, never by the model — present as soon as
   * analysis finishes, including on calls the coach hasn't released yet.
   */
  metrics?: RepMetrics;
  /**
   * Share of objections the model judged handled. Model judgment, so it is
   * absent until the coach releases the call.
   */
  objectionRate?: number | null;
}

export interface RepMetrics {
  talkRatio: number;
  longPausesHeld: number;
  fillerWords: number;
  questionsAsked: number;
  interruptions: number;
  /** Call length, so counts can be compared as per-hour rates. */
  durationMin?: number;
}

export interface ReviewJob {
  id: string;
  filename: string;
  createdAt: string;
  callDate?: string;
  status: JobStatus;
  rep?: string;
  client?: string;
  audioFile?: string;
  repAudioFile?: string;
  clientAudioFile?: string;
  coach?: CoachFeedback;
  released?: boolean;
  /** True when the review was analyzed from one mixed file (guessed speakers). */
  mixedAudio?: boolean;
  /** Set when the report was re-scored from its stored transcript. */
  reanalyzedAt?: string;
  /** Rep "this is inaccurate" flags on findings. */
  flags?: FindingFlag[];
  error?: string;
  result?: CallReviewResult;
  /**
   * Measured delivery numbers, sent flat (not inside `result`) on a call the
   * coach hasn't released yet — the owner can see how they sounded before the
   * model's verdict is unlocked.
   */
  metrics?: RepMetrics;
}

export async function deleteReview(id: string): Promise<void> {
  const res = await api(`/api/reviews/${id}`, { method: "DELETE" });
  await json(res);
}

export async function saveCoachFeedback(
  id: string,
  notes: string,
  reviewed: boolean,
  released: boolean,
): Promise<ReviewJob> {
  const res = await api(`/api/reviews/${id}/coach`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ notes, reviewed, released }),
  });
  return json<ReviewJob>(res);
}

export async function reanalyzeReview(id: string): Promise<void> {
  const res = await api(`/api/reviews/${id}/reanalyze`, { method: "POST" });
  await json(res);
}

export async function reanalyzeMine(): Promise<{ queued: number }> {
  const res = await api("/api/reanalyze/mine", { method: "POST" });
  return json<{ queued: number }>(res);
}

export function audioUrl(id: string, track?: "rep" | "client"): string {
  // Goes straight into an <audio src>, so it never passes through api() — it
  // needs the same viewAs treatment or playback would 403 while viewing as a rep.
  return withViewAs(track ? `/api/reviews/${id}/audio?track=${track}` : `/api/reviews/${id}/audio`);
}

export function userAvatarUrl(id: string): string {
  return `/api/users/${id}/avatar`;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/**
 * When a manager is inspecting someone else's view, every request must carry
 * that identity. Held module-level and injected in api() rather than threaded
 * through each call site: a single call that forgot the parameter would show
 * the manager their OWN data while the banner claimed otherwise, which is worse
 * than the feature not existing.
 */
let viewAsId: string | null = null;

export function setViewAs(id: string | null): void {
  viewAsId = id;
}

export function getViewAs(): string | null {
  return viewAsId;
}

/** Appends viewAs to a URL, preserving any query string already on it. */
function withViewAs(path: string): string {
  if (!viewAsId) return path;
  return path + (path.includes("?") ? "&" : "?") + "viewAs=" + encodeURIComponent(viewAsId);
}

// All requests are same-origin; "same-origin" credentials send the session cookie.
function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(withViewAs(path), { credentials: "same-origin", ...init });
}

// --- Auth -------------------------------------------------------------------
export type Role = "rep" | "manager";

export interface Session {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** True when this session is a manager inspecting someone else's view. */
  viewingAs?: boolean;
  /** True for the app owner's account — excluded from team reporting. */
  personal?: boolean;
}

/** Returns the logged-in session, or null if not logged in. */
export async function getSession(): Promise<Session | null> {
  const res = await api("/api/me");
  if (res.status === 401) return null;
  return json<Session>(res);
}

export async function login(email: string, password: string): Promise<Session> {
  const res = await api("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return json<Session>(res);
}

/** True when the server can actually send mail; hides the link otherwise. */
export async function passwordResetAvailable(): Promise<boolean> {
  try {
    const res = await api("/api/password/available");
    return (await json<{ available: boolean }>(res)).available;
  } catch {
    return false;
  }
}

/**
 * Always resolves, whether or not the address has an account — the server
 * deliberately gives the same answer either way, so the UI must not imply
 * anything about whether the email was found.
 */
export async function forgotPassword(email: string): Promise<void> {
  const res = await api("/api/password/forgot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  await json<{ ok: true }>(res);
}

/** Redeems a reset token and logs the user straight in. */
export async function resetPassword(token: string, password: string): Promise<Session> {
  const res = await api("/api/password/reset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  return json<Session>(res);
}

export async function logout(): Promise<void> {
  await api("/api/logout", { method: "POST" });
}

// --- Users (manager only) ---------------------------------------------------
export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  hasAvatar?: boolean;
}

export function listUsers(): Promise<AppUser[]> {
  return api("/api/users").then((r) => json<AppUser[]>(r));
}

export async function createUser(
  name: string,
  email: string,
  role: Role,
  password: string,
): Promise<AppUser> {
  const res = await api("/api/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, email, role, password }),
  });
  return json<AppUser>(res);
}

export async function resetUserPassword(id: string, password: string): Promise<void> {
  const res = await api(`/api/users/${id}/password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  await json(res);
}

export async function deleteUser(id: string): Promise<void> {
  const res = await api(`/api/users/${id}`, { method: "DELETE" });
  await json(res);
}

export async function uploadUserAvatar(id: string, file: File): Promise<AppUser> {
  const form = new FormData();
  form.append("avatar", file);
  const res = await api(`/api/users/${id}/avatar`, { method: "POST", body: form });
  return json<AppUser>(res);
}

export async function deleteUserAvatar(id: string): Promise<void> {
  const res = await api(`/api/users/${id}/avatar`, { method: "DELETE" });
  await json(res);
}

export function listReviews(): Promise<ReviewSummary[]> {
  return api("/api/reviews").then((r) => json<ReviewSummary[]>(r));
}

export function getReview(id: string): Promise<ReviewJob> {
  return api(`/api/reviews/${id}`).then((r) => json<ReviewJob>(r));
}

export async function uploadReview(
  files: { audio?: File; repAudio?: File; clientAudio?: File },
  opts: { frameworkId?: string; rep?: string; client: string; callDate?: string },
): Promise<{ id: string }> {
  const form = new FormData();
  if (files.audio) form.append("audio", files.audio);
  if (files.repAudio) form.append("repAudio", files.repAudio);
  if (files.clientAudio) form.append("clientAudio", files.clientAudio);
  if (opts.frameworkId) form.append("frameworkId", opts.frameworkId);
  if (opts.rep) form.append("rep", opts.rep);
  form.append("client", opts.client);
  if (opts.callDate) form.append("callDate", opts.callDate);
  const res = await api("/api/reviews", { method: "POST", body: form });
  return json<{ id: string }>(res);
}

export interface FrameworkInfo {
  id: string;
  name: string;
  isDefault: boolean;
}

export function listFrameworks(): Promise<FrameworkInfo[]> {
  return api("/api/frameworks").then((r) => json<FrameworkInfo[]>(r));
}

// --- Flags & lessons ----------------------------------------------------------

export interface FindingFlag {
  section: "whatWentRight" | "whatWentWrong";
  index: number;
  createdAt: string;
  assessment?: "lesson_proposed" | "no_lesson";
}

export interface Lesson {
  id: string;
  frameworkId: string;
  text: string;
  status: "proposed" | "applied" | "discarded";
  rationale: string;
  sourceReviewId: string;
  sourceFindingPoint: string;
  sourceNote?: string;
  createdAt: string;
  appliedAt?: string;
}

export async function flagFinding(
  reviewId: string,
  flag: { section: "whatWentRight" | "whatWentWrong"; index: number; note?: string },
): Promise<void> {
  const res = await api(`/api/reviews/${reviewId}/flags`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(flag),
  });
  await json(res);
}

export function listLessons(): Promise<Lesson[]> {
  return api("/api/lessons").then((r) => json<Lesson[]>(r));
}

export async function applyLesson(id: string): Promise<Lesson> {
  const res = await api(`/api/lessons/${id}/apply`, { method: "POST" });
  return json<Lesson>(res);
}

export async function discardLesson(id: string): Promise<Lesson> {
  const res = await api(`/api/lessons/${id}/discard`, { method: "POST" });
  return json<Lesson>(res);
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  queued: "Queued",
  transcribing: "Transcribing audio…",
  identifying_speakers: "Identifying speakers…",
  analyzing: "Reviewing the call…",
  completed: "Completed",
  failed: "Failed",
};

export function isInProgress(status: JobStatus): boolean {
  return status !== "completed" && status !== "failed";
}

// --- Support chat -----------------------------------------------------------

export interface SupportTicket {
  id: string;
  userId?: string;
  userName?: string;
  page: string;
  userAgent: string;
  messages: { role: "user" | "assistant"; content: string }[];
  aiSummary: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string;
}

export async function sendSupportChat(body: {
  messages: { role: "user" | "assistant"; content: string }[];
  page: string;
  ticketId?: string;
}): Promise<{ reply: string; escalated: boolean; ticketId?: string }> {
  const res = await api("/api/support/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return json(res);
}

export function listSupportTickets(): Promise<SupportTicket[]> {
  return api("/api/support/tickets").then((r) => json<SupportTicket[]>(r));
}

export async function resolveSupportTicket(id: string): Promise<SupportTicket> {
  const res = await api(`/api/support/tickets/${id}/resolve`, { method: "POST" });
  return json<SupportTicket>(res);
}
