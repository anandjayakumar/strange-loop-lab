import { clamp } from "../math";
import { Rng, streamSeed } from "../rng";

export interface SettleInput {
  energyReading: number;
  energyEstimate: number;
  strainReading: number;
  fatigueEstimate: number;
  effortReading: number | null;
  expectedEffort: number;
  novelty: number;
  /** Workspace prediction: [viability, certainty, coherence, goal drive]. */
  topDown: [number, number, number, number];
  /** False in feedforward controls: the recurrent sheet still runs but gets no top-down term. */
  topDownEnabled: boolean;
}

export interface SettleResult {
  latent: number[];
  /** Fraction of the first-pass change that later passes removed. */
  convergence: number;
  /** Mean absolute latent change on the final pass. */
  disagreement: number;
  /** Normalised entropy of the interpretable state readout. */
  uncertainty: number;
  interpretation: number[];
  passes: number;
}

const STATES = ["stable", "low energy", "strained", "ambiguous"] as const;
export const SETTLE_STATES = STATES;

function softmax(values: readonly number[]): number[] {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(clamp(v - max, -30, 0)));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / total);
}

function entropy(p: readonly number[]): number {
  let h = 0;
  for (const v of p) if (v > 1e-9) h -= v * Math.log(v);
  return h / Math.log(p.length);
}

/**
 * RPT-1/2: fast within-tick recurrent settling.
 *
 * Bottom-up multi-channel evidence and a top-down workspace prior are fed
 * through a small recurrent sheet for K passes. The sheet is not trained
 * against labels; its weights are fixed draws from the run seed. What is
 * measured is convergence (how much of the first-pass update survives), the
 * residual disagreement on the final pass, and the entropy of an interpretable
 * four-state readout. A single-channel spike produces high disagreement and
 * low convergence, which is what lets the precision pathway absorb it.
 */
export class RecurrentSettler {
  private readonly wRes: number[][];
  private readonly wIn: number[][];
  private readonly wTop: number[][];
  private readonly bias: number[];
  private readonly readout: number[][];
  private state: number[];

  constructor(seed: number, size = 4) {
    const rng = new Rng(streamSeed(seed, "v06-settler"));
    const draw = () => (rng.next() - 0.5) * 1.1;
    this.wRes = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => draw() * 0.95),
    );
    this.wIn = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => draw()),
    );
    this.wTop = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => draw() * 1.2),
    );
    this.bias = Array.from({ length: size }, () => draw() * 0.2);
    this.readout = Array.from({ length: 4 }, () =>
      Array.from({ length: size }, () => draw()),
    );
    this.state = new Array(size).fill(0);
  }

  private step(
    h: readonly number[],
    bottomUp: readonly number[],
    topDown: readonly number[],
    topDownEnabled: boolean,
  ): number[] {
    const next: number[] = [];
    for (let i = 0; i < h.length; i++) {
      let sum = this.bias[i];
      for (let j = 0; j < h.length; j++) sum += this.wRes[i][j] * h[j];
      for (let j = 0; j < bottomUp.length; j++) sum += this.wIn[i][j] * bottomUp[j];
      if (topDownEnabled) {
        for (let j = 0; j < topDown.length; j++) sum += this.wTop[i][j] * topDown[j];
      }
      next.push(Math.tanh(sum));
    }
    return next;
  }

  settle(input: SettleInput, passes: number): SettleResult {    const energyNorm = clamp(input.energyReading / 100, -0.2, 1.3);
    const strainNorm = clamp(input.strainReading, 0, 1.2);
    const effortNorm =
      input.effortReading === null
        ? 0.4
        : clamp((input.effortReading - input.expectedEffort) / 6, -1, 1);
    const predictionMiss = clamp(
      Math.abs(input.energyReading - input.energyEstimate) / 12,
      0,
      1.5,
    );
    const bottomUp = [energyNorm, strainNorm, effortNorm, predictionMiss];

    let h = this.state;
    const deltas: number[] = [];
    let lastEntropy = 0;
    const k = Math.max(1, passes);
    for (let pass = 0; pass < k; pass++) {
      const next = this.step(h, bottomUp, input.topDown, input.topDownEnabled);
      let delta = 0;
      for (let i = 0; i < h.length; i++) delta += Math.abs(next[i] - h[i]);
      deltas.push(delta / h.length);
      const interpretation = softmax(
        this.readout.map((row) => row.reduce((acc, w, i) => acc + w * next[i], 0) * 1.6),
      );
      const hEntropy = entropy(interpretation);
      lastEntropy = hEntropy;
      h = next;
    }
    const interpretation = softmax(
      this.readout.map((row) => row.reduce((acc, w, i) => acc + w * h[i], 0) * 1.6),
    );
    const firstDelta = deltas[0] ?? 0;
    const lastDelta = deltas[deltas.length - 1] ?? 0;
    const convergence =
      k < 2 ? 0 : clamp(1 - lastDelta / Math.max(1e-6, firstDelta), 0, 1);
    // Recurrence is persistent but slow, so the sheet cannot carry a single
    // tick's spike into the next tick.
    this.state = h.map((value, i) => 0.65 * this.state[i] + 0.35 * value);
    return {
      latent: h,
      convergence,
      disagreement: lastDelta,
      uncertainty: clamp(0.5 * lastEntropy + 0.5 * (1 - convergence), 0, 1),
      interpretation,
      passes: k,
    };
  }
}
