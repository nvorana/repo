import type {
  Transcript,
  TranscriptUtterance,
  TranscriptWord,
} from "../types.ts";
import type { AudioInput, TranscriptionProvider } from "./provider.ts";

const BASE_URL = "https://api.assemblyai.com/v2";

interface AssemblyAIWord {
  text: string;
  start: number;
  end: number;
  speaker: string | null;
}

interface AssemblyAIUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
  words: AssemblyAIWord[];
}

interface AssemblyAITranscript {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  error?: string;
  text?: string;
  audio_duration?: number;
  language_code?: string;
  utterances?: AssemblyAIUtterance[];
}

/**
 * Default transcription provider. AssemblyAI gives speaker diarization and
 * word-level timestamps, which the metrics layer needs for pause/talk-ratio
 * analysis. Requires ASSEMBLYAI_API_KEY.
 */
export class AssemblyAIProvider implements TranscriptionProvider {
  readonly id = "assemblyai";
  private readonly apiKey: string;
  private readonly pollIntervalMs: number;

  constructor(apiKey: string, pollIntervalMs = 3000) {
    if (!apiKey) {
      throw new Error("AssemblyAIProvider requires an API key (ASSEMBLYAI_API_KEY).");
    }
    this.apiKey = apiKey;
    this.pollIntervalMs = pollIntervalMs;
  }

  async transcribe(audio: AudioInput): Promise<Transcript> {
    const uploadUrl = await this.upload(audio);
    const id = await this.requestTranscript(uploadUrl);
    const result = await this.poll(id);
    return toTranscript(result);
  }

  private async upload(audio: AudioInput): Promise<string> {
    const res = await fetch(`${BASE_URL}/upload`, {
      method: "POST",
      headers: {
        authorization: this.apiKey,
        "content-type": "application/octet-stream",
      },
      body: new Uint8Array(audio.data),
    });
    if (!res.ok) {
      throw new Error(`AssemblyAI upload failed (${res.status}): ${await res.text()}`);
    }
    const body = (await res.json()) as { upload_url: string };
    return body.upload_url;
  }

  private async requestTranscript(audioUrl: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/transcript`, {
      method: "POST",
      headers: {
        authorization: this.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        speaker_labels: true,
        // One-on-one sales calls: hinting two speakers improves diarization.
        speakers_expected: 2,
        punctuate: true,
        format_text: true,
        disfluencies: true, // keep "um"/"uh" — needed for filler-word metrics
        language_detection: true,
      }),
    });
    if (!res.ok) {
      throw new Error(`AssemblyAI transcript request failed (${res.status}): ${await res.text()}`);
    }
    const body = (await res.json()) as { id: string };
    return body.id;
  }

  private async poll(id: string): Promise<AssemblyAITranscript> {
    for (;;) {
      const res = await fetch(`${BASE_URL}/transcript/${id}`, {
        headers: { authorization: this.apiKey },
      });
      if (!res.ok) {
        throw new Error(`AssemblyAI poll failed (${res.status}): ${await res.text()}`);
      }
      const body = (await res.json()) as AssemblyAITranscript;
      if (body.status === "completed") return body;
      if (body.status === "error") {
        throw new Error(`AssemblyAI transcription failed: ${body.error}`);
      }
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }
  }
}

function toTranscript(raw: AssemblyAITranscript): Transcript {
  const utterances: TranscriptUtterance[] = (raw.utterances ?? []).map((u) => ({
    speaker: u.speaker,
    role: "unknown",
    text: u.text,
    startMs: u.start,
    endMs: u.end,
    words: u.words.map(
      (w): TranscriptWord => ({
        text: w.text,
        startMs: w.start,
        endMs: w.end,
        speaker: w.speaker ?? u.speaker,
      }),
    ),
  }));

  const lastEnd = utterances.length
    ? Math.max(...utterances.map((u) => u.endMs))
    : 0;

  return {
    utterances,
    durationMs: raw.audio_duration ? raw.audio_duration * 1000 : lastEnd,
    text: raw.text ?? utterances.map((u) => u.text).join(" "),
    language: raw.language_code,
  };
}
