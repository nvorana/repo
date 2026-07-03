import type { CallReview, ReviewVerification, Transcript, VerifiedSection } from "./types.ts";

// Checks that every quote the AI cited actually appears in the transcript.
// Runs after anchorReviewTimestamps, so a verified claim's timestamp is
// already the real audio time of its quote. Failures are flagged, not
// stripped — the UI shows them; nothing is silently deleted.

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return norm(s).split(" ").filter(Boolean);
}

/** How many of `quote`'s tokens appear in order (gaps allowed) in `utterance`. */
function inOrderOverlap(quote: string[], utterance: string[]): number {
  let i = 0;
  let matched = 0;
  for (const t of quote) {
    while (i < utterance.length && utterance[i] !== t) i++;
    if (i < utterance.length) {
      matched++;
      i++;
    }
  }
  return matched;
}

/** Quotes shorter than this many tokens can't be verified meaningfully. */
const MIN_TOKENS = 3;
/** Fraction of quote tokens that must appear in order within one utterance. */
const OVERLAP_THRESHOLD = 0.8;

export function quoteAppears(quote: string, transcript: Transcript): boolean {
  const q = tokens(quote);
  if (q.length < MIN_TOKENS) return true;
  if (norm(transcript.text).includes(q.join(" "))) return true;
  const need = Math.ceil(q.length * OVERLAP_THRESHOLD);
  return transcript.utterances.some((u) => inOrderOverlap(q, tokens(u.text)) >= need);
}

const SECTIONS: VerifiedSection[] = ["whatWentRight", "whatWentWrong", "objections"];

export function verifyReviewClaims(review: CallReview, transcript: Transcript): ReviewVerification {
  const unverified: ReviewVerification["unverified"] = [];
  let claimsChecked = 0;
  for (const section of SECTIONS) {
    review[section].forEach((item, index) => {
      if (!item.quote?.trim()) return;
      claimsChecked++;
      if (!quoteAppears(item.quote, transcript)) unverified.push({ section, index });
    });
  }
  return { claimsChecked, claimsVerified: claimsChecked - unverified.length, unverified };
}
