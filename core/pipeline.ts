import type { AudioInput, TranscriptionProvider } from "./transcription/provider.ts";
import { CallAnalyzer, type AnalyzerOptions } from "./analyzer.ts";
import { computeDeliveryMetrics } from "./metrics.ts";
import { defaultFramework } from "./frameworks/default.ts";
import type { SalesFramework } from "./frameworks/types.ts";
import type {
  CallReviewResult,
  SpeakerRole,
  Transcript,
  TranscriptUtterance,
} from "./types.ts";

export type ReviewStage = "transcribing" | "identifying_speakers" | "analyzing";

export interface ReviewPipelineOptions {
  transcriber: TranscriptionProvider;
  framework?: SalesFramework;
  analyzer?: AnalyzerOptions;
  /** Progress callback for UIs/queues. */
  onStage?: (stage: ReviewStage) => void;
}

/**
 * The whole product as one function: audio in, structured review out.
 * Embed this anywhere — the web app's API server, a CLI, a queue worker, a
 * Slack bot — by supplying a transcription provider and (optionally) your own
 * sales framework.
 */
export async function reviewCall(
  audio: AudioInput,
  options: ReviewPipelineOptions,
): Promise<CallReviewResult> {
  const framework = options.framework ?? defaultFramework;
  const analyzer = new CallAnalyzer(options.analyzer);

  options.onStage?.("transcribing");
  const transcript = await options.transcriber.transcribe(audio);
  if (transcript.utterances.length === 0) {
    throw new Error("Transcription produced no speech — is the file a valid audio recording?");
  }

  options.onStage?.("identifying_speakers");
  await analyzer.identifySpeakers(transcript);

  options.onStage?.("analyzing");
  const metrics = computeDeliveryMetrics(transcript);
  const review = await analyzer.analyze(transcript, metrics, framework);

  return { review, metrics, transcript, frameworkId: framework.id };
}

export interface CallTracks {
  repAudio: AudioInput;
  clientAudio: AudioInput;
}

/** Stamp a single known role/label across every utterance + word of a transcript. */
function stampRole(t: Transcript, role: SpeakerRole, label: string): TranscriptUtterance[] {
  return t.utterances.map((u) => ({
    ...u,
    role,
    speaker: label,
    words: u.words.map((w) => ({ ...w, speaker: label })),
  }));
}

/**
 * Build one merged transcript from two single-speaker tracks. Roles are known
 * for certain (no diarization guessing): rep file → salesperson, client file →
 * prospect. Utterances are ordered by their shared meeting timeline.
 */
export function mergeTracks(repT: Transcript, clientT: Transcript): Transcript {
  const utterances = [
    ...stampRole(repT, "salesperson", "rep"),
    ...stampRole(clientT, "prospect", "client"),
  ].sort((a, b) => a.startMs - b.startMs);
  return {
    utterances,
    durationMs: Math.max(repT.durationMs, clientT.durationMs),
    text: utterances.map((u) => u.text).join(" "),
    language: repT.language ?? clientT.language,
  };
}

/**
 * Review path for separately-recorded participants. Skips identifySpeakers
 * entirely — speaker attribution is exact, so talk ratio/pace/etc. are exact.
 */
export async function reviewCallFromTracks(
  tracks: CallTracks,
  options: ReviewPipelineOptions,
): Promise<CallReviewResult> {
  const framework = options.framework ?? defaultFramework;
  const analyzer = new CallAnalyzer(options.analyzer);

  options.onStage?.("transcribing");
  const [repT, clientT] = await Promise.all([
    options.transcriber.transcribe(tracks.repAudio),
    options.transcriber.transcribe(tracks.clientAudio),
  ]);
  if (repT.utterances.length === 0) {
    throw new Error(
      "The rep track had no detected speech — check that you uploaded your own recording.",
    );
  }
  if (clientT.utterances.length === 0) {
    throw new Error(
      "The client track had no detected speech — check that you uploaded the client's recording.",
    );
  }

  const transcript = mergeTracks(repT, clientT);

  options.onStage?.("analyzing");
  const metrics = computeDeliveryMetrics(transcript);
  const review = await analyzer.analyze(transcript, metrics, framework);
  return { review, metrics, transcript, frameworkId: framework.id };
}
