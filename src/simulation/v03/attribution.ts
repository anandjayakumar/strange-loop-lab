import { clamp } from "../math";
import type { Action, AttributionScores, ChannelStats } from "./types";

interface Channel {
  n: number;
  energyFast: number;
  energyBase: number;
  energyVol: number;
  energyVolBase: number;
  strainFast: number;
  strainBase: number;
  strainVol: number;
  strainVolBase: number;
  effortFast: number;
  effortBase: number;
  slipBrier: number;
  peakEnergy: number;
  peakStrain: number;
  peakEnergyVol: number;
  peakStrainVol: number;
  peakEffort: number;
}

function emptyChannel(): Channel {
  return {
    n: 0,
    energyFast: 0,
    energyBase: 0,
    energyVol: 0.5,
    energyVolBase: 0.5,
    strainFast: 0,
    strainBase: 0,
    strainVol: 0.05,
    strainVolBase: 0.05,
    effortFast: 0,
    effortBase: 0,
    slipBrier: 0.25,
    peakEnergy: 0,
    peakStrain: 0,
    peakEnergyVol: 0,
    peakStrainVol: 0,
    peakEffort: 0,
  };
}

const FAST = 0.14;
const BASE = 0.004;

function updateChannel(
  channel: Channel,
  energyInnovation: number,
  strainResidual: number,
  effortResidual: number | null,
  slipped: boolean,
  predictedSuccess: number,
): void {
  channel.n++;
  channel.energyFast += FAST * (energyInnovation - channel.energyFast);
  channel.energyBase += BASE * (energyInnovation - channel.energyBase);
  const energyDev = Math.abs(energyInnovation - channel.energyFast);
  channel.energyVol += 0.16 * (energyDev - channel.energyVol);
  channel.energyVolBase += BASE * (channel.energyVol - channel.energyVolBase);
  channel.strainFast += FAST * (strainResidual - channel.strainFast);
  channel.strainBase += BASE * (strainResidual - channel.strainBase);
  const strainDev = Math.abs(strainResidual - channel.strainFast);
  channel.strainVol += 0.22 * (strainDev - channel.strainVol);
  channel.strainVolBase += BASE * (channel.strainVol - channel.strainVolBase);
  if (effortResidual !== null) {
    channel.effortFast += FAST * (effortResidual - channel.effortFast);
    channel.effortBase += BASE * (effortResidual - channel.effortBase);
  }
  const brier = (predictedSuccess - (slipped ? 0 : 1)) ** 2;
  channel.slipBrier += 0.04 * (brier - channel.slipBrier);
}

function softmax(values: number[]): number[] {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(clamp(v - max, -30, 0)));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / total);
}

/**
 * Signature features (see `features()`):
 *   0 MOVE-only energy variance excess
 *   1 common energy variance excess (MOVE and REST)
 *   2 MOVE-only strain variance excess
 *   3 common strain variance excess
 *   4 MOVE-only energy innovation
 *   5 MOVE-only strain innovation
 *
 * Variance excess is the more durable signature: a sensor degradation keeps
 * the channel noisier, while a physical shift is absorbed by the self-model
 * within a few ticks. Every feature is an excess over the agent's own
 * long-run residual baseline, so a pre-existing model bias contributes
 * nothing.
 */

/**
 * V0.3 action-conditioned temporal attribution.
 *
 * The same single-step innovation can come from physics or a sensor. This
 * module separates MOVE and REST signatures and compares their *excess* over
 * the agent's own long-run residual baseline, then accumulates evidence for
 * four causal prototypes. It is an observable diagnostic, never a
 * ground-truth classifier, and it outputs `insufficient` until both action
 * classes have been sampled.
 */
export class TemporalAttributor {
  private move = emptyChannel();
  private rest = emptyChannel();
  private total = 0;
  private energyVarianceBase = 5;
  private energyBias = 0;
  private peakMoveEnergy = 0;

  update(input: {
    action: Action;
    energyInnovation: number;
    strainResidual: number;
    effortResidual: number | null;
    slipped: boolean;
    predictedSuccess: number;
    energyBias: number;
    energyVariance: number;
  }): void {
    const channel = input.action === "REST" ? this.rest : this.move;
    updateChannel(
      channel,
      input.energyInnovation,
      input.strainResidual,
      input.effortResidual,
      input.slipped,
      input.predictedSuccess,
    );
    this.energyBias = 0.97 * this.energyBias + 0.03 * input.energyBias;
    this.energyVarianceBase =
      0.98 * this.energyVarianceBase + 0.02 * input.energyVariance;
    // MOVE-only innovation shock, retained over a sliding window so a
    // physical cost shift remains visible after the self-model adapts.
    const moveOnly =
      Math.max(
        0,
        Math.abs(this.move.energyFast - this.move.energyBase) -
          Math.abs(this.rest.energyFast - this.rest.energyBase),
      ) / 3;
    this.peakMoveEnergy = Math.max(moveOnly, this.peakMoveEnergy * 0.97);
    this.total++;
  }

  signature(): number[] {
    return this.features();
  }

  private features(): number[] {
    const m = this.move;
    const r = this.rest;
    const moveEnergy = Math.abs(m.energyFast - m.energyBase);
    const restEnergy = Math.abs(r.energyFast - r.energyBase);
    const moveStrain = Math.abs(m.strainFast - m.strainBase);
    const restStrain = Math.abs(r.strainFast - r.strainBase);
    const moveOnlyEnergy = Math.max(0, moveEnergy - restEnergy) / 3;
    const peakMoveOnlyEnergy = Math.max(moveOnlyEnergy, this.peakMoveEnergy);
    const moveOnlyStrain = Math.max(0, moveStrain - restStrain) / 0.25;
    const quietEnergyVol = Math.max(0.8, Math.min(m.energyVolBase, r.energyVolBase));
    const quietStrainVol = Math.max(0.015, Math.min(m.strainVolBase, r.strainVolBase));
    const moveEnergyVol = Math.max(0, m.energyVol - m.energyVolBase) / quietEnergyVol;
    const restEnergyVol = Math.max(0, r.energyVol - r.energyVolBase) / quietEnergyVol;
    const moveStrainVol = Math.max(0, m.strainVol - m.strainVolBase) / quietStrainVol;
    const restStrainVol = Math.max(0, r.strainVol - r.strainVolBase) / quietStrainVol;
    const commonEnergyVol = Math.min(moveEnergyVol, restEnergyVol);
    const moveOnlyEnergyVol = Math.max(0, moveEnergyVol - restEnergyVol);
    const commonStrainVol = Math.min(moveStrainVol, restStrainVol);
    const moveOnlyStrainVol = Math.max(0, moveStrainVol - restStrainVol);
    return [
      clamp(moveOnlyEnergyVol, 0, 1.5),
      clamp(commonEnergyVol, 0, 1.5),
      clamp(moveOnlyStrainVol, 0, 1.5),
      clamp(commonStrainVol, 0, 1.5),
      clamp(peakMoveOnlyEnergy, 0, 2),
      clamp(moveOnlyStrain, 0, 2),
      clamp(Math.abs(m.effortFast - m.effortBase) / 0.6, 0, 2),    ];
  }

  stats(): ChannelStats {
    const m = this.move;
    const r = this.rest;
    return {
      energyInnovation: m.energyFast - m.energyBase,
      energyInnovationEma: Math.abs(m.energyFast - m.energyBase),
      energyInnovationVolatility: m.energyVol,
      strainResidualEma: m.strainFast - m.strainBase,
      strainResidualVolatility: m.strainVol,
      effortResidualEma: m.effortFast - m.effortBase,
      effortResidualVolatility: 0,
      slipBrierEma: m.slipBrier,
      restEnergyInnovation: r.energyFast - r.energyBase,
      restEnergyVolatility: r.energyVol,
      restStrainResidual: r.strainFast - r.strainBase,
      restStrainVolatility: r.strainVol,
      energySensorBias: this.energyBias,
      energySensorVariance: this.energyVarianceBase,
      effortSensorBias: 0,
      evidenceCount: this.total,
    };
  }

  scores(): AttributionScores {
    const evidence = this.total;
    const minEvidence = Math.min(this.move.n, this.rest.n);
    const insufficientProbability = 1 / (1 + Math.exp((Math.min(minEvidence, 40) - 10) / 2.4));
    if (evidence < 10) {
      return {
        physical: 0.05,
        energy_sensor: 0.05,
        fatigue_sensor: 0.05,
        shared: 0.05,
        insufficient: 0.8,
        top: "insufficient",
        confidence: 0.6,
        evidenceCount: evidence,
      };
    }

    const z = this.features();
    const moveMean = z[4];
    const moveOnlyVol = z[0];
    const eE = z[1];
    const eS = z[3];
    const scores = {
      physical: 1.6 * moveMean + 0.35 * moveOnlyVol - 0.8 * eE - 1.2 * eS,
      energy_sensor: 1.1 * eE - 1.4 * eS + 0.15 * moveOnlyVol,
      fatigue_sensor: 1.2 * eS - 0.9 * eE,
      shared: 1.4 * Math.min(0.9 * eE, eS),
    };
    const kinds = Object.keys(scores) as (keyof typeof scores)[];
    const logits = kinds.map((kind) => scores[kind] / 0.28);
    logits.push(minEvidence > 15 ? -8 : 1.5 * insufficientProbability - 2.2);
    const probs = softmax(logits);
    const all = [
      "physical",
      "energy_sensor",
      "fatigue_sensor",
      "shared",
      "insufficient",
    ] as const;
    let top = 0;
    for (let i = 1; i < probs.length; i++) if (probs[i] > probs[top]) top = i;
    const sorted = [...probs].sort((a, b) => b - a);
    return {
      physical: probs[0],
      energy_sensor: probs[1],
      fatigue_sensor: probs[2],
      shared: probs[3],
      insufficient: probs[4],
      top: all[top],
      confidence: clamp(sorted[0] - sorted[1], 0, 1),
      evidenceCount: evidence,
    };
  }
}
