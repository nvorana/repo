import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { CallReviewResult } from "../core/types.ts";
import type { ReviewStage } from "../core/pipeline.ts";

export type JobStatus = "queued" | ReviewStage | "completed" | "failed";

export interface CoachFeedback {
  /** Sales head's commendations/corrections for this call. */
  notes: string;
  /** True once the coach has gone over the call with the rep. */
  reviewed: boolean;
  /** True once the coach releases the report for the rep to see. */
  released: boolean;
  updatedAt: string;
}

export interface ReviewJob {
  id: string;
  filename: string;
  createdAt: string;
  status: JobStatus;
  /** Salesperson display name on the call. */
  rep?: string;
  /** Salesperson account id — the stable owner key (collision-proof). */
  repId?: string;
  /** Prospect/client on the call, entered at upload time (required in UI). */
  client?: string;
  /** Stored audio file name (under the audio dir), when retained. */
  audioFile?: string;
  coach?: CoachFeedback;
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
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.error(
        `FATAL: cannot create/write data dir "${dir}". Is the volume mounted at /data?`,
        err,
      );
      throw err;
    }
  }

  create(
    filename: string,
    opts: { rep?: string; repId?: string; client?: string } = {},
  ): ReviewJob {
    const job: ReviewJob = {
      id: crypto.randomUUID(),
      filename,
      createdAt: new Date().toISOString(),
      status: "queued",
      ...(opts.rep ? { rep: opts.rep } : {}),
      ...(opts.repId ? { repId: opts.repId } : {}),
      ...(opts.client ? { client: opts.client } : {}),
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
    try {
      return JSON.parse(fs.readFileSync(file, "utf8")) as ReviewJob;
    } catch (err) {
      console.error(`Skipping unreadable review file ${file}:`, err);
      return null;
    }
  }

  list(): ReviewJob[] {
    // One corrupt/partial file must not break the whole list — skip it.
    const jobs: ReviewJob[] = [];
    for (const f of fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"))) {
      try {
        jobs.push(JSON.parse(fs.readFileSync(path.join(this.dir, f), "utf8")) as ReviewJob);
      } catch (err) {
        console.error(`Skipping unreadable review file ${f}:`, err);
      }
    }
    return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private fileFor(id: string): string {
    // ids are server-generated UUIDs, but never trust them as raw paths
    return path.join(this.dir, `${path.basename(id)}.json`);
  }

  private write(job: ReviewJob): void {
    fs.writeFileSync(this.fileFor(job.id), JSON.stringify(job, null, 2));
  }
}
