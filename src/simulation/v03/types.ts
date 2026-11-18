import type {
  Action,
  ActionFeatures,
  CellType,
  OutcomeSignal,
  Vec,
} from "../types";

export type Difficulty = "docile" | "standard" | "harsh";
export type PriorRegime = "uninformed" | "severe";
export type ExplorationMode = "pragmatic" | "random" | "uncertainty" | "voi";
export type Scenario =
  | "stable"
  | "physical_shift"
  | "energy_sensor_shift"
  | "fatigue_sensor_shift"
  | "shared_shift"
  | "mixed_shifts";
export type ShiftKind =
  | "none"
  | "physical"
  | "energy_sensor"
  | "fatigue_sensor"
  | "shared";
export type AttributionKind =
  | "physical"
  | "energy_sensor"
  | "fatigue_sensor"
  | "shared"
  | "insufficient";

export interface DifficultyConfig {
  key: Difficulty;
  label: string;
  startEnergy: number;
  maxEnergy: number;
  baseCost: number;
  fatigueCostSlope: number;
  energyWeight: number;
  moveFatigue: number;
  restGain: number;
  restRelief: number;
  passiveMetabolism: number;
  fatigueSuccessSlope: number;
  minSuccess: number;
  cliffFatigue: number;
  cliffExtraCost: number;
  cliffSlip: number;
  criticalEnergy: number;
  collapseChance: number;
  resourceGain: number;
  resourceDensity: number;
  debtRate: number;
  /** Rough/resource terrain has a separate true movement cost in V0.3. */
  roughCost: number;
  sensorNoise: { energy: number; strain: number; effort: number };
}

export interface SensorConfig {
  energySigma: number;
  energyBias: number;
  energyStaleChance: number;
  strainSigma: number;
  strainBias: number;
  effortSigma: number;
  effortBias: number;
}

export interface V03PhysicalState {
  x: number;
  y: number;
  energy: number;
  fatigue: number;
  alive: boolean;
  exhaustedTicks: number;
  metabolicDebt: number;
  lastAction: Action | null;
  previousAction: Action | null;
  effectiveCost: number;
  effectiveSuccess: number;
  moves: number;
  rests: number;
  resources: number;
  slips: number;
  collapses: number;
  blocked: number;
  distance: number;
}

export interface V03Observation {
  tick: number;
  x: number;
  y: number;
  radius: number;
  local: Int8Array;
  energyReading: number;
  strainReading: number;
  lastEffortReading: number | null;
  staleEnergyReading: boolean;
  lastOutcome: OutcomeSignal | null;
}

export interface V03StepOutcome {
  tick: number;
  action: Action;
  from: Vec;
  to: Vec;
  moved: boolean;
  blocked: boolean;
  slipped: boolean;
  collected: boolean;
  collapsed: boolean;
  energyBefore: number;
  energyAfter: number;
  energySpent: number;
  energyGained: number;
  fatigueBefore: number;
  fatigueAfter: number;
  effortReading: number;
  trueCost: number;
  effectiveSuccess: number;
  cliffApplied: boolean;
  terrainRough: boolean;
}

export interface MetaContext {
  action: Action;
  features: number[];
  energyBin: number;
  fatigueBin: number;
  count: number;
  roughTarget: number;
  roughEvidence: number;
  sensorDisagreement: number;
  lastInnovation: number;
  recentAbsError: number;
  recentSignedBias: number;
  recentVolatility: number;
  timeSinceRest: number;
  slipRate: number;
}

export interface MetaPrediction {
  expectedError: number;
  toleranceProbability: number;
  uncertainty: number;
  systematicBias: number;
  biasCorrection: number;
  errorBound: number;
  failureProbability: number;
  persistentBias: number;
  rollingBase: number;
  residualWeight: number;
  evidenceCount: number;
  evidenceWeight: number;
  influence: number;
  learningMultiplier: number;
  priorWeight: number;
}

export interface ActionPrediction {
  action: Action;
  actionIndex: number;
  features: ActionFeatures;
  world: {
    pSuccess: number;
    pCollect: number;
    pCollision: number;
  };
  self: {
    energyDelta: number;
    pSuccess: number;
    fatigueNext: number;
    fatigueDelta: number;
    survivalHorizon: number;
    pCollect: number;
  };
  meta: MetaPrediction;
  context: MetaContext;
}

export interface V03Selection {
  action: Action;
  actionIndex: number;
  utilities: number[];
  pragmaticUtilities: number[];
  informationValues: number[];
  probabilities: number[];
  pragmaticAction: Action;
  randomized: boolean;
  infoGainEstimate: number;
  voiEstimate: number;
  safetyBlocked: number;
}

export interface AttributionScores {
  physical: number;
  energy_sensor: number;
  fatigue_sensor: number;
  shared: number;
  insufficient: number;
  top: AttributionKind;
  confidence: number;
  evidenceCount: number;
}

export interface ChannelStats {
  energyInnovation: number;
  energyInnovationEma: number;
  energyInnovationVolatility: number;
  strainResidualEma: number;
  strainResidualVolatility: number;
  effortResidualEma: number;
  effortResidualVolatility: number;
  slipBrierEma: number;
  restEnergyInnovation: number;
  restEnergyVolatility: number;
  restStrainResidual: number;
  restStrainVolatility: number;
  energySensorBias: number;
  energySensorVariance: number;
  effortSensorBias: number;
  evidenceCount: number;
}

export interface SelfModelV03Snapshot {
  initialized: boolean;
  energyEstimate: number;
  energyVariance: number;
  movementCost: number;
  restGain: number;
  collectGain: number;
  roughCost: number;
  roughObservations: number;
  fatigue: number;
  moveFatigueRate: number;
  restReliefRate: number;
  energyBias: number;
  energyNoiseVariance: number;
  successWeights: number[];
  collectWeights: number[];
  innovation: number;
  predictionErrorEma: number;
  innovationVolatility: number;
  systematicBias: number;
  confidence: number;
  survivalHorizon: number;
  learnRate: number;
  lastEffort: number | null;
  lastEffortCost: number | null;
}

export interface WorldModelV03Snapshot {
  successWeights: number[];
  collectWeights: number[];
  collisionWeights: number[];
  successByAction: Record<Action, number[]>;
  collectByAction: Record<Action, number[]>;
  collisionByAction: Record<Action, number[]>;
  learnRate: number;
}

export interface MetaModelV03Snapshot {
  expectedError: number;
  toleranceProbability: number;
  uncertainty: number;
  systematicBias: number;
  biasCorrection: number;
  errorBound: number;
  failureProbability: number;
  persistentBias: number;
  rollingBase: number;
  residualWeight: number;
  volatility: number;
  evidenceCount: number;
  influence: number;
  learningMultiplier: number;
  priorWeight: number;
  brier: number;
  logLoss: number;
  toleranceRate: number;
  calibrationBins: {
    low: number;
    high: number;
    predicted: number;
    observed: number;
    count: number;
  }[];
  errorWeights: number[];
  toleranceWeights: number[];
  featureLabels: string[];
  observations: number;
}

export interface V03SeriesPoint {
  t: number;
  energy: number;
  energyEstimate: number;
  rawEnergyReading: number;
  energyError: number;
  rawEnergyError: number;
  fatigue: number;
  fatigueEstimate: number;
  fatigueError: number;
  costTrue: number;
  costEstimate: number;
  costError: number;
  observedError: number;
  latentError: number;
  signedLatentError: number;
  absLatentDelta: number;
  latentPersistent: boolean;
  tolerance: boolean;
  metaTargetTolerance: boolean;
  senseEnergyTrue: number;
  senseEnergyRaw: number;
  roughCostTrue: number;
  roughCostEstimate: number;
  roughCostError: number;
  terrainRough: boolean;
  pulseActive: boolean;
  metaFailureProbability: number | null;
  metaPersistentBias: number | null;
  riskMargin: number;
  attributionPhysical: number;
  attributionEnergy: number;
  attributionFatigue: number;
  attributionShared: number;
  attributionInsufficient: number;
  predictedError: number | null;
  predictedTolerance: number | null;
  predictionUncertainty: number | null;
  influence: number | null;
  metaBias: number | null;
  evidenceCount: number;
  infoValue: number;
  voi: number;
  action: Action;
  explorationMode: ExplorationMode;
  alive: boolean;
  resources: number;
  shift: ShiftKind;
  attribution: AttributionScores;
  sensorDisagreement: number;
  channelEnergy: number;
  channelStrain: number;
  lastEffort: number | null;
}

export interface V03Metrics {
  alive: boolean;
  ticks: number;
  resources: number;
  distance: number;
  meanEnergy: number;
  minEnergy: number;
  selfEnergyMae: number;
  rawEnergyMae: number;
  fatigueMae: number;
  costMae: number;
  toleranceRate: number;
  metaBrier: number;
  metaLogLoss: number;
  metaEce: number;
  metaAuroc: number | null;
  meanUncertainty: number;
  meanInfluence: number;
  meanInfoValue: number;
  meanVoi: number;
  infoGain: number;
  rollingBss: number;
  latentAuroc: number | null;
  roughCostMae: number;
  actionEntropy: number;
  explorationCoverage: number;
  topAttribution: AttributionKind;
  attributionConfidence: number;
  shifted: boolean;
}

export interface V03Snapshot {
  seed: number;
  tick: number;
  phase: number;
  phaseName: string;
  difficulty: Difficulty;
  priorRegime: PriorRegime;
  scenario: Scenario;
  explorationMode: ExplorationMode;
  lambda: number;
  alive: boolean;
  shift: ShiftKind;
  shiftAge: number;
  physical: V03PhysicalState;
  observation: V03Observation | null;
  predictions: ActionPrediction[];
  selection: V03Selection | null;
  selfModel: SelfModelV03Snapshot;
  worldModel: WorldModelV03Snapshot;
  metaModel: MetaModelV03Snapshot;
  currentMeta: MetaPrediction | null;
  channelStats: ChannelStats;
  attribution: AttributionScores;
  metrics: V03Metrics;
  events: { tick: number; kind: string; text: string }[];
  beliefTrap: string | null;
}

export interface V03Options {
  seed: number;
  difficulty: Difficulty;
  priorRegime: PriorRegime;
  scenario: Scenario;
  explorationMode: ExplorationMode;
  lambda: number;
  beliefTrap: "none" | "pessimistic_cost";
  worldModelEnabled?: boolean;
  worldLearning?: boolean;
  selfLearning?: boolean;
  selfFeedback?: boolean;
  metaFeedback?: boolean;
  metaLearning?: boolean;
  riskControl?: boolean;
  residualMeta?: boolean;
  evidenceLink?: boolean;
  recordEvents: boolean;
  historyLimit: number;
}

export interface V03RunConfig extends V03Options {
  sensorOverrides?: Partial<SensorConfig>;
  physicalShiftAt?: number;
  sensorShiftAt?: number;
}

export const V03_ACTIONS: Action[] = ["UP", "DOWN", "LEFT", "RIGHT", "REST"];

export const ATTRIBUTION_LABELS: Record<AttributionKind, string> = {
  physical: "physical dynamics",
  energy_sensor: "energy sensor",
  fatigue_sensor: "fatigue sensor",
  shared: "shared / external",
  insufficient: "insufficient evidence",
};

export type { Action, ActionFeatures, CellType, OutcomeSignal, Vec };

/**
 * The step outcome as the agent may observe it. Ground-truth evaluation fields
 * (true movement cost and instrumented energy before/after) are removed, so
 * learning code cannot read them: the isolation is enforced by the compiler.
 */
export type ObservableStepOutcome = Omit<V03StepOutcome, "trueCost" | "energyBefore" | "energyAfter">;
