import { AGENT } from "../config";
import { clamp } from "../math";
import type { Rng } from "../rng";
import {
  ACTION_DELTAS,
  type Action,
  type PhysicalState,
  type StepOutcome,
  type Vec,
} from "../types";
import type { World } from "./world";

export function effectiveMoveCost(energy: number, fatigue: number): number {
  return (
    AGENT.moveBaseCost +
    fatigue * AGENT.fatigueCostSlope +
    (energy / AGENT.maxEnergy) * AGENT.energyWeight
  );
}

export function effectiveSuccess(fatigue: number): number {
  return clamp(
    1 - fatigue * AGENT.fatigueSuccessSlope,
    AGENT.minSuccess,
    AGENT.maxSuccess,
  );
}

export function createPhysicalState(start: Vec): PhysicalState {
  return {
    x: start.x,
    y: start.y,
    energy: AGENT.startEnergy,
    fatigue: AGENT.startFatigue,
    alive: true,
    lastAction: null,
    previousAction: null,
    effectiveCost: effectiveMoveCost(AGENT.startEnergy, AGENT.startFatigue),
    effectiveSuccess: effectiveSuccess(AGENT.startFatigue),
    totalMoves: 0,
    totalRests: 0,
    resourcesCollected: 0,
    blockedAttempts: 0,
    slips: 0,
    distance: 0,
  };
}

/**
 * Apply one action. The returned StepOutcome is ground-truth instrumentation;
 * only its signal fields are exposed to the agent.
 */
export function applyAction(
  world: World,
  state: PhysicalState,
  action: Action,
  tick: number,
  rng: Rng,
): StepOutcome {
  const before: Vec = { x: state.x, y: state.y };
  const energyBefore = state.energy;
  const fatigueBefore = state.fatigue;
  const cost = effectiveMoveCost(state.energy, state.fatigue);
  const successProbability = effectiveSuccess(state.fatigue);

  let moved = false;
  let blocked = false;
  let slipped = false;
  let collected = false;
  let spent = 0;
  let gained = 0;

  state.previousAction = state.lastAction;
  state.lastAction = action;

  if (action === "REST") {
    gained = Math.min(AGENT.restGain, AGENT.maxEnergy - state.energy);
    state.energy = clamp(state.energy + AGENT.restGain, 0, AGENT.maxEnergy);
    state.fatigue = clamp(state.fatigue - AGENT.restFatigueRelief, 0, 1);
    state.totalRests++;
  } else {
    state.totalMoves++;
    state.fatigue = clamp(state.fatigue + AGENT.moveFatigue, 0, 1);
    const delta = ACTION_DELTAS[action];
    const targetX = state.x + delta.x;
    const targetY = state.y + delta.y;

    slipped = rng.next() > successProbability;
    if (slipped) {
      spent = cost * AGENT.slipEnergyFactor;
      state.slips++;
    } else if (!world.inBounds(targetX, targetY) || world.isObstacle(targetX, targetY)) {
      blocked = true;
      spent = cost * AGENT.blockEnergyFactor;
      state.blockedAttempts++;
    } else {
      moved = true;
      spent = cost;
      state.x = targetX;
      state.y = targetY;
      state.distance++;
      if (world.isResourcePresent(targetX, targetY, tick) && world.collect(targetX, targetY, tick)) {
        collected = true;
        gained = AGENT.resourceGain;
        state.resourcesCollected++;
      }
    }
    state.energy = clamp(state.energy - spent + gained, 0, AGENT.maxEnergy);
  }

  if (state.energy <= AGENT.deathEnergy) {
    state.energy = 0;
    state.alive = false;
  }

  state.effectiveCost = effectiveMoveCost(state.energy, state.fatigue);
  state.effectiveSuccess = effectiveSuccess(state.fatigue);

  return {
    tick,
    action,
    from: before,
    to: { x: state.x, y: state.y },
    moved,
    blocked,
    slipped,
    collected,
    energyBefore,
    energyAfter: state.energy,
    energySpent: spent,
    energyGained: gained,
    fatigueBefore,
    fatigueAfter: state.fatigue,
    effectiveCost: cost,
    effectiveSuccess: successProbability,
  };
}
