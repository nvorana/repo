# SalesCallOS — AI Sales Call Review

Upload a one-on-one sales call recording and get back a structured coaching
review: what went right, what went wrong, **every objection** (explicit and
the implicit ones that were never voiced or never handled), a delivery
analysis grounded in real audio metrics (talk ratio, pace, pauses,
interruptions, filler words), a scorecard against your sales framework, and
prioritized coaching advice.

## Architecture — built for reuse

The app is three independent layers; each lower layer knows nothing about the
ones above it, so the engine can be embedded anywhere.

```
core/      The engine. Pure TypeScript, no React/Express. Audio in → review out.
server/    Thin REST API hosting the engine (Express). Async jobs + JSON storage.
src/       React web UI — just one consumer of the REST API.
```

### Use it as a library

```ts
import { reviewCall, AssemblyAIProvider } from "./core/index.ts";

const result = await reviewCall(
  { data: audioBuffer, filename: "call.mp3" },
  { transcriber: new AssemblyAIProvider(process.env.ASSEMBLYAI_API_KEY!) },
);
// result.review     → structured report (objections, scorecard, coaching...)
// result.metrics    → objective delivery metrics (pauses, talk ratio...)
// result.transcript → diarized transcript with timestamps
```

Embed it in a CLI, a Slack bot, a queue worker, a CRM hook — anything that can
hand it audio bytes.

### Use it over HTTP

| Endpoint | Purpose |
|---|---|
| `POST /api/reviews` | multipart upload, field `audio` (+ optional `frameworkId`); returns `202 {id}` |
| `GET /api/reviews/:id` | job status (`queued → transcribing → identifying_speakers → analyzing → completed`) + full report |
| `GET /api/reviews` | list of reviews (light) |
| `GET /api/frameworks` | available scoring frameworks |
| `GET /api/health` | server + key configuration check |

### Swap the parts

- **Transcription** — `TranscriptionProvider` interface
  (`core/transcription/provider.ts`). AssemblyAI is the default (speaker
  diarization + word timestamps); implement the interface to use Deepgram,
  Whisper, or an on-prem model.
- **Sales framework** — drop a markdown file in `server/frameworks/` to score
  calls against your own methodology (see the README there), or pass a
  `SalesFramework` object to `reviewCall` directly. The default is a general
  best-practices rubric.
- **Storage** — `server/store.ts` writes one JSON file per review; replace it
  with a database without touching the engine.

## How a review works

1. **Transcribe** — AssemblyAI produces a diarized transcript with word-level
   timestamps (`speakers_expected: 2`, disfluencies kept for filler analysis).
2. **Identify speakers** — Claude maps the anonymous diarization labels to
   salesperson vs. prospect.
3. **Measure** — delivery metrics are computed *in code* from word timings
   (pauses >1.5s with surrounding context, interruptions, talk ratio, WPM,
   monologues, questions, filler words) so the tonality review is grounded in
   real numbers, not model guesses.
4. **Review** — Claude (`claude-opus-4-8`, adaptive thinking, streaming,
   structured output validated against a zod schema) reviews the full
   transcript + metrics against the active sales framework.

## Getting started

```sh
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY and ASSEMBLYAI_API_KEY
npm run dev            # API on :8787, web app on :5173 (proxied)
```

Then open http://localhost:5173 and drop in a call recording (mp3, m4a, wav,
ogg, webm — up to 250 MB).

### Keys

- `ANTHROPIC_API_KEY` — the review model. https://platform.claude.com/
- `ASSEMBLYAI_API_KEY` — transcription + diarization. https://www.assemblyai.com/

Both stay server-side; the browser only talks to the local API.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | API server + web app together (watch mode) |
| `npm run dev:server` / `dev:web` | each side individually |
| `npm run build` | typecheck everything + production web build |
| `npm run start:server` | run the API server |
| `npm run lint` | ESLint |
