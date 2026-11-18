import { clamp, dot, sigmoid } from "../math";
import { META } from "./config";
import type {
  MetaContext,
  MetaModelV04Snapshot,
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
  "rough target",
  "rough evidence",
  "normalised |bias|",
  "cross-channel bias",
];

interface CalibrationRecord {
  predicted: number;
  baseline: number;
  observed: boolean;
  failurePredicted: number;
  failureObserved: boolean;
}

/**
 * V0.4 residual meta-model.
 *
 * A one-parameter rolling tracker supplies the baseline prediction. A
 * regularized contextual residual is blended in through a validation/hedge
 * weight, so weak context evidence collapses back to the rolling baseline
 * rather than overfitting. A separate head predicts persistent failure from
 * observable multi-step error. No latent state or regime label is used.
 */
export class ResidualMetaModel {
  /** Ablation switch: when false the model reports only its rolling baseline. */
  residualEnabled = true;
  private errorWeights: number[];
  private toleranceWeights: number[];
  private failureWeights: number[];
  private counts = new Map<string, number>();
  private contextStats = new Map<string, { n: number; tolerance: number; error: number }>();
  private records: CalibrationRecord[] = [];
  private residualVariance = 0.25;
  private signedBias = 0;
  private volatility = 0.2;
  private observations = 0;
  private brierSum = 0;
  private logLossSum = 0;
  private failureBrierSum = 0;
  private failureObservations = 0;
  private toleranceBase = 0.5;
  private errorBase = 0.35;
  private persistentError = 0.4;
  private smoothedError = 0.35;
  private multiStepEma = 0.35;
  private absDeltaEma = 2;
  private failureBias = 0;
  private crossBiasEma = 0;
  private contextWeight = 0.25;
  lastToleranceTarget = true;

  constructor() {
    this.errorWeights = new Array(META_FEATURE_LABELS.length).fill(0);
    this.toleranceWeights = new Array(META_FEATURE_LABELS.length).fill(0);
    this.failureWeights = new Array(META_FEATURE_LABELS.length).fill(0);
    this.errorWeights[0] = 0.3;
    this.toleranceWeights[0] = 0.25;
    this.failureWeights[0] = -0.2;
  }

  private key(context: MetaContext): string {
    return `${context.action}:${context.energyBin}:${context.fatigueBin}:${context.roughTarget}`;
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
      context.roughTarget,
      clamp(Math.log1p(context.roughEvidence) / 3, 0, 1),
      clamp(Math.abs(this.failureBias) / (this.absDeltaEma + META.errorScale), 0, 1),
      clamp(this.crossBiasEma, 0, 2),
    ];
  }

  private estimateTolerance(x: number[], evidence: number): number {
    if (!this.residualEnabled) return this.toleranceBase;
    const evidenceWeight = 1 - Math.exp(-evidence / 5);
    const raw = sigmoid(dot(this.toleranceWeights, x));
    const residual = raw - this.toleranceBase;
    const shrink = evidenceWeight * this.contextWeight;
    return clamp(this.toleranceBase + shrink * residual, 0.05, 0.95);
  }

  predict(context: MetaContext): MetaPrediction {
    const evidenceCount = this.evidence(context);
    const x = this.features(context, evidenceCount);
    const toleranceProbability = this.estimateTolerance(x, evidenceCount);
    const rawError = clamp(dot(this.errorWeights, x), 0, 2);
    const evidenceWeight = 1 - Math.exp(-evidenceCount / 5);
    const expectedError = clamp(
      this.errorBase +
        (this.residualEnabled ? 1 : 0) *
          evidenceWeight *
          this.contextWeight *
          (rawError - this.errorBase),
      0,
      2,
    );
    const failureProbability = sigmoid(dot(this.failureWeights, x));
    const uncertainty = clamp(
      META.uncertaintyFloor +
        0.55 * Math.sqrt(Math.max(0, this.residualVariance)) +
        0.5 * (1 - evidenceWeight) +
        0.12 * this.volatility,
      META.uncertaintyFloor,
      1.5,
    );
    const influence = clamp(0.55 + 0.4 * (toleranceProbability - 0.5), 0.25, 0.95);
    const learningMultiplier = clamp(
      0.5 + 1.2 * (1 - toleranceProbability),
      0.4,
      2,
    );
    const priorWeight = clamp(0.4 + 0.4 * toleranceProbability, 0.4, 0.9);
    return {
      expectedError,
      toleranceProbability,
      uncertainty,
      systematicBias: this.signedBias,
      biasCorrection: -this.signedBias,
      errorBound: clamp(expectedError + 1.2 * uncertainty, 0.05, 3),
      failureProbability,
      persistentBias: this.signedBias,
      rollingBase: this.toleranceBase,
      residualWeight: this.contextWeight * evidenceWeight,
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
    absDelta: number,
    crossChannelBias: number,
    multiStepError: number,
  ): void {
    const evidenceCount = this.evidence(context);
    const x = this.features(context, evidenceCount);
    const rawTolerance = sigmoid(dot(this.toleranceWeights, x));
    const tolerancePrediction = this.estimateTolerance(x, evidenceCount);
    const baselinePrediction = this.toleranceBase;

    // Failure label: contemporaneous smoothed observable error (V0.3 target,
    // preserved for comparability). Error-head target: the multi-step
    // windowed error (V0.4), so the contextual residual stops fitting 1-step
    // sensor noise.
    this.smoothedError = clamp(0.86 * this.smoothedError + 0.14 * observedError, 0, 2);
    this.multiStepEma = clamp(0.86 * this.multiStepEma + 0.14 * multiStepError, 0, 2);
    this.absDeltaEma = clamp(0.88 * this.absDeltaEma + 0.12 * absDelta, 0.2, 40);
    this.failureBias = clamp(0.94 * this.failureBias + 0.06 * signedError, -12, 12);
    this.crossBiasEma = clamp(
      0.9 * this.crossBiasEma + 0.1 * Math.abs(crossChannelBias),
      0,
      3,
    );
    this.persistentError = clamp(
      0.85 * this.persistentError + 0.15 * Math.abs(this.smoothedError - this.errorBase),
      0,
      2,
    );
    this.lastToleranceTarget = this.smoothedError <= META.tolerance;
    // Persistent directional discrepancy, normalised the same way as the
    // per-step error. Averaging the signed error cancels zero-mean sensor
    // noise, so this isolates genuine model bias. This is the multi-step,
    // cross-channel target: it survives the precision filter absorbing
    // single-channel spikes.
    const failureSignal =
      Math.abs(this.failureBias) / (this.absDeltaEma + META.errorScale);
    const persistentFailure = failureSignal > 0.18;
    const rawError = clamp(dot(this.errorWeights, x), 0, 2);
    const errorPrediction = clamp(
      this.errorBase + this.contextWeight * (rawError - this.errorBase),
      0,
      2,
    );
    const errorResidual = this.multiStepEma - errorPrediction;

    // Regularized contextual residual updates.
    for (let i = 0; i < this.errorWeights.length; i++) {
      this.errorWeights[i] = clamp(
        this.errorWeights[i] * 0.9994 +
          META.errorLearningRate * clamp(errorResidual, -1.5, 1.5) * x[i],
        -3,
        3,
      );
    }
    for (let i = 0; i < this.toleranceWeights.length; i++) {
      this.toleranceWeights[i] = clamp(
        this.toleranceWeights[i] * 0.9994 +
          META.toleranceLearningRate *
            ((this.lastToleranceTarget ? 1 : 0) - rawTolerance) *
            x[i],
        -4,
        4,
      );
    }
    for (let i = 0; i < this.failureWeights.length; i++) {
      this.failureWeights[i] = clamp(
        this.failureWeights[i] * 0.9994 +
          0.035 * ((persistentFailure ? 1 : 0) - sigmoid(dot(this.failureWeights, x))) * x[i],
        -4,
        4,
      );
    }

    // Hedge between the rolling baseline and the contextual residual. If the
    // contextual predictor loses locally, its weight falls toward zero.
    const baseLoss = (baselinePrediction - (this.lastToleranceTarget ? 1 : 0)) ** 2;
    const rawLoss = (rawTolerance - (this.lastToleranceTarget ? 1 : 0)) ** 2;
    this.contextWeight = clamp(
      this.contextWeight + 0.012 * (baseLoss - rawLoss),
      0,
      0.8,
    );

    this.toleranceBase = clamp(
      0.94 * this.toleranceBase + 0.06 * (this.lastToleranceTarget ? 1 : 0),
      0.05,
      0.95,
    );
    this.errorBase = clamp(
      0.93 * this.errorBase + 0.07 * this.multiStepEma,
      0.02,
      2,
    );
    this.residualVariance = clamp(
      this.residualVariance +
        META.residualRate * (errorResidual * errorResidual - this.residualVariance),
      0.002,
      3,
    );
    this.signedBias = clamp(
      this.signedBias + META.biasRate * (signedError - this.signedBias),
      -5,
      5,
    );
    this.volatility = clamp(
      this.volatility + META.volatilityRate * (Math.abs(errorResidual) - this.volatility),
      0,
      2,
    );

    const key = this.key(context);
    this.counts.set(key, evidenceCount + 1);
    const empirical = this.contextStats.get(key) ?? { n: 0, tolerance: 0, error: 0 };
    empirical.n++;
    if (this.lastToleranceTarget) empirical.tolerance++;
    empirical.error += observedError;
    this.contextStats.set(key, empirical);
    this.observations++;
    this.brierSum += (tolerancePrediction - (this.lastToleranceTarget ? 1 : 0)) ** 2;
    const q = this.lastToleranceTarget ? tolerancePrediction : 1 - tolerancePrediction;
    this.logLossSum += -Math.log(clamp(q, 0.001, 0.999));
    this.failureBrierSum +=
      (sigmoid(dot(this.failureWeights, x)) - (persistentFailure ? 1 : 0)) ** 2;
    this.failureObservations++;

    this.records.push({
      predicted: tolerancePrediction,
      baseline: baselinePrediction,
      observed: this.lastToleranceTarget,
      failurePredicted: sigmoid(dot(this.failureWeights, x)),
      failureObserved: persistentFailure,
    });
    if (this.records.length > 500) this.records.shift();
  }

  snapshot(): MetaModelV04Snapshot {
    const n = this.records.length;
    const bins = Array.from({ length: META.calibrationBins }, () => ({
      predicted: 0,
      observed: 0,
      count: 0,
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
    const toleranceRate = n ? this.records.filter((r) => r.observed).length / n : 0;
    return {
      expectedError: this.errorBase,
      toleranceProbability: this.toleranceBase,
      uncertainty: clamp(0.05 + Math.sqrt(this.residualVariance), 0, 2),
      systematicBias: this.signedBias,
      biasCorrection: -this.signedBias,
      errorBound: clamp(this.errorBase + 1.2 * Math.sqrt(this.residualVariance), 0.05, 3),
      failureProbability: this.records.length
        ? this.records[this.records.length - 1].failurePredicted
        : 0.5,
      persistentBias: this.signedBias,
      rollingBase: this.toleranceBase,
      residualWeight: this.contextWeight,
      volatility: this.volatility,
      evidenceCount: Math.max(0, ...this.counts.values()),
      influence: 0.55,
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
