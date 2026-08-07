/**
 * End-to-end check of the fact/judgment split on an unreleased call.
 *
 * Asks, as the rep who OWNS a call the coach has not released: do I get the
 * MEASURED delivery metrics, and is every piece of MODEL JUDGMENT withheld?
 * The judgment fields in the fixture are stuffed with the string "SECRET", so
 * a single substring check catches any leak the field-by-field asserts miss.
 *
 * Runs the server in-process (no subprocess) against a seeded temp DATA_DIR.
 *
 *   npx tsx scripts/verify-release-gate.ts
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "callcoach-verify-"));
const dataDir = path.join(root, "reviews");
fs.mkdirSync(dataDir, { recursive: true });
const usersFile = path.join(root, "users.json");

const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync("pw123456", salt, 64).toString("hex");
const REP_ID = "rep-edgar";
fs.writeFileSync(
  usersFile,
  JSON.stringify([
    {
      id: REP_ID,
      name: "Edgar",
      email: "edgar@test.local",
      role: "rep",
      salt,
      hash,
      createdAt: new Date(0).toISOString(),
    },
  ]),
);

const JOB_ID = "job-unreleased";
fs.writeFileSync(
  path.join(dataDir, `${JOB_ID}.json`),
  JSON.stringify({
    id: JOB_ID,
    filename: "call.mp3",
    createdAt: "2026-08-01T00:00:00.000Z",
    callDate: "2026-08-01",
    status: "completed",
    rep: "Edgar",
    repId: REP_ID,
    client: "Maria",
    // Two tracks => not mixed audio, so metrics are trustworthy.
    repAudioFile: `${JOB_ID}-rep.mp3`,
    clientAudioFile: `${JOB_ID}-client.mp3`,
    coach: { released: false, reviewed: false, notes: "SECRET-COACH-NOTES" },
    result: {
      frameworkId: "accelerator-program",
      metrics: {
        durationMs: 3_600_000,
        salespersonTalkRatio: 0.71,
        paceWpm: { salesperson: 160, prospect: 120 },
        pauses: [
          { atMs: 1000, durationMs: 2000, afterSpeaker: "salesperson", precedingText: "so" },
        ],
        longestMonologues: [],
        interruptions: [{ atMs: 500, interrupter: "salesperson", interrupted: "prospect" }],
        questionCounts: { salesperson: 4, prospect: 9 },
        fillerWordCounts: { salesperson: 12, prospect: 2 },
      },
      review: {
        overallScore: 4.5,
        summary: "SECRET-SUMMARY",
        scorecard: [
          { criterionId: "c1", criterionName: "Rapport", score: 2, rationale: "SECRET" },
        ],
        objections: [
          { quote: "SECRET-OBJECTION", handled: "handled", timestamp: "10:00" },
          { quote: "SECRET-OBJECTION-2", handled: "missed", timestamp: "20:00" },
        ],
        whatWentRight: [{ quote: "SECRET-WIN", note: "SECRET", timestamp: "01:00" }],
        whatWentWrong: [{ quote: "SECRET-MISS", note: "SECRET", timestamp: "02:00" }],
        coaching: [{ action: "SECRET-COACHING", example: "SECRET" }],
        deliveryAssessment: "SECRET-DELIVERY",
      },
    },
  }),
);

const PORT = 8791;
// Must be set before importing the server — it reads these at module scope.
process.env.PORT = String(PORT);
process.env.DATA_DIR = dataDir;
process.env.AUDIO_DIR = path.join(root, "audio");
process.env.USERS_FILE = usersFile;
process.env.ANTHROPIC_API_KEY ??= "test";
process.env.ASSEMBLYAI_API_KEY ??= "test";

const { server } = await import("../server/index.ts");

const base = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`${base}/api/health`)).ok) break;
  } catch {
    /* not listening yet */
  }
  await new Promise((r) => setTimeout(r, 250));
}

const failures: string[] = [];
function check(name: string, cond: boolean, detail = "") {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : ` ${detail}`}`);
  if (!cond) failures.push(name);
}

try {
  const login = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "edgar@test.local", password: "pw123456" }),
  });
  if (!login.ok) throw new Error(`login failed: ${login.status} ${await login.text()}`);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  const row = (await (await fetch(`${base}/api/reviews`, { headers: { cookie } })).json()).find(
    (r: { id: string }) => r.id === JOB_ID,
  );
  console.log("\nLIST — rep viewing their own UNRELEASED call:");
  check("metrics present", row?.metrics != null);
  check("talkRatio is the measured 71%", row?.metrics?.talkRatio === 71);
  check("fillerWords measured", row?.metrics?.fillerWords === 12);
  check("overallScore withheld", row?.overallScore === undefined);
  check("summary withheld", row?.summary === undefined);
  check("scorecard withheld", row?.scorecard === undefined);
  check("objectionRate withheld (model judgment)", row?.objectionRate === undefined);
  check("no SECRET text in payload", !JSON.stringify(row).includes("SECRET"));

  const detail = await (await fetch(`${base}/api/reviews/${JOB_ID}`, { headers: { cookie } })).json();
  console.log("\nDETAIL — same call:");
  check("metrics present", detail?.metrics != null);
  check("talkRatio is the measured 71%", detail?.metrics?.talkRatio === 71);
  check("result body withheld", detail?.result === undefined);
  check("coach notes withheld", detail?.coach === undefined);
  check("no SECRET text in payload", !JSON.stringify(detail).includes("SECRET"));

  // Control: releasing the call must unlock exactly the judgment fields.
  const job = JSON.parse(fs.readFileSync(path.join(dataDir, `${JOB_ID}.json`), "utf8"));
  job.coach.released = true;
  fs.writeFileSync(path.join(dataDir, `${JOB_ID}.json`), JSON.stringify(job));

  const row2 = (await (await fetch(`${base}/api/reviews`, { headers: { cookie } })).json()).find(
    (r: { id: string }) => r.id === JOB_ID,
  );
  console.log("\nCONTROL — after the coach releases it:");
  check("overallScore now visible", row2?.overallScore === 4.5);
  check("objectionRate now computed (1 of 2 handled = 50)", row2?.objectionRate === 50);
  check("metrics still present", row2?.metrics?.talkRatio === 71);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : "\nAll checks passed.");
// Close the listener and let the event loop drain rather than calling
// process.exit(): forcing exit with a live handle trips a libuv assertion
// under tsx on Windows, which would crash-exit and mask the real result.
process.exitCode = failures.length ? 1 : 0;
server.close();
