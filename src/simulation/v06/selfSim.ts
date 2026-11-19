import { clamp } from "../math";
import type { Action } from "../types";
import { V06 } from "./config";
import type { ActionPredictionV06, CognitiveMode, RolloutStep, SelfSimResult } from "./types";
import { V06_ACTIONS } from "./types";

export interface SelfSimInput {
  predictions: ActionPredictionV06[];
  energy: number;
  fatigue: number;
  uncertainty: number;
  reliability: number;
  roughObservations: number;
  roughCost: number;
  horizon: number;
  cognitive: boolean;
}

function modeOf(
  energy: number,
  fatigue: number,
  uncertainty: number,
  reliability: number,
): CognitiveMode {
  if (energy < 24 || fatigue > 0.82) return "defend";
  if (uncertainty > 0.55 || reliability < 0.4) return "diagnose";
  if (fatigue > 0.58) return "prepare";
  return "forage";
}

function informative(prediction: ActionPredictionV06, unverifiedRough: boolean): number {
  let info = prediction.action === "REST" ? 0.05 : 0.16;
  if (prediction.features.resourceAtTarget) info += 0.25;
  if (prediction.features.directionResourceSignal > 0.1) info += 0.08;
  if (unverifiedRough) info += 0.42;
  return clamp(info, 0, 0.9);
}

/**
 * AE-1/AE-2: bounded recursive self-simulation.
 *
 * The rollout predicts future *physical* state (energy, fatigue) and, when
 * `cognitive` is true, future *cognitive* state: belief uncertainty, second-
 * order reliability and the workspace mode the agent expects to be in. This is
 * the strange-loop closure: the model's own future knowledge is part of what it
 * evaluates.
 *
 * The epistemic term is the value of the decision the information unlocks. It
 * is computed from the predicted uncertainty drop and the stake of the decision
 * that the uncertainty currently blocks, not from a scenario label. A probe is
 * worth paying for only if the simulated future self can act better afterwards.
 */
export function planRollout(input: SelfSimInput): SelfSimResult {
  const horizon = Math.max(1, input.horizon);
  const traces: RolloutStep[][] = [];
  const totals: number[] = [];
  const epistics: number[] = [];

  for (const first of V06_ACTIONS) {
    const trace: RolloutStep[] = [];
    let energy = clamp(input.energy, 0, 100);
    let fatigue = clamp(input.fatigue, 0, 1);
    let uncertainty = clamp(input.uncertainty, 0.02, 1);
    let reliability = clamp(input.reliability, 0, 1);
    let total = 0;
    let epistemic = 0;

    for (let k = 0; k < horizon; k++) {
      const action: Action = k === 0 ? first : greedyAction(input.predictions, energy, fatigue);
      const prediction =
        input.predictions.find((p) => p.action === action) ?? input.predictions[0];
      const unverifiedRough =
        prediction.features.resourceAtTarget === 1 && input.roughObservations === 0;
      const rawDelta =
        action === "REST"
          ? Math.min(prediction.self.energyDelta, Math.max(0, 100 - energy))
          : prediction.self.energyDelta;
      const nextEnergy = clamp(energy + rawDelta, 0, 100);
      const nextFatigue = clamp(fatigue + prediction.self.fatigueDelta, 0, 1);
      const uPrev = uncertainty;
      let option = 0;

      let physical =
        prediction.world.pCollect * 22 +
        prediction.world.pSuccess * 1 -
        prediction.world.pCollision * 4.5;
      if (nextEnergy < 24) physical -= (24 - nextEnergy) * 1.3;
      if (action !== "REST" && rawDelta < -22) physical -= 3;

      if (input.cognitive) {
        const info = informative(prediction, unverifiedRough);
        uncertainty = clamp(
          uncertainty * (1 - V06.informationGainRate * info) + 0.025,
          0.02,
          1,
        );
        reliability = clamp(
          reliability + V06.reliabilityGainRate * info * (1 - reliability),
          0,
          1,
        );
        if (unverifiedRough) {
          // Option value of resolving the cost prior. `stake` is the
          // pessimistic cost the decision currently carries; `drop` is how
          // much the probe is predicted to reduce belief uncertainty; the
          // remaining horizon is how many later decisions inherit the gain.
          const stake = Math.max(4, Math.abs(prediction.self.energyDelta));
          const drop = Math.max(0, uPrev - uncertainty);
          const remaining = horizon - k;
          option = 2.0 * stake * drop * remaining * V06.optionValueWeight;
        }
      }
      if (nextEnergy <= 0) {
        physical -= 60;
      }

      const discount = Math.pow(V06.rolloutDiscount, k);
      total += discount * (physical + option);
      epistemic += discount * option;
      trace.push({
        k,
        action,
        energy: nextEnergy,
        fatigue: nextFatigue,
        uncertainty,
        reliability,
        mode: input.cognitive
          ? modeOf(nextEnergy, nextFatigue, uncertainty, reliability)
          : nextEnergy < 24
            ? "defend"
            : nextFatigue > 0.6
              ? "prepare"
              : "forage",
        physicalValue: physical,
        optionValue: option,
      });
      energy = nextEnergy;
      fatigue = nextFatigue;
      if (energy <= 0) break;
    }
    traces.push(trace);
    totals.push(total);
    epistics.push(epistemic);
  }

  let best = 0;
  for (let i = 1; i < totals.length; i++) if (totals[i] > totals[best]) best = i;
  const trace = traces[best];
  const modes = trace.map((step) => step.mode);
  const narrative =
    trace.length === 0
      ? "no rollout"
      : trace
          .map((step) => `t+${step.k + 1} ${step.mode} (${step.action.toLowerCase()})`)
          .join(" → ");

  return {
    horizon,
    cognitive: input.cognitive,
    steps: trace,
    bestAction: V06_ACTIONS[best],
    expectedValue: totals[best],
    epistemicValue: epistics[best],
    narrative:
      modes.length > 1
        ? `${narrative} · uncertainty ${input.uncertainty.toFixed(2)} → ${trace[trace.length - 1].uncertainty.toFixed(2)}`
        : narrative,
  };
}

function greedyAction(
  predictions: ActionPredictionV06[],
  energy: number,
  fatigue: number,
): Action {
  let best = 0;
  let bestValue = -Infinity;
  for (let i = 0; i < predictions.length; i++) {
    const p = predictions[i];
    let value =
      p.world.pCollect * 22 + p.world.pSuccess - p.world.pCollision * 4.5;
    const next = energy + (p.action === "REST" ? Math.min(p.self.energyDelta, 100 - energy) : p.self.energyDelta);
    if (next < 24) value -= (24 - next) * 1.2;
    if (fatigue > 0.8 && p.action !== "REST") value -= 3;
    if (value > bestValue) {
      bestValue = value;
      best = i;
    }
  }
  return predictions[best]?.action ?? "REST";
}
