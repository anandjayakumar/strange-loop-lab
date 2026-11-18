import { clamp } from "../math";
import { ACTION_DELTAS, type Action } from "../types";
import type { World } from "../environment/world";
import type { Rng } from "../rng";
import type { DifficultyConfig, V04PhysicalState, V04StepOutcome } from "./types";

export function effectiveCost(
  state: V04PhysicalState,
  cfg: DifficultyConfig,
): { cost: number; cliff: boolean } {
  const cliff = state.fatigue > cfg.cliffFatigue;
  const base =
    cfg.baseCost +
    state.fatigue * cfg.fatigueCostSlope +
    (state.energy / cfg.maxEnergy) * cfg.energyWeight;
  return {
    cost: base + (cliff ? cfg.cliffExtraCost * (0.4 + state.fatigue) : 0),
    cliff,
  };
}

export function effectiveSuccess(state: V04PhysicalState, cfg: DifficultyConfig): number {
  const cliff = state.fatigue > cfg.cliffFatigue ? cfg.cliffSlip : 0;
  return clamp(
    1 - state.fatigue * cfg.fatigueSuccessSlope - cliff,
    cfg.minSuccess,
    0.995,
  );
}

export function createV04PhysicalState(
  start: { x: number; y: number },
  cfg: DifficultyConfig,
): V04PhysicalState {
  return {
    x: start.x,
    y: start.y,
    energy: cfg.startEnergy,
    fatigue: 0,
    alive: true,
    exhaustedTicks: 0,
    metabolicDebt: 0,
    lastAction: null,
    previousAction: null,
    effectiveCost: cfg.baseCost,
    effectiveSuccess: 1,
    moves: 0,
    rests: 0,
    resources: 0,
    slips: 0,
    collapses: 0,
    blocked: 0,
    distance: 0,
  };
}

export function applyV04Action(
  world: World,
  state: V04PhysicalState,
  action: Action,
  tick: number,
  rng: Rng,
  cfg: DifficultyConfig,
): V04StepOutcome {
  const from = { x: state.x, y: state.y };
  const energyBefore = state.energy;
  const fatigueBefore = state.fatigue;
  const normal = effectiveCost(state, cfg);
  const delta = ACTION_DELTAS[action];
  const tx = action === "REST" ? state.x : state.x + delta.x;
  const ty = action === "REST" ? state.y : state.y + delta.y;
  const terrainRough =
    action !== "REST" && world.inBounds(tx, ty) && world.cellAt(tx, ty, tick) === 2;
  const roughBase = terrainRough
    ? cfg.roughCost +
      state.fatigue * cfg.fatigueCostSlope +
      (state.energy / cfg.maxEnergy) * cfg.energyWeight
    : normal.cost;
  const cost = roughBase + (normal.cliff ? cfg.cliffExtraCost * (0.4 + state.fatigue) : 0);
  const cliff = normal.cliff;
  const successP = effectiveSuccess(state, cfg);

  let moved = false;
  let blocked = false;
  let slipped = false;
  let collected = false;
  let collapsed = false;
  let spent = 0;
  let gained = 0;

  state.metabolicDebt = clamp(
    state.metabolicDebt + cfg.debtRate,
    0,
    1.6,
  );
  state.previousAction = state.lastAction;
  state.lastAction = action;

  if (state.exhaustedTicks > 0 && action !== "REST") {
    state.exhaustedTicks--;
    spent = cost * 0.35;
    blocked = true;
    state.energy = clamp(state.energy - spent - cfg.passiveMetabolism, 0, cfg.maxEnergy);
  } else if (action === "REST") {
    gained = Math.min(cfg.restGain, cfg.maxEnergy - state.energy);
    state.energy = clamp(
      state.energy + cfg.restGain - cfg.passiveMetabolism - state.metabolicDebt * 0.35,
      0,
      cfg.maxEnergy,
    );
    state.fatigue = clamp(state.fatigue - cfg.restRelief, 0, 1);
    state.exhaustedTicks = Math.max(0, state.exhaustedTicks - 1);
    state.rests++;
  } else {
    state.moves++;
    state.fatigue = clamp(state.fatigue + cfg.moveFatigue, 0, 1);
    const collapseRisk =
      state.energy < cfg.criticalEnergy || state.fatigue > 0.93
        ? cfg.collapseChance
        : cfg.collapseChance * 0.15;
    if (rng.next() < collapseRisk) {
      collapsed = true;
      spent = cost * 0.8 + 3.2;
      state.fatigue = clamp(state.fatigue + 0.22, 0, 1);
      state.exhaustedTicks = 3;
      state.collapses++;
    } else {
      slipped = rng.next() > successP;
      if (slipped) {
        spent = cost * 0.62;
        state.slips++;
      } else if (!world.inBounds(tx, ty) || world.isObstacle(tx, ty)) {
        blocked = true;
        spent = cost * 0.5;
        state.blocked++;
      } else {
        moved = true;
        spent = cost;
        state.x = tx;
        state.y = ty;
        state.distance++;
        if (world.isResourcePresent(tx, ty, tick) && world.collect(tx, ty, tick)) {
          collected = true;
          gained = cfg.resourceGain;
          state.resources++;
        }
      }
    }
    state.energy = clamp(
      state.energy - spent - cfg.passiveMetabolism - state.metabolicDebt * 0.35 + gained,
      0,
      cfg.maxEnergy,
    );
    if (collected) state.metabolicDebt *= 0.15;
  }

  if (state.energy <= 0) {
    state.energy = 0;
    state.alive = false;
  }
  const nextCost = effectiveCost(state, cfg);
  state.effectiveCost = nextCost.cost;
  state.effectiveSuccess = effectiveSuccess(state, cfg);

  return {
    tick,
    action,
    from,
    to: { x: state.x, y: state.y },
    moved,
    blocked,
    slipped,
    collected,
    collapsed,
    energyBefore,
    energyAfter: state.energy,
    energySpent: spent,
    energyGained: gained,
    fatigueBefore,
    fatigueAfter: state.fatigue,
    effortReading: cost,
    trueCost: cost,
    effectiveSuccess: successP,
    cliffApplied: cliff,
    terrainRough,
  };
}
