import type { Transcript } from "../types.ts";

/**
 * Anything that can turn call audio into a diarized, word-timestamped
 * transcript. Implementations must produce the normalized Transcript shape so
 * the rest of the pipeline is provider-agnostic — swap AssemblyAI for
 * Deepgram, Whisper+diarization, or an on-prem model without touching
 * analysis code.
 */
export interface TranscriptionProvider {
  readonly id: string;

  transcribe(audio: AudioInput): Promise<Transcript>;
}

export interface AudioInput {
  /** Raw audio bytes (any common format: mp3, m4a, wav, ogg, webm...). */
  data: Buffer | Uint8Array;
  /** Original filename, used for format hints and logging. */
  filename: string;
  mimeType?: string;
}
