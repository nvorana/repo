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

export interface FindingFlag {
  section: "whatWentRight" | "whatWentWrong";
  index: number;
  /** Snapshot at flag time — re-analysis may replace the findings array. */
  finding: { point: string; detail: string; quote: string; timestamp: string };
  note?: string;
  repId?: string;
  createdAt: string;
  /** Absent until the distiller has processed this flag. */
  assessment?: "lesson_proposed" | "no_lesson";
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
  /** Date the call actually happened (YYYY-MM-DD), entered at upload. Falls back to createdAt. */
  callDate?: string;
  /** Stored audio file name (under the audio dir), when retained. Legacy single-file uploads. */
  audioFile?: string;
  /** Stored rep-track audio file name (separate-tracks uploads). */
  repAudioFile?: string;
  /** Stored client-track audio file name (separate-tracks uploads). */
  clientAudioFile?: string;
  /** Set when the report was re-scored from its stored transcript. */
  reanalyzedAt?: string;
  /** Rep "this is inaccurate" flags on findings, processed by the distiller. */
  flags?: FindingFlag[];
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
  /** Parsed jobs keyed by path, validated against mtime+size. `job: null` marks
   *  a file that failed to parse, so we don't re-read it every request. */
  private readonly cache = new Map<string, { key: string; job: ReviewJob | null }>();
  /** Last set of unreadable files reported, so the warning logs on change only. */
  private lastUnreadableSignature = "";

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
    opts: { rep?: string; repId?: string; client?: string; callDate?: string } = {},
  ): ReviewJob {
    const job: ReviewJob = {
      id: crypto.randomUUID(),
      filename,
      createdAt: new Date().toISOString(),
      status: "queued",
      ...(opts.rep ? { rep: opts.rep } : {}),
      ...(opts.repId ? { repId: opts.repId } : {}),
      ...(opts.client ? { client: opts.client } : {}),
      ...(opts.callDate ? { callDate: opts.callDate } : {}),
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
    } catch {
      // One line, no stack: a polling client would otherwise reprint the
      // whole trace on every request for the same broken file.
      console.error(`Unreadable review file ${path.basename(file)} (skipped)`);
      return null;
    }
  }

  list(): ReviewJob[] {
    // One corrupt/partial file must not break the whole list — skip it.
    const jobs: ReviewJob[] = [];
    const unreadable: string[] = [];
    for (const f of fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"))) {
      const file = path.join(this.dir, f);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(file);
      } catch {
        continue; // deleted between readdir and stat
      }
      // Reuse the previous parse when the file hasn't changed. Re-reading and
      // re-parsing every review (each carrying a full transcript) on every
      // request is what made a handful of bad files able to stall the app.
      const key = `${stat.mtimeMs}:${stat.size}`;
      const hit = this.cache.get(file);
      if (hit?.key === key) {
        if (hit.job) jobs.push(hit.job);
        else unreadable.push(f);
        continue;
      }
      try {
        const job = JSON.parse(fs.readFileSync(file, "utf8")) as ReviewJob;
        this.cache.set(file, { key, job });
        jobs.push(job);
      } catch {
        this.cache.set(file, { key, job: null });
        unreadable.push(f);
      }
    }

    // One summary line, not a stack trace per bad file per request.
    if (unreadable.length) {
      const signature = unreadable.join(",");
      if (signature !== this.lastUnreadableSignature) {
        this.lastUnreadableSignature = signature;
        console.error(
          `${unreadable.length} unreadable review file(s) skipped (run quarantineCorrupt): ` +
            unreadable.slice(0, 5).join(", ") +
            (unreadable.length > 5 ? `, +${unreadable.length - 5} more` : ""),
        );
      }
    } else {
      this.lastUnreadableSignature = "";
    }

    return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  delete(id: string): void {
    const file = this.fileFor(id);
    if (fs.existsSync(file)) fs.rmSync(file);
    this.cache.delete(file);
  }

  private fileFor(id: string): string {
    // ids are server-generated UUIDs, but never trust them as raw paths
    return path.join(this.dir, `${path.basename(id)}.json`);
  }

  /**
   * Write atomically: a full write to a temp file, then a rename over the
   * target. Rename is atomic, so an interrupted write (restart, crash, a full
   * disk) leaves the PREVIOUS file intact instead of a truncated one.
   *
   * Writing straight to the destination is what produced 33 unreadable
   * "Unexpected end of JSON input" files in production — each one then logged
   * a stack trace on every list request until the app was drowning in its own
   * error output.
   */
  private write(job: ReviewJob): void {
    const file = this.fileFor(job.id);
    const tmp = `${file}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(job, null, 2));
      fs.renameSync(tmp, file);
    } catch (err) {
      // Never leave a stray temp file behind on a failed write.
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        /* best effort */
      }
      throw err;
    }
    this.cache.delete(file);
  }

  /**
   * Moves unreadable review files out of the way and returns how many were
   * moved. Call once at boot: a corrupt file can never be recovered, and
   * leaving it in place makes every subsequent list request pay for it.
   * Quarantined rather than deleted so the files can still be inspected.
   */
  quarantineCorrupt(): number {
    const dest = path.join(this.dir, "corrupt");
    let moved = 0;
    for (const f of fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"))) {
      const file = path.join(this.dir, f);
      try {
        JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        try {
          fs.mkdirSync(dest, { recursive: true });
          fs.renameSync(file, path.join(dest, f));
          moved++;
        } catch (err) {
          console.error(`Could not quarantine unreadable review file ${f}:`, err);
        }
      }
    }
    return moved;
  }
}
