import type {
  Difficulty,
  DifficultyConfig,
  ExplorationMode,
  PriorRegime,
  Scenario,
} from "./types";

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  docile: {
    key: "docile",
    label: "Docile",
    startEnergy: 72,
    maxEnergy: 100,
    baseCost: 0.9,
    fatigueCostSlope: 1.2,
    energyWeight: 0.35,
    moveFatigue: 0.045,
    restGain: 1.2,
    restRelief: 0.2,
    passiveMetabolism: 0.18,
    fatigueSuccessSlope: 0.45,
    minSuccess: 0.35,
    cliffFatigue: 0.9,
    cliffExtraCost: 1.1,
    cliffSlip: 0.08,
    criticalEnergy: 10,
    collapseChance: 0.04,
    resourceGain: 22,
    resourceDensity: 0.06,
    debtRate: 0.0001,
    roughCost: 1.5,
    sensorNoise: { energy: 2.2, strain: 0.07, effort: 0.35 },
  },
  standard: {
    key: "standard",
    label: "Standard",
    startEnergy: 55,
    maxEnergy: 100,
    baseCost: 1.15,
    fatigueCostSlope: 1.5,
    energyWeight: 0.45,
    moveFatigue: 0.065,
    restGain: 0.75,
    restRelief: 0.17,
    passiveMetabolism: 0.4,
    fatigueSuccessSlope: 0.54,
    minSuccess: 0.3,
    cliffFatigue: 0.72,
    cliffExtraCost: 2.6,
    cliffSlip: 0.15,
    criticalEnergy: 14,
    collapseChance: 0.15,
    resourceGain: 22,
    resourceDensity: 0.1,
    debtRate: 0.00035,
    roughCost: 2.2,
    sensorNoise: { energy: 2.4, strain: 0.08, effort: 0.45 },
  },
  harsh: {
    key: "harsh",
    label: "Harsh",
    startEnergy: 52,
    maxEnergy: 100,
    baseCost: 1.35,
    fatigueCostSlope: 1.8,
    energyWeight: 0.5,
    moveFatigue: 0.08,
    restGain: 0.8,
    restRelief: 0.14,
    passiveMetabolism: 0.55,
    fatigueSuccessSlope: 0.6,
    minSuccess: 0.25,
    cliffFatigue: 0.62,
    cliffExtraCost: 3.8,
    cliffSlip: 0.22,
    criticalEnergy: 18,
    collapseChance: 0.28,
    resourceGain: 28,
    resourceDensity: 0.14,
    debtRate: 0.0008,
    roughCost: 3.0,
    sensorNoise: { energy: 2.8, strain: 0.09, effort: 0.55 },
  },
};

export const BASE_SENSORS = {
  energySigma: 2.4,
  energyBias: 0,
  energyStaleChance: 0.06,
  strainSigma: 0.08,
  strainBias: 0,
  effortSigma: 0.45,
  effortBias: 0,
};

export const META = {
  tolerance: 0.45,
  errorScale: 3,
  minObservationsForTrust: 8,
  uncertaintyFloor: 0.04,
  errorLearningRate: 0.02,
  toleranceLearningRate: 0.025,
  residualRate: 0.06,
  biasRate: 0.05,
  volatilityRate: 0.06,
  calibrationBins: 8,
  maxFeatureCount: 16,
};

export const EXPLORATION = {
  pragmaticCollectValue: 22,
  pragmaticMoveValue: 1,
  pragmaticCollisionPenalty: 4.5,
  pragmaticNoveltyValue: 2,
  selfEnergyValue: 0.95,
  selfFatigueValue: 6,
  selfSuccessValue: 0.7,
  riskThreshold: 24,
  riskPenalty: 1.5,
  defaultLambda: 0.35,
  randomEpsilon: 0.15,
  infoSafetyEnergy: 10,
  infoSafetyFatigue: 0.9,
  infoScale: 1.6,
};

export const PRIOR_RANGES: Record<
  PriorRegime,
  {
    movementCost: [number, number];
    roughCost: [number, number];
    restGain: [number, number];
    collectGain: [number, number];
    moveFatigueRate: [number, number];
    restReliefRate: [number, number];
    successBias: [number, number];
    energyBias: [number, number];
    energyVariance: [number, number];
    effortBias: [number, number];
    worldWeight: [number, number];
  }
> = {
  uninformed: {
    movementCost: [0.5, 4.5],
    roughCost: [0.3, 4.5],
    restGain: [0.15, 3.2],
    collectGain: [2, 34],
    moveFatigueRate: [0.012, 0.18],
    restReliefRate: [0.03, 0.3],
    successBias: [-1.2, 1.2],
    energyBias: [-0.5, 0.5],
    energyVariance: [1.5, 12],
    effortBias: [-0.5, 0.5],
    worldWeight: [-0.8, 0.8],
  },
  severe: {
    movementCost: [0.15, 8],
    roughCost: [0.2, 24],
    restGain: [0.02, 5],
    collectGain: [0.5, 65],
    moveFatigueRate: [0.002, 0.35],
    restReliefRate: [0.005, 0.6],
    successBias: [-3, 3],
    energyBias: [-1, 1],
    energyVariance: [0.2, 28],
    effortBias: [-2, 2],
    worldWeight: [-2.5, 2.5],
  },
};

export const SCENARIO_LABELS: Record<Scenario, string> = {
  stable: "Stable dynamics",
  physical_shift: "Physical regime shift",
  energy_sensor_shift: "Energy sensor degradation",
  fatigue_sensor_shift: "Fatigue sensor degradation",
  shared_shift: "Shared sensor degradation",
  mixed_shifts: "Mixed regime shifts",
};

export const EXPLORATION_LABELS: Record<ExplorationMode, string> = {
  pragmatic: "Pragmatic only (lambda = 0)",
  random: "Random exploration",
  uncertainty: "Uncertainty bonus",
  voi: "Decision-value of information",
};

export const DEFAULT_V03_OPTIONS = {
  seed: 20261118,
  difficulty: "standard" as Difficulty,
  priorRegime: "uninformed" as PriorRegime,
  scenario: "stable" as Scenario,
  explorationMode: "voi" as ExplorationMode,
  lambda: EXPLORATION.defaultLambda,
  beliefTrap: "none" as const,
  recordEvents: true,
  historyLimit: 2000,
};

export const SHIFT_TICKS = {
  defaultAt: 360,
  physicalDuration: 260,
  sensorDuration: 240,
};


