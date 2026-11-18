import type { SeriesPoint } from "../simulation/types";

export function fmt(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function signed(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function pct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export const TICK_LABEL = (tick: number): string => `t${String(tick).padStart(4, "0")}`;

export function lastN<T>(values: readonly T[], n: number): T[] {
  return values.length > n ? values.slice(values.length - n) : [...values];
}

export function seriesValues(
  series: readonly SeriesPoint[],
  key: keyof SeriesPoint,
): (number | null)[] {
  return series.map((point) => {
    const value = point[key];
    return typeof value === "number" ? value : null;
  });
}

/** Bucket-average downsample that preserves nulls (gaps). */
export function downsample(
  values: readonly (number | null)[],
  target = 180,
): (number | null)[] {
  if (values.length <= target) return [...values];
  const bucket = values.length / target;
  const out: (number | null)[] = [];
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucket));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < values.length; j++) {
      const v = values[j];
      if (v !== null) {
        sum += v;
        count++;
      }
    }
    out.push(count ? sum / count : null);
  }
  return out;
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function dominantAction(mix: Record<string, number>): [string, number] {
  const entries = Object.entries(mix);
  return entries.sort((a, b) => b[1] - a[1])[0] ?? ["REST", 0];
}
