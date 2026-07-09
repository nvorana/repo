// Clamp an audio skip so it never runs before the start or past the end.
// `duration` is NaN/0 until the media metadata loads — in that case only the
// lower bound is enforced, so an early skip still works and never false-clamps.
export function clampSkip(current: number, delta: number, duration: number): number {
  const next = current + delta;
  if (next < 0) return 0;
  if (Number.isFinite(duration) && duration > 0 && next > duration) return duration;
  return next;
}
