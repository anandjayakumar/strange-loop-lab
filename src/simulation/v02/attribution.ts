import { clamp } from "../math";
import type { AttributionScores, ChannelStats } from "./types";

const softmax = (values: number[]): number[] => {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
};

/**
 * Observable-only failure attribution readout.
 *
 * It compares channel-specific innovation/bias/volatility signatures. It does
 * not receive regime labels or latent state, and it does not autonomously choose
 * an intervention; the learned meta-model supplies the causal reliability
 * signal. The readout is evaluated against hidden experimental labels offline.
 */
export class FailureAttributor {
  private energyInnovationEma = 0;
  private energyInnovationVolatility = 0.5;
  private strainResidualEma = 0;
  private strainResidualVolatility = 0.5;
  private effortResidualEma = 0;
  private effortResidualVolatility = 0.5;
  private slipBrierEma = 0.25;
  private energySensorBias = 0;
  private energySensorVariance = 5;
  private effortSensorBias = 0;
  private evidenceCount = 0;

  update(input: {
    energyInnovation: number;
    strainResidual: number;
    effortResidual: number | null;
    slipped: boolean;
    predictedSuccess: number;
    energyBias: number;
    energyVariance: number;
  }): void {
    this.evidenceCount++;
    this.energyInnovationEma =
      0.94 * this.energyInnovationEma + 0.06 * input.energyInnovation;
    this.energyInnovationVolatility =
      0.95 * this.energyInnovationVolatility +
      0.05 * Math.abs(input.energyInnovation - this.energyInnovationEma);
    this.strainResidualEma =
      0.94 * this.strainResidualEma + 0.06 * input.strainResidual;
    this.strainResidualVolatility =
      0.95 * this.strainResidualVolatility +
      0.05 * Math.abs(input.strainResidual - this.strainResidualEma);
    if (input.effortResidual !== null) {
      this.effortResidualEma =
        0.94 * this.effortResidualEma + 0.06 * input.effortResidual;
      this.effortResidualVolatility =
        0.95 * this.effortResidualVolatility +
        0.05 * Math.abs(input.effortResidual - this.effortResidualEma);
      this.effortSensorBias =
        0.97 * this.effortSensorBias + 0.03 * input.effortResidual;
    }
    const brier = (input.predictedSuccess - (input.slipped ? 0 : 1)) ** 2;
    this.slipBrierEma = 0.95 * this.slipBrierEma + 0.05 * brier;
    this.energySensorBias = 0.97 * this.energySensorBias + 0.03 * input.energyBias;
    this.energySensorVariance =
      0.97 * this.energySensorVariance + 0.03 * input.energyVariance;
  }

  stats(): ChannelStats {
    return {
      energyInnovation: this.energyInnovationEma,
      energyInnovationEma: this.energyInnovationEma,
      energyInnovationVolatility: this.energyInnovationVolatility,
      strainResidualEma: this.strainResidualEma,
      strainResidualVolatility: this.strainResidualVolatility,
      effortResidualEma: this.effortResidualEma,
      effortResidualVolatility: this.effortResidualVolatility,
      slipBrierEma: this.slipBrierEma,
      energySensorBias: this.energySensorBias,
      energySensorVariance: this.energySensorVariance,
      effortSensorBias: this.effortSensorBias,
      evidenceCount: this.evidenceCount,
    };
  }

  scores(): AttributionScores {
    const stats = this.stats();
    const eZ = Math.abs(stats.energyInnovationEma) / (stats.energyInnovationVolatility + 0.8);
    const fZ = Math.abs(stats.strainResidualEma) / (stats.strainResidualVolatility + 0.08);
    const effortZ =
      Math.abs(stats.effortResidualEma) / (stats.effortResidualVolatility + 0.3);
    const slipZ = Math.max(0, stats.slipBrierEma - 0.18) * 5;
    const raw = [
      // physical: effort/slip and energy changes co-occur, without a pure
      // single-channel variance signature.
      0.8 * effortZ + 0.6 * slipZ + 0.25 * eZ + 0.2 * fZ,
      // energy channel only
      1.1 * eZ + 0.35 * Math.abs(stats.energySensorBias) - 0.25 * fZ,
      // fatigue/strain channel only
      1.1 * fZ - 0.2 * eZ,
      // shared sensor/external
      0.55 * eZ + 0.55 * fZ + 0.2 * effortZ,
      // insufficient evidence
      1.4 * Math.exp(-stats.evidenceCount / 12),
    ];
    const probs = softmax(raw);
    const kinds = [
      "physical",
      "energy_sensor",
      "fatigue_sensor",
      "shared",
      "insufficient",
    ] as const;
    let topIndex = 0;
    for (let i = 1; i < probs.length; i++) if (probs[i] > probs[topIndex]) topIndex = i;
    const sorted = [...probs].sort((a, b) => b - a);
    return {
      physical: probs[0],
      energy_sensor: probs[1],
      fatigue_sensor: probs[2],
      shared: probs[3],
      insufficient: probs[4],
      top: kinds[topIndex],
      confidence: clamp(sorted[0] - sorted[1], 0, 1),
      evidenceCount: stats.evidenceCount,
    };
  }
}
