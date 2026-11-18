import { clamp, dot, sigmoid } from "../math";
import { META } from "./config";
import type {
  MetaContext,
  MetaModelV02Snapshot,
  MetaPrediction,
} from "./types";

export const META_FEATURE_LABELS = [
  "bias",
  "action UP",
  "action DOWN",
  "action LEFT",
  "action RIGHT",
  "action REST",
  "log evidence",
  "recent |error|",
  "recent |bias|",
  "error volatility",
  "|innovation|",
  "sensor disagreement",
  "time since rest",
  "estimated fatigue",
  "estimated energy",
  "slip rate",
  "context tolerance rate",
  "context mean error",
];

interface CalibrationRecord {
  predicted: number;
  observed: boolean;
  errorPredicted: number;
  errorObserved: number;
}

/**
 * Learned second-order model.
 *
 * It predicts two observable quantities before each action: the magnitude of
 * the first-order observable error and the probability that this error will be
 * within tolerance. It is trained only from post-action observable errors.
 * There is no ground-truth state or latent-error input.
 */
export class LearnedMetaModel {
  private errorWeights: number[];
  private toleranceWeights: number[];
  private counts = new Map<string, number>();
  private contextStats = new Map<string, { n: number; tolerance: number; error: number }>();
  private records: CalibrationRecord[] = [];
  private residualVariance = 0.25;
  private signedBias = 0;
  private volatility = 0.2;
  private observations = 0;
  private brierSum = 0;
  private logLossSum = 0;
  private toleranceBase = 0.5;
  private smoothedError = 0.35;
  lastToleranceTarget = true;

  constructor() {
    this.errorWeights = new Array(META_FEATURE_LABELS.length).fill(0);
    this.toleranceWeights = new Array(META_FEATURE_LABELS.length).fill(0);
    this.errorWeights[0] = 0.35;
    this.toleranceWeights[0] = 0.4;
  }

  private key(context: MetaContext): string {
    return `${context.action}:${context.energyBin}:${context.fatigueBin}`;
  }

  private evidence(context: MetaContext): number {
    return this.counts.get(this.key(context)) ?? 0;
  }

  private features(context: MetaContext, evidence: number): number[] {
    const empirical = this.contextStats.get(this.key(context));
    return [
      1,
      context.action === "UP" ? 1 : 0,
      context.action === "DOWN" ? 1 : 0,
      context.action === "LEFT" ? 1 : 0,
      context.action === "RIGHT" ? 1 : 0,
      context.action === "REST" ? 1 : 0,
      Math.log1p(evidence) / 3,
      clamp(context.recentAbsError, 0, 3),
      clamp(Math.abs(context.recentSignedBias), 0, 3),
      clamp(context.recentVolatility, 0, 2),
      clamp(Math.abs(context.lastInnovation) / 9, 0, 2),
      clamp(context.sensorDisagreement, 0, 2),
      clamp(context.timeSinceRest / 30, 0, 1),
      clamp(context.energyBin / 4, 0, 1),
      clamp(context.fatigueBin / 3, 0, 1),
      clamp(context.slipRate, 0, 1),
      empirical && empirical.n > 0 ? clamp(empirical.tolerance / empirical.n, 0, 1) : 0.5,
      empirical && empirical.n > 0 ? clamp(empirical.error / empirical.n, 0, 2) : 0.5,
    ];
  }

  private estimateTolerance(x: number[], evidenceCount: number): number {
    const evidenceWeight = 1 - Math.exp(-evidenceCount / 5);
    const rawTolerance = sigmoid(dot(this.toleranceWeights, x));
    const value =
      this.toleranceBase +
      0.72 * evidenceWeight * (rawTolerance - this.toleranceBase);
    return clamp(value, 0.05, 0.95);
  }

  predict(context: MetaContext): MetaPrediction {
    const evidenceCount = this.evidence(context);
    const x = this.features(context, evidenceCount);
    const expectedError = clamp(dot(this.errorWeights, x), 0, 2);
    const toleranceProbability = this.estimateTolerance(x, evidenceCount);
    const evidenceWeight = 1 - Math.exp(-evidenceCount / 5);
    const uncertainty = clamp(
      META.uncertaintyFloor +
        0.55 * Math.sqrt(Math.max(0, this.residualVariance)) +
        0.5 * (1 - evidenceWeight) +
        0.12 * this.volatility,
      META.uncertaintyFloor,
      1.5,
    );
    const influence = clamp(
      0.5 + (toleranceProbability - 0.5) * evidenceWeight,
      0.04,
      0.96,
    );
    const learningMultiplier =
      evidenceWeight > 0.05
        ? clamp(0.5 + 1.5 * (1 - toleranceProbability), 0.4, 2)
        : 1;
    const priorWeight = evidenceWeight > 0.05 ? clamp(0.4 + 0.45 * toleranceProbability, 0.4, 0.9) : 0.5;
    return {
      expectedError,
      toleranceProbability,
      uncertainty,
      systematicBias: this.signedBias,
      evidenceCount,
      evidenceWeight,
      influence,
      learningMultiplier,
      priorWeight,
    };
  }

  update(
    context: MetaContext,
    observedError: number,
    signedError: number,
    withinTolerance: boolean,
  ): void {
    const evidenceCount = this.evidence(context);
    const x = this.features(context, evidenceCount);
    // The meta target is the expected observable error, not one noisy sample.
    // A short local EMA makes the target identifiable while still being strictly
    // observable.
    this.smoothedError = clamp(
      0.86 * this.smoothedError + 0.14 * observedError,
      0,
      2,
    );
    const targetError = this.smoothedError;
    this.lastToleranceTarget = targetError <= META.tolerance;
    const predictedError = clamp(dot(this.errorWeights, x), 0, 2);
    const predictedTolerance = this.estimateTolerance(x, evidenceCount);
    const errorResidual = targetError - predictedError;

    for (let i = 0; i < this.errorWeights.length; i++) {
      this.errorWeights[i] = clamp(
        this.errorWeights[i] * 0.9995 +
          META.errorLearningRate * clamp(errorResidual, -1.5, 1.5) * x[i],
        -4,
        4,
      );
    }
    for (let i = 0; i < this.toleranceWeights.length; i++) {
      this.toleranceWeights[i] = clamp(
        this.toleranceWeights[i] * 0.9995 +
          META.toleranceLearningRate * ((this.lastToleranceTarget ? 1 : 0) - predictedTolerance) * x[i],
        -5,
        5,
      );
    }
    this.toleranceBase = clamp(
      this.toleranceBase +
        0.012 * ((this.lastToleranceTarget ? 1 : 0) - this.toleranceBase),
      0.05,
      0.95,
    );

    this.residualVariance = clamp(
      this.residualVariance +
        META.residualRate * (errorResidual * errorResidual - this.residualVariance),
      0.002,
      3,
    );
    this.signedBias = clamp(
      this.signedBias + META.biasRate * (signedError - this.signedBias),
      -2,
      2,
    );
    this.volatility = clamp(
      this.volatility +
        META.volatilityRate * (Math.abs(errorResidual) - this.volatility),
      0,
      2,
    );
    const key = this.key(context);
    this.counts.set(key, evidenceCount + 1);
    const empirical = this.contextStats.get(key) ?? { n: 0, tolerance: 0, error: 0 };
    empirical.n++;
    if (withinTolerance) empirical.tolerance++;
    empirical.error += observedError;
    this.contextStats.set(key, empirical);
    this.observations++;
    this.brierSum +=
      (predictedTolerance - (this.lastToleranceTarget ? 1 : 0)) ** 2;
    const q = this.lastToleranceTarget ? predictedTolerance : 1 - predictedTolerance;
    this.logLossSum += -Math.log(clamp(q, 0.001, 0.999));

    this.records.push({
      predicted: predictedTolerance,
      observed: this.lastToleranceTarget,
      errorPredicted: predictedError,
      errorObserved: targetError,
    });
    if (this.records.length > 400) this.records.shift();
  }

  snapshot(): MetaModelV02Snapshot {
    const n = this.records.length;
    const bins = Array.from({ length: META.calibrationBins }, () => ({
      predicted: 0,
      observed: 0,
      count: 0,
      low: 0,
      high: 1,
    }));
    for (const record of this.records) {
      const index = Math.min(
        META.calibrationBins - 1,
        Math.floor(record.predicted * META.calibrationBins),
      );
      bins[index].predicted += record.predicted;
      bins[index].observed += record.observed ? 1 : 0;
      bins[index].count++;
    }
    const calibrationBins = bins.map((bin, index) => ({
      low: index / META.calibrationBins,
      high: (index + 1) / META.calibrationBins,
      predicted: bin.count ? bin.predicted / bin.count : (index + 0.5) / META.calibrationBins,
      observed: bin.count ? bin.observed / bin.count : 0,
      count: bin.count,
    }));
    const toleranceRate = n
      ? this.records.filter((r) => r.observed).length / n
      : 0;
    const currentTolerance = clamp(
      this.toleranceBase +
        0.72 * (sigmoid(this.toleranceWeights[0]) - this.toleranceBase),
      0.05,
      0.95,
    );
    return {
      expectedError: this.errorWeights[0],
      toleranceProbability: currentTolerance,
      uncertainty: clamp(0.05 + Math.sqrt(this.residualVariance), 0, 2),
      systematicBias: this.signedBias,
      volatility: this.volatility,
      evidenceCount: Math.max(0, ...this.counts.values()),
      influence:
        this.observations > 0
          ? clamp(
              0.5 +
                (currentTolerance - 0.5) *
                  (1 - Math.exp(-this.observations / 5)),
              0,
              1,
            )
          : 0.5,
      learningMultiplier: 1,
      priorWeight: 0.5,
      brier: n ? this.brierSum / n : 0,
      logLoss: n ? this.logLossSum / n : 0,
      toleranceRate,
      calibrationBins,
      errorWeights: [...this.errorWeights],
      toleranceWeights: [...this.toleranceWeights],
      featureLabels: META_FEATURE_LABELS,
      observations: this.observations,
    };
  }
}
