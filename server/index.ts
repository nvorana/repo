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
  reviewCall,
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

// Seed the first manager account from env on first boot, so the owner always
// has a way in. After that, the manager creates accounts in the app.
if (process.env.MANAGER_PASSWORD && process.env.MANAGER_EMAIL && !users.hasManager()) {
  const name = (process.env.MANAGER_NAME ?? "Manager").trim() || "Manager";
  users.create({
    name,
    email: process.env.MANAGER_EMAIL,
    role: "manager",
    password: process.env.MANAGER_PASSWORD,
  });
  console.log(`Seeded manager "${name}" <${process.env.MANAGER_EMAIL}> — log in with that email.`);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
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
  });
});

// --- Auth: individual accounts (email + password) ---------------------------
app.post("/api/login", (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const user = users.verify(email, password);
  if (!user) return res.status(401).json({ error: "Wrong email or password" });
  setSessionCookie(req, res, user.id);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
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
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
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
  const visible = asRep ? store.list().filter((job) => repOwns(job, user)) : store.list();
  // List view stays light: omit transcripts and report bodies, but include
  // per-criterion scores so the UI can aggregate rep performance. Scores are
  // withheld from reps on their own calls the coach hasn't released yet.
  res.json(
    visible.map((job) => {
      const { id, filename, createdAt, status, rep, repId, client, error, result, coach } = job;
      const released = Boolean(coach?.released);
      const base = { id, filename, createdAt, status, rep, repId, client, error, released };
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

app.post("/api/reviews/:id/coach", requireManager, (req, res) => {
  const job = store.get(String(req.params.id));
  if (!job) return res.status(404).json({ error: "Review not found" });
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
  if (!job?.audioFile) return res.status(404).json({ error: "No audio stored for this review" });
  const user = currentUser(req);
  if (roleOf(req) === "rep") {
    if (!repOwns(job, user)) return res.status(404).json({ error: "Review not found" });
    if (!repReleased(job)) {
      return res.status(403).json({ error: "Your coach hasn't released this call yet." });
    }
  }
  const file = path.join(AUDIO_DIR, path.basename(job.audioFile));
  if (!fs.existsSync(file)) return res.status(404).json({ error: "Audio file missing" });
  res.sendFile(file);
});

app.get("/api/reviews/:id", (req, res) => {
  const job = store.get(String(req.params.id));
  if (!job) return res.status(404).json({ error: "Review not found" });
  const released = Boolean(job.coach?.released);
  if (roleOf(req) === "rep") {
    const user = currentUser(req);
    if (!repOwns(job, user)) return res.status(404).json({ error: "Review not found" });
    if (!repReleased(job)) {
      // Hide the report body and coach notes until released.
      const { result: _r, coach: _c, ...rest } = job;
      void _r;
      void _c;
      return res.json({ ...rest, released });
    }
  }
  res.json({ ...job, released });
});

app.post("/api/reviews", upload.single("audio"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Upload an audio file in the 'audio' field." });
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
  const job = store.create(req.file.originalname, { rep, repId, client });

  // Keep the recording so coaches can replay moments from the report.
  try {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
    const ext = path.extname(req.file.originalname).slice(0, 10) || ".audio";
    const audioFile = `${job.id}${ext}`;
    fs.writeFileSync(path.join(AUDIO_DIR, audioFile), req.file.buffer);
    store.update(job.id, { audioFile });
  } catch (err) {
    console.error(`Could not persist audio for ${job.id}:`, err);
  }

  res.status(202).json({ id: job.id, status: job.status });

  // Fire-and-forget; clients poll GET /api/reviews/:id for progress.
  void runReview(job.id, req.file, framework);
});

async function runReview(
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

// --- Static web app (production) --------------------------------------------
// In production the built UI (dist/) is served by this same server, so one
// Railway/Render service hosts everything. In dev, Vite serves the UI instead.
const DIST_DIR = path.join(__dirname, "..", "dist");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // SPA fallback: any non-API GET serves the app shell.
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api/")) {
      return res.sendFile(path.join(DIST_DIR, "index.html"));
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log(`Sales call review API listening on http://localhost:${PORT}`);
});
