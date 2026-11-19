import { clamp, dot } from "../math";
import type { AttentionMode, AttentionSnapshot, PrecisionPlan } from "./types";

function normalise(plan: PrecisionPlan): PrecisionPlan {
  const total =
    plan.energy + plan.strain + plan.effort + plan.prior + plan.epistemic;
  if (total <= 1e-9) {
    return { energy: 0.25, strain: 0.15, effort: 0.1, prior: 0.4, epistemic: 0.1 };
  }
  return {
    energy: plan.energy / total,
    strain: plan.strain / total,
    effort: plan.effort / total,
    prior: plan.prior / total,
    epistemic: plan.epistemic / total,
  };
}

/**
 * AST-1: an attention schema.
 *
 * Two distinct jobs, kept separate on purpose:
 *
 *  - `allocate()` is the schema's *model of its own attention*: it predicts how
 *    precision should be divided across the interoceptive channels, the prior
 *    and the epistemic drive, given current uncertainty and conflict. The
 *    output is a plan, not an outcome.
 *  - `update()` trains a small predictor of the next observable estimation
 *    error from that plan, classifies the current mode, and emits a bounded
 *    `recovery` signal when the agent is still suppressing sensory evidence
 *    after the disagreement that justified it has gone.
 *
 * Nothing here refers to subjective awareness; "attention" is precision
 * weighting in a predictive filter.
 */
export class AttentionSchemaV06 {
  enabled = true;
  fixedDecay = false;
  mode: AttentionMode = "monitoring";
  modeAge = 0;
  allocation: PrecisionPlan = {
    energy: 0.3,
    strain: 0.15,
    effort: 0.1,
    prior: 0.35,
    epistemic: 0.1,
  };
  predictedError = 0.3;
  observedError = 0.3;
  recovery = 0;
  quietTicks = 0;
  private schemaWeights: number[];
  private lastMode: AttentionMode = "monitoring";

  constructor() {
    this.schemaWeights = [0.2, 0.1, 0.05, 0.15, 0.05, 0.05, 0.2];
  }

  allocate(input: {
    energyUncertainty: number;
    strainUncertainty: number;
    epistemicNeed: number;
    priorNeed: number;
    conflict: number;
  }): PrecisionPlan {
    if (!this.enabled) {
      // No model of attention: a flat allocation, never updated.
      this.allocation = { energy: 0.2, strain: 0.2, effort: 0.2, prior: 0.2, epistemic: 0.2 };
      return this.allocation;
    }
    this.allocation = normalise({
      energy: 0.18 + 1.15 * clamp(input.energyUncertainty, 0, 1),
      strain: 0.08 + 0.85 * clamp(input.strainUncertainty, 0, 1),
      effort: 0.06 + 0.45 * clamp(input.conflict, 0, 1),
      prior: 0.3 + 1.05 * clamp(input.priorNeed, 0, 1),
      epistemic: 0.06 + 1.25 * clamp(input.epistemicNeed, 0, 1),
    });
    return this.allocation;
  }

  update(input: {
    observedError: number;
    disagreement: number;
    reliability: number;
    reliabilityDrop: number;
    conflict: number;
  }): void {
    if (!this.enabled) {
      this.recovery = 0;
      this.predictedError = 0.3;
      this.observedError = input.observedError;
      this.mode = "monitoring";
      return;
    }
    if (this.fixedDecay) {
      // Passive fixed exponential-decay rule: release prior suppression on a
      // schedule, without modelling the schema's own precision allocation.
      if (input.disagreement > 0.1) this.quietTicks = 0;
      else this.quietTicks++;
      this.recovery = 0.85 * Math.exp(-this.quietTicks / 6);
      this.mode = "monitoring";
      this.observedError = input.observedError;
      return;
    }
    const a = this.allocation;
    const x = [
      1,
      a.energy,
      a.strain,
      a.prior,
      a.epistemic,
      clamp(input.disagreement, 0, 1),
      clamp(a.prior - a.energy, -1, 1),
    ];
    this.observedError = clamp(input.observedError, 0, 2);
    const prediction = clamp(dot(this.schemaWeights, x), 0, 2);
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
      input.conflict > 0.68 || input.reliabilityDrop > 0.12
        ? "defensive"
        : a.prior > 0.42 && a.energy < 0.22
          ? "high_prior"
          : a.epistemic > 0.22
            ? "exploratory"
            : "monitoring";
    if (nextMode === this.lastMode) this.modeAge++;
    else {
      this.modeAge = 0;
      this.lastMode = nextMode;
    }
    this.mode = nextMode;

    if (a.prior > 0.36 && input.disagreement < 0.12) {
      this.quietTicks++;
    } else {
      this.quietTicks = 0;
    }
    this.recovery = clamp((this.quietTicks - 2) / 4, 0, 1) * 0.85;
  }

  snapshot(): AttentionSnapshot {
    return {
      enabled: this.enabled,
      mode: this.mode,
      modeAge: this.modeAge,
      allocation: { ...this.allocation },
      predictedError: this.predictedError,
      observedError: this.observedError,
      recovery: this.recovery,
      quietTicks: this.quietTicks,
      schemaWeights: [...this.schemaWeights],
    };
  }
}
