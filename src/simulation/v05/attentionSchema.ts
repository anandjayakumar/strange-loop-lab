import { clamp, dot } from "../math";

export type AttentionMode =
  | "monitoring"
  | "high_prior"
  | "defensive"
  | "exploratory";

export interface AttentionWeights {
  energy: number;
  strain: number;
  prior: number;
  world: number;
  epistemic: number;
}

export interface AttentionSchemaSnapshot {
  enabled: boolean;
  weights: AttentionWeights;
  mode: AttentionMode;
  modeAge: number;
  predictedError: number;
  observedError: number;
  recovery: number;
  quietTicks: number;
  schemaWeights: number[];
}

/**
 * AST-1: an attention schema.
 *
 * This is a small predictor of the agent's *own* precision allocation. It does
 * not read latent state. It receives the current allocation of precision across
 * four streams plus epistemic drive, predicts the next observable estimation
 * error, learns from that error, classifies its current attentional mode, and
 * emits a bounded `recovery` signal when it detects that it is still in a
 * high-prior / sensor-ignoring mode after the cross-channel disagreement that
 * justified that mode has subsided. The recovery signal is the only output that
 * feeds back into processing: it releases prior suppression so attention
 * returns to normal after a transient glitch.
 *
 * "Attention" here means precision weighting in a predictive filter. Nothing in
 * this class refers to subjective awareness.
 */
export class AttentionSchema {
  enabled = true;
  weights: AttentionWeights = {
    energy: 0.5,
    strain: 0.25,
    prior: 0.5,
    world: 0.5,
    epistemic: 0,
  };
  mode: AttentionMode = "monitoring";
  modeAge = 0;
  predictedError = 0.3;
  observedError = 0.3;
  recovery = 0;
  quietTicks = 0;
  private schemaWeights: number[];
  private lastMode: AttentionMode = "monitoring";

  constructor() {
    this.schemaWeights = [0.2, 0.1, 0.05, 0.15, 0.05, 0.05, 0.2];
  }

  private predict(): number {
    const x = this.features();
    return clamp(dot(this.schemaWeights, x), 0, 2);
  }

  private features(): number[] {
    const w = this.weights;
    return [1, w.energy, w.strain, w.prior, w.world, w.epistemic, clamp(w.prior - w.energy, -1, 1)];
  }

  update(input: {
    energy: number;
    strain: number;
    prior: number;
    world: number;
    epistemic: number;
    observedError: number;
    disagreement: number;
    cliff: number;
  }): void {
    if (!this.enabled) {
      this.recovery = 0;
      return;
    }
    this.weights = {
      energy: clamp(input.energy, 0, 1),
      strain: clamp(input.strain, 0, 1),
      prior: clamp(input.prior, 0, 1),
      world: clamp(input.world, 0, 1),
      epistemic: clamp(input.epistemic, 0, 1),
    };
    this.observedError = clamp(input.observedError, 0, 2);
    const x = this.features();
    const prediction = this.predict();
    const error = this.observedError - prediction;
    for (let i = 0; i < this.schemaWeights.length; i++) {
      this.schemaWeights[i] = clamp(
        this.schemaWeights[i] * 0.999 + 0.008 * error * x[i],
        -4,
        4,
      );
    }
    this.predictedError = clamp(dot(this.schemaWeights, x), 0, 2);

    const nextMode: AttentionMode =
      input.cliff > 0.7
        ? "defensive"
        : input.epistemic > 0.4
          ? "exploratory"
          : this.weights.prior > 0.55 && this.weights.energy < 0.32
            ? "high_prior"
            : "monitoring";
    if (nextMode === this.lastMode) {
      this.modeAge++;
    } else {
      this.modeAge = 0;
      this.lastMode = nextMode;
    }
    this.mode = nextMode;

    // The schema recognises perseveration: the agent is still in high-prior
    // mode although the instantaneous disagreement that justified it is gone.
    if (this.mode === "high_prior" && input.disagreement < 0.08) {
      this.quietTicks++;
    } else {
      this.quietTicks = 0;
    }
    this.recovery = clamp((this.quietTicks - 2) / 3, 0, 1) * 0.8;
  }

  snapshot(): AttentionSchemaSnapshot {
    return {
      enabled: this.enabled,
      weights: { ...this.weights },
      mode: this.mode,
      modeAge: this.modeAge,
      predictedError: this.predictedError,
      observedError: this.observedError,
      recovery: this.recovery,
      quietTicks: this.quietTicks,
      schemaWeights: [...this.schemaWeights],
    };
  }
}
