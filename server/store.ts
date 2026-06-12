import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { CallReviewResult } from "../core/types.ts";
import type { ReviewStage } from "../core/pipeline.ts";

export type JobStatus = "queued" | ReviewStage | "completed" | "failed";

export interface ReviewJob {
  id: string;
  filename: string;
  createdAt: string;
  status: JobStatus;
  /** Salesperson on the call, as entered at upload time. */
  rep?: string;
  /** Stored audio file name (under the audio dir), when retained. */
  audioFile?: string;
  error?: string;
  result?: CallReviewResult;
}

/**
 * Minimal persistence: one JSON file per review under DATA_DIR. Enough for a
 * single-node deployment; swap for a database by reimplementing this module's
 * interface.
 */
export class ReviewStore {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
  }

  create(filename: string, rep?: string): ReviewJob {
    const job: ReviewJob = {
      id: crypto.randomUUID(),
      filename,
      createdAt: new Date().toISOString(),
      status: "queued",
      ...(rep ? { rep } : {}),
    };
    this.write(job);
    return job;
  }

  update(id: string, patch: Partial<ReviewJob>): ReviewJob {
    const job = this.get(id);
    if (!job) throw new Error(`Unknown review job: ${id}`);
    const next = { ...job, ...patch };
    this.write(next);
    return next;
  }

  get(id: string): ReviewJob | null {
    const file = this.fileFor(id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as ReviewJob;
  }

  list(): ReviewJob[] {
    return fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(this.dir, f), "utf8")) as ReviewJob)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private fileFor(id: string): string {
    // ids are server-generated UUIDs, but never trust them as raw paths
    return path.join(this.dir, `${path.basename(id)}.json`);
  }

  private write(job: ReviewJob): void {
    fs.writeFileSync(this.fileFor(job.id), JSON.stringify(job, null, 2));
  }
}
