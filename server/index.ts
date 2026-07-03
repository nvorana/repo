import "./env.ts";
import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AssemblyAIProvider,
  defaultFramework,
  frameworkFromMarkdown,
  reanalyzeCall,
  reviewCall,
  reviewCallFromTracks,
  type SalesFramework,
} from "../core/index.ts";
import { ReviewStore } from "./store.ts";
import { UserStore, toPublic, type Role, type User } from "./users.ts";
import {
  clearSessionCookie,
  setSessionCookie,
  userIdFromRequest,
} from "./auth.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, "..", "data", "reviews");
const AUDIO_DIR = process.env.AUDIO_DIR ?? path.join(__dirname, "..", "data", "audio");
const AVATAR_DIR = process.env.AVATAR_DIR ?? path.join(DATA_DIR, "..", "avatars");
const USERS_FILE = process.env.USERS_FILE ?? path.join(DATA_DIR, "..", "users.json");
const FRAMEWORKS_DIR = path.join(__dirname, "frameworks");
const MAX_UPLOAD_MB = 250;

// --- Framework registry ----------------------------------------------------
// Drop a markdown file in server/frameworks/ to add your own methodology.
// The file name (minus .md) becomes its id; first "# Heading" is its name.
function loadFrameworks(): Map<string, SalesFramework> {
  const frameworks = new Map<string, SalesFramework>([[defaultFramework.id, defaultFramework]]);
  if (fs.existsSync(FRAMEWORKS_DIR)) {
    const files = fs
      .readdirSync(FRAMEWORKS_DIR)
      .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md");
    for (const file of files) {
      const id = file.replace(/\.md$/, "");
      const markdown = fs.readFileSync(path.join(FRAMEWORKS_DIR, file), "utf8");
      const name = markdown.match(/^#\s+(.+)$/m)?.[1] ?? id;
      frameworks.set(id, frameworkFromMarkdown(id, name, markdown));
    }
  }
  return frameworks;
}

// The default for new reviews: DEFAULT_FRAMEWORK_ID env var if set, else the
// sole custom framework when exactly one exists, else the general built-in.
function pickDefaultFrameworkId(frameworks: Map<string, SalesFramework>): string {
  const preferred = process.env.DEFAULT_FRAMEWORK_ID;
  if (preferred && frameworks.has(preferred)) return preferred;
  const custom = [...frameworks.keys()].filter((id) => id !== defaultFramework.id);
  return custom.length === 1 ? custom[0] : defaultFramework.id;
}

// --- App -------------------------------------------------------------------

const store = new ReviewStore(DATA_DIR);
const users = new UserStore(USERS_FILE);

// Ensure an admin login from env: whenever MANAGER_EMAIL + MANAGER_PASSWORD are
// set and that email has no account yet, create a manager for it. This both
// seeds the first boot and provides a recovery login if you're ever locked out.
if (
  process.env.MANAGER_PASSWORD &&
  process.env.MANAGER_EMAIL &&
  !users.getByEmail(process.env.MANAGER_EMAIL)
) {
  const name = (process.env.MANAGER_NAME ?? "Manager").trim() || "Manager";
  try {
    users.create({
      name,
      email: process.env.MANAGER_EMAIL,
      role: "manager",
      password: process.env.MANAGER_PASSWORD,
    });
    console.log(`Ensured manager "${name}" <${process.env.MANAGER_EMAIL}> — log in with that email.`);
  } catch (err) {
    // A bad MANAGER_* config must not crash the whole app on boot.
    console.error("Could not seed manager from env (check MANAGER_EMAIL/PASSWORD):", err);
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

// Profile photos: small, image-only uploads kept on the volume next to reviews.
const AVATAR_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, Boolean(AVATAR_EXT[file.mimetype])),
});

const app = express();
app.set("trust proxy", 1); // behind Railway/Render's HTTPS proxy
app.use(express.json());

// Auth is active whenever any account exists. With none (fresh dev box) the
// app runs open and treats the caller as a manager.
function authEnabled(): boolean {
  return users.count() > 0;
}

function currentUser(req: express.Request): User | null {
  const id = userIdFromRequest(req);
  return id ? users.getById(id) : null;
}

function roleOf(req: express.Request): Role {
  return currentUser(req)?.role ?? (authEnabled() ? "rep" : "manager");
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    authEnabled: authEnabled(),
    anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    assemblyaiKey: Boolean(process.env.ASSEMBLYAI_API_KEY),
    dataDir: DATA_DIR,
    audioDir: AUDIO_DIR,
    avatarDir: AVATAR_DIR,
    // True when storage points at a mounted volume path (persists across deploys).
    persistentStorage: DATA_DIR.startsWith("/data"),
    reviewCount: store.list().length,
    userCount: users.count(),
  });
});

// --- Auth: individual accounts (email + password) ---------------------------
app.post("/api/login", (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const user = users.verify(email, password);
  if (!user) return res.status(401).json({ error: "Wrong email or password" });
  setSessionCookie(req, res, user.id);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, personal: isPersonalAccount(user) });
});

app.post("/api/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  if (!authEnabled()) {
    return res.json({ id: "", name: "Admin", email: "", role: "manager", authDisabled: true });
  }
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, personal: isPersonalAccount(user) });
});

// Everything below requires a logged-in user (open when no accounts exist).
app.use("/api", (req, res, next) => {
  if (!authEnabled() || currentUser(req)) return next();
  res.status(401).json({ error: "Not logged in" });
});

function requireManager(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!authEnabled() || currentUser(req)?.role === "manager") return next();
  res.status(403).json({ error: "Only the sales head can do this" });
}

// --- User administration (manager only) -------------------------------------
app.get("/api/users", requireManager, (_req, res) => {
  res.json(users.list());
});

app.post("/api/users", requireManager, (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name : "";
  const email = typeof req.body.email === "string" ? req.body.email : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const role: Role = req.body.role === "manager" ? "manager" : "rep";
  const wasOpen = !authEnabled(); // before this create
  try {
    const user = users.create({ name, email, role, password });
    // If the very first account is created from open mode, log the creator in
    // as it (when it's a manager) so they don't lock themselves out the instant
    // auth turns on.
    if (wasOpen && user.role === "manager") setSessionCookie(req, res, user.id);
    res.status(201).json(toPublic(user));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not create user" });
  }
});

app.post("/api/users/:id/password", requireManager, (req, res) => {
  const password = typeof req.body.password === "string" ? req.body.password : "";
  try {
    users.setPassword(String(req.params.id), password);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not set password" });
  }
});

app.delete("/api/users/:id", requireManager, (req, res) => {
  try {
    users.remove(String(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not remove user" });
  }
});

// --- Profile photos ---------------------------------------------------------
// Upload/replace and remove are manager-only; the image itself is readable by
// any logged-in user so it can render in the team reports.
app.post("/api/users/:id/avatar", requireManager, avatarUpload.single("avatar"), (req, res) => {
  const id = String(req.params.id);
  if (!users.getById(id)) return res.status(404).json({ error: "User not found" });
  if (!req.file) {
    return res.status(400).json({ error: "Upload a JPG, PNG, WebP or GIF image (max 5 MB)." });
  }
  const ext = AVATAR_EXT[req.file.mimetype];
  try {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
    // Drop any prior photo with a different extension so only one file per user.
    for (const e of Object.values(AVATAR_EXT)) {
      const old = path.join(AVATAR_DIR, `${id}.${e}`);
      if (e !== ext && fs.existsSync(old)) fs.rmSync(old);
    }
    fs.writeFileSync(path.join(AVATAR_DIR, `${id}.${ext}`), req.file.buffer);
    users.setAvatarExt(id, ext);
    res.json(toPublic(users.getById(id)!));
  } catch (err) {
    console.error(`Could not save avatar for ${id}:`, err);
    res.status(500).json({ error: "Could not save the photo." });
  }
});

app.delete("/api/users/:id/avatar", requireManager, (req, res) => {
  const id = String(req.params.id);
  const u = users.getById(id);
  if (!u) return res.status(404).json({ error: "User not found" });
  if (u.avatarExt) {
    const file = path.join(AVATAR_DIR, `${id}.${u.avatarExt}`);
    try {
      if (fs.existsSync(file)) fs.rmSync(file);
    } catch (err) {
      console.error(`Could not delete avatar for ${id}:`, err);
    }
  }
  users.clearAvatar(id);
  res.json({ ok: true });
});

app.get("/api/users/:id/avatar", (req, res) => {
  const u = users.getById(String(req.params.id));
  if (!u?.avatarExt) return res.status(404).json({ error: "No photo" });
  const file = path.join(AVATAR_DIR, `${u.id}.${u.avatarExt}`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: "No photo" });
  res.set("Cache-Control", "private, max-age=300");
  res.sendFile(file);
});

// A report is hidden from reps until the sales head releases it — this is the
// accountability gate: reps only see their report after the 1:1 feedback.
function repReleased(job: { status: string; coach?: { released?: boolean } }): boolean {
  return job.status !== "completed" || Boolean(job.coach?.released);
}

// Reps can only ever touch their own calls (server-enforced). Match on the
// stable account id; fall back to display name for calls created before ids.
function repOwns(job: { rep?: string; repId?: string }, user: User | null): boolean {
  if (!user) return false;
  if (job.repId) return job.repId === user.id;
  return Boolean(job.rep && job.rep.toLowerCase() === user.name.toLowerCase());
}

// Derived, never stored: a review analyzed from one mixed audio file has
// guessed speaker attribution, so its numbers are lower-confidence.
function isMixedAudio(job: { repAudioFile?: string; clientAudioFile?: string }): boolean {
  return !(job.repAudioFile && job.clientAudioFile);
}

// Personal accounts: their calls are excluded from team reporting and kept
// private to the owner. Defaults to the app owner; override via the
// PERSONAL_EMAILS env var (comma-separated).
const PERSONAL_EMAILS = new Set(
  (process.env.PERSONAL_EMAILS ?? "nvorana@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);
function isPersonalAccount(user: User | null | undefined): boolean {
  return Boolean(user && PERSONAL_EMAILS.has(user.email.toLowerCase()));
}
function ownerIsPersonal(job: { repId?: string }): boolean {
  return job.repId ? isPersonalAccount(users.getById(job.repId)) : false;
}

// A manager sees all non-personal calls plus their OWN personal calls,
// but never another user's personal (owner) call.
function managerCanSee(job: { repId?: string }, user: User | null): boolean {
  if (!ownerIsPersonal(job)) return true;
  return Boolean(user && job.repId === user.id);
}

app.get("/api/frameworks", (_req, res) => {
  const frameworks = loadFrameworks();
  const defaultId = pickDefaultFrameworkId(frameworks);
  res.json(
    [...frameworks.values()].map((f) => ({
      id: f.id,
      name: f.name,
      criteria: f.criteria,
      isDefault: f.id === defaultId,
    })),
  );
});

app.get("/api/reviews", (req, res) => {
  const user = currentUser(req);
  const asRep = roleOf(req) === "rep";
  // Reps see only their own calls; the manager sees everyone.
  const visible = asRep
    ? store.list().filter((job) => repOwns(job, user))
    : store.list().filter((job) => managerCanSee(job, user));
  // List view stays light: omit transcripts and report bodies, but include
  // per-criterion scores so the UI can aggregate rep performance. Scores are
  // withheld from reps on their own calls the coach hasn't released yet.
  res.json(
    visible.map((job) => {
      const { id, filename, createdAt, callDate, status, rep, repId, client, error, result, coach } =
        job;
      const released = Boolean(coach?.released);
      const base = {
        id, filename, createdAt, callDate, status, rep, repId, client, error, released,
        mixedAudio: isMixedAudio(job),
      };
      if (asRep && !repReleased(job)) {
        return { ...base, coachReviewed: coach?.reviewed ?? false };
      }
      return {
        ...base,
        coachReviewed: coach?.reviewed ?? false,
        hasCoachNotes: Boolean(coach?.notes),
        overallScore: result?.review.overallScore,
        summary: result?.review.summary,
        scorecard: result?.review.scorecard.map(({ criterionId, criterionName, score }) => ({
          criterionId,
          criterionName,
          score,
        })),
      };
    }),
  );
});

app.delete("/api/reviews/:id", requireManager, (req, res) => {
  const job = store.get(String(req.params.id));
  if (!job) return res.status(404).json({ error: "Review not found" });
  if (!managerCanSee(job, currentUser(req))) return res.status(404).json({ error: "Review not found" });
  // Remove the audio files too — that's what frees disk space.
  for (const name of [job.audioFile, job.repAudioFile, job.clientAudioFile]) {
    if (!name) continue;
    const file = path.join(AUDIO_DIR, path.basename(name));
    try {
      if (fs.existsSync(file)) fs.rmSync(file);
    } catch (err) {
      console.error(`Could not delete audio for ${job.id}:`, err);
    }
  }
  store.delete(job.id);
  res.json({ ok: true });
});

app.post("/api/reviews/:id/coach", requireManager, (req, res) => {
  const job = store.get(String(req.params.id));
  if (!job) return res.status(404).json({ error: "Review not found" });
  if (!managerCanSee(job, currentUser(req))) return res.status(404).json({ error: "Review not found" });
  const notes = typeof req.body.notes === "string" ? req.body.notes.slice(0, 10_000) : "";
  const reviewed = Boolean(req.body.reviewed);
  const released = Boolean(req.body.released);
  const updated = store.update(job.id, {
    coach: { notes, reviewed, released, updatedAt: new Date().toISOString() },
  });
  res.json(updated);
});

app.get("/api/reviews/:id/audio", (req, res) => {
  const job = store.get(String(req.params.id));
  if (!job) return res.status(404).json({ error: "Review not found" });
  const track = req.query.track === "client" ? "client" : req.query.track === "rep" ? "rep" : null;
  const name =
    track === "rep"
      ? (job.repAudioFile ?? job.audioFile)
      : track === "client"
        ? job.clientAudioFile
        : (job.audioFile ?? job.repAudioFile);
  if (!name) return res.status(404).json({ error: "No audio stored for this review" });
  const user = currentUser(req);
  if (roleOf(req) === "rep") {
    if (!repOwns(job, user)) return res.status(404).json({ error: "Review not found" });
    if (!repReleased(job)) {
      return res.status(403).json({ error: "Your coach hasn't released this call yet." });
    }
  } else if (!managerCanSee(job, user)) {
    return res.status(404).json({ error: "Review not found" });
  }
  const file = path.join(AUDIO_DIR, path.basename(name));
  if (!fs.existsSync(file)) return res.status(404).json({ error: "Audio file missing" });
  res.sendFile(file);
});

app.get("/api/reviews/:id", (req, res) => {
  const job = store.get(String(req.params.id));
  if (!job) return res.status(404).json({ error: "Review not found" });
  const released = Boolean(job.coach?.released);
  const user = currentUser(req);
  if (roleOf(req) === "rep") {
    if (!repOwns(job, user)) return res.status(404).json({ error: "Review not found" });
    if (!repReleased(job)) {
      // Hide the report body and coach notes until released.
      const { result: _r, coach: _c, ...rest } = job;
      void _r;
      void _c;
      return res.json({ ...rest, released, mixedAudio: isMixedAudio(job) });
    }
  } else if (!managerCanSee(job, user)) {
    return res.status(404).json({ error: "Review not found" });
  }
  res.json({ ...job, released, mixedAudio: isMixedAudio(job) });
});

app.post("/api/reviews/:id/reanalyze", requireManager, (req, res) => {
  const job = store.get(String(req.params.id));
  if (!job || !managerCanSee(job, currentUser(req))) {
    return res.status(404).json({ error: "Review not found" });
  }
  if (job.status !== "completed" || !job.result) {
    return res.status(409).json({ error: "Only completed reviews can be re-analyzed." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "Server is missing ANTHROPIC_API_KEY — see .env.example." });
  }
  if (!enqueueReanalysis(job.id)) {
    return res.status(409).json({ error: "This review is already being re-analyzed." });
  }
  res.status(202).json({ ok: true });
});

app.post("/api/reanalyze/mine", requireManager, (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "Server is missing ANTHROPIC_API_KEY — see .env.example." });
  }
  const own = store
    .list()
    .filter((j) => j.repId === user.id && j.status === "completed" && j.result);
  let queued = 0;
  for (const j of own) if (enqueueReanalysis(j.id)) queued++;
  res.status(202).json({ queued });
});

app.post("/api/reviews", upload.fields([{ name: "audio", maxCount: 1 }, { name: "repAudio", maxCount: 1 }, { name: "clientAudio", maxCount: 1 }]), (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const repFile = files?.repAudio?.[0];
  const clientFile = files?.clientAudio?.[0];
  const singleFile = files?.audio?.[0];
  const twoTracks = Boolean(repFile && clientFile);
  if (!twoTracks && !singleFile) {
    return res.status(400).json({
      error: "Upload a recording — either one combined file, or both participants' separate files.",
    });
  }
  if (!process.env.ASSEMBLYAI_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: "Server is missing ASSEMBLYAI_API_KEY and/or ANTHROPIC_API_KEY — see .env.example.",
    });
  }

  const frameworks = loadFrameworks();
  const frameworkId =
    (req.body.frameworkId as string | undefined) || pickDefaultFrameworkId(frameworks);
  const framework = frameworks.get(frameworkId);
  if (!framework) {
    return res.status(400).json({ error: `Unknown framework: ${frameworkId}` });
  }

  // The salesperson is the logged-in account (server-trusted). A manager may
  // upload on behalf of a named rep; otherwise the call is owned by the uploader.
  const me = currentUser(req);
  const bodyRep = typeof req.body.rep === "string" ? req.body.rep.trim().slice(0, 80) : "";
  let rep: string | undefined;
  let repId: string | undefined;
  if (me?.role === "rep") {
    rep = me.name;
    repId = me.id;
  } else if (me) {
    if (bodyRep && bodyRep.toLowerCase() !== me.name.toLowerCase()) {
      rep = bodyRep; // on behalf of someone else (no owning account id)
    } else {
      rep = me.name;
      repId = me.id;
    }
  } else {
    rep = bodyRep || undefined;
  }

  const client = typeof req.body.client === "string" ? req.body.client.trim().slice(0, 120) : "";
  if (!client) {
    return res.status(400).json({ error: "Client name is required." });
  }
  // Optional date the call actually happened (YYYY-MM-DD); trends bucket by this.
  const rawDate = typeof req.body.callDate === "string" ? req.body.callDate.trim() : "";
  const callDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;
  const job = store.create((twoTracks ? repFile! : singleFile!).originalname, {
    rep,
    repId,
    client,
    callDate,
  });

  // Persist audio so coaches can replay moments from the report.
  try {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
    if (twoTracks) {
      const repExt = path.extname(repFile!.originalname).slice(0, 10) || ".audio";
      const clientExt = path.extname(clientFile!.originalname).slice(0, 10) || ".audio";
      const repAudioFile = `${job.id}-rep${repExt}`;
      const clientAudioFile = `${job.id}-client${clientExt}`;
      fs.writeFileSync(path.join(AUDIO_DIR, repAudioFile), repFile!.buffer);
      fs.writeFileSync(path.join(AUDIO_DIR, clientAudioFile), clientFile!.buffer);
      store.update(job.id, { repAudioFile, clientAudioFile });
    } else {
      const ext = path.extname(singleFile!.originalname).slice(0, 10) || ".audio";
      const audioFile = `${job.id}${ext}`;
      fs.writeFileSync(path.join(AUDIO_DIR, audioFile), singleFile!.buffer);
      store.update(job.id, { audioFile });
    }
  } catch (err) {
    console.error(`Could not persist audio for ${job.id}:`, err);
  }

  res.status(202).json({ id: job.id, status: job.status });

  // Fire-and-forget; clients poll GET /api/reviews/:id for progress.
  if (twoTracks) {
    void runReviewFromTracks(job.id, repFile!, clientFile!, framework);
  } else {
    void runReviewSingle(job.id, singleFile!, framework);
  }
});

// Single combined file: uses diarization + AI speaker-ID (talk ratio is an
// estimate — the UI flags it). Kept so reps not yet recording separate tracks
// aren't blocked.
async function runReviewSingle(
  jobId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string },
  framework: SalesFramework,
) {
  try {
    const result = await reviewCall(
      { data: file.buffer, filename: file.originalname, mimeType: file.mimetype },
      {
        transcriber: new AssemblyAIProvider(process.env.ASSEMBLYAI_API_KEY!),
        framework,
        onStage: (stage) => store.update(jobId, { status: stage }),
      },
    );
    store.update(jobId, { status: "completed", result });
  } catch (err) {
    console.error(`Review ${jobId} failed:`, err);
    store.update(jobId, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function runReviewFromTracks(
  jobId: string,
  repFile: { buffer: Buffer; originalname: string; mimetype: string },
  clientFile: { buffer: Buffer; originalname: string; mimetype: string },
  framework: SalesFramework,
) {
  try {
    const result = await reviewCallFromTracks(
      {
        repAudio: { data: repFile.buffer, filename: repFile.originalname, mimeType: repFile.mimetype },
        clientAudio: {
          data: clientFile.buffer,
          filename: clientFile.originalname,
          mimeType: clientFile.mimetype,
        },
      },
      {
        transcriber: new AssemblyAIProvider(process.env.ASSEMBLYAI_API_KEY!),
        framework,
        onStage: (stage) => store.update(jobId, { status: stage }),
      },
    );
    store.update(jobId, { status: "completed", result });
  } catch (err) {
    console.error(`Review ${jobId} failed:`, err);
    store.update(jobId, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// --- Re-analysis -------------------------------------------------------------
// Re-scores a completed review from its stored transcript (no re-transcription).
// In-memory FIFO, drained one job at a time so bulk re-analysis doesn't hammer
// the model API. Lost on restart — acceptable for a manual, occasional action.
const reanalyzeQueue: string[] = [];
let reanalyzeDraining = false;

function enqueueReanalysis(jobId: string): boolean {
  if (reanalyzeQueue.includes(jobId)) return false;
  reanalyzeQueue.push(jobId);
  void drainReanalyzeQueue();
  return true;
}

async function drainReanalyzeQueue() {
  if (reanalyzeDraining) return;
  reanalyzeDraining = true;
  try {
    while (reanalyzeQueue.length > 0) {
      // Keep the id in the queue while it runs so re-enqueueing is blocked.
      await runReanalysis(reanalyzeQueue[0]);
      reanalyzeQueue.shift();
    }
  } finally {
    reanalyzeDraining = false;
  }
}

async function runReanalysis(jobId: string) {
  const job = store.get(jobId);
  if (!job || job.status !== "completed" || !job.result) return;
  const frameworks = loadFrameworks();
  const framework =
    frameworks.get(job.result.frameworkId) ?? frameworks.get(pickDefaultFrameworkId(frameworks))!;
  store.update(jobId, { status: "analyzing" });
  try {
    const result = await reanalyzeCall(job.result, { framework });
    store.update(jobId, { status: "completed", result, reanalyzedAt: new Date().toISOString() });
  } catch (err) {
    // Never lose the existing report — restore it and move on.
    console.error(`Re-analysis of ${jobId} failed; keeping the previous report:`, err);
    store.update(jobId, { status: "completed" });
  }
}

// --- Static web app (production) --------------------------------------------
// In production the built UI (dist/) is served by this same server, so one
// Railway/Render service hosts everything. In dev, Vite serves the UI instead.
const DIST_DIR = path.join(__dirname, "..", "dist");
if (fs.existsSync(DIST_DIR)) {
  // Assets are content-hashed (safe to cache forever); index.html must always
  // revalidate so a new deploy is picked up instead of a stale cached shell.
  app.use(
    express.static(DIST_DIR, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );
  // SPA fallback: any non-API GET serves the app shell.
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-cache");
      return res.sendFile(path.join(DIST_DIR, "index.html"));
    }
    next();
  });
}

// Turn upload/parse failures into a clear message instead of a bare 500.
// (e.g. an old cached client posting an unexpected field, or an oversized file.)
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const e = err as { code?: string; message?: string };
    if (e?.code === "LIMIT_UNEXPECTED_FILE" || e?.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "Couldn't read the upload. Refresh the page (Ctrl+Shift+R) and try again." });
    }
    console.error("Unhandled request error:", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Something went wrong handling that request. Please try again." });
  },
);

app.listen(PORT, () => {
  console.log(`Sales call review API listening on http://localhost:${PORT}`);
  console.log(
    `Storage: DATA_DIR=${DATA_DIR} AUDIO_DIR=${AUDIO_DIR} ` +
      `(persistent=${DATA_DIR.startsWith("/data")}, reviews=${store.list().length}, users=${users.count()})`,
  );
  if (!DATA_DIR.startsWith("/data")) {
    console.warn(
      "WARNING: DATA_DIR is not on a mounted volume — uploads will be LOST on every redeploy. " +
        "Set DATA_DIR=/data/reviews and AUDIO_DIR=/data/audio and attach a volume at /data.",
    );
  }
});
