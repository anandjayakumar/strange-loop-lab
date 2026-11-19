import { clamp, dot, sigmoid } from "../math";
import type { Rng } from "../rng";
import type { Action, ActionFeatures, SelfPrediction } from "../types";
import type { ObservableStepOutcome } from "../v05/types";
import { V06_PRIOR_RANGES } from "./config";
import type { PriorRegime, V06Observation } from "./types";

const WEIGHT_LIMIT = 6;

function draw(rng: Rng, range: [number, number]): number {
  return range[0] + (range[1] - range[0]) * rng.next();
}

function updateLogistic(
  weights: number[],
  features: number[],
  target: number,
  rate: number,
): void {
  const p = sigmoid(dot(weights, features));
  const error = target - p;
  for (let i = 0; i < weights.length; i++) {
    weights[i] = clamp(weights[i] + rate * error * features[i], -WEIGHT_LIMIT, WEIGHT_LIMIT);
  }
}

/**
 * First-order self-model, inherited from V0.5 with two V0.6 additions:
 *
 *  1. `gainOverride` lets the recurrent settling loop (RPT) supply the
 *     posterior precision instead of the local adaptive heuristic. With
 *     `no_rpt` the override is cleared and the V0.5 gain is used, so the
 *     ablation changes only the precision pathway.
 *  2. `topDownPrior` blends the workspace's predicted energy into the
 *     measurement update. This is the "top-down prior" half of PP-1.
 *
 * All priors remain bounded, uninformed draws. No latent state is read.
 */
export class SelfModelV06 {
  initialized = false;
  energyEstimate = 0;
  energyVariance = 9;
  movementCost = 1.5;
  roughCost = 4;
  roughObservations = 0;
  restGain = 1;
  collectGain = 18;
  fatigue = 0;
  moveFatigueRate = 0.06;
  restReliefRate = 0.15;
  energyBias = 0;
  fatigueBias = 0;
  effortBias = 0;
  energyNoiseVariance = 5;
  successWeights = [0, 0, 0, 0];
  collectWeights = [0, 0, 0, 0];
  predictionErrorEma = 0.3;
  innovationVolatility = 0.2;
  systematicBias = 0;
  lastInnovation = 0;
  lastObservableError = 0.4;
  slipRate = 0.2;
  priorPrecision = 0.7;
  sensorPrecision = 0.7;
  precisionGain = 0.5;
  instantDisagreement = 0;
  disagreementFast = 0;
  disagreementEma = 0;
  sensorDistrust = 0;
  lastEffort: number | null = null;
  lastEffortCost: number | null = null;
  survivalHorizon = 0;

  /** RPT / PP-1 hooks, set by the engine before `observePre`. */
  gainScale = 1;
  topDownPrior: number | null = null;
  topDownWeight = 0.12;
  learningGate = 1;

  private lastIntendedDelta = 0;
  private lastJump = 0;

  constructor(rng: Rng, regime: PriorRegime) {
    const ranges = V06_PRIOR_RANGES[regime];
    this.movementCost = draw(rng, ranges.movementCost);
    this.roughCost = draw(rng, ranges.roughCost);
    this.restGain = draw(rng, ranges.restGain);
    this.collectGain = draw(rng, ranges.collectGain);
    this.moveFatigueRate = draw(rng, ranges.moveFatigueRate);
    this.restReliefRate = draw(rng, ranges.restReliefRate);
    this.energyBias = draw(rng, ranges.energyBias);
    this.energyNoiseVariance = draw(rng, ranges.energyVariance);
    this.effortBias = 0;
    for (let i = 0; i < 4; i++) {
      this.successWeights[i] = draw(rng, [ranges.successBias[0], ranges.successBias[1]]);
      this.collectWeights[i] = draw(rng, [ranges.successBias[0], ranges.successBias[1]]);
    }
  }

  initialise(observation: V06Observation): void {
    if (this.initialized) return;
    this.energyEstimate = observation.energyReading - this.energyBias;
    this.energyVariance = Math.max(1, this.energyNoiseVariance);
    this.fatigue = clamp(observation.strainReading - this.fatigueBias, 0, 1);
    this.initialized = true;
    this.lastInnovation = 0;
    this.lastIntendedDelta = 0;
  }

  private correctEnergy(
    reading: number,
    priorWeight: number,
    strainDisagreement = 0,
    metaFailure = 0.5,
    attentionRelief = 0,
  ): void {
    const corrected = reading - this.energyBias;
    if (!this.initialized) {
      this.energyEstimate = corrected;
      this.energyVariance = Math.max(1, this.energyNoiseVariance);
      this.lastInnovation = 0;
      this.initialized = true;
      this.lastIntendedDelta = 0;
      return;
    }
    const predicted = this.energyEstimate;
    this.energyVariance = clamp(this.energyVariance + 0.55, 0.2, 30);
    const innovation = corrected - predicted;

    const innovationRatio = Math.max(
      0,
      Math.abs(innovation - this.lastJump) / 11 - 0.25,
    );
    this.lastJump = 0;
    const strainExcess = Math.max(0, strainDisagreement - 0.12);
    const instantDisagreement = clamp(
      innovationRatio * (0.5 + 0.5 * clamp(strainExcess / 0.2, 0, 1.3)),
      0,
      1.6,
    );
    this.instantDisagreement = instantDisagreement;
    this.disagreementFast = 0.62 * this.disagreementFast + 0.38 * instantDisagreement;
    this.disagreementEma = 0.9 * this.disagreementEma + 0.1 * instantDisagreement;
    this.sensorDistrust = 0.9 * this.sensorDistrust + 0.1 * instantDisagreement;
    if (attentionRelief > 0) {
      this.sensorDistrust *= 1 - 0.9 * clamp(attentionRelief, 0, 1);
    }

    const familiarity = clamp(priorWeight, 0.2, 0.95);
    const priorPrecision =
      1.4 *
      Math.exp(-1.6 * clamp(metaFailure, 0, 1)) *
      Math.exp(-2.6 * clamp(this.disagreementEma, 0, 1.6)) *
      (0.7 + 0.6 * familiarity);
    const sensorPrecision =
      1.6 *
      Math.exp(-4.0 * clamp(instantDisagreement, 0, 1.6)) *
      clamp(6 / (1 + this.energyNoiseVariance), 0.4, 1.6) *
      (1 + 3.2 * clamp(attentionRelief, 0, 1));
    const adaptiveGain = clamp(
      0.3 +
        0.5 * clamp(Math.abs(innovation) / 14, 0, 1) +
        0.08 * clamp(Math.abs(innovation) / 9, 0, 1) +
        0.015 * Math.log1p(this.energyNoiseVariance),
      0.24,
      0.9,
    );
    const relief = clamp((this.disagreementEma - 0.25) / 0.4, 0, 1) * 0.7;
    const sigma = Math.sqrt(Math.max(1, this.energyNoiseVariance));
    const outlier = Math.abs(innovation) > Math.max(5, 2 * sigma);
    const suppression = outlier
      ? clamp(
          0.12 +
            0.88 *
              Math.exp(-3.5 * clamp(instantDisagreement + 2.5 * this.sensorDistrust, 0, 1.8)) +
            relief,
          0.06,
          1,
        )
      : 1;
    const precisionGain = clamp(adaptiveGain * suppression, 0.04, 0.94);
    this.priorPrecision = priorPrecision;
    this.sensorPrecision = sensorPrecision;
    this.precisionGain = precisionGain;
    const gain = clamp(precisionGain * this.gainScale, 0.02, 0.95);

    // Top-down prior: the workspace predicts where energy should be. The
    // settled innovation is a convex blend of the sensory evidence and that
    // prediction, weighted by the modelled prior precision.
    let settledInnovation = innovation;
    if (this.topDownPrior !== null) {
      const w = clamp(this.topDownWeight * clamp(priorPrecision / 1.4, 0.2, 1.2), 0, 0.5);
      const priorInnovation = this.topDownPrior - predicted;
      settledInnovation = (1 - w) * innovation + w * priorInnovation;
    }

    this.energyEstimate = predicted + gain * settledInnovation;
    this.energyVariance = (1 - gain) * this.energyVariance + 0.12;
    this.lastInnovation = innovation;
    this.energyBias = clamp(this.energyBias + 0.008 * gain * innovation, -25, 25);
    this.energyNoiseVariance = clamp(
      this.energyNoiseVariance + 0.018 * (innovation * innovation - this.energyNoiseVariance),
      0.15,
      40,
    );
    this.predictionErrorEma = clamp(
      0.94 * this.predictionErrorEma + 0.06 * Math.min(1, Math.abs(innovation) / 9),
      0,
      2,
    );
    this.energyEstimate = clamp(this.energyEstimate, 0, 115);
    this.lastIntendedDelta = 0;
  }

  observePre(
    observation: V06Observation,
    priorWeight: number,
    metaFailure = 0.5,
    attentionRelief = 0,
  ): void {
    const strain = clamp(observation.strainReading - this.fatigueBias, 0, 1.2);
    const strainDisagreement = Math.abs(strain - this.fatigue);
    this.correctEnergy(
      observation.energyReading,
      priorWeight,
      strainDisagreement,
      metaFailure,
      attentionRelief,
    );
    this.fatigue = clamp(
      this.initialized ? 0.72 * this.fatigue + 0.28 * strain : strain,
      0,
      1,
    );
  }

  setIntention(action: Action, delta: number): void {
    this.lastIntendedDelta = action === "REST" ? 0 : delta;
  }

  predict(features: ActionFeatures): SelfPrediction {
    const moving = features.action !== "REST";
    const successFeatures = [
      1,
      this.fatigue,
      features.obstacleAtTarget + features.boundary,
      this.slipRate,
    ];
    const collectFeatures = [
      1,
      features.resourceAtTarget,
      features.directionResourceSignal,
      features.localResourceDensity,
    ];
    const pSuccess = moving ? sigmoid(dot(this.successWeights, successFeatures)) : 1;
    const pCollect = moving ? sigmoid(dot(this.collectWeights, collectFeatures)) : 0;
    const predictedCost = features.resourceAtTarget ? this.roughCost : this.movementCost;
    const energyDelta = moving
      ? -predictedCost + pCollect * this.collectGain
      : this.restGain;
    const fatigueNext = clamp(
      this.fatigue + (moving ? this.moveFatigueRate : -this.restReliefRate),
      0,
      1,
    );
    this.survivalHorizon = clamp(
      Math.max(0, this.energyEstimate) / Math.max(0.4, this.movementCost * (0.6 + 0.4 * pSuccess)),
      0,
      999,
    );
    return {
      energyDelta,
      pSuccess,
      fatigueNext,
      fatigueDelta: fatigueNext - this.fatigue,
      survivalHorizon: this.survivalHorizon,
      pCollect,
    };
  }

  learnOutcome(
    outcome: ObservableStepOutcome,
    features: ActionFeatures,
    post: V06Observation,
    preEnergyReading: number,
    rateScale: number,
  ): void {
    const scale = rateScale * this.learningGate;
    const observedDelta = post.energyReading - preEnergyReading;
    this.lastJump = outcome.collected ? this.collectGain : 0;
    const moving = outcome.action !== "REST";
    const effort = outcome.effortReading;
    this.lastEffort = outcome.effortReading;
    this.lastEffortCost = effort;

    if (moving) {
      if (outcome.terrainRough) {
        this.roughCost = clamp(
          this.roughCost + 0.5 * scale * (effort - this.roughCost),
          0.08,
          30,
        );
        this.roughObservations++;
      } else {
        this.movementCost = clamp(
          this.movementCost + 0.09 * scale * (effort - this.movementCost),
          0.08,
          10,
        );
        this.effortBias = clamp(
          this.effortBias + 0.01 * (effort - this.movementCost),
          -1,
          1,
        );
      }
    } else {
      if (this.energyEstimate < 96) {
        const gain = clamp(observedDelta + (post.energyReading < 96 ? 0.3 : 0), 0.05, 6);
        this.restGain = clamp(
          this.restGain + 0.07 * scale * (gain - this.restGain),
          0.05,
          6,
        );
      }
      this.fatigue = clamp(this.fatigue - this.restReliefRate * 0.5, 0, 1);
    }
    if (outcome.collected) {
      const gain = clamp(observedDelta + this.movementCost, 1, 70);
      this.collectGain = clamp(
        this.collectGain + 0.1 * scale * (gain - this.collectGain),
        1,
        70,
      );
    }

    const strain = clamp(post.strainReading - this.fatigueBias, 0, 1.2);
    const strainBlend = clamp(0.55 * this.fatigue + 0.45 * strain, 0, 1);
    this.fatigue = clamp(
      strainBlend + (moving ? this.moveFatigueRate * 0.35 : -this.restReliefRate * 0.2),
      0,
      1,
    );
    this.fatigueBias = clamp(
      this.fatigueBias + 0.02 * (post.strainReading - this.fatigue),
      -0.3,
      0.3,
    );

    this.slipRate = clamp(
      this.slipRate + 0.1 * ((outcome.slipped ? 1 : 0) - this.slipRate),
      0,
      1,
    );
    updateLogistic(
      this.successWeights,
      [1, this.fatigue, features.obstacleAtTarget + features.boundary, this.slipRate],
      outcome.moved ? 1 : 0,
      0.11 * scale,
    );
    updateLogistic(
      this.collectWeights,
      [1, features.resourceAtTarget, features.directionResourceSignal, features.localResourceDensity],
      outcome.collected ? 1 : 0,
      0.08 * scale,
    );

    const normalizedError = clamp(
      Math.abs(this.lastIntendedCostPrediction - observedDelta) /
        (Math.abs(observedDelta) + 3),
      0,
      1.5,
    );
    this.predictionErrorEma = clamp(
      0.93 * this.predictionErrorEma + 0.07 * normalizedError,
      0,
      2,
    );
    this.systematicBias = clamp(
      0.96 * this.systematicBias + 0.04 * (observedDelta - this.lastIntendedCostPrediction),
      -10,
      10,
    );
    this.innovationVolatility = clamp(
      0.94 * this.innovationVolatility + 0.06 * Math.abs(normalizedError - this.predictionErrorEma),
      0,
      2,
    );
    this.lastObservableError = normalizedError;
  }

  private get lastIntendedCostPrediction(): number {
    return this.lastIntendedDelta;
  }

  get confidence(): number {
    return clamp(1 - this.predictionErrorEma * 0.9 - this.innovationVolatility * 0.3, 0.03, 0.97);
  }

  snapshot(learnRate: number): SelfModelV06Snapshot {
    return {
      initialized: this.initialized,
      energyEstimate: this.energyEstimate,
      energyVariance: this.energyVariance,
      movementCost: this.movementCost,
      roughCost: this.roughCost,
      roughObservations: this.roughObservations,
      restGain: this.restGain,
      collectGain: this.collectGain,
      fatigue: this.fatigue,
      moveFatigueRate: this.moveFatigueRate,
      restReliefRate: this.restReliefRate,
      energyBias: this.energyBias,
      energyNoiseVariance: this.energyNoiseVariance,
      successWeights: [...this.successWeights],
      collectWeights: [...this.collectWeights],
      innovation: this.lastInnovation,
      predictionErrorEma: this.predictionErrorEma,
      innovationVolatility: this.innovationVolatility,
      systematicBias: this.systematicBias,
      confidence: this.confidence,
      survivalHorizon: this.survivalHorizon,
      learnRate,
      lastEffort: this.lastEffort,
      lastEffortCost: this.lastEffortCost,
      priorPrecision: this.priorPrecision,
      sensorPrecision: this.sensorPrecision,
      precisionGain: this.precisionGain,
      instantDisagreement: this.instantDisagreement,
      persistentDisagreement: this.disagreementEma,
    };
  }
}

export interface SelfModelV06Snapshot {
  initialized: boolean;
  energyEstimate: number;
  energyVariance: number;
  movementCost: number;
  roughCost: number;
  roughObservations: number;
  restGain: number;
  collectGain: number;
  fatigue: number;
  moveFatigueRate: number;
  restReliefRate: number;
  energyBias: number;
  energyNoiseVariance: number;
  successWeights: number[];
  collectWeights: number[];
  innovation: number;
  predictionErrorEma: number;
  innovationVolatility: number;
  systematicBias: number;
  confidence: number;
  survivalHorizon: number;
  learnRate: number;
  lastEffort: number | null;
  lastEffortCost: number | null;
  priorPrecision: number;
  sensorPrecision: number;
  precisionGain: number;
  instantDisagreement: number;
  persistentDisagreement: number;
}
