import { LEARNING } from "../../config";
import { clamp, dot, sigmoid } from "../../math";
import type {
  ActionFeatures,
  Action,
  WorldModelSnapshot,
  WorldPrediction,
} from "../../types";

const WEIGHT_LIMIT = 7;

export const SUCCESS_LABELS = [
  "bias",
  "obstacle ahead",
  "boundary ahead",
  "local obstacle density",
];

export const COLLECT_LABELS = [
  "bias",
  "resource ahead",
  "local resource density",
  "directional resource signal",
];

export const COLLISION_LABELS = [
  "bias",
  "obstacle ahead",
  "boundary ahead",
  "local obstacle density",
  "directional obstacle signal",
];

function successFeatures(features: ActionFeatures): number[] {
  return [
    1,
    features.obstacleAtTarget,
    features.boundary,
    features.localObstacleDensity,
  ];
}

function collectFeatures(features: ActionFeatures): number[] {
  return [
    1,
    features.resourceAtTarget,
    features.localResourceDensity,
    features.directionResourceSignal,
  ];
}

function collisionFeatures(features: ActionFeatures): number[] {
  return [
    1,
    features.obstacleAtTarget,
    features.boundary,
    features.localObstacleDensity,
    features.directionObstacleSignal,
  ];
}

function updateWeights(
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

/**
 * A transparent online logistic world model: one set of readable coefficients
 * per outcome and action. Updated by the delta rule from realised outcomes.
 */
export class WorldModel {
  private success = new Map<Action, number[]>();
  private collect = new Map<Action, number[]>();
  private collision = new Map<Action, number[]>();

  constructor() {
    this.applyPriors();
  }

  private applyPriors(): void {
    const actions: Action[] = ["UP", "DOWN", "LEFT", "RIGHT"];
    for (const action of actions) {
      this.success.set(action, [1.75, -3.4, -5.2, -1.3]);
      this.collect.set(action, [-1.5, 3.2, 0.7, 0.8]);
      this.collision.set(action, [-2.4, 3.1, 4.3, 1.3, 0.7]);
    }
    this.success.set("REST", [1.75, 0, 0, -1.3]);
    this.collect.set("REST", [-1.5, 0, 0, 0]);
    this.collision.set("REST", [-2.4, 0, 0, 0, 0]);
  }

  reset(): void {
    this.success.clear();
    this.collect.clear();
    this.collision.clear();
    this.applyPriors();
  }

  private weights(map: Map<Action, number[]>, action: Action): number[] {
    const found = map.get(action);
    if (!found) throw new Error(`missing world-model weights for ${action}`);
    return found;
  }

  predict(features: ActionFeatures): WorldPrediction {
    const sf = successFeatures(features);
    const cf = collectFeatures(features);
    const xf = collisionFeatures(features);
    if (features.action === "REST") {
      return {
        pSuccess: 1,
        pCollect: 0,
        pCollision: 0,
        expectedTarget: { ...features.target },
        features: sf,
        collectFeatures: cf,
        collisionFeatures: xf,
      };
    }
    return {
      pSuccess: sigmoid(dot(this.weights(this.success, features.action), sf)),
      pCollect: sigmoid(dot(this.weights(this.collect, features.action), cf)),
      pCollision: sigmoid(dot(this.weights(this.collision, features.action), xf)),
      expectedTarget: { ...features.target },
      features: sf,
      collectFeatures: cf,
      collisionFeatures: xf,
    };
  }

  /** Full delta-rule update from a realised action outcome. */
  learn(
    prediction: WorldPrediction,
    action: Action,
    outcome: { moved: boolean; blocked: boolean; collected: boolean },
    rate = LEARNING.worldRate,
  ): { successError: number; collectError: number; collisionError: number } {
    if (action === "REST") {
      return { successError: 0, collectError: 0, collisionError: 0 };
    }
    const successError = updateWeights(
      this.weights(this.success, action),
      prediction.features,
      outcome.moved ? 1 : 0,
      rate,
    );
    const collectError = updateWeights(
      this.weights(this.collect, action),
      prediction.collectFeatures,
      outcome.collected ? 1 : 0,
      rate,
    );
    const collisionError = updateWeights(
      this.weights(this.collision, action),
      prediction.collisionFeatures,
      outcome.blocked ? 1 : 0,
      rate * 0.8,
    );
    return { successError, collectError, collisionError };
  }

  /**
   * Cheap observational correction. Seeing an adjacent empty cell is weak
   * evidence that a step is possible; seeing a wall is strong evidence against.
   */
  learnFromObservation(features: ActionFeatures, rate = LEARNING.worldObservationRate): void {
    if (features.action === "REST") return;
    const sf = successFeatures(features);
    const cf = collectFeatures(features);
    const successTarget = features.boundary || features.obstacleAtTarget ? 0 : 1;
    updateWeights(this.weights(this.success, features.action), sf, successTarget, rate);
    if (!features.boundary && !features.obstacleAtTarget) {
      updateWeights(
        this.weights(this.collect, features.action),
        cf,
        features.resourceAtTarget,
        rate * 0.6,
      );
    }
  }

  snapshot(): WorldModelSnapshot {
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
      weightLabels: SUCCESS_LABELS,
      collectLabels: COLLECT_LABELS,
      collisionLabels: COLLISION_LABELS,
      learnRate: LEARNING.worldRate,
    };
  }
}
