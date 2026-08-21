/**
 * End-to-end check of the read-only API token.
 *
 * This is the credential an external system (Cortex) holds, so the properties
 * that matter are the ones that stop it becoming a way in:
 *   1. READS  — a valid token can list and fetch calls without a login.
 *   2. WRITES — every non-GET is refused, whatever the route.
 *   3. PRIVACY — a token can never read a personal account's calls.
 *   4. AUTH   — a wrong, empty or malformed token gets nothing.
 *
 *   npx tsx scripts/verify-api-token.ts
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "apitoken-"));
const dataDir = path.join(root, "reviews");
fs.mkdirSync(dataDir, { recursive: true });
const usersFile = path.join(root, "users.json");

const SECRET = "cortex-secret-token-abcdefghijklmnop";
const WRONG = "cortex-secret-token-ABCDEFGHIJKLMNOP";

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

function review(id: string, repId: string, rep: string) {
  return {
    id, filename: "c.mp3", createdAt: "2026-08-01T00:00:00.000Z", callDate: "2026-08-01",
    status: "completed", rep, repId, client: "Maria",
    repAudioFile: `${id}-rep.mp3`, clientAudioFile: `${id}-client.mp3`,
    coach: { released: true, reviewed: true, notes: "n", updatedAt: "2026-08-05T00:00:00.000Z" },
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
fs.writeFileSync(path.join(dataDir, "r-edgar.json"), JSON.stringify(review("r-edgar", EDGAR, "Edgar")));
fs.writeFileSync(path.join(dataDir, "r-jon.json"), JSON.stringify(review("r-jon", JON, "Jon")));

const PORT = 8795;
process.env.PORT = String(PORT);
process.env.DATA_DIR = dataDir;
process.env.AUDIO_DIR = path.join(root, "audio");
process.env.USERS_FILE = usersFile;
process.env.PERSONAL_EMAILS = "jon@test.local";
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

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const failures: string[] = [];
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : ` ${d}`}`);
  if (!ok) failures.push(n);
};

try {
  console.log("\nREADS — with a valid token and no login:");
  const listRes = await fetch(`${base}/api/reviews`, { headers: auth(SECRET) });
  check("list returns 200", listRes.status === 200, String(listRes.status));
  const list = await listRes.json();
  const row = list.find((r: { id: string }) => r.id === "r-edgar");
  check("the call is present", Boolean(row));
  check("score included", row?.overallScore === 6);
  check("metrics included", row?.metrics?.talkRatio === 50);
  check("duration for per-hour rates", row?.metrics?.durationMin === 60);

  console.log("\nPROVENANCE:");
  check("updatedAt reflects the latest change", row?.updatedAt === "2026-08-05T00:00:00.000Z", row?.updatedAt);
  check("frameworkId present", row?.frameworkId === "accelerator-program");
  check("mixedAudio trust signal present", row?.mixedAudio === false);

  const detail = await (await fetch(`${base}/api/reviews/r-edgar`, { headers: auth(SECRET) })).json();
  check("detail carries the transcript", detail?.result?.transcript?.text === "hello");

  console.log("\nPRIVACY:");
  check("personal account's call is NOT listed", !list.some((r: { id: string }) => r.id === "r-jon"));
  const jon = await fetch(`${base}/api/reviews/r-jon`, { headers: auth(SECRET) });
  check("personal call not fetchable", jon.status === 404, String(jon.status));

  console.log("\nWRITES — every one must be refused:");
  for (const [label, method, url] of [
    ["release a report", "POST", "/api/reviews/r-edgar/coach"],
    ["delete a call", "DELETE", "/api/reviews/r-edgar"],
    ["trigger re-analysis", "POST", "/api/reviews/r-edgar/reanalyze"],
    ["recompute metrics", "POST", "/api/metrics/recompute"],
  ] as const) {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: { ...auth(SECRET), "content-type": "application/json" },
      body: method === "POST" ? "{}" : undefined,
    });
    check(`${label} refused`, res.status === 403, `got ${res.status}`);
  }
  const after = JSON.parse(fs.readFileSync(path.join(dataDir, "r-edgar.json"), "utf8"));
  check("the call on disk is untouched", after.coach.notes === "n");

  console.log("\nAUTH:");
  check("no token = 401", (await fetch(`${base}/api/reviews`)).status === 401);
  check("wrong token = 401", (await fetch(`${base}/api/reviews`, { headers: auth(WRONG) })).status === 401);
  check("empty bearer = 401", (await fetch(`${base}/api/reviews`, { headers: auth("") })).status === 401);
  check(
    "token cannot use view-as to become a rep",
    (await (await fetch(`${base}/api/me?viewAs=${EDGAR}`, { headers: auth(SECRET) })).json())?.viewingAs !== true,
  );
  console.log(String.fromCharCode(10) + "ISSUED THROUGH THE API:");
  const jonLogin = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "jon@test.local", password: "jonpw12345" }),
  });
  const jonCookie = jonLogin.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

  const made = await (await fetch(`${base}/api/tokens`, {
    method: "POST",
    headers: { cookie: jonCookie, "content-type": "application/json" },
    body: JSON.stringify({ name: "cortex-live" }),
  })).json();
  check("manager can mint a token", typeof made?.secret === "string" && made.secret.length > 20);

  const minted = await fetch(`${base}/api/reviews`, { headers: auth(made.secret) });
  check("the minted token reads immediately", minted.status === 200, String(minted.status));

  const listed = await (await fetch(`${base}/api/tokens`, { headers: { cookie: jonCookie } })).json();
  check("listing never returns the secret", !JSON.stringify(listed).includes(made.secret));

  const tokenMakingToken = await fetch(`${base}/api/tokens`, {
    method: "POST",
    headers: { ...auth(SECRET), "content-type": "application/json" },
    body: JSON.stringify({ name: "escalate" }),
  });
  check("a token cannot mint another token", tokenMakingToken.status === 403, String(tokenMakingToken.status));

  await fetch(`${base}/api/tokens/${made.id}`, { method: "DELETE", headers: { cookie: jonCookie } });
  const afterRevoke = await fetch(`${base}/api/reviews`, { headers: auth(made.secret) });
  check("revoking takes effect immediately", afterRevoke.status === 401, String(afterRevoke.status));

} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : "\nAll checks passed.");
process.exitCode = failures.length ? 1 : 0;
server.close();
