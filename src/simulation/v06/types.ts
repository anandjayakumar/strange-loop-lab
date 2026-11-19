/**
 * V0.6 vocabulary.
 *
 * V0.6 keeps the V0.5 world, physics and sensory substrate byte-for-byte
 * (same environment, same difficulty configs, same seeded streams) and adds a
 * unified cognitive architecture above it. Nothing in this file refers to
 * subjective experience: every field is a measurable internal variable.
 */

import type { Action, ActionFeatures, OutcomeSignal, Vec } from "../types";
import type { SelfModelV06Snapshot } from "./selfModel";
import type {
  AttributionKind,
  AttributionScores,
  Difficulty,
  DifficultyConfig,
  ExplorationMode,
  MetaContext,
  MetaPrediction,
  PriorRegime,
  V05Observation,
  V05PhysicalState,
  V05StepOutcome,
} from "../v05/types";

export type {
  Action,
  ActionFeatures,
  AttributionKind,
  AttributionScores,
  Difficulty,
  DifficultyConfig,
  ExplorationMode,
  MetaContext,
  MetaPrediction,
  PriorRegime,
};
export type V06Observation = V05Observation;
export type V06PhysicalState = V05PhysicalState;
export type V06StepOutcome = V05StepOutcome;

export type ModuleId = "world" | "somatic" | "meta" | "epistemic";

export const MODULE_IDS: ModuleId[] = ["world", "somatic", "meta", "epistemic"];

export const MODULE_LABELS: Record<ModuleId, string> = {
  world: "World",
  somatic: "Somatic",
  meta: "Meta-attribution",
  epistemic: "Epistemic",
};

export const MODULE_COLORS: Record<ModuleId, string> = {
  world: "#26467e",
  somatic: "#b23f24",
  meta: "#634070",
  epistemic: "#39643f",
};

/** One of the six single-mechanism ablations. `none` is the intact system. */
export type Ablation =
  | "none"
  | "no_rpt"
  | "no_gwt_bottleneck"
  | "no_gwt_broadcast"
  | "no_hot_meta"
  | "no_ast"
  | "no_cognitive_self_sim";

export const ABLATION_LABELS: Record<Ablation, string> = {
  none: "Intact V0.6",
  no_rpt: "No-RPT (K = 1)",
  no_gwt_bottleneck: "No-GWT bottleneck",
  no_gwt_broadcast: "No-GWT broadcast",
  no_hot_meta: "No-HOT meta",
  no_ast: "No-AST",
  no_cognitive_self_sim: "No cognitive self-sim (H = 1)",
};

/**
 * Adversarial controls. These are complete alternative architectures, not
 * ablations: each is given the same world, seeds and (nominally) compute.
 */
export type ControlKind =
  | "full"
  | "reactive"
  | "physical_mpc"
  | "flat_blackboard"
  | "matched_feedforward"
  | "rolling_tracker"
  | "raw_sensor"
  | "fixed_decay";

export const CONTROL_LABELS: Record<ControlKind, string> = {
  full: "V0.6 full",
  reactive: "Reactive reflex",
  physical_mpc: "Physical MPC (H = 4)",
  flat_blackboard: "Flat blackboard",
  matched_feedforward: "Matched feedforward",
  rolling_tracker: "1-param rolling tracker",
  raw_sensor: "Raw sensor vector",
  fixed_decay: "Fixed decay precision",
};

export type V06Scenario =
  | "stable"
  | "glitch"
  | "conflict"
  | "self_disruption"
  | "epistemic_fork"
  | "contingency_reversal"
  | "unseen_topology"
  | "unseen_nonlinear"
  | "unseen_compound";

export const SCENARIO_LABELS: Record<V06Scenario, string> = {
  stable: "Stable",
  glitch: "Ambiguous multi-channel glitches",
  conflict: "Compound conflict",
  self_disruption: "Self-model / sensor disruption",
  epistemic_fork: "Epistemic fork",
  contingency_reversal: "Action–perception reversal",
  unseen_topology: "Unseen topology",
  unseen_nonlinear: "Unseen non-linear dynamics",
  unseen_compound: "Unseen compound conflict",
};

/** Which channel the disruption episode corrupts. */
export type DisruptionKind = "self" | "energy_sensor" | "fatigue_sensor" | "shared";

/** A module's independent proposal for the current cycle. */
export interface ModuleProposal {
  module: ModuleId;
  action: Action;
  utilities: number[];
  /** Distinctiveness x confidence. Drives competition for the workspace. */
  salience: number;
  confidence: number;
  localError: number;
  goal: string;
  hypothesis: string;
  /** Named observable quantities that supported this proposal. */
  evidence: Record<string, number>;
}

export interface PrecisionPlan {
  energy: number;
  strain: number;
  effort: number;
  prior: number;
  epistemic: number;
}

export interface WorkspaceState {
  /** Ignited frame. Under the no-bottleneck control this is only a display label. */
  frame: ModuleId;
  goal: string;
  hypothesis: string;
  /** Capacity weights over the four modules (sum to 1). */
  weights: Record<ModuleId, number>;
  salience: Record<ModuleId, number>;
  /** Additive bias the broadcast applies to each action. */
  broadcast: number[];
  precision: PrecisionPlan;
  learningGains: Record<ModuleId, number>;
  /** Integrated quality-space coordinate at ignition. */
  quality: [number, number, number];
  ignition: number;
  bottleneck: boolean;
  broadcastEnabled: boolean;
  /** The ignited coalition is proposing an unverified diagnostic probe. */
  diagnosticProbe: boolean;
  /** Viability is safe enough that the workspace should not pre-empt foraging. */
  safeForaging: boolean;
}

export interface QueryPass {
  pass: number;
  frame: ModuleId;
  action: Action;
  goal: string;
  revised: boolean;
  note: string;
}

export type AttentionMode = "monitoring" | "high_prior" | "defensive" | "exploratory";

export interface AttentionSnapshot {
  enabled: boolean;
  mode: AttentionMode;
  modeAge: number;
  /** Modelled share of precision assigned to each stream. */
  allocation: PrecisionPlan;
  predictedError: number;
  observedError: number;
  recovery: number;
  quietTicks: number;
  schemaWeights: number[];
}

export type CognitiveMode = "forage" | "diagnose" | "defend" | "prepare";

export interface RolloutStep {
  k: number;
  action: Action;
  energy: number;
  fatigue: number;
  /** Predicted belief uncertainty after this step. */
  uncertainty: number;
  /** Predicted second-order reliability after this step. */
  reliability: number;
  /** Predicted workspace mode after this step. */
  mode: CognitiveMode;
  /** Expected immediate physical value. */
  physicalValue: number;
  /** Value of the future decisions this step makes possible. */
  optionValue: number;
}

export interface SelfSimResult {
  horizon: number;
  cognitive: boolean;
  steps: RolloutStep[];
  bestAction: Action;
  expectedValue: number;
  epistemicValue: number;
  /** Human-readable account of the imagined future mode transition. */
  narrative: string;
}

export interface HigherOrderSnapshot {
  enabled: boolean;
  /** Predicted probability that the current first-order estimate is reliable. */
  reliability: number;
  /** Rolling Brier score of the reliability prediction against shadow probes. */
  reliabilityBrier: number;
  reliabilityEce: number;
  /** AUROC of reliability against latent failure (evaluation only). */
  reliabilityAuroc: number | null;
  attribution: AttributionScores;
  /** 3D quality-space coordinate: viability, certainty, coherence. */
  quality: [number, number, number];
  qualityVelocity: number;
  shadowProbes: number;
  /** Learning gate applied to each module this tick. */
  routing: Record<ModuleId, number>;
}

export interface V06Metrics {
  alive: boolean;
  ticks: number;
  resources: number;
  distance: number;
  meanEnergy: number;
  minEnergy: number;
  selfEnergyMae: number;
  rawEnergyMae: number;
  toleranceRate: number;
  metaBrier: number;
  metaEce: number;
  metaAuroc: number | null;
  reliabilityBrier: number;
  reliabilityEce: number;
  reliabilityAuroc: number | null;
  settlingConvergence: number;
  meanReliability: number;
  actionEntropy: number;
  thrashRate: number;
  goalCoherence: number;
  bindingAccuracy: number;
  qualityStability: number;
  qualitySpaceSeparability: number;
  rawSpaceSeparability: number;
  qualityModeSwitchCorrelation: number;
  rawModeSwitchCorrelation: number;
  withinTickEntropyDrop: number;
  rollingBss: number;
  postGlitchMae: number;
  astRecoveryGainDelta: number;
  routingCorruption: number;
  computeUnits: number;
  attributionTop: AttributionKind;
  attributionConfidence: number;
  shifted: boolean;
}

export interface V06SeriesPoint {
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
  tolerance: boolean;
  action: Action;
  frame: ModuleId;
  reliability: number;
  uncertainty: number;
  quality: [number, number, number];
  precisionEnergy: number;
  precisionPrior: number;
  precisionEpistemic: number;
  attentionMode: string;
  attentionRecovery: number;
  somaticGain: number;
  settlingConvergence: number;
  settlingDisagreement: number;
  withinTickEntropyDrop: number;
  cognitiveMode: string;
  modeSwitch: boolean;
  rawQuality: [number, number, number];
  terrainRough: boolean;
  collected: boolean;
  pulseActive: boolean;
  pulseChannel: "none" | "energy" | "strain" | "both";
  attributionTop: AttributionKind;
  attribution: AttributionScores;
  alive: boolean;
  resources: number;
  shift: string;
}

export interface V06Event {
  tick: number;
  kind: string;
  text: string;
}

export interface V06Snapshot {
  seed: number;
  tick: number;
  phase: number;
  phaseName: string;
  scenario: V06Scenario;
  difficulty: Difficulty;
  priorRegime: PriorRegime;
  control: ControlKind;
  ablation: Ablation;
  alive: boolean;
  shift: string;
  shiftAge: number;
  physical: V06PhysicalState;
  observation: V06Observation | null;
  predictions: ActionPredictionV06[];
  proposals: ModuleProposal[];
  workspace: WorkspaceState;
  query: QueryPass[];
  selfSim: SelfSimResult;
  attention: AttentionSnapshot;
  higherOrder: HigherOrderSnapshot;
  selfModel: SelfModelV06Snapshot;
  qualityHistory: [number, number, number][];
  metrics: V06Metrics;
  events: V06Event[];
  beliefTrap: string | null;
  disruption: DisruptionKind | null;
}

/** A prediction row shared by all four modules. */
export interface ActionPredictionV06 {
  action: Action;
  actionIndex: number;
  features: ActionFeatures;
  world: { pSuccess: number; pCollect: number; pCollision: number };
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

export interface V06Options {
  seed: number;
  difficulty: Difficulty;
  priorRegime: PriorRegime;
  explorationMode: ExplorationMode;
  scenario: V06Scenario;
  control: ControlKind;
  ablation: Ablation;
  lambda: number;
  beliefTrap: "none" | "pessimistic_cost";
  disruption: DisruptionKind;
  recordEvents: boolean;
  historyLimit: number;
}

export const V06_ACTIONS: Action[] = ["UP", "DOWN", "LEFT", "RIGHT", "REST"];

export const ATTRIBUTION_LABELS: Record<AttributionKind, string> = {
  physical: "self / internal model",
  energy_sensor: "energy sensor",
  fatigue_sensor: "fatigue sensor",
  shared: "shared / external",
  insufficient: "insufficient evidence",
};

/** Re-exported for the labs that still render V0.5 outcome glyphs. */
export type { OutcomeSignal, Vec };
