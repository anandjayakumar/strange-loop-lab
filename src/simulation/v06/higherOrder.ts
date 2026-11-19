import { clamp, dot, sigmoid } from "../math";
import { TemporalAttributor } from "../v05/attribution";
import type { Action, AttributionKind, AttributionScores } from "../v05/types";
import { V06_META } from "./config";
import type { HigherOrderSnapshot, ModuleId } from "./types";

interface CalibrationRecord {
  predicted: number;
  observed: boolean;
  /** Latent (unsensed) failure label, evaluation only. */
  latentFailure: boolean;
}

const FEATURES = 6;

/**
 * HOT-1..4: higher-order monitoring.
 *
 *  - HOT-1: a second-order estimate of whether the first-order model will be
 *    reliable on this step.
 *  - HOT-2: that estimate is calibrated on held-out, off-policy shadow probes
 *    (a separate head that never controls behaviour).
 *  - HOT-3: four-way causal attribution of a discrepancy (self, energy sensor,
 *    fatigue sensor, shared) reuses the V0.5 action-conditioned attributor.
 *  - HOT-4: the integrated state is projected into a three-axis quality space
 *    (viability, certainty, coherence).
 *
 * With `enabled = false` the second-order head is frozen at chance and
 * attribution reports `insufficient`; first-order learning is untouched.
 */
export class HigherOrderMonitor {
  enabled = true;
  reliability = 0.5;
  /** Slow baseline; attention reacts to departures from it, not to its level. */
  baselineReliability = 0.5;
  private controlWeights: number[];
  private shadowWeights: number[];
  private records: CalibrationRecord[] = [];
  private brierSum = 0;
  private brierCount = 0;
  private shadowRecords: CalibrationRecord[] = [];
  private shadowBrierSum = 0;
  private shadowCount = 0;
  readonly attributor = new TemporalAttributor();
  quality: [number, number, number] = [0.5, 0.5, 0.5];
  qualityVelocity = 0;
  shadowProbes = 0;
  private lastFeatures: number[] = [];

  constructor() {
    this.controlWeights = new Array(FEATURES).fill(0);
    this.shadowWeights = new Array(FEATURES).fill(0);
    this.controlWeights[0] = 0.4;
    this.shadowWeights[0] = 0.4;
  }

  private features(input: {
    uncertainty: number;
    recentError: number;
    disagreement: number;
    evidence: number;
    ambiguity: number;
    energy: number;
  }): number[] {
    return [
      1,
      clamp(input.uncertainty, 0, 1),
      clamp(input.recentError / 2, 0, 1),
      clamp(input.disagreement / 1.6, 0, 1),
      1 - Math.exp(-input.evidence / 12),
      clamp(1 - input.energy / 100, 0, 1),
    ];
  }

  predict(input: {
    uncertainty: number;
    recentError: number;
    disagreement: number;
    evidence: number;
    ambiguity: number;
    energy: number;
  }): number {
    if (!this.enabled) return 0.5;
    this.lastFeatures = this.features(input);
    this.reliability = clamp(
      sigmoid(dot(this.controlWeights, this.lastFeatures)),
      0.1,
      0.95,
    );
    this.baselineReliability =
      0.985 * this.baselineReliability + 0.015 * this.reliability;
    return this.reliability;
  }

  get reliabilityDrop(): number {
    return clamp(this.baselineReliability - this.reliability, -1, 1);
  }

  /** On-policy calibration of the controlling head. */
  learnControl(label: boolean, latentFailure: boolean): void {
    if (!this.enabled) return;
    const y = label ? 1 : 0;
    if (this.lastFeatures.length) {
      const predicted = clamp(sigmoid(dot(this.controlWeights, this.lastFeatures)), 0.03, 0.97);
      const error = y - predicted;
      for (let i = 0; i < this.controlWeights.length; i++) {
        this.controlWeights[i] = clamp(
          this.controlWeights[i] + 0.08 * error * this.lastFeatures[i],
          -4,
          4,
        );
      }
    }
    this.brierSum += (this.reliability - y) ** 2;
    this.brierCount++;
    this.records.push({ predicted: this.reliability, observed: label, latentFailure });
    if (this.records.length > 400) this.records.shift();
  }

  /** Off-policy calibration on an action the agent did not take. */
  shadowProbe(features: {
    uncertainty: number;
    recentError: number;
    disagreement: number;
    evidence: number;
    ambiguity: number;
    energy: number;
  }, label: boolean, latentFailure: boolean): void {
    if (!this.enabled) return;
    const x = this.features(features);
    const predicted = clamp(sigmoid(dot(this.shadowWeights, x)), 0.03, 0.97);
    const y = label ? 1 : 0;
    const error = y - predicted;
    for (let i = 0; i < this.shadowWeights.length; i++) {
      this.shadowWeights[i] = clamp(this.shadowWeights[i] + 0.1 * error * x[i], -4, 4);
    }
    this.shadowBrierSum += (predicted - y) ** 2;
    this.shadowCount++;
    this.shadowRecords.push({ predicted, observed: label, latentFailure });
    if (this.shadowRecords.length > 400) this.shadowRecords.shift();
    this.shadowProbes++;
  }

  updateAttribution(input: {
    action: Action;
    energyInnovation: number;
    strainResidual: number;
    effortResidual: number | null;
    slipped: boolean;
    predictedSuccess: number;
    energyBias: number;
    energyVariance: number;
  }): void {
    if (!this.enabled) return;
    this.attributor.update(input);
  }

  scores(): AttributionScores {
    if (!this.enabled) {
      return {
        physical: 0.05,
        energy_sensor: 0.05,
        fatigue_sensor: 0.05,
        shared: 0.05,
        insufficient: 0.8,
        top: "insufficient",
        confidence: 0,
        evidenceCount: 0,
      };
    }
    return this.attributor.scores();
  }

  top(): AttributionKind {
    return this.scores().top;
  }

  /** Smooth projection into the three-axis quality space. */
  updateQuality(input: {
    energy: number;
    fatigue: number;
    uncertainty: number;
    disagreement: number;
  }): [number, number, number] {
    const target: [number, number, number] = [
      clamp(input.energy / 100, 0, 1) * (1 - clamp(input.fatigue, 0, 1)),
      1 - clamp(input.uncertainty, 0, 1),
      1 - clamp(input.disagreement * 2.4, 0, 1),
    ];
    const next: [number, number, number] = [
      0.72 * this.quality[0] + 0.28 * target[0],
      0.72 * this.quality[1] + 0.28 * target[1],
      0.72 * this.quality[2] + 0.28 * target[2],
    ];
    this.qualityVelocity = Math.hypot(
      next[0] - this.quality[0],
      next[1] - this.quality[1],
      next[2] - this.quality[2],
    );
    this.quality = next;
    return next;
  }

  private ece(records: readonly CalibrationRecord[]): number {
    if (records.length < 20) return 0;
    let ece = 0;
    const bins = 8;
    for (let i = 0; i < bins; i++) {
      const lo = i / bins;
      const hi = (i + 1) / bins;
      let count = 0;
      let predicted = 0;
      let observed = 0;
      for (const record of records) {
        if (record.predicted >= lo && (i === bins - 1 ? record.predicted <= hi : record.predicted < hi)) {
          count++;
          predicted += record.predicted;
          observed += record.observed ? 1 : 0;
        }
      }
      if (count) ece += (count / records.length) * Math.abs(predicted / count - observed / count);
    }
    return ece;
  }

  private auroc(records: readonly CalibrationRecord[]): number | null {
    if (records.length < 20) return null;
    const positives = records.filter((r) => r.latentFailure);
    const negatives = records.filter((r) => !r.latentFailure);
    if (positives.length === 0 || negatives.length === 0) return null;
    let concordant = 0;
    for (const p of positives) {
      for (const n of negatives) {
        if (p.predicted < n.predicted) concordant++;
        else if (Math.abs(p.predicted - n.predicted) < 1e-12) concordant += 0.5;
      }
    }
    return concordant / (positives.length * negatives.length);
  }

  snapshot(routing: Record<ModuleId, number>): HigherOrderSnapshot {
    const attribution = this.scores();
    return {
      enabled: this.enabled,
      reliability: this.enabled ? this.reliability : 0.5,
      reliabilityBrier: this.brierCount ? this.brierSum / this.brierCount : 0,
      reliabilityEce: this.ece(this.records),
      reliabilityAuroc: this.auroc(this.records),
      attribution,
      quality: [...this.quality],
      qualityVelocity: this.qualityVelocity,
      shadowProbes: this.shadowProbes,
      routing,
    };
  }

  /** Evaluation-only metrics over the off-policy shadow head. */
  shadowMetrics(): { brier: number; ece: number; auroc: number | null; n: number } {
    return {
      brier: this.shadowCount ? this.shadowBrierSum / this.shadowCount : 0,
      ece: this.ece(this.shadowRecords),
      auroc: this.auroc(this.shadowRecords),
      n: this.shadowProbes,
    };
  }

  /** Rolling variance of the quality coordinate, used as an attractor index. */
  qualityStability(window: readonly [number, number, number][]): number {
    if (window.length < 4) return 0;
    let total = 0;
    for (let axis = 0; axis < 3; axis++) {
      const values = window.map((point) => point[axis]);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((acc, v) => acc + (v - avg) ** 2, 0) / values.length;
      total += variance;
    }
    return 1 - clamp(Math.sqrt(total / 3) * 3.2, 0, 1);
  }
}

export const HOT_TOLERANCE = V06_META.tolerance;
