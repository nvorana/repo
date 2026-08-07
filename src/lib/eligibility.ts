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

// Metric trends have a different bar than score trends. A call the coach has
// not released yet carries measured delivery numbers but no score, so it must
// still move the rep's talk-ratio/filler/questions lines — that is the whole
// point of showing facts before judgment. Same fail-safe on mixed audio: a
// guessed-speaker call has an unreliable talk ratio and is excluded.
export function countsTowardMetricTrends(r: {
  status: string;
  mixedAudio?: boolean;
  metrics?: unknown;
}): boolean {
  return r.status === "completed" && r.mixedAudio === false && r.metrics != null;
}
