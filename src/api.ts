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
  updatedAt: string;
}

export interface ReviewSummary {
  id: string;
  filename: string;
  createdAt: string;
  status: JobStatus;
  rep?: string;
  client?: string;
  error?: string;
  coachReviewed?: boolean;
  hasCoachNotes?: boolean;
  overallScore?: number;
  summary?: string;
  scorecard?: ScorecardScore[];
}

export interface ReviewJob {
  id: string;
  filename: string;
  createdAt: string;
  status: JobStatus;
  rep?: string;
  client?: string;
  audioFile?: string;
  coach?: CoachFeedback;
  error?: string;
  result?: CallReviewResult;
}

export async function saveCoachFeedback(
  id: string,
  notes: string,
  reviewed: boolean,
): Promise<ReviewJob> {
  const res = await api(`/api/reviews/${id}/coach`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ notes, reviewed }),
  });
  return json<ReviewJob>(res);
}

export function audioUrl(id: string): string {
  return `/api/reviews/${id}/audio`;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// All requests are same-origin; "same-origin" credentials send the session cookie.
function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, { credentials: "same-origin", ...init });
}

// --- Auth -------------------------------------------------------------------
export type Role = "rep" | "manager";

/** Returns the logged-in role, or null if not logged in / auth disabled-but-open. */
export async function getSession(): Promise<Role | null> {
  const res = await api("/api/me");
  if (res.status === 401) return null;
  const body = await json<{ role: Role }>(res);
  return body.role;
}

export async function login(password: string): Promise<Role> {
  const res = await api("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return (await json<{ role: Role }>(res)).role;
}

export async function logout(): Promise<void> {
  await api("/api/logout", { method: "POST" });
}

export function listReviews(): Promise<ReviewSummary[]> {
  return api("/api/reviews").then((r) => json<ReviewSummary[]>(r));
}

export function getReview(id: string): Promise<ReviewJob> {
  return api(`/api/reviews/${id}`).then((r) => json<ReviewJob>(r));
}

export async function uploadReview(
  file: File,
  opts: { frameworkId?: string; rep?: string; client: string },
): Promise<{ id: string }> {
  const form = new FormData();
  form.append("audio", file);
  if (opts.frameworkId) form.append("frameworkId", opts.frameworkId);
  if (opts.rep) form.append("rep", opts.rep);
  form.append("client", opts.client);
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
