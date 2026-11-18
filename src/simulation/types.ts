/**
 * Shared vocabulary for the simulation. Everything here is plain data so the
 * engine can be serialised, compared and unit-tested without a browser.
 */

export const ACTIONS = ["UP", "DOWN", "LEFT", "RIGHT", "REST"] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_DELTAS: Record<Action, { x: number; y: number }> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
  REST: { x: 0, y: 0 },
};

export const ACTION_GLYPH: Record<Action, string> = {
  UP: "↑",
  DOWN: "↓",
  LEFT: "←",
  RIGHT: "→",
  REST: "·",
};

export type Mode = "A" | "B" | "C";

export const MODES: Mode[] = ["A", "B", "C"];

export const MODE_META: Record<
  Mode,
  { name: string; short: string; description: string; accent: string }
> = {
  A: {
    name: "No self-model",
    short: "Sensory + world",
    description: "Sensory input and a learned world model. No representation of the agent itself.",
    accent: "#8b929b",
  },
  B: {
    name: "Self-model",
    short: "World + self",
    description: "A second, independent model learns the agent's own energy, cost and fatigue dynamics.",
    accent: "#5fd0e3",
  },
  C: {
    name: "Recursive self-model",
    short: "World + self + meta",
    description:
      "A meta-model tracks the self-model's reliability and modulates its learning, prior weight and influence.",
    accent: "#b49cff",
  },
};

/** -1 out of bounds, 0 empty, 1 obstacle, 2 energy resource. */
export type CellType = -1 | 0 | 1 | 2;

export interface Vec {
  x: number;
  y: number;
}

export interface PhysicalState {
  x: number;
  y: number;
  energy: number;
  fatigue: number;
  alive: boolean;
  lastAction: Action | null;
  previousAction: Action | null;
  effectiveCost: number;
  effectiveSuccess: number;
  totalMoves: number;
  totalRests: number;
  resourcesCollected: number;
  blockedAttempts: number;
  slips: number;
  distance: number;
}

/** The only outcome information the agent receives: proprioception + events. */
export interface OutcomeSignal {
  action: Action;
  moved: boolean;
  blocked: boolean;
  slipped: boolean;
  collected: boolean;
}

export interface Observation {
  tick: number;
  x: number;
  y: number;
  radius: number;
  /** (2r+1)^2 row-major local cells, centred on the agent. No global map. */
  local: Int8Array;
  /** Noisy, sometimes stale interoceptive energy reading. Never ground truth. */
  sensedEnergy: number;
  lastOutcome: OutcomeSignal | null;
}

export interface StepOutcome {
  tick: number;
  action: Action;
  from: Vec;
  to: Vec;
  moved: boolean;
  blocked: boolean;
  slipped: boolean;
  collected: boolean;
  energyBefore: number;
  energyAfter: number;
  energySpent: number;
  energyGained: number;
  fatigueBefore: number;
  fatigueAfter: number;
  effectiveCost: number;
  effectiveSuccess: number;
}

export interface ActionFeatures {
  action: Action;
  target: Vec;
  targetInBounds: boolean;
  targetType: CellType;
  obstacleAtTarget: number;
  resourceAtTarget: number;
  boundary: number;
  localObstacleDensity: number;
  localResourceDensity: number;
  directionResourceSignal: number;
  directionObstacleSignal: number;
  nearestResourceDistance: number;
  nearestObstacleDistance: number;
}

export interface MemoryStats {
  recentSuccess: number;
  recentSlip: number;
  recentBlocked: number;
  recentRest: number;
  novelty: number;
  visits: number;
  meanEnergyDelta: number;
}

export interface WorldPrediction {
  pSuccess: number;
  pCollect: number;
  pCollision: number;
  expectedTarget: Vec;
  features: number[];
  collectFeatures: number[];
  collisionFeatures: number[];
}

export interface SelfPrediction {
  energyDelta: number;
  pSuccess: number;
  fatigueNext: number;
  fatigueDelta: number;
  survivalHorizon: number;
  pCollect: number;
}

export interface ActionPrediction {
  action: Action;
  actionIndex: number;
  features: ActionFeatures;
  world: WorldPrediction;
  /** Absent entirely in Mode A — there is no self-model to ask. */
  self: SelfPrediction | null;
}

export interface PredictionSet {
  tick: number;
  actions: ActionPrediction[];
}

export interface Selection {
  action: Action;
  actionIndex: number;
  utilities: number[];
  utilitiesWithoutSelf: number[];
  probabilities: number[];
  probabilitiesWithoutSelf: number[];
  temperature: number;
  selfInfluence: number;
  selfTerm: number[];
  reasoning: string;
  /**
   * Counterfactual sampled with the same uniform draw against the policy with
   * the self term removed. Used for behavioural influence measurement, not for
   * action selection.
   */
  counterfactualAction: Action;
  counterfactualActionIndex: number;
  decisionChanged: boolean;
  /** Total-variation distance between the two policies. */
  policyTv: number;
}

export interface PerceptionRecord {
  observation: Observation;
  features: Record<Action, ActionFeatures>;
  localResourceCount: number;
  localObstacleCount: number;
  nearestResourceDistance: number;
  nearestObstacleDistance: number;
}

export interface SeriesPoint {
  t: number;
  energy: number;
  energyEstimate: number | null;
  fatigue: number;
  fatigueEstimate: number | null;
  /** Raw instrumented-vs-belief error sampled at the sense phase. */
  selfStateError: number | null;
  /** Absolute error of the raw interoceptive sample at the same sense phase. */
  sensorStateError: number | null;
  /** Raw forward-prediction error for the selected action. */
  selfPredictionError: number | null;
  worldAccuracy: number;
  selfStateAccuracy: number | null;
  selfPredictionAccuracy: number | null;
  selfInfluence: number;
  metaTrust: number | null;
  metaErrorEMA: number | null;
  selfConfidence: number | null;
  predictionErrorEMA: number | null;
  learningRate: number;
  priorWeight: number;
  action: Action;
  reward: number;
  resources: number;
  alive: boolean;
  survivalHorizon: number | null;
  effectiveCost: number;
  movementCostEstimate: number | null;
  selfCostError: number | null;
  policyTv: number;
  decisionChanged: boolean;
  counterfactualAction: Action | null;
  sensedEnergy: number;
  predictedSuccess: number | null;
  predictedCollect: number | null;
  selfPredictedSuccess: number | null;
  selfPredictedDelta: number | null;
  actualMoved: boolean;
  actualCollected: boolean;
  actualEnergyDelta: number;
}

export type EventKind = "env" | "risk" | "model" | "meta" | "action" | "system";

export interface SimEvent {
  id: number;
  tick: number;
  kind: EventKind;
  text: string;
}

export interface WorldModelSnapshot {
  successWeights: number[];
  collectWeights: number[];
  collisionWeights: number[];
  successByAction: Record<Action, number[]>;
  collectByAction: Record<Action, number[]>;
  collisionByAction: Record<Action, number[]>;
  weightLabels: string[];
  collectLabels: string[];
  collisionLabels: string[];
  learnRate: number;
}

export interface SelfModelSnapshot {
  initialized: boolean;
  energyEstimate: number;
  energyVariance: number;
  movementCost: number;
  restGain: number;
  collectGain: number;
  fatigue: number;
  slipRate: number;
  pCollect: number;
  successWeights: number[];
  collectWeights: number[];
  successLabels: string[];
  collectLabels: string[];
  innovation: number;
  predictionErrorEMA: number;
  confidence: number;
  survivalHorizon: number;
  learnRate: number;
}

export interface MetaModelSnapshot {
  enabled: boolean;
  trust: number;
  errorEMA: number;
  calibration: number;
  learningRateMultiplier: number;
  priorWeight: number;
  plasticityActive: boolean;
  priorWeightingActive: boolean;
  observations: number;
}

export interface ResearchOptions {
  /** Use the learned world model for predictions. Default true. */
  worldModelEnabled?: boolean;
  /** Allow the world model to update. Default true. */
  worldLearning?: boolean;
  /** Allow the self-model to update from new observations. Default true. */
  selfLearning?: boolean;
  /** Experimental starting priors for the self-model. Never applied by default. */
  initialSelfModel?: {
    movementCost?: number;
    restGain?: number;
    collectGain?: number;
    fatigue?: number;
  };
}

export interface EngineOptions {
  seed: number;
  mode: Mode;
  selfFeedback: boolean;
  metaFeedback: boolean;
  plasticity: boolean;
  priorWeighting: boolean;
  recordEvents: boolean;
  historyLimit: number;
  research?: ResearchOptions;
}

export interface EngineMetrics {
  worldAccuracy: number;
  selfStateAccuracy: number | null;
  selfPredictionAccuracy: number | null;
  selfInfluence: number;
  metaCalibration: number | null;
  adaptation: number;
  actionEntropy: number;
  meanEnergy: number;
  survival: number;
  resources: number;
  distance: number;
  meanTrust: number | null;
  meanLearningRate: number;
  meanPriorWeight: number;
  decisionChangeRate: number;
  meanPolicyTv: number;
  meanCostError: number | null;
}

export interface EngineSnapshot {
  seed: number;
  mode: Mode;
  tick: number;
  phase: number;
  phaseName: string;
  phaseDescription: string;
  alive: boolean;
  options: EngineOptions;
  physical: PhysicalState;
  sensedEnergy: number;
  energyNoise: number;
  staleReading: boolean;
  observation: Observation | null;
  predictions: ActionPrediction[];
  selection: Selection | null;
  worldModel: WorldModelSnapshot;
  selfModel: SelfModelSnapshot | null;
  metaModel: MetaModelSnapshot | null;
  metrics: EngineMetrics;
  actionMix: Record<Action, number>;
  lastOutcome: StepOutcome | null;
  memorySize: number;
  eventCount: number;
}
