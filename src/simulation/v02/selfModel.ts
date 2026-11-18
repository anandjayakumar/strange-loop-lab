import { clamp, dot, sigmoid } from "../math";
import type { Rng } from "../rng";
import type { Action, ActionFeatures, SelfPrediction } from "../types";
import { PRIOR_RANGES } from "./config";
import type {
  PriorRegime,
  SelfModelV02Snapshot,
  V02Observation,
  V02StepOutcome,
} from "./types";

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
 * V0.2 first-order self-model. It has no access to true energy, fatigue, cost
 * or the environment's regime schedule. All priors are drawn from bounded,
 * uninformed distributions in the configured regime.
 */
export class SelfModelV02 {
  initialized = false;
  energyEstimate = 0;
  energyVariance = 9;
  movementCost = 1.5;
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
  lastEffort: number | null = null;
  lastEffortCost: number | null = null;
  survivalHorizon = 0;
  private lastIntendedDelta = 0;
  private lastRawReading: number | null = null;

  constructor(rng: Rng, regime: PriorRegime) {
    const ranges = PRIOR_RANGES[regime];
    this.movementCost = draw(rng, ranges.movementCost);
    this.restGain = draw(rng, ranges.restGain);
    this.collectGain = draw(rng, ranges.collectGain);
    this.moveFatigueRate = draw(rng, ranges.moveFatigueRate);
    this.restReliefRate = draw(rng, ranges.restReliefRate);
    this.energyBias = draw(rng, ranges.energyBias);
    this.energyNoiseVariance = draw(rng, ranges.energyVariance);
    // Effort is treated as an unbiased channel initially. A nonzero starting
    // bias would be a designer guess about a hidden sensor defect.
    this.effortBias = 0;
    for (let i = 0; i < 4; i++) {
      this.successWeights[i] = draw(rng, [ranges.successBias[0], ranges.successBias[1]]);
      this.collectWeights[i] = draw(rng, [ranges.successBias[0], ranges.successBias[1]]);
    }
  }

  initialise(observation: V02Observation): void {
    if (this.initialized) return;
    this.energyEstimate = observation.energyReading - this.energyBias;
    this.energyVariance = Math.max(1, this.energyNoiseVariance);
    this.fatigue = clamp(observation.strainReading - this.fatigueBias, 0, 1);
    this.initialized = true;
    this.lastInnovation = 0;
    this.lastIntendedDelta = 0;
    this.lastRawReading = observation.energyReading;
  }

  private correctEnergy(reading: number, priorWeight: number): void {
    const corrected = reading - this.energyBias;
    if (!this.initialized) {
      this.energyEstimate = corrected;
      this.energyVariance = Math.max(1, this.energyNoiseVariance);
      this.lastInnovation = 0;
      this.initialized = true;
      this.lastIntendedDelta = 0;
      this.lastRawReading = reading;
      return;
    }
    const rawChange =
      this.lastRawReading === null ? 0 : Math.abs(reading - this.lastRawReading);
    this.lastRawReading = reading;
    // Measurement update. The last predicted delta is deliberately excluded
    // from the belief correction; it remains available for meta error scoring
    // and for the learned future-state predictor.
    const predicted = this.energyEstimate;
    this.energyVariance = clamp(this.energyVariance + 0.55, 0.2, 30);
    // Adaptive measurement filter. The direct channel is more trustworthy
    // than a forward model learned from sparse, noisy outcomes. The gain
    // adapts upward during large innovations and is modulated by meta prior
    // weight, but a poor prediction cannot drag the belief away from sensing.
    const adaptiveGain = clamp(
      0.3 +
        0.5 * clamp(rawChange / 5, 0, 1) +
        0.08 * clamp(Math.abs(corrected - predicted) / 9, 0, 1) +
        0.015 * Math.log1p(this.energyNoiseVariance),
      0.24,
      0.9,
    );
    const gain = clamp(adaptiveGain * (1.08 - 0.15 * priorWeight), 0.2, 0.94);
    const innovation = corrected - predicted;
    this.energyEstimate = predicted + gain * innovation;
    this.energyVariance = (1 - gain) * this.energyVariance + 0.12;
    this.lastInnovation = innovation;
    this.energyBias = clamp(
      this.energyBias + 0.008 * gain * innovation,
      -25,
      25,
    );
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

  observePre(observation: V02Observation, priorWeight: number): void {
    this.correctEnergy(observation.energyReading, priorWeight);
    const strain = clamp(observation.strainReading - this.fatigueBias, 0, 1.2);
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
    const energyDelta = moving
      ? -this.movementCost + pCollect * this.collectGain
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
    outcome: V02StepOutcome,
    features: ActionFeatures,
    post: V02Observation,
    preEnergyReading: number,
    rateScale: number,
  ): void {
    const observedDelta = post.energyReading - preEnergyReading;
    const moving = outcome.action !== "REST";
    const effort = outcome.effortReading - this.effortBias;
    this.lastEffort = outcome.effortReading;
    this.lastEffortCost = effort;

    if (moving) {
      this.movementCost = clamp(
        this.movementCost + 0.09 * rateScale * (effort - this.movementCost),
        0.08,
        10,
      );
      this.effortBias = clamp(
        this.effortBias + 0.008 * (outcome.effortReading - this.movementCost),
        -4,
        4,
      );
    } else {
      if (this.energyEstimate < 96) {
        const gain = clamp(observedDelta + (post.energyReading < 96 ? 0.3 : 0), 0.05, 6);
        this.restGain = clamp(
          this.restGain + 0.07 * rateScale * (gain - this.restGain),
          0.05,
          6,
        );
      }
      this.fatigue = clamp(this.fatigue - this.restReliefRate * 0.5, 0, 1);
    }
    if (outcome.collected) {
      const gain = clamp(observedDelta + this.movementCost, 1, 70);
      this.collectGain = clamp(
        this.collectGain + 0.1 * rateScale * (gain - this.collectGain),
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
      [
        1,
        this.fatigue,
        features.obstacleAtTarget + features.boundary,
        this.slipRate,
      ],
      outcome.moved ? 1 : 0,
      0.11 * rateScale,
    );
    updateLogistic(
      this.collectWeights,
      [
        1,
        features.resourceAtTarget,
        features.directionResourceSignal,
        features.localResourceDensity,
      ],
      outcome.collected ? 1 : 0,
      0.08 * rateScale,
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

  snapshot(learnRate: number): SelfModelV02Snapshot {
    return {
      initialized: this.initialized,
      energyEstimate: this.energyEstimate,
      energyVariance: this.energyVariance,
      movementCost: this.movementCost,
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
    };
  }
}
