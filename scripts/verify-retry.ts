/**
 * Gate checks for retrying a failed upload.
 *
 * A retry re-runs the whole pipeline and overwrites the job, so the property
 * that matters most is the one that protects reports we already have:
 *
 *   1. A COMPLETED review can never be retried. Pointing a retry at a good
 *      report would destroy it to rebuild it, and cost money doing so.
 *   2. A failed upload with audio on disk is accepted.
 *   3. A failed upload whose audio is gone is refused up front, not half-run.
 *   4. Only a manager can trigger one — not a rep, not an API token.
 *   5. Queueing the same job twice is refused.
 *
 * This exercises the GATE, not a real transcription: the run itself needs live
 * AssemblyAI and Anthropic keys. With fake keys the queued job fails again,
 * which is itself worth checking — the queue must survive a failing job and
 * leave it marked failed rather than stuck.
 *
 *   npx tsx scripts/verify-retry.ts
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "retry-"));
const dataDir = path.join(root, "reviews");
const audioDir = path.join(root, "audio");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });
const usersFile = path.join(root, "users.json");

const SECRET = "cortex-secret-token-abcdefghijklmnop";

function user(id: string, name: string, email: string, role: string, pw: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    id, name, email, role, salt,
    hash: crypto.scryptSync(pw, salt, 64).toString("hex"),
    createdAt: new Date(0).toISOString(),
  };
}
const EDGAR = "u-edgar", JON = "u-jon";
fs.writeFileSync(usersFile, JSON.stringify([
  user(EDGAR, "Edgar", "edgar@test.local", "rep", "edgarpw123"),
  user(JON, "Jon", "jon@test.local", "manager", "jonpw12345"),
]));

/** A failed upload: audio kept, no transcript — exactly what the outage left. */
function failedJob(id: string, opts: { audio: boolean }) {
  if (opts.audio) {
    fs.writeFileSync(path.join(audioDir, `${id}-rep.mp3`), Buffer.from("fake rep audio"));
    fs.writeFileSync(path.join(audioDir, `${id}-client.mp3`), Buffer.from("fake client audio"));
  }
  return {
    id, filename: "c.mp3", createdAt: "2026-07-28T00:00:00.000Z", callDate: "2026-07-20",
    status: "failed", rep: "Edgar", repId: EDGAR, client: "Marilyn",
    repAudioFile: `${id}-rep.mp3`, clientAudioFile: `${id}-client.mp3`,
    error: "400 invalid_request_error: Your credit balance is too low",
  };
}

/** A finished report — the thing a retry must never be allowed to touch. */
function completedJob(id: string) {
  return {
    id, filename: "c.mp3", createdAt: "2026-08-01T00:00:00.000Z", callDate: "2026-08-01",
    status: "completed", rep: "Edgar", repId: EDGAR, client: "Maria",
    repAudioFile: `${id}-rep.mp3`, clientAudioFile: `${id}-client.mp3`,
    coach: { released: true, reviewed: true, notes: "keep me", updatedAt: "2026-08-05T00:00:00.000Z" },
    result: {
      frameworkId: "accelerator-program",
      metrics: {
        durationMs: 3600000, salespersonTalkRatio: 0.5,
        paceWpm: { salesperson: 150, prospect: 120 },
        pauses: [], pauseCount: 40, longestMonologues: [], interruptions: [],
        questionCounts: { salesperson: 60, prospect: 20 },
        fillerWordCounts: { salesperson: 20, prospect: 5 },
      },
      review: {
        overallScore: 6, summary: "s",
        scorecard: [{ criterionId: "c1", criterionName: "Rapport", score: 4, rationale: "r" }],
        objections: [], whatWentRight: [], whatWentWrong: [], coaching: [], deliveryAssessment: "d",
      },
      transcript: { utterances: [], durationMs: 3600000, text: "hello" },
    },
  };
}

const RETRYABLE = "r-failed-with-audio";
const ORPHANED = "r-failed-no-audio";
const FINISHED = "r-completed";
fs.writeFileSync(path.join(dataDir, `${RETRYABLE}.json`), JSON.stringify(failedJob(RETRYABLE, { audio: true })));
fs.writeFileSync(path.join(dataDir, `${ORPHANED}.json`), JSON.stringify(failedJob(ORPHANED, { audio: false })));
fs.writeFileSync(path.join(dataDir, `${FINISHED}.json`), JSON.stringify(completedJob(FINISHED)));

const PORT = 8796;
process.env.PORT = String(PORT);
process.env.DATA_DIR = dataDir;
process.env.AUDIO_DIR = audioDir;
process.env.USERS_FILE = usersFile;
process.env.API_READ_TOKENS = `cortex:${SECRET}`;
process.env.TOKENS_FILE = path.join(root, "tokens.json");
process.env.ANTHROPIC_API_KEY ??= "test";
process.env.ASSEMBLYAI_API_KEY ??= "test";

const { server } = await import("../server/index.ts");
const base = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* booting */ }
  await new Promise((r) => setTimeout(r, 250));
}

const failures: string[] = [];
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : ` ${d}`}`);
  if (!ok) failures.push(n);
};
const login = async (email: string, password: string) => {
  const res = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
};
const retry = (id: string, headers: Record<string, string>) =>
  fetch(`${base}/api/reviews/${id}/retry`, { method: "POST", headers });
const onDisk = (id: string) =>
  JSON.parse(fs.readFileSync(path.join(dataDir, `${id}.json`), "utf8"));

try {
  const manager = { cookie: await login("jon@test.local", "jonpw12345") };
  const rep = { cookie: await login("edgar@test.local", "edgarpw123") };

  console.log("\nPROTECTING FINISHED WORK — the expensive mistake:");
  const onCompleted = await retry(FINISHED, manager);
  check("a completed review cannot be retried", onCompleted.status === 409, `got ${onCompleted.status}`);
  check("its report survives untouched", onDisk(FINISHED).result?.review?.overallScore === 6);
  check("its coach notes survive untouched", onDisk(FINISHED).coach?.notes === "keep me");

  console.log("\nREFUSING WHAT CANNOT FINISH:");
  const noAudio = await retry(ORPHANED, manager);
  check("a failed upload with no audio is refused", noAudio.status === 409, `got ${noAudio.status}`);
  check("it is left failed, not queued", onDisk(ORPHANED).status === "failed");
  const missing = await retry("does-not-exist", manager);
  check("an unknown id is 404", missing.status === 404, `got ${missing.status}`);

  console.log("\nWHO MAY TRIGGER ONE:");
  check("a rep cannot retry", [403, 404].includes((await retry(RETRYABLE, rep)).status));
  const byToken = await retry(RETRYABLE, { authorization: `Bearer ${SECRET}` });
  check("a read-only token cannot retry", byToken.status === 403, `got ${byToken.status}`);
  check("an anonymous caller cannot retry", (await retry(RETRYABLE, {})).status === 401);
  check("still failed after all of those", onDisk(RETRYABLE).status === "failed");

  console.log("\nTHE HAPPY PATH:");
  const accepted = await retry(RETRYABLE, manager);
  check("a failed upload with audio is accepted", accepted.status === 202, `got ${accepted.status}`);
  const again = await retry(RETRYABLE, manager);
  check("queueing it twice is refused", again.status === 409, `got ${again.status}`);

  // Fake provider keys, so the run must fail — the point is that it fails
  // CLEANLY: marked failed with a fresh error, never left stuck mid-pipeline.
  let settled = "";
  for (let i = 0; i < 80; i++) {
    settled = onDisk(RETRYABLE).status;
    if (settled === "failed" || settled === "completed") break;
    await new Promise((r) => setTimeout(r, 250));
  }
  check("the queue runs it and it settles", settled === "failed" || settled === "completed", settled);
  check("a job that fails again is not left stuck", onDisk(RETRYABLE).status !== "queued");
  check("the retry can be attempted again afterwards",
    (await retry(RETRYABLE, manager)).status === 202);

  console.log("\nSURVIVING A JOB THAT VANISHES MID-FLIGHT:");
  // A manager deleting a review while its retry is queued must not take the
  // server down — the runner is detached from any request, so an escaping
  // rejection would kill the process over one abandoned retry.
  fs.rmSync(path.join(dataDir, `${RETRYABLE}.json`), { force: true });
  let alive = false;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try { alive = (await fetch(`${base}/api/health`)).ok; } catch { alive = false; }
    if (!alive) break;
  }
  check("the server survives the deletion", alive);

} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : "\nAll checks passed.");
process.exitCode = failures.length ? 1 : 0;
server.close();
