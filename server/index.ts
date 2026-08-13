import "./env.ts";
import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  answerSupport,
  AssemblyAIProvider,
  defaultFramework,
  distillLesson,
  frameworkFromMarkdown,
  reanalyzeCall,
  reviewCall,
  reviewCallFromTracks,
  type SalesFramework,
  type SupportMessage,
} from "../core/index.ts";
import { ReviewStore, type FindingFlag, type ReviewJob } from "./store.ts";
import { SupportStore } from "./support.ts";
import { LessonStore } from "./lessons.ts";
import { UserStore, toPublic, MIN_PASSWORD, type Role, type User } from "./users.ts";
import { appUrl, mailConfigured, sendPasswordReset } from "./mailer.ts";
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

const HELP_FILE = path.join(__dirname, "support", "help.md");
const supportStore = new SupportStore(path.join(DATA_DIR, "support"));
const SUPPORT_MAX_MESSAGES = 20;
const SUPPORT_MAX_CHARS = 2000;

function loadHelpNotes(): string {
  try {
    return fs.existsSync(HELP_FILE) ? fs.readFileSync(HELP_FILE, "utf8") : "";
  } catch (err) {
    console.error("Could not read support help notes:", err);
    return "";
  }
}

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

// Recover jobs stranded by a restart mid-re-analysis: only re-analysis flips
// an in-progress status onto a job that already has a stored report, so any
// such job can safely go back to completed — its previous report is intact.
for (const job of store.list()) {
  if (job.status !== "completed" && job.status !== "failed" && job.result) {
    console.warn(`Recovering review ${job.id} stranded in "${job.status}" by a restart.`);
    store.update(job.id, { status: "completed" });
  }
}

const lessonStore = new LessonStore(path.join(DATA_DIR, "lessons"));

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

// --- Password reset ---------------------------------------------------------
// Two rules shape this: never reveal whether an address has an account (so the
// response is identical either way), and never let the endpoint become a way to
// spam someone's inbox (hence the throttle).
const resetAttempts = new Map<string, { count: number; windowStart: number }>();
const RESET_WINDOW_MS = 60 * 60 * 1000;
const RESET_MAX_PER_WINDOW = 5;

function resetThrottled(key: string): boolean {
  const now = Date.now();
  const seen = resetAttempts.get(key);
  if (!seen || now - seen.windowStart > RESET_WINDOW_MS) {
    resetAttempts.set(key, { count: 1, windowStart: now });
    return false;
  }
  seen.count++;
  return seen.count > RESET_MAX_PER_WINDOW;
}

app.post("/api/password/forgot", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  // Always the same answer, whatever happens below.
  const ok = { ok: true } as const;
  if (!email) return res.json(ok);
  if (resetThrottled(email) || resetThrottled(req.ip ?? "unknown")) return res.json(ok);

  const issued = users.createResetToken(email);
  if (!issued) return res.json(ok); // no such account — say nothing

  try {
    const sent = await sendPasswordReset(issued.user.email, issued.user.name, issued.token);
    if (!sent) {
      console.warn(
        `Password reset requested for ${issued.user.email} but email is not configured ` +
          "(set RESEND_API_KEY and MAIL_FROM). The link could not be delivered.",
      );
      // Only with an explicit opt-in, and never on a real deployment: printing
      // a live reset link to the logs would be a handover of account access.
      if (process.env.MAIL_DEBUG === "1") {
        console.warn(`MAIL_DEBUG reset link: ${appUrl()}/?reset=${issued.token}`);
      }
    }
  } catch (err) {
    console.error("Could not send password reset email:", err);
  }
  return res.json(ok);
});

app.post("/api/password/reset", (req, res) => {
  const token = typeof req.body.token === "string" ? req.body.token : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (password.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
  }
  let user;
  try {
    user = users.resetPasswordWithToken(token, password);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Reset failed" });
  }
  if (!user) {
    return res
      .status(400)
      .json({ error: "That reset link has expired or was already used. Request a new one." });
  }
  // Log them straight in — they just proved control of the account's inbox.
  setSessionCookie(req, res, user.id);
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    personal: isPersonalAccount(user),
  });
});

/** Tells the login screen whether to offer "Forgot password?" at all. */
app.get("/api/password/available", (_req, res) => {
  res.json({ available: mailConfigured() });
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

// A job that carries a stored report is only visible to its rep once the
// coach releases it — regardless of status. (Re-analysis flips status back
// to "analyzing" while the previous report stays on the job; the old
// status-based shortcut leaked unreleased reports during that window.)
function repReleased(job: { coach?: { released?: boolean }; result?: unknown }): boolean {
  return !job.result || Boolean(job.coach?.released);
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

// Delivery metrics are computed deterministically from word timings in
// core/metrics.ts — there is no model judgment in them, so the rep who owns the
// call sees them as soon as analysis finishes, without waiting for a release.
function deliveryFields(result: ReviewJob["result"]) {
  if (!result) return {};
  const m = result.metrics;
  return {
    metrics: {
      talkRatio: Math.round(m.salespersonTalkRatio * 100),
      longPausesHeld: m.pauses.length,
      fillerWords: m.fillerWordCounts.salesperson,
      questionsAsked: m.questionCounts.salesperson,
      interruptions: m.interruptions.length,
    },
  };
}

// Everything the MODEL concluded. Gated behind coach release for a rep.
// NOTE: objectionRate belongs here, not in deliveryFields — it is derived from
// review.objections[].handled, which is the model's judgment call, not a
// measurement. Bundling it with the delivery metrics would leak a graded
// verdict into the pre-release view.
function judgmentFields(result: ReviewJob["result"]) {
  if (!result) return {};
  const objs = result.review.objections;
  const handled = objs.filter((o) => o.handled === "handled").length;
  return {
    overallScore: result.review.overallScore,
    summary: result.review.summary,
    scorecard: result.review.scorecard.map(({ criterionId, criterionName, score }) => ({
      criterionId,
      criterionName,
      score,
    })),
    objectionRate: objs.length ? Math.round((handled / objs.length) * 100) : null,
  };
}

app.get("/api/reviews", (req, res) => {
  const user = currentUser(req);
  const asRep = roleOf(req) === "rep";
  // Reps see only their own calls; the manager sees everyone.
  const visible = asRep
    ? store.list().filter((job) => repOwns(job, user))
    : store.list().filter((job) => managerCanSee(job, user));
  // List view stays light: omit transcripts and report bodies, but include
  // per-criterion scores so the UI can aggregate rep performance. Model
  // judgment is withheld from reps on their own calls the coach hasn't
  // released yet; the measured delivery metrics are not.
  res.json(
    visible.map((job) => {
      const { id, filename, createdAt, callDate, status, rep, repId, client, error, result, coach } =
        job;
      const released = Boolean(coach?.released);
      const base = {
        id, filename, createdAt, callDate, status, rep, repId, client, error, released,
        mixedAudio: isMixedAudio(job),
        coachReviewed: coach?.reviewed ?? false,
        ...deliveryFields(result),
      };
      if (asRep && !repReleased(job)) return base;
      return {
        ...base,
        hasCoachNotes: Boolean(coach?.notes),
        ...judgmentFields(result),
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
    // A rep may replay their OWN recording before release. The recording is
    // the rawest fact there is — it is literally their own voice — and hearing
    // yourself is what makes a filler-word count actionable. The coach's
    // judgment (score, written feedback) stays gated; the audio does not.
    if (!repOwns(job, user)) return res.status(404).json({ error: "Review not found" });
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
      // Hide the report body, coach notes and flags until released — flag
      // finding snapshots quote the hidden report verbatim. The measured
      // delivery metrics ride alongside as a flat field rather than a partial
      // `result`, so nothing downstream can mistake this for a full report.
      const { result: _r, coach: _c, flags: _f, ...rest } = job;
      void _r;
      void _c;
      void _f;
      return res.json({
        ...rest,
        released,
        mixedAudio: isMixedAudio(job),
        ...deliveryFields(job.result),
      });
    }
  } else if (!managerCanSee(job, user)) {
    return res.status(404).json({ error: "Review not found" });
  }
  // Reps get only the fields needed to render "Flagged ✓" — never a flag's
  // finding snapshot, the coach's note, or who placed it. Managers own the full data.
  const payload =
    roleOf(req) === "rep" && job.flags
      ? {
          ...job,
          flags: job.flags.map((f) => ({
            section: f.section,
            index: f.index,
            createdAt: f.createdAt,
            assessment: f.assessment,
          })),
        }
      : job;
  res.json({ ...payload, released, mixedAudio: isMixedAudio(job) });
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

app.post("/api/reviews/:id/flags", (req, res) => {
  const job = store.get(String(req.params.id));
  const user = currentUser(req);
  if (!job) return res.status(404).json({ error: "Review not found" });
  // Managers may flag anything they can see; a rep only their own released report.
  const asManager = roleOf(req) === "manager" && managerCanSee(job, user);
  const asOwner = roleOf(req) === "rep" && repOwns(job, user) && repReleased(job);
  if (!asManager && !asOwner) return res.status(404).json({ error: "Review not found" });
  if (job.status !== "completed" || !job.result) {
    return res.status(409).json({ error: "Only completed reviews can be flagged." });
  }
  const { section, index, note } = req.body as {
    section?: string;
    index?: number;
    note?: string;
  };
  if (section !== "whatWentRight" && section !== "whatWentWrong") {
    return res.status(400).json({ error: "Invalid section." });
  }
  const findings = job.result.review[section];
  if (!Number.isInteger(index) || index! < 0 || index! >= findings.length) {
    return res.status(400).json({ error: "Invalid finding index." });
  }
  const flags = job.flags ?? [];
  if (flags.some((f) => f.section === section && f.index === index)) {
    return res.status(409).json({ error: "This finding was already flagged." });
  }
  const f = findings[index!];
  const flag: FindingFlag = {
    section,
    index: index!,
    finding: { point: f.point, detail: f.detail, quote: f.quote, timestamp: f.timestamp },
    ...(typeof note === "string" && note.trim() ? { note: note.trim().slice(0, 500) } : {}),
    ...(user ? { repId: user.id } : {}),
    createdAt: new Date().toISOString(),
  };
  store.update(job.id, { flags: [...flags, flag] });
  enqueueDistillation(job.id, flag.section, flag.index);
  res.status(202).json({ ok: true });
});

app.get("/api/lessons", requireManager, (_req, res) => {
  res.json(lessonStore.list());
});

app.post("/api/lessons/:id/apply", requireManager, (req, res) => {
  try {
    res.json(lessonStore.apply(String(req.params.id)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(message.startsWith("Unknown lesson") ? 404 : 409).json({ error: message });
  }
});

app.post("/api/lessons/:id/discard", requireManager, (req, res) => {
  try {
    res.json(lessonStore.discard(String(req.params.id)));
  } catch {
    res.status(404).json({ error: "Lesson not found" });
  }
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

// --- Support chat + inbox ----------------------------------------------------
// Any logged-in user (open in open mode) can chat with the help assistant. It
// answers from help.md; anything it can't resolve becomes a ticket in the
// manager inbox. The catch path still files a ticket so a user is never left
// at a dead end.
app.post("/api/support/chat", async (req, res) => {
  const { messages, page, ticketId } = req.body as {
    messages?: SupportMessage[];
    page?: string;
    ticketId?: string;
  };
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Say something first." });
  }
  if (messages.length > SUPPORT_MAX_MESSAGES) {
    return res.status(400).json({ error: "This chat is too long — start a new one." });
  }
  // Validate every element up front: a null/primitive/bad-role element would
  // otherwise throw on m.content inside the model call and surface as a 500,
  // and an unvalidated role is a ticket-spam vector.
  const validShape = messages.every(
    (m) =>
      m &&
      typeof m === "object" &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.length <= SUPPORT_MAX_CHARS,
  );
  if (!validShape) {
    return res.status(400).json({ error: "Message too long or malformed." });
  }
  const user = currentUser(req);
  const pagePath = typeof page === "string" ? page.slice(0, 200) : "unknown";
  const userAgent = String(req.headers["user-agent"] ?? "unknown").slice(0, 300);

  // Only append to an existing ticket the caller owns; a mismatched, foreign,
  // or leaked ticketId falls through to creating a fresh ticket. In open mode
  // both sides are undefined, which correctly allows the append.
  const fileTicket = (aiSummary: string) => {
    const existing = ticketId ? supportStore.get(ticketId) : null;
    if (existing && existing.userId === user?.id) {
      const last = messages[messages.length - 1];
      return supportStore.append(ticketId!, last ? [last] : []).id;
    }
    return supportStore.create({
      ...(user ? { userId: user.id, userName: user.name } : {}),
      page: pagePath,
      userAgent,
      messages,
      aiSummary,
    }).id;
  };

  try {
    const result = await answerSupport({ messages, helpNotes: loadHelpNotes() });
    if (result.resolved) return res.json({ reply: result.reply, escalated: false });
    const id = fileTicket(result.ticketSummary ?? "Unspecified issue");
    return res.json({ reply: result.reply, escalated: true, ticketId: id });
  } catch (err) {
    console.error("Support chat failed; filing a ticket anyway:", err);
    const id = fileTicket("(AI unavailable)");
    return res.json({
      reply:
        "I couldn't reach support AI just now, but I've logged your message and the team will follow up.",
      escalated: true,
      ticketId: id,
    });
  }
});

app.get("/api/support/tickets", requireManager, (_req, res) => {
  res.json(supportStore.list());
});

app.post("/api/support/tickets/:id/resolve", requireManager, (req, res) => {
  try {
    res.json(supportStore.resolve(String(req.params.id)));
  } catch {
    res.status(404).json({ error: "Ticket not found" });
  }
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
        framework: { ...framework, lessons: lessonStore.appliedTexts(framework.id) },
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
        framework: { ...framework, lessons: lessonStore.appliedTexts(framework.id) },
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
  try {
    const job = store.get(jobId);
    if (!job || job.status !== "completed" || !job.result) return;
    const frameworks = loadFrameworks();
    const framework =
      frameworks.get(job.result.frameworkId) ?? frameworks.get(pickDefaultFrameworkId(frameworks))!;
    store.update(jobId, { status: "analyzing" });
    const result = await reanalyzeCall(job.result, {
      framework: { ...framework, lessons: lessonStore.appliedTexts(framework.id) },
    });
    store.update(jobId, { status: "completed", result, reanalyzedAt: new Date().toISOString() });
  } catch (err) {
    // Never lose the existing report — restore it and move on.
    console.error(`Re-analysis of ${jobId} failed; keeping the previous report:`, err);
    try {
      store.update(jobId, { status: "completed" });
    } catch {
      // Job vanished mid-flight (deleted) — nothing to restore.
    }
  }
}

// --- Flag distillation --------------------------------------------------------
// Each rep flag gets one skeptical model pass; substantive flags become
// proposed lessons for the coach. Same hardened sequential pattern as
// re-analysis: in-memory FIFO, nothing may escape the drain.
// A flag's identity is (jobId, section, index) — unique per review, enforced
// by the endpoint's duplicate-flag 409.
const distillQueue: { jobId: string; section: FindingFlag["section"]; index: number }[] = [];
let distillDraining = false;

function enqueueDistillation(jobId: string, section: FindingFlag["section"], index: number) {
  if (distillQueue.some((q) => q.jobId === jobId && q.section === section && q.index === index)) {
    return;
  }
  distillQueue.push({ jobId, section, index });
  void drainDistillQueue();
}

async function drainDistillQueue() {
  if (distillDraining) return;
  distillDraining = true;
  try {
    while (distillQueue.length > 0) {
      await runDistillation(distillQueue[0]);
      distillQueue.shift();
    }
  } finally {
    distillDraining = false;
  }
}

async function runDistillation({
  jobId,
  section,
  index,
}: {
  jobId: string;
  section: FindingFlag["section"];
  index: number;
}) {
  try {
    const job = store.get(jobId);
    const flag = job?.flags?.find((f) => f.section === section && f.index === index);
    if (!job?.result || !flag || flag.assessment) return;
    const frameworks = loadFrameworks();
    const framework =
      frameworks.get(job.result.frameworkId) ?? frameworks.get(pickDefaultFrameworkId(frameworks))!;
    const verdict = await distillLesson({
      finding: flag.finding,
      section: flag.section,
      note: flag.note,
      transcript: job.result.transcript,
      framework,
    });
    if (verdict.lesson) {
      lessonStore.propose({
        frameworkId: framework.id,
        text: verdict.lesson,
        rationale: verdict.rationale,
        sourceReviewId: job.id,
        sourceFindingPoint: flag.finding.point,
        ...(flag.note ? { sourceNote: flag.note } : {}),
      });
    }
    // Re-read before stamping — the job may have changed while the model ran.
    const fresh = store.get(jobId);
    if (!fresh?.flags) return;
    const assessment: FindingFlag["assessment"] = verdict.lesson ? "lesson_proposed" : "no_lesson";
    const stamped = fresh.flags.map((f) =>
      f.section === section && f.index === index ? { ...f, assessment } : f,
    );
    store.update(jobId, { flags: stamped });
  } catch (err) {
    console.error(`Distillation for review ${jobId} failed; flag stays unprocessed:`, err);
  }
}

// Move unreadable review files aside once, at boot. A truncated file can never
// be recovered, and leaving it in place makes every later list request pay to
// re-read and re-fail on it. (Production accumulated 33 of these, which flooded
// the logs badly enough to stall request handling.)
{
  const moved = store.quarantineCorrupt();
  if (moved > 0) {
    console.warn(
      `Quarantined ${moved} unreadable review file(s) to ${path.join(DATA_DIR, "corrupt")}. ` +
        "Their reports are unrecoverable; the calls must be re-uploaded.",
    );
  }
}

// Boot sweep: retry flags a restart left unprocessed (idempotent — one model
// call per unprocessed flag at most).
for (const job of store.list()) {
  for (const flag of job.flags ?? []) {
    if (!flag.assessment) enqueueDistillation(job.id, flag.section, flag.index);
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

// Exported so a harness that imports this module can shut the listener down
// and exit cleanly (see scripts/verify-release-gate.ts). Unused in production.
export const server = app.listen(PORT, () => {
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
