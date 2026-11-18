import { LEARNING } from "../../config";
import { clamp, dot, sigmoid } from "../../math";
import type {
  Action,
  ActionFeatures,
  MemoryStats,
  SelfModelSnapshot,
  SelfPrediction,
} from "../../types";

export const SELF_SUCCESS_LABELS = [
  "bias",
  "estimated fatigue",
  "obstacle ahead",
  "recent slip rate",
];

export const SELF_COLLECT_LABELS = [
  "bias",
  "resource ahead",
  "directional resource signal",
  "local resource density",
];

const WEIGHT_LIMIT = 6;

function logisticUpdate(
  weights: number[],
  features: number[],
  target: number,
  rate: number,
): number {
  const prediction = sigmoid(dot(weights, features));
  const error = target - prediction;
  for (let i = 0; i < weights.length; i++) {
    weights[i] = clamp(weights[i] + rate * error * features[i], -WEIGHT_LIMIT, WEIGHT_LIMIT);
  }
  return error;
}

export interface SelfLearnInput {
  prediction: SelfPrediction;
  action: Action;
  success: boolean;
  collected: boolean;
  slipped: boolean;
  blocked: boolean;
  sensedEnergyDelta: number;
  innovation: number;
  rateScale: number;
}

/**
 * The self-model sees only interoception, proprioception, actions, outcomes and
 * its own past estimates. It never receives the physical energy or fatigue.
 */
export class SelfModel {
  energyEstimate = 0;
  energyVariance = 9;
  movementCost = 1.35;
  restGain = 2.35;
  collectGain = 20;
  fatigueEstimate = 0;
  slipRate = 0;
  successCalibration = 0;
  predictionErrorEMA = 0.2;
  innovation = 0;
  survivalHorizon = 0;
  private initialised = false;
  private lastIntendedDelta = 0;
  private successWeights = [1.5, -2.6, -1.0, -1.4];
  private collectWeights = [-2.6, 3.0, 0.8, 0.8];
  private readonly initialMovementCost: number;
  private readonly initialRestGain: number;
  private readonly initialCollectGain: number;
  private readonly initialFatigue: number;

  constructor(initial: {
    movementCost?: number;
    restGain?: number;
    collectGain?: number;
    fatigue?: number;
  } = {}) {
    this.initialMovementCost = clamp(initial.movementCost ?? 1.35, 0.2, 8);
    this.initialRestGain = clamp(initial.restGain ?? 2.35, 0.3, 7);
    this.initialCollectGain = clamp(initial.collectGain ?? 20, 2, 70);
    this.initialFatigue = clamp(initial.fatigue ?? 0, 0, 1);
    this.reset();
  }

  /** Initialise the energy belief from the first interoceptive sample only. */
  initialise(sensedEnergy: number): void {
    if (this.initialised) return;
    this.energyEstimate = sensedEnergy;
    this.energyVariance = 6;
    this.innovation = 0;
    this.initialised = true;
    this.lastIntendedDelta = 0;
  }

  /** Kalman-style scalar prediction/correction for energy, using noisy sensing. */
  advanceAndCorrect(
    sensedEnergy: number,
    priorWeighting: boolean,
    priorWeight: number,
  ): void {
    if (!this.initialised) {
      this.initialise(sensedEnergy);
      return;
    }
    const predicted = this.energyEstimate + this.lastIntendedDelta;
    this.energyVariance += 0.55;
    let gain = this.energyVariance / (this.energyVariance + 6.2);
    if (priorWeighting) gain *= clamp(1.18 - 0.62 * priorWeight, 0.35, 1.05);
    const innovation = sensedEnergy - predicted;
    this.innovation = innovation;
    this.energyEstimate = predicted + gain * innovation;
    this.energyVariance = (1 - gain) * this.energyVariance + 0.15;
    this.predictionErrorEMA =
      0.92 * this.predictionErrorEMA + 0.08 * clamp(Math.abs(innovation) / 9, 0, 1);
    this.lastIntendedDelta = 0;
  }

  setIntention(action: Action, predictedDelta: number): void {
    this.lastIntendedDelta = action === "REST" ? 0 : predictedDelta;
  }

  predict(features: ActionFeatures, memory: MemoryStats): SelfPrediction {
    const moving = features.action !== "REST";
    const fatigueFeature = this.fatigueEstimate;
    const successFeatures = [
      1,
      fatigueFeature,
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
      this.fatigueEstimate + (moving ? 0.048 + 0.012 * memory.recentSlip : -0.105),
      0,
      1,
    );
    const averageBurn = this.movementCost * (0.62 + 0.38 * pSuccess);
    this.survivalHorizon = clamp(
      this.energyEsimtateForHorizon() / Math.max(0.35, averageBurn),
      0,
      999,
    );
    return {
      energyDelta,
      pSuccess,
      fatigueNext,
      fatigueDelta: fatigueNext - this.fatigueEstimate,
      survivalHorizon: this.survivalHorizon,
      pCollect,
    };
  }

  private energyEsimtateForHorizon(): number {
    return Math.max(0, this.energyEstimate);
  }

  learn(input: SelfLearnInput): { deltaError: number; brier: number } {
    const { prediction, action, success, collected, slipped, blocked, rateScale } = input;
    const moving = action !== "REST";
    const sensedDelta = input.sensedEnergyDelta;

    let observedCost = 0;
    if (moving) {
      observedCost = -(sensedDelta - (collected ? this.collectGain : 0));
      observedCost = clamp(observedCost, 0.05, 11);
      const costInnovation = observedCost - this.movementCost;
      this.movementCost = clamp(
        this.movementCost + LEARNING.selfCostRate * rateScale * costInnovation,
        0.2,
        8,
      );

      this.fatigueEstimate = clamp(
        this.fatigueEstimate +
          0.048 * rateScale +
          (slipped ? 0.012 : 0) +
          0.012 * rateScale * clamp(costInnovation, -0.8, 0.8),
        0,
        1,
      );
    } else {
      this.fatigueEstimate = clamp(
        this.fatigueEstimate - 0.105 * rateScale,
        0,
        1,
      );
      if (this.energyEstimate < 96) {
        const gainSample = clamp(sensedDelta, 0.2, 7);
        this.restGain = clamp(
          this.restGain + 0.09 * rateScale * (gainSample - this.restGain),
          0.3,
          7,
        );
      }
    }

    if (collected) {
      const gainSample = clamp(sensedDelta + observedCost, 1, 70);
      this.collectGain = clamp(
        this.collectGain + 0.13 * rateScale * (gainSample - this.collectGain),
        2,
        70,
      );
    }

    this.slipRate = clamp(
      this.slipRate + LEARNING.selfOutcomeRate * rateScale * ((slipped ? 1 : 0) - this.slipRate),
      0,
      1,
    );

    const deltaError = clamp(
      Math.abs(prediction.energyDelta - sensedDelta) / (Math.abs(sensedDelta) + 3),
      0,
      1.3,
    );
    const brier = (prediction.pSuccess - (success ? 1 : 0)) ** 2;
    this.successCalibration = clamp(
      0.96 * this.successCalibration +
        0.04 * (prediction.pSuccess - (success ? 1 : 0)),
      -1,
      1,
    );
    const innovationError = Math.min(1, Math.abs(input.innovation) / 9);
    const calibrationError = Math.min(1, Math.abs(this.successCalibration) * 2);
    const combined = 0.72 * innovationError + 0.28 * calibrationError;
    this.predictionErrorEMA = clamp(
      0.93 * this.predictionErrorEMA + 0.07 * combined,
      0,
      1,
    );

    if (blocked) {
      // A block is a known external cause; do not over-attribute it to fatigue.
      this.fatigueEstimate = Math.max(0, this.fatigueEstimate - 0.01);
    }

    return { deltaError, brier };
  }

  /** Train the self-model's own success logistic on the features it saw. */
  learnSuccess(features: ActionFeatures, success: boolean, rateScale: number): void {
    if (features.action === "REST") return;
    logisticUpdate(
      this.successWeights,
      [
        1,
        this.fatigueEstimate,
        features.obstacleAtTarget + features.boundary,
        this.slipRate,
      ],
      success ? 1 : 0,
      LEARNING.selfOutcomeRate * rateScale,
    );
  }

  learnCollect(features: ActionFeatures, collected: boolean, rateScale: number): void {
    if (features.action === "REST") return;
    logisticUpdate(
      this.collectWeights,
      [
        1,
        features.resourceAtTarget,
        features.directionResourceSignal,
        features.localResourceDensity,
      ],
      collected ? 1 : 0,
      LEARNING.selfOutcomeRate * 0.9 * rateScale,
    );
  }

  reset(): void {
    this.energyEstimate = 0;
    this.energyVariance = 9;
    this.initialised = false;
    this.movementCost = this.initialMovementCost;
    this.restGain = this.initialRestGain;
    this.collectGain = this.initialCollectGain;
    this.fatigueEstimate = this.initialFatigue;
    this.slipRate = 0;
    this.successCalibration = 0;
    this.predictionErrorEMA = 0.2;
    this.innovation = 0;
    this.survivalHorizon = 0;
    this.successWeights = [1.5, -2.6, -1.0, -1.4];
    this.collectWeights = [-2.6, 3.0, 0.8, 0.8];
    this.lastIntendedDelta = 0;
  }

  get confidence(): number {
    return clamp(1 - this.predictionErrorEMA * 1.4, 0.05, 0.98);
  }

  get hasObservation(): boolean {
    return this.initialised;
  }

  snapshot(learnRate: number): SelfModelSnapshot {
    return {
      initialized: this.initialised,
      energyEstimate: this.energyEstimate,
      energyVariance: this.energyVariance,
      movementCost: this.movementCost,
      restGain: this.restGain,
      collectGain: this.collectGain,
      fatigue: this.fatigueEstimate,
      slipRate: this.slipRate,
      pCollect: sigmoid(dot(this.collectWeights, [1, 0, 0, 0])),
      successWeights: [...this.successWeights],
      collectWeights: [...this.collectWeights],
      successLabels: SELF_SUCCESS_LABELS,
      collectLabels: SELF_COLLECT_LABELS,
      innovation: this.innovation,
      predictionErrorEMA: this.predictionErrorEMA,
      confidence: this.confidence,
      survivalHorizon: this.survivalHorizon,
      learnRate,
    };
  }
}
