export type Direction = "higher" | "lower";
export type TrendState = "fixed" | "recurring" | "steady" | "insufficient";

export interface MeasureConfig {
  key: string;
  label: string;
  direction: Direction;
  /** The value at/over which the rep is doing well. */
  target: number;
  /** Optional display formatter, e.g. (v) => `${v}%`. */
  format?: (v: number) => string;
}

export interface MeasurePoint {
  /** YYYY-MM-DD. */
  date: string;
  value: number | null;
}

export interface MeasureTrend {
  config: MeasureConfig;
  points: MeasurePoint[];
  current: number | null;
  meetsTarget: boolean;
  state: TrendState;
}

export function meetsTarget(value: number, c: MeasureConfig): boolean {
  return c.direction === "lower" ? value <= c.target : value >= c.target;
}

export function computeMeasureTrend(
  config: MeasureConfig,
  points: MeasurePoint[],
): MeasureTrend {
  const valued = points.filter((p): p is MeasurePoint & { value: number } => p.value !== null);
  const current = valued.length ? valued[valued.length - 1].value : null;
  const currentPass = current !== null && meetsTarget(current, config);

  let state: TrendState;
  if (valued.length < 2) {
    state = "insufficient";
  } else if (valued.every((p) => meetsTarget(p.value, config))) {
    state = "steady";
  } else if (currentPass) {
    state = "fixed";
  } else {
    state = "recurring";
  }

  return { config, points, current, meetsTarget: currentPass, state };
}

/** How far the current value is the wrong side of the target (0 if passing). */
function gap(t: MeasureTrend): number {
  if (t.current === null) return 0;
  const raw = t.config.direction === "lower" ? t.current - t.config.target : t.config.target - t.current;
  return Math.max(0, raw);
}

/** The single most worth-coaching measure: the recurring one furthest from target. */
export function pickCoachNext(trends: MeasureTrend[]): MeasureTrend | null {
  const recurring = trends.filter((t) => t.state === "recurring");
  if (recurring.length === 0) return null;
  return recurring.slice().sort((a, b) => gap(b) - gap(a))[0];
}
