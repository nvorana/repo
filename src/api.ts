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

export interface ReviewSummary {
  id: string;
  filename: string;
  createdAt: string;
  status: JobStatus;
  error?: string;
  overallScore?: number;
  summary?: string;
}

export interface ReviewJob {
  id: string;
  filename: string;
  createdAt: string;
  status: JobStatus;
  error?: string;
  result?: CallReviewResult;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function listReviews(): Promise<ReviewSummary[]> {
  return fetch("/api/reviews").then((r) => json<ReviewSummary[]>(r));
}

export function getReview(id: string): Promise<ReviewJob> {
  return fetch(`/api/reviews/${id}`).then((r) => json<ReviewJob>(r));
}

export async function uploadReview(file: File, frameworkId?: string): Promise<{ id: string }> {
  const form = new FormData();
  form.append("audio", file);
  if (frameworkId) form.append("frameworkId", frameworkId);
  const res = await fetch("/api/reviews", { method: "POST", body: form });
  return json<{ id: string }>(res);
}

export interface FrameworkInfo {
  id: string;
  name: string;
  isDefault: boolean;
}

export function listFrameworks(): Promise<FrameworkInfo[]> {
  return fetch("/api/frameworks").then((r) => json<FrameworkInfo[]>(r));
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
