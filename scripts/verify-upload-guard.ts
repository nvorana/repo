/**
 * Does the SERVER actually refuse a recording that never saved?
 *
 * core/upload.test.ts proves the rule. This proves the wiring: a real
 * multipart POST, over HTTP, exactly as the browser sends it.
 *
 * That distinction is the whole point here. The browser check is what the rep
 * sees, but it is a courtesy — anyone can post straight past it, and a stale
 * cached bundle skips it entirely. The empty file must die at the door.
 *
 * A rejected upload must also leave NOTHING behind: no job in the list, no
 * orphaned audio on the volume.
 *
 *   npx tsx scripts/verify-upload-guard.ts
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MIN_AUDIO_BYTES } from "../core/upload.ts";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "uploadguard-"));
const dataDir = path.join(root, "reviews");
const audioDir = path.join(root, "audio");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });
const usersFile = path.join(root, "users.json");

const salt = crypto.randomBytes(16).toString("hex");
fs.writeFileSync(usersFile, JSON.stringify([
  {
    id: "u-edgar", name: "Edgar", email: "edgar@test.local", role: "rep", salt,
    hash: crypto.scryptSync("edgarpw123", salt, 64).toString("hex"),
    createdAt: new Date(0).toISOString(),
  },
]));

const PORT = 8797;
process.env.PORT = String(PORT);
process.env.DATA_DIR = dataDir;
process.env.AUDIO_DIR = audioDir;
process.env.USERS_FILE = usersFile;
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

const login = await fetch(`${base}/api/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "edgar@test.local", password: "edgarpw123" }),
});
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

const track = (bytes: number, name: string) =>
  new File([new Uint8Array(bytes)], name, { type: "audio/mpeg" });

async function upload(fields: Record<string, File>) {
  const form = new FormData();
  form.set("client", "Mervin John Morando");
  form.set("callDate", "2026-08-20");
  for (const [k, v] of Object.entries(fields)) form.set(k, v, v.name);
  const res = await fetch(`${base}/api/reviews`, { method: "POST", headers: { cookie }, body: form });
  return { status: res.status, body: await res.text() };
}

const REAL = MIN_AUDIO_BYTES * 4;
const jobCount = () => fs.readdirSync(dataDir).filter((f) => f.endsWith(".json")).length;
const audioCount = () => fs.readdirSync(audioDir).length;

try {
  console.log("\nTHE UPLOAD THAT REACHED PRODUCTION SEVEN TIMES:");
  const bothEmpty = await upload({ repAudio: track(0, "rep.m4a"), clientAudio: track(0, "client.m4a") });
  check("two empty tracks are refused", bothEmpty.status === 400, `got ${bothEmpty.status}`);
  check("and it says the recording didn't save", bothEmpty.body.includes("didn't save"), bothEmpty.body.slice(0, 90));

  console.log("\nONE GOOD TRACK IS NOT ENOUGH:");
  // Cherry Mae's call: the rep's own side recorded fine, the client's never did.
  // Half a two-track call cannot produce a talk ratio, so it must not be taken.
  const halfDead = await upload({ repAudio: track(REAL, "rep.m4a"), clientAudio: track(9 * 1024, "client.m4a") });
  check("an empty client track is refused", halfDead.status === 400, `got ${halfDead.status}`);
  check("the message names the client's track", halfDead.body.includes("client"), halfDead.body.slice(0, 90));

  const repDead = await upload({ repAudio: track(0, "rep.m4a"), clientAudio: track(REAL, "client.m4a") });
  check("an empty rep track is refused", repDead.status === 400, `got ${repDead.status}`);
  check("the message names the rep's track", repDead.body.includes("Your recording"), repDead.body.slice(0, 90));

  console.log("\nSINGLE-FILE UPLOADS TOO:");
  const tinySingle = await upload({ audio: track(15 * 1024, "call.m4a") });
  check("a 15 KB combined file is refused", tinySingle.status === 400, `got ${tinySingle.status}`);
  check("it reports the size back", tinySingle.body.includes("15 KB"), tinySingle.body.slice(0, 90));

  console.log("\nNOTHING IS LEFT BEHIND:");
  check("no job was created", jobCount() === 0, `${jobCount()} job file(s)`);
  check("no audio was persisted", audioCount() === 0, `${audioCount()} audio file(s)`);

  console.log("\nA REAL RECORDING STILL GETS THROUGH:");
  // Fake provider keys mean the analysis will fail later; all that matters here
  // is that the door opened and the job was accepted.
  const good = await upload({ repAudio: track(REAL, "rep.m4a"), clientAudio: track(REAL, "client.m4a") });
  check("a normal two-track upload is accepted", good.status === 202, `got ${good.status} ${good.body.slice(0, 80)}`);
  check("and it was actually stored", jobCount() === 1, `${jobCount()} job file(s)`);

  const goodSingle = await upload({ audio: track(REAL, "call.m4a") });
  check("a normal single-file upload is accepted", goodSingle.status === 202, `got ${goodSingle.status}`);

} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(failures.length ? `\n${failures.length} FAILURE(S)` : "\nAll checks passed.");
process.exitCode = failures.length ? 1 : 0;
server.close();
