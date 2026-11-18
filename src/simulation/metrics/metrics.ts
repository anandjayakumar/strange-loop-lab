import { clamp, jsDivergence, mean, pearson } from "../math";
import { ACTIONS, type Action, type EngineMetrics } from "../types";

const ACTION_WINDOW = 30;

export interface MetricSample {
  worldBrier: number;
  selfStateError: number | null;
  selfPredictionError: number | null;
  selfInfluence: number;
  trust: number | null;
  learningRate: number;
  priorWeight: number;
  energy: number;
  action: Action;
  policyTv: number;
  decisionChanged: boolean;
  costError: number | null;
}

export class MetricTracker {
  private world: number[] = [];
  private selfState: number[] = [];
  private selfPrediction: number[] = [];
  private influence: number[] = [];
  private trust: number[] = [];
  private learningRate: number[] = [];
  private priorWeight: number[] = [];
  private energy: number[] = [];
  private actions: Action[] = [];
  private calibrationTrust: number[] = [];
  private calibrationAccuracy: number[] = [];
  private policyTv: number[] = [];
  private decisionChanges: number[] = [];
  private costError: number[] = [];
  private capacity = 60;

  record(sample: MetricSample): void {
    pushCapped(this.world, sample.worldBrier, this.capacity);
    pushCapped(this.energy, sample.energy, this.capacity);
    pushCapped(this.influence, sample.selfInfluence, this.capacity);
    pushCapped(this.learningRate, sample.learningRate, this.capacity);
    pushCapped(this.priorWeight, sample.priorWeight, this.capacity);
    pushCapped(this.policyTv, sample.policyTv, this.capacity);
    pushCapped(this.decisionChanges, sample.decisionChanged ? 1 : 0, this.capacity);
    if (sample.costError !== null) pushCapped(this.costError, sample.costError, this.capacity);
    if (sample.selfStateError !== null) {
      pushCapped(this.selfState, sample.selfStateError, this.capacity);
    }
    if (sample.selfPredictionError !== null) {
      pushCapped(this.selfPrediction, sample.selfPredictionError, this.capacity);
      pushCapped(
        this.calibrationAccuracy,
        clamp(1 - sample.selfPredictionError, 0, 1),
        160,
      );
    }
    if (sample.trust !== null) {
      pushCapped(this.trust, sample.trust, this.capacity);
      pushCapped(this.calibrationTrust, sample.trust, 160);
    }
    this.actions.push(sample.action);
    if (this.actions.length > ACTION_WINDOW * 2) this.actions.shift();
  }

  worldAccuracy(): number {
    if (this.world.length === 0) return 0;
    return clamp(1 - mean(this.world), 0, 1);
  }

  selfStateAccuracy(): number | null {
    if (this.selfState.length === 0) return null;
    return clamp(1 - mean(this.selfState) / 25, 0, 1);
  }

  selfPredictionAccuracy(): number | null {
    if (this.selfPrediction.length === 0) return null;
    return clamp(1 - mean(this.selfPrediction), 0, 1);
  }

  selfInfluence(): number {
    return mean(this.influence);
  }

  meanTrust(): number | null {
    return this.trust.length ? mean(this.trust) : null;
  }

  meanLearningRate(): number {
    return mean(this.learningRate);
  }

  meanPriorWeight(): number {
    return mean(this.priorWeight);
  }

  meanEnergy(): number {
    return mean(this.energy);
  }

  decisionChangeRate(): number {
    return this.decisionChanges.length ? mean(this.decisionChanges) : 0;
  }

  meanPolicyTv(): number {
    return mean(this.policyTv);
  }

  meanCostError(): number | null {
    return this.costError.length ? mean(this.costError) : null;
  }

  /**
   * Predictive calibration: does trust at time t predict measured self-model
   * accuracy a short time later? A short lag avoids scoring trust against the
   * instantaneous noise it is responding to.
   */
  metaCalibration(): number | null {
    const n = Math.min(this.calibrationTrust.length, this.calibrationAccuracy.length);
    if (n < 100) return null;
    const lag = Math.min(15, Math.floor(n / 4));
    return pearson(
      this.calibrationTrust.slice(0, n - lag),
      this.calibrationAccuracy.slice(lag, n),
    );
  }

  actionMix(): Record<Action, number> {
    const counts: Record<Action, number> = { UP: 0, DOWN: 0, LEFT: 0, RIGHT: 0, REST: 0 };
    for (const action of this.actions) counts[action]++;
    const total = Math.max(1, this.actions.length);
    for (const action of ACTIONS) counts[action] = counts[action] / total;
    return counts;
  }

  actionEntropy(): number {
    const mix = this.actionMix();
    let h = 0;
    for (const action of ACTIONS) {
      const p = mix[action];
      if (p > 1e-6) h -= p * Math.log(p);
    }
    return h;
  }

  adaptation(): number {
    if (this.actions.length < ACTION_WINDOW + 8) return 0;
    const recent = this.actions.slice(-ACTION_WINDOW);
    const prior = this.actions.slice(-ACTION_WINDOW * 2, -ACTION_WINDOW);
    if (prior.length < 8) return 0;
    const p = mixOf(recent);
    const q = mixOf(prior);
    return jsDivergence(p, q);
  }

  reset(): void {
    this.world = [];
    this.selfState = [];
    this.selfPrediction = [];
    this.influence = [];
    this.trust = [];
    this.learningRate = [];
    this.priorWeight = [];
    this.energy = [];
    this.actions = [];
    this.calibrationTrust = [];
    this.calibrationAccuracy = [];
    this.policyTv = [];
    this.decisionChanges = [];
    this.costError = [];
  }

  snapshot(input: {
    survival: number;
    resources: number;
    distance: number;
  }): EngineMetrics {
    return {
      worldAccuracy: this.worldAccuracy(),
      selfStateAccuracy: this.selfStateAccuracy(),
      selfPredictionAccuracy: this.selfPredictionAccuracy(),
      selfInfluence: this.selfInfluence(),
      metaCalibration: this.metaCalibration(),
      adaptation: this.adaptation(),
      actionEntropy: this.actionEntropy(),
      meanEnergy: this.meanEnergy(),
      survival: input.survival,
      resources: input.resources,
      distance: input.distance,
      meanTrust: this.meanTrust(),
      meanLearningRate: this.meanLearningRate(),
      meanPriorWeight: this.meanPriorWeight(),
      decisionChangeRate: this.decisionChangeRate(),
      meanPolicyTv: this.meanPolicyTv(),
      meanCostError: this.meanCostError(),
    };
  }
}

function pushCapped(array: number[], value: number, cap: number): void {
  array.push(value);
  if (array.length > cap) array.shift();
}

function mixOf(actions: readonly Action[]): number[] {
  const counts = [0, 0, 0, 0, 0];
  for (const action of actions) {
    counts[["UP", "DOWN", "LEFT", "RIGHT", "REST"].indexOf(action)]++;
  }
  const total = Math.max(1, actions.length);
  return counts.map((c) => c / total);
}
