import type { CallReview, Transcript, TranscriptWord } from "./types.ts";
import { formatTimestamp } from "./metrics.ts";

// The AI writes each finding/objection with a verbatim `quote` plus an
// *estimated* `timestamp`. LLMs are unreliable at exact times, so instead of
// trusting that estimate we find where the quote was actually spoken — using
// the transcript's word-level timings — and use that real time. Deterministic:
// no match with enough confidence → keep the model's estimate (no worse).

function norm(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function tokenize(s: string): string[] {
  return s.split(/\s+/).map(norm).filter(Boolean);
}

/**
 * Real audio time (ms) where `quote` was spoken, by aligning the quote's tokens
 * against the transcript words. Returns null when there's no confident match.
 */
export function locateQuoteMs(quote: string, words: TranscriptWord[]): number | null {
  const q = tokenize(quote);
  const w = words.map((x) => norm(x.text));
  const n = w.length;
  const m = q.length;
  // Very short quotes align by coincidence — not safe to relocate on.
  if (m < 3 || n === 0) return null;

  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < n; i++) {
    let score = 0;
    for (let j = 0; j < m && i + j < n; j++) {
      if (w[i + j] === q[j]) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  // Require a solid positional overlap (handles minor transcription drift)
  // before overriding the model's timestamp.
  const need = Math.max(3, Math.ceil(m * 0.6));
  return bestIdx >= 0 && bestScore >= need ? words[bestIdx].startMs : null;
}

/**
 * Replace each finding's/objection's estimated timestamp with the real time of
 * its supporting quote in the transcript. Leaves the estimate when the quote
 * can't be confidently located.
 */
export function anchorReviewTimestamps(review: CallReview, transcript: Transcript): CallReview {
  const words = transcript.utterances.flatMap((u) => u.words);
  if (words.length === 0) return review;

  const anchor = <T extends { quote?: string; timestamp?: string }>(item: T): T => {
    if (!item.quote) return item;
    const ms = locateQuoteMs(item.quote, words);
    return ms == null ? item : { ...item, timestamp: formatTimestamp(ms) };
  };

  return {
    ...review,
    whatWentRight: review.whatWentRight.map(anchor),
    whatWentWrong: review.whatWentWrong.map(anchor),
    objections: review.objections.map(anchor),
  };
}
