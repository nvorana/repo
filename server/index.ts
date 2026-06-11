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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, "..", "data", "reviews");
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

// --- App -------------------------------------------------------------------

const store = new ReviewStore(DATA_DIR);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    assemblyaiKey: Boolean(process.env.ASSEMBLYAI_API_KEY),
  });
});

app.get("/api/frameworks", (_req, res) => {
  const frameworks = loadFrameworks();
  res.json(
    [...frameworks.values()].map((f) => ({
      id: f.id,
      name: f.name,
      criteria: f.criteria,
    })),
  );
});

app.get("/api/reviews", (_req, res) => {
  // List view stays light: omit full transcripts/reports.
  res.json(
    store.list().map(({ id, filename, createdAt, status, error, result }) => ({
      id,
      filename,
      createdAt,
      status,
      error,
      overallScore: result?.review.overallScore,
      summary: result?.review.summary,
    })),
  );
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
  const frameworkId = (req.body.frameworkId as string | undefined) ?? defaultFramework.id;
  const framework = frameworks.get(frameworkId);
  if (!framework) {
    return res.status(400).json({ error: `Unknown framework: ${frameworkId}` });
  }

  const job = store.create(req.file.originalname);
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

app.listen(PORT, () => {
  console.log(`Sales call review API listening on http://localhost:${PORT}`);
});
