/**
 * End-to-end check of manager "view as".
 *
 * The feature swaps the identity every route gates on, so it is exactly the
 * kind of thing that turns into a privilege hole if it drifts. This asserts the
 * four properties that matter:
 *   1. FIDELITY  — a manager viewing a rep sees the REP's projection (model
 *                  judgment withheld on unreleased calls), not the manager's.
 *   2. SCOPE     — they see only that rep's calls.
 *   3. READ-ONLY — no write can be made while viewing as someone.
 *   4. LIMITS    — reps can't use it at all, and nobody can view a personal account.
 *
 *   npx tsx scripts/verify-view-as.ts
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "viewas-"));
const dataDir = path.join(root, "reviews");
fs.mkdirSync(dataDir, { recursive: true });
const usersFile = path.join(root, "users.json");

function user(id: string, name: string, email: string, role: string, pw: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { id, name, email, role, salt, hash: crypto.scryptSync(pw, salt, 64).toString("hex"), createdAt: new Date(0).toISOString() };
}
const MIKE = "u-mike", EDGAR = "u-edgar", JON = "u-jon";
fs.writeFileSync(usersFile, JSON.stringify([
  user(MIKE, "Mike", "mike@test.local", "manager", "managerpw1"),
  user(EDGAR, "Edgar", "edgar@test.local", "rep", "edgarpw123"),
  user(JON, "Jon", "jon@test.local", "manager", "jonpw12345"),
]));

function review(id: string, repId: string, rep: string, released: boolean) {
  return {
    id, filename: "c.mp3", createdAt: "2026-08-01T00:00:00.000Z", callDate: "2026-08-01",
    status: "completed", rep, repId, client: "Maria",
    repAudioFile: `${id}-rep.mp3`, clientAudioFile: `${id}-client.mp3`,
    coach: { released, reviewed: false, notes: "SECRET-NOTES" },
    result: {
      frameworkId: "accelerator-program",
      metrics: {
        durationMs: 3600000, salespersonTalkRatio: 0.71,
        paceWpm: { salesperson: 160, prospect: 120 },
        pauses: [{ atMs: 1, durationMs: 2, afterSpeaker: "salesperson", precedingText: "so" }],
        longestMonologues: [], interruptions: [],
        questionCounts: { salesperson: 4, prospect: 9 },
        fillerWordCounts: { salesperson: 12, prospect: 2 },
      },
      review: {
        overallScore: 4.5, summary: "SECRET-SUMMARY",
        scorecard: [{ criterionId: "c1", criterionName: "Rapport", score: 2, rationale: "SECRET" }],
        objections: [{ quote: "SECRET-OBJ", handled: "handled", timestamp: "10:00" }],
        whatWentRight: [], whatWentWrong: [], coaching: [], deliveryAssessment: "SECRET-DELIVERY",
      },
    },
  };
}
fs.writeFileSync(path.join(dataDir, "r-edgar.json"), JSON.stringify(review("r-edgar", EDGAR, "Edgar", false)));
fs.writeFileSync(path.join(dataDir, "r-jon.json"), JSON.stringify(review("r-jon", JON, "Jon", false)));

const PORT = 8793;
process.env.PORT = String(PORT);
process.env.DATA_DIR = dataDir;
process.env.AUDIO_DIR = path.join(root, "audio");
process.env.USERS_FILE = usersFile;
process.env.PERSONAL_EMAILS = "jon@test.local";   // Jon's calls are private
process.env.ANTHROPIC_API_KEY ??= "test";
process.env.ASSEMBLYAI_API_KEY ??= "test";

const { server } = await import("../server/index.ts");
const base = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* booting */ }
  await new Promise((r) => setTimeout(r, 250));
}

async function loginAs(email: string, password: string): Promise<string> {
  const r = await fetch(`${base}/api/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}
const get = (p: string, cookie: string) => fetch(`${base}${p}`, { headers: { cookie } });

const failures: string[] = [];
const check = (n: string, ok: boolean, d = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : ` ${d}`}`);
  if (!ok) failures.push(n);
};

try {
  const mike = await loginAs("mike@test.local", "managerpw1");
  const edgar = await loginAs("edgar@test.local", "edgarpw123");

  console.log("\nBASELINE — Mike as himself:");
  const own = await (await get("/api/reviews", mike)).json();
  const ownEdgar = own.find((r: { id: string }) => r.id === "r-edgar");
  check("manager sees the score on an unreleased call", ownEdgar?.overallScore === 4.5);

  console.log("\nFIDELITY — Mike viewing as Edgar:");
  const me = await (await get(`/api/me?viewAs=${EDGAR}`, mike)).json();
  check("identity becomes Edgar", me?.name === "Edgar" && me?.role === "rep", JSON.stringify(me));
  check("flagged as viewingAs", me?.viewingAs === true);

  const asEdgar = await (await get(`/api/reviews?viewAs=${EDGAR}`, mike)).json();
  const raw = JSON.stringify(asEdgar);
  const row = asEdgar.find((r: { id: string }) => r.id === "r-edgar");
  check("sees Edgar's call", Boolean(row));
  check("score now WITHHELD (rep projection, not manager's)", row?.overallScore === undefined);
  check("metrics still present", row?.metrics?.talkRatio === 71);
  check("no SECRET text anywhere", !raw.includes("SECRET"));

  console.log("\nSCOPE:");
  check("only Edgar's calls returned", asEdgar.length === 1, `got ${asEdgar.length}`);
  check("Jon's personal call not included", !asEdgar.some((r: { id: string }) => r.id === "r-jon"));

  console.log("\nREAD-ONLY:");
  const write = await fetch(`${base}/api/reviews/r-edgar/coach?viewAs=${EDGAR}`, {
    method: "POST", headers: { cookie: mike, "content-type": "application/json" },
    body: JSON.stringify({ notes: "x", reviewed: true, released: true }),
  });
  check("write refused with 403", write.status === 403, `got ${write.status}`);
  const still = JSON.parse(fs.readFileSync(path.join(dataDir, "r-edgar.json"), "utf8"));
  check("the call was NOT released", still.coach.released === false);

  console.log("\nLIMITS:");
  const asJon = await (await get(`/api/me?viewAs=${JON}`, mike)).json();
  check("cannot view as a personal account", asJon?.name === "Mike" && !asJon?.viewingAs, JSON.stringify(asJon));
  const repTry = await (await get(`/api/me?viewAs=${MIKE}`, edgar)).json();
  check("a rep cannot view as anyone", repTry?.name === "Edgar" && !repTry?.viewingAs);
  const selfTry = await (await get(`/api/me?viewAs=${MIKE}`, mike)).json();
  check("viewing as yourself is a no-op", selfTry?.name === "Mike" && !selfTry?.viewingAs);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : "\nAll checks passed.");
process.exitCode = failures.length ? 1 : 0;
server.close();
