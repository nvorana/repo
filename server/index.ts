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
import {
  authEnabled,
  clearSessionCookie,
  requireAuth,
  requireManager,
  roleForPassword,
  roleFromRequest,
  setSessionCookie,
} from "./auth.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, "..", "data", "reviews");
const AUDIO_DIR = process.env.AUDIO_DIR ?? path.join(__dirname, "..", "data", "audio");
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
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

const app = express();
app.set("trust proxy", 1); // behind Railway/Render's HTTPS proxy
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    authEnabled: authEnabled(),
    anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    assemblyaiKey: Boolean(process.env.ASSEMBLYAI_API_KEY),
  });
});

// --- Auth: two shared role passwords (rep / manager) ------------------------
app.post("/api/login", (req, res) => {
  const role = roleForPassword(typeof req.body.password === "string" ? req.body.password : "");
  if (!role) return res.status(401).json({ error: "Wrong password" });
  setSessionCookie(req, res, role);
  res.json({ role });
});

app.post("/api/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// Who am I? Drives which hero page the app shows.
app.get("/api/me", (req, res) => {
  if (!authEnabled()) return res.json({ role: "manager", authDisabled: true });
  const role = roleFromRequest(req);
  if (!role) return res.status(401).json({ error: "Not logged in" });
  res.json({ role });
});

// Everything below requires a logged-in role.
app.use("/api", requireAuth);

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

app.get("/api/reviews", (_req, res) => {
  // List view stays light: omit transcripts and report bodies, but include
  // per-criterion scores so the UI can aggregate rep performance.
  res.json(
    store.list().map(({ id, filename, createdAt, status, rep, error, result, coach }) => ({
      id,
      filename,
      createdAt,
      status,
      rep,
      error,
      coachReviewed: coach?.reviewed ?? false,
      hasCoachNotes: Boolean(coach?.notes),
      overallScore: result?.review.overallScore,
      summary: result?.review.summary,
      scorecard: result?.review.scorecard.map(({ criterionId, criterionName, score }) => ({
        criterionId,
        criterionName,
        score,
      })),
    })),
  );
});

app.post("/api/reviews/:id/coach", requireManager, (req, res) => {
  const job = store.get(String(req.params.id));
  if (!job) return res.status(404).json({ error: "Review not found" });
  const notes = typeof req.body.notes === "string" ? req.body.notes.slice(0, 10_000) : "";
  const reviewed = Boolean(req.body.reviewed);
  const updated = store.update(job.id, {
    coach: { notes, reviewed, updatedAt: new Date().toISOString() },
  });
  res.json(updated);
});

app.get("/api/reviews/:id/audio", (req, res) => {
  const job = store.get(req.params.id);
  if (!job?.audioFile) return res.status(404).json({ error: "No audio stored for this review" });
  const file = path.join(AUDIO_DIR, path.basename(job.audioFile));
  if (!fs.existsSync(file)) return res.status(404).json({ error: "Audio file missing" });
  res.sendFile(file);
});

app.get("/api/reviews/:id", (req, res) => {
  const job = store.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Review not found" });
  res.json(job);
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

  const rep = typeof req.body.rep === "string" ? req.body.rep.trim().slice(0, 80) : "";
  const job = store.create(req.file.originalname, rep || undefined);

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
