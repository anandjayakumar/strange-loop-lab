/**
 * Small, dependency-free statistics toolkit for the validation runs.
 * Every stochastic procedure is deterministically seeded.
 */

import { Rng } from "../src/simulation/rng";

export interface Summary {
  n: number;
  mean: number;
  median: number;
  sd: number;
  se: number;
  ciLow: number;
  ciHigh: number;
  min: number;
  q25: number;
  q75: number;
  max: number;
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const w = pos - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export function summarize(values: readonly number[], seed = 99173, bootstrap = 2000): Summary {
  const clean = values.filter((v) => Number.isFinite(v));
  const n = clean.length;
  if (n === 0) {
    return {
      n: 0,
      mean: NaN,
      median: NaN,
      sd: NaN,
      se: NaN,
      ciLow: NaN,
      ciHigh: NaN,
      min: NaN,
      q25: NaN,
      q75: NaN,
      max: NaN,
    };
  }
  const sorted = [...clean].sort((a, b) => a - b);
  const avg = clean.reduce((a, b) => a + b, 0) / n;
  const variance =
    n > 1 ? clean.reduce((acc, v) => acc + (v - avg) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const rng = new Rng(seed);
  const means: number[] = [];
  if (n > 1) {
    for (let b = 0; b < bootstrap; b++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += clean[rng.int(n)];
      means.push(sum / n);
    }
    means.sort((a, b) => a - b);
  } else {
    means.push(avg);
  }
  return {
    n,
    mean: avg,
    median: quantile(sorted, 0.5),
    sd,
    se: n > 0 ? sd / Math.sqrt(n) : NaN,
    ciLow: quantile(means, 0.025),
    ciHigh: quantile(means, 0.975),
    min: sorted[0],
    q25: quantile(sorted, 0.25),
    q75: quantile(sorted, 0.75),
    max: sorted[n - 1],
  };
}

export interface PairedResult {
  n: number;
  meanA: number;
  meanB: number;
  meanDiff: number;
  medianDiff: number;
  sdDiff: number;
  ciLow: number;
  ciHigh: number;
  cohenDz: number;
  pPermutation: number;
  winRate: number;
  relativeChange: number;
}

export function pairedComparison(
  a: readonly number[],
  b: readonly number[],
  seed = 44117,
  permutations = 10000,
): PairedResult {
  const n = Math.min(a.length, b.length);
  const diffs: number[] = [];
  for (let i = 0; i < n; i++) diffs.push(a[i] - b[i]);
  const summary = summarize(diffs, seed + 1, 2000);
  const meanA = meanOf(a.slice(0, n));
  const meanB = meanOf(b.slice(0, n));
  const sdDiff = summary.sd;
  const dz = sdDiff > 1e-12 ? summary.mean / sdDiff : 0;
  const rng = new Rng(seed);
  const observed = Math.abs(summary.mean);
  let extreme = 0;
  if (observed > 1e-12) {
    for (let p = 0; p < permutations; p++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += rng.next() < 0.5 ? -diffs[i] : diffs[i];
      if (Math.abs(sum / n) >= observed) extreme++;
    }
  }
  return {
    n,
    meanA,
    meanB,
    meanDiff: summary.mean,
    medianDiff: summary.median,
    sdDiff,
    ciLow: summary.ciLow,
    ciHigh: summary.ciHigh,
    cohenDz: dz,
    pPermutation: observed > 1e-12 ? (extreme + 1) / (permutations + 1) : 1,
    winRate: diffs.filter((d) => d > 0).length / Math.max(1, n),
    relativeChange: Math.abs(meanB) > 1e-12 ? summary.mean / Math.abs(meanB) : 0,
  };
}

export function meanOf(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return quantile(sorted, 0.5);
}

export function sdOf(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = meanOf(values);
  return Math.sqrt(values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1));
}

export function proportionCI(successes: number, n: number, seed = 1723): [number, number] {
  if (n === 0) return [NaN, NaN];
  const rng = new Rng(seed);
  const p = successes / n;
  const values: number[] = [];
  for (let b = 0; b < 2000; b++) {
    let k = 0;
    for (let i = 0; i < n; i++) if (rng.next() < p) k++;
    values.push(k / n);
  }
  values.sort((a, b) => a - b);
  return [quantile(values, 0.025), quantile(values, 0.975)];
}

export function holm(pValues: readonly number[]): number[] {
  const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const adjusted = new Array<number>(pValues.length).fill(1);
  let running = 0;
  for (let rank = 0; rank < indexed.length; rank++) {
    const value = Math.min(1, (indexed.length - rank) * indexed[rank].p);
    running = Math.max(running, value);
    adjusted[indexed[rank].i] = running;
  }
  return adjusted;
}

export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return NaN;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den < 1e-12 ? 0 : num / den;
}

function ranks(values: readonly number[]): number[] {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const out = new Array<number>(values.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].value === sorted[i].value) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[sorted[k].index] = rank;
    i = j + 1;
  }
  return out;
}

export function spearman(xs: readonly number[], ys: readonly number[]): number {
  return pearson(ranks(xs), ranks(ys));
}

export function bootstrapCorrelation(
  xs: readonly number[],
  ys: readonly number[],
  seed = 60013,
  resamples = 2000,
): { r: number; ciLow: number; ciHigh: number; n: number } {
  const n = Math.min(xs.length, ys.length);
  if (n < 4) return { r: NaN, ciLow: NaN, ciHigh: NaN, n };
  const r = pearson(xs.slice(0, n), ys.slice(0, n));
  const rng = new Rng(seed);
  const values: number[] = [];
  for (let b = 0; b < resamples; b++) {
    const bx: number[] = [];
    const by: number[] = [];
    for (let i = 0; i < n; i++) {
      const idx = rng.int(n);
      bx.push(xs[idx]);
      by.push(ys[idx]);
    }
    values.push(pearson(bx, by));
  }
  values.sort((a, b) => a - b);
  return {
    r,
    ciLow: quantile(values, 0.025),
    ciHigh: quantile(values, 0.975),
    n,
  };
}

/** Ordinary least squares with intercept. Returns in-sample R². */
export function linearR2(predictors: readonly (readonly number[])[], y: readonly number[]): {
  r2: number;
  coefficients: number[];
} {
  const n = y.length;
  if (n < 4 || predictors.length === 0) return { r2: NaN, coefficients: [] };
  const k = predictors.length + 1;
  const xtx = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const xty = new Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    const row = [1, ...predictors.map((p) => p[i])];
    for (let a = 0; a < k; a++) {
      xty[a] += row[a] * y[i];
      for (let b = 0; b < k; b++) xtx[a][b] += row[a] * row[b];
    }
  }
  const coefficients = solveLinearSystem(xtx, xty);
  if (!coefficients) return { r2: NaN, coefficients: [] };
  const meanY = meanOf(y);
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const row = [1, ...predictors.map((p) => p[i])];
    const pred = row.reduce((acc, v, j) => acc + v * coefficients[j], 0);
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - meanY) ** 2;
  }
  return {
    r2: ssTot > 1e-12 ? 1 - ssRes / ssTot : 0,
    coefficients,
  };
}

function solveLinearSystem(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const div = m[col][col];
    for (let j = col; j <= n; j++) m[col][j] /= div;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let j = col; j <= n; j++) m[row][j] -= factor * m[col][j];
    }
  }
  return m.map((row) => row[n]);
}

/** AUC for scores that should be higher when the binary label is true. */
export function auc(scores: readonly number[], labels: readonly boolean[]): number {
  const n = scores.length;
  if (n < 4) return NaN;
  const positives = labels.filter(Boolean).length;
  const negatives = n - positives;
  if (positives === 0 || negatives === 0) return NaN;
  const ranked = scores
    .map((score, index) => ({ score, label: labels[index] }))
    .sort((a, b) => a.score - b.score);
  let rank = 1;
  let sumPositiveRanks = 0;
  let i = 0;
  while (i < ranked.length) {
    let j = i;
    while (j + 1 < ranked.length && Math.abs(ranked[j + 1].score - ranked[i].score) < 1e-12) {
      j++;
    }
    const averageRank = (rank + (rank + (j - i))) / 2;
    for (let k = i; k <= j; k++) {
      if (ranked[k].label) sumPositiveRanks += averageRank;
    }
    rank += j - i + 1;
    i = j + 1;
  }
  return (sumPositiveRanks - (positives * (positives + 1)) / 2) / (positives * negatives);
}

/** Equal-count (decile) expected calibration error. */
export function adaptiveEce(
  predictions: readonly number[],
  actuals: readonly number[],
  bins = 10,
): number {
  const n = Math.min(predictions.length, actuals.length);
  if (n < bins * 2) return NaN;
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => predictions[a] - predictions[b],
  );
  let ece = 0;
  let start = 0;
  while (start < n) {
    const end = Math.min(n, start + Math.ceil(n / bins));
    let sumP = 0;
    let sumA = 0;
    for (let i = start; i < end; i++) {
      const idx = order[i];
      sumP += predictions[idx];
      sumA += actuals[idx];
    }
    const count = end - start;
    ece += (count / n) * Math.abs(sumP / count - sumA / count);
    start = end;
  }
  return ece;
}

export function percentile(values: readonly number[], q: number): number {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  return quantile(sorted, q);
}

export function formatSummary(summary: Summary, digits = 2, scale = 1): string {
  const f = (v: number) => (Number.isFinite(v) ? (v * scale).toFixed(digits) : "—");
  return `${f(summary.mean)} [${f(summary.ciLow)}, ${f(summary.ciHigh)}] (SD ${f(
    summary.sd,
  )})`;
}

export function formatP(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}

export function formatPaired(result: PairedResult, digits = 2, scale = 1): string {
  const f = (v: number) => (Number.isFinite(v) ? (v * scale).toFixed(digits) : "—");
  return `${f(result.meanDiff)} [${f(result.ciLow)}, ${f(result.ciHigh)}], dz=${f(
    result.cohenDz,
  )}, p=${formatP(result.pPermutation)}`;
}
