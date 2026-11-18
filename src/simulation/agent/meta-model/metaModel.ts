import { LEARNING } from "../../config";
import { clamp, pearson } from "../../math";
import type { MetaModelSnapshot } from "../../types";

/**
 * Second-order reliability tracker. It observes the self-model's own reported
 * prediction errors and learns a trust weight. In Mode C that trust closes the
 * loop: it scales self-model influence, its learning rate and (optionally) the
 * prior weight used when correcting the energy belief.
 */
export class MetaModel {
  trust = 0.72;
  errorEMA = 0.12;
  observations = 0;
  private trustHistory: number[] = [];
  private accuracyHistory: number[] = [];
  private trustFloor = 0.08;
  private trustCeiling = 0.96;

  update(normalizedError: number): void {
    const error = clamp(normalizedError, 0, 1);
    this.observations++;
    this.errorEMA = clamp(0.935 * this.errorEMA + 0.065 * error, 0, 1);
    const target = clamp(1 - this.errorEMA * 1.25, this.trustFloor, this.trustCeiling);
    const rate = target < this.trust ? 0.105 : 0.06;
    this.trust = clamp(this.trust + rate * (target - this.trust), this.trustFloor, this.trustCeiling);
    const accuracy = clamp(1 - this.errorEMA * 1.8, 0, 1);
    this.trustHistory.push(this.trust);
    this.accuracyHistory.push(accuracy);
    if (this.trustHistory.length > LEARNING.calibrationWindow) {
      this.trustHistory.shift();
      this.accuracyHistory.shift();
    }
  }

  get learningRateMultiplier(): number {
    return clamp(0.4 + 1.7 * (1 - this.trust), 0.35, 2.1);
  }

  get priorWeight(): number {
    return clamp(0.35 + 0.6 * this.trust, 0.35, 0.92);
  }

  get calibration(): number {
    return pearson(this.trustHistory, this.accuracyHistory);
  }

  reset(): void {
    this.trust = 0.72;
    this.errorEMA = 0.12;
    this.observations = 0;
    this.trustHistory = [];
    this.accuracyHistory = [];
  }

  snapshot(
    enabled: boolean,
    plasticityActive: boolean,
    priorWeightingActive: boolean,
  ): MetaModelSnapshot {
    return {
      enabled,
      trust: this.trust,
      errorEMA: this.errorEMA,
      calibration: this.calibration,
      learningRateMultiplier: this.learningRateMultiplier,
      priorWeight: this.priorWeight,
      plasticityActive,
      priorWeightingActive,
      observations: this.observations,
    };
  }
}
