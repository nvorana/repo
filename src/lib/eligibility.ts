// Single source of truth for "may this review's scores move a trend?"
// Mixed-audio reviews (guessed speaker attribution) stay viewable but must
// not shift team or rep numbers. `mixedAudio === false` is required — an
// absent field means a stale payload, and we fail safe by excluding it.
export function countsTowardTrends(r: {
  status: string;
  overallScore?: number | null;
  mixedAudio?: boolean;
}): boolean {
  return r.status === "completed" && r.overallScore != null && r.mixedAudio === false;
}
