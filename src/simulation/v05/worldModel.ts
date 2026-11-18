import { clamp, dot, sigmoid } from "../math";
import type { Rng } from "../rng";
import type { Action, ActionFeatures } from "../types";
import { PRIOR_RANGES } from "./config";
import type { PriorRegime, WorldModelV05Snapshot } from "./types";

const WEIGHT_LIMIT = 8;

function successFeatures(f: ActionFeatures): number[] {
  return [1, f.obstacleAtTarget, f.boundary, f.localObstacleDensity];
}
function collectFeatures(f: ActionFeatures): number[] {
  return [1, f.resourceAtTarget, f.localResourceDensity, f.directionResourceSignal];
}
function collisionFeatures(f: ActionFeatures): number[] {
  return [1, f.obstacleAtTarget, f.boundary, f.localObstacleDensity, f.directionObstacleSignal];
}

function update(weights: number[], x: number[], y: number, rate: number): void {
  const p = sigmoid(dot(weights, x));
  const err = y - p;
  for (let i = 0; i < weights.length; i++) {
    weights[i] = clamp(weights[i] + rate * err * x[i], -WEIGHT_LIMIT, WEIGHT_LIMIT);
  }
}

/**
 * V0.2 world model. All coefficients start from a bounded random distribution;
 * no environment-specific priors are supplied.
 */
export class WorldModelV05 {
  private success = new Map<Action, number[]>();
  private collect = new Map<Action, number[]>();
  private collision = new Map<Action, number[]>();
  readonly learnRate = 0.1;
  private priorRegime: PriorRegime;
  private lastPredictions = new Map<Action, { pSuccess: number; pCollect: number; pCollision: number }>();
  private brier = { success: 0.25, collect: 0.08, collision: 0.12 };
  private baseRate = { success: 0.75, collect: 0.05, collision: 0.1 };

  constructor(rng: Rng, priorRegime: PriorRegime) {
    this.priorRegime = priorRegime;
    this.applyPriors(rng);
  }

  /**
   * Trailing Brier skill of each head against a constant base-rate predictor.
   * Zero means "no better than knowing only how often the outcome happens",
   * which is what gates the learned model's influence on selection.
   */
  skill(): { success: number; collect: number; collision: number } {
    const ratio = (brier: number, rate: number): number => {
      const p = clamp(rate, 0.02, 0.98);
      const reference = p * (1 - p);
      return clamp(1 - brier / reference, 0, 1);
    };
    return {
      success: ratio(this.brier.success, this.baseRate.success),
      collect: ratio(this.brier.collect, this.baseRate.collect),
      collision: ratio(this.brier.collision, this.baseRate.collision),
    };
  }

  private applyPriors(rng: Rng): void {
    const [lo, hi] = PRIOR_RANGES[this.priorRegime].worldWeight;
    const draw = () => lo + (hi - lo) * rng.next();
    for (const action of ["UP", "DOWN", "LEFT", "RIGHT"] as Action[]) {
      this.success.set(action, Array.from({ length: 4 }, draw));
      this.collect.set(action, Array.from({ length: 4 }, draw));
      this.collision.set(action, Array.from({ length: 5 }, draw));
    }
    this.success.set("REST", [0, 0, 0, 0]);
    this.collect.set("REST", [0, 0, 0, 0]);
    this.collision.set("REST", [0, 0, 0, 0, 0]);
  }

  private weights(map: Map<Action, number[]>, action: Action): number[] {
    const value = map.get(action);
    if (!value) throw new Error(`missing v02 world weights: ${action}`);
    return value;
  }

  predict(features: ActionFeatures): { pSuccess: number; pCollect: number; pCollision: number } {
    if (features.action === "REST") {
      return { pSuccess: 1, pCollect: 0, pCollision: 0 };
    }
    const prediction = {
      pSuccess: sigmoid(dot(this.weights(this.success, features.action), successFeatures(features))),
      pCollect: sigmoid(dot(this.weights(this.collect, features.action), collectFeatures(features))),
      pCollision: sigmoid(
        dot(this.weights(this.collision, features.action), collisionFeatures(features)),
      ),
    };
    this.lastPredictions.set(features.action, prediction);
    return prediction;
  }

  learn(
    features: ActionFeatures,
    outcome: { moved: boolean; blocked: boolean; collected: boolean },
    rate = this.learnRate,
  ): void {
    if (features.action === "REST") return;
    const prediction =
      this.lastPredictions.get(features.action) ?? this.predict(features);
    const ySuccess = outcome.moved ? 1 : 0;
    const yCollect = outcome.collected ? 1 : 0;
    const yCollision = outcome.blocked ? 1 : 0;
    const alpha = 0.06;
    this.brier.success += alpha * ((prediction.pSuccess - ySuccess) ** 2 - this.brier.success);
    this.brier.collect += alpha * ((prediction.pCollect - yCollect) ** 2 - this.brier.collect);
    this.brier.collision +=
      alpha * ((prediction.pCollision - yCollision) ** 2 - this.brier.collision);
    this.baseRate.success += alpha * (ySuccess - this.baseRate.success);
    this.baseRate.collect += alpha * (yCollect - this.baseRate.collect);
    this.baseRate.collision += alpha * (yCollision - this.baseRate.collision);
    update(
      this.weights(this.success, features.action),
      successFeatures(features),
      ySuccess,
      rate,
    );
    update(
      this.weights(this.collect, features.action),
      collectFeatures(features),
      yCollect,
      rate * (yCollect === 1 ? 4 : 1),
    );
    update(
      this.weights(this.collision, features.action),
      collisionFeatures(features),
      yCollision,
      rate * 0.8,
    );
  }

  learnFromObservation(features: ActionFeatures): void {
    if (features.action === "REST") return;
    const target = features.boundary || features.obstacleAtTarget ? 0 : 1;
    update(
      this.weights(this.success, features.action),
      successFeatures(features),
      target,
      0.01,
    );
  }

  snapshot(): WorldModelV05Snapshot {
    const actions: Action[] = ["UP", "DOWN", "LEFT", "RIGHT", "REST"];
    const successByAction = {} as Record<Action, number[]>;
    const collectByAction = {} as Record<Action, number[]>;
    const collisionByAction = {} as Record<Action, number[]>;
    for (const action of actions) {
      successByAction[action] = [...this.weights(this.success, action)];
      collectByAction[action] = [...this.weights(this.collect, action)];
      collisionByAction[action] = [...this.weights(this.collision, action)];
    }
    return {
      successWeights: successByAction.UP,
      collectWeights: collectByAction.UP,
      collisionWeights: collisionByAction.UP,
      successByAction,
      collectByAction,
      collisionByAction,
      learnRate: this.learnRate,
    };
  }
}
