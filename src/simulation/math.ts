export const EPS = 1e-6;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

export function dot(weights: readonly number[], features: readonly number[]): number {
  let sum = 0;
  const n = Math.min(weights.length, features.length);
  for (let i = 0; i < n; i++) sum += weights[i] * features[i];
  return sum;
}

export function softmax(values: readonly number[], temperature: number): number[] {
  const temp = Math.max(temperature, 0.05);
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp((v - max) / temp));
  const total = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((v) => v / total);
}

export function klDivergence(p: readonly number[], q: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < p.length; i++) {
    const pi = Math.max(p[i], EPS);
    const qi = Math.max(q[i], EPS);
    sum += pi * Math.log(pi / qi);
  }
  return Math.max(0, sum);
}

export function jsDivergence(p: readonly number[], q: readonly number[]): number {
  const m = p.map((v, i) => (v + q[i]) / 2);
  return 0.5 * klDivergence(p, m) + 0.5 * klDivergence(q, m);
}

export function entropy(values: readonly number[]): number {
  let sum = 0;
  for (const p of values) {
    if (p > EPS) sum -= p * Math.log(p);
  }
  return sum;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
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
  return den < EPS ? 0 : clamp(num / den, -1, 1);
}

export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function formatSigned(value: number, digits = 2): string {
  const v = value.toFixed(digits);
  return value >= 0 ? `+${v}` : v;
}

export class RollingWindow {
  private values: number[] = [];

  constructor(private capacity: number) {}

  push(value: number): void {
    this.values.push(value);
    if (this.values.length > this.capacity) this.values.shift();
  }

  get length(): number {
    return this.values.length;
  }

  get all(): readonly number[] {
    return this.values;
  }

  mean(): number {
    return mean(this.values);
  }

  latest(): number {
    return this.values.length ? this.values[this.values.length - 1] : 0;
  }

  sum(): number {
    return this.values.reduce((a, b) => a + b, 0);
  }

  clear(): void {
    this.values = [];
  }
}
