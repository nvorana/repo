import type { AudioInput, TranscriptionProvider } from "./transcription/provider.ts";
import { CallAnalyzer, type AnalyzerOptions } from "./analyzer.ts";
import { computeDeliveryMetrics } from "./metrics.ts";
import { defaultFramework } from "./frameworks/default.ts";
import type { SalesFramework } from "./frameworks/types.ts";
import type { CallReviewResult } from "./types.ts";

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
