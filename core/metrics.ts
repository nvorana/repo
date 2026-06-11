import type {
  DeliveryMetrics,
  InterruptionEvent,
  MonologueEvent,
  PauseEvent,
  SpeakerRole,
  Transcript,
} from "./types.ts";

/** Silence between utterances longer than this counts as a notable pause. */
const PAUSE_THRESHOLD_MS = 1500;
/** Overlap of the next utterance into the previous one that counts as an interruption. */
const INTERRUPTION_OVERLAP_MS = 500;
const MONOLOGUE_TOP_N = 5;
const PAUSE_TOP_N = 12;

const FILLER_WORDS = new Set([
  "um", "uh", "er", "ah", "hmm", "like", "y'know",
]);

/**
 * Computes objective delivery metrics from the diarized transcript. These are
 * calculated in code — not by the model — so the tonality/pacing section of
 * the review is grounded in real numbers.
 */
export function computeDeliveryMetrics(transcript: Transcript): DeliveryMetrics {
  const utterances = transcript.utterances;

  const speakingMs: Record<SpeakerRole, number> = { salesperson: 0, prospect: 0, unknown: 0 };
  const wordCounts: Record<SpeakerRole, number> = { salesperson: 0, prospect: 0, unknown: 0 };
  const questionCounts = { salesperson: 0, prospect: 0 };
  const fillerWordCounts = { salesperson: 0, prospect: 0 };

  const pauses: PauseEvent[] = [];
  const monologues: MonologueEvent[] = [];
  const interruptions: InterruptionEvent[] = [];

  for (let i = 0; i < utterances.length; i++) {
    const u = utterances[i];
    const role = u.role;
    speakingMs[role] += u.endMs - u.startMs;
    wordCounts[role] += u.words.length;

    if (role === "salesperson" || role === "prospect") {
      questionCounts[role] += (u.text.match(/\?/g) ?? []).length;
      for (const w of u.words) {
        if (FILLER_WORDS.has(w.text.toLowerCase().replace(/[.,!?]/g, ""))) {
          fillerWordCounts[role]++;
        }
      }
    }

    monologues.push({
      role,
      startMs: u.startMs,
      durationMs: u.endMs - u.startMs,
      wordCount: u.words.length,
    });

    const next = utterances[i + 1];
    if (!next) continue;

    const gap = next.startMs - u.endMs;
    if (gap >= PAUSE_THRESHOLD_MS) {
      pauses.push({
        atMs: u.endMs,
        durationMs: gap,
        afterSpeaker: role,
        precedingText: lastWords(u.text, 12),
      });
    } else if (gap < -INTERRUPTION_OVERLAP_MS && next.role !== role) {
      interruptions.push({
        atMs: next.startMs,
        interrupter: next.role,
        interrupted: role,
      });
    }
  }

  const totalSpeaking = speakingMs.salesperson + speakingMs.prospect;

  return {
    durationMs: transcript.durationMs,
    salespersonTalkRatio: totalSpeaking > 0 ? speakingMs.salesperson / totalSpeaking : 0,
    paceWpm: {
      salesperson: wpm(wordCounts.salesperson, speakingMs.salesperson),
      prospect: wpm(wordCounts.prospect, speakingMs.prospect),
    },
    pauses: pauses
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, PAUSE_TOP_N)
      .sort((a, b) => a.atMs - b.atMs),
    longestMonologues: monologues
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, MONOLOGUE_TOP_N)
      .sort((a, b) => a.startMs - b.startMs),
    interruptions,
    questionCounts,
    fillerWordCounts,
  };
}

function wpm(words: number, ms: number): number {
  if (ms <= 0) return 0;
  return Math.round(words / (ms / 60000));
}

function lastWords(text: string, n: number): string {
  const parts = text.trim().split(/\s+/);
  return parts.slice(-n).join(" ");
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
