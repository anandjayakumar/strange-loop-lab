/**
 * Deterministic seeded PRNG (mulberry32) plus stable stream derivation.
 * Every stochastic subsystem gets its own named stream, so agent noise cannot
 * shift world generation and comparison runs can share an identical world.
 */

export function hashString(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function streamSeed(seed: number, stream: string): number {
  const mixed = (seed >>> 0) ^ hashString(stream);
  return hashString(`${mixed}:${stream}`) >>> 0;
}

export function normaliseSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 1;
  return Math.abs(Math.trunc(seed)) % 4294967296 || 1;
}

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = normaliseSeed(seed);
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Standard normal via Box-Muller. Not cached, so call counts stay obvious. */
  gaussian(): number {
    const u = Math.max(this.next(), 1e-12);
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }

  save(): number {
    return this.state;
  }

  restore(state: number): void {
    this.state = normaliseSeed(state);
  }
}
