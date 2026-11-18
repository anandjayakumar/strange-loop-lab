import type { Action } from "./types";

export const WORLD = {
  width: 30,
  height: 30,
  obstacleDensity: 0.115,
  resourceDensity: 0.052,
  sensorRadius: 3,
} as const;

export const AGENT = {
  startEnergy: 80,
  maxEnergy: 100,
  startFatigue: 0,
  moveBaseCost: 1.05,
  fatigueCostSlope: 1.35,
  energyWeight: 0.45,
  moveFatigue: 0.046,
  restGain: 2.7,
  restFatigueRelief: 0.16,
  fatigueSuccessSlope: 0.54,
  minSuccess: 0.32,
  maxSuccess: 0.995,
  slipEnergyFactor: 0.65,
  blockEnergyFactor: 0.5,
  resourceGain: 24,
  deathEnergy: 0,
} as const;

export const INTEROCEPTION = {
  noiseSigma: 2.4,
  staleChance: 0.08,
} as const;

export const SELECTION = {
  temperature: 0.78,
  /** Utility of a resource that is predicted to be at the target. */
  collectValue: 24,
  /** Value of a successful step (information + mobility). */
  moveValue: 1.1,
  /** Penalty for a predicted collision. */
  collisionPenalty: 5.5,
  /** Bonus for an unvisited target cell. */
  noveltyValue: 2.2,
  /** Baseline homeostatic rest pull when sensed energy is low (all modes). */
  restThreshold: 33,
  restUrgency: 1.15,
  /** Mode A's nominal cost assumption used for reactive budgeting. */
  nominalMoveCost: 1.6,
  /** Self-model term scaling. */
  selfEnergyValue: 1.25,
  selfFatigueValue: 8.5,
  selfSuccessValue: 0.9,
  riskThreshold: 22,
  riskPenalty: 1.7,
  maxProbabilityFloor: 1e-6,
} as const;

export const LEARNING = {
  worldRate: 0.055,
  worldObservationRate: 0.012,
  selfRate: 0.09,
  selfCostRate: 0.11,
  selfOutcomeRate: 0.12,
  selfFatigueRate: 0.11,
  calibrationWindow: 80,
} as const;

export const DEFAULT_SEED = 20261117;

export const ACTION_ORDER: Record<Action, number> = {
  UP: 0,
  DOWN: 1,
  LEFT: 2,
  RIGHT: 3,
  REST: 4,
};

export const ACTION_COLORS: Record<Action, string> = {
  UP: "#f0a35e",
  DOWN: "#5fd0e3",
  LEFT: "#b49cff",
  RIGHT: "#5cdb95",
  REST: "#6d7580",
};
