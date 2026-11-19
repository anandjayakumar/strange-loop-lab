import {
  BASE_SENSORS,
  DIFFICULTIES,
  EXPLORATION,
  META,
  PRIOR_RANGES,
  SHIFT_TICKS,
} from "../v05/config";
import type { Difficulty, DifficultyConfig, PriorRegime } from "./types";

/**
 * V0.6 uses the exact V0.5 physics and priors so that any behavioural change
 * is attributable to the cognitive architecture, not to a re-tuned world.
 * The difficulty objects are cloned because the engine mutates them when a
 * regime shift fires.
 */
export const V06_DIFFICULTIES: Record<Difficulty, DifficultyConfig> = Object.fromEntries(
  (Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => [
    key,
    { ...DIFFICULTIES[key], sensorNoise: { ...DIFFICULTIES[key].sensorNoise } },
  ]),
) as Record<Difficulty, DifficultyConfig>;

export const V06_BASE_SENSORS = { ...BASE_SENSORS };
export const V06_PRIOR_RANGES: Record<PriorRegime, (typeof PRIOR_RANGES)["uninformed"]> =
  PRIOR_RANGES;
export const V06_META = META;
export const V06_EXPLORATION = EXPLORATION;
export const V06_SHIFT_TICKS = SHIFT_TICKS;

/**
 * Architecture constants. These are fixed before validation and are not
 * optimised against the evaluation seeds.
 */
export const V06 = {
  /** Recurrent settling passes within a tick. */
  settlePasses: 3,
  /** Workspace micro-passes for a decision. */
  queryPasses: 3,
  /** Rollout horizon for recursive self-simulation. */
  cognitiveHorizon: 4,
  /** Rollout horizon of the physical-only MPC control (matched compute). */
  physicalHorizon: 4,
  /** Capacity leak: how much a non-ignited module still contributes. */
  capacityLeak: 0.14,
  /** Win-stay hysteresis in workspace competition. */
  hysteresis: 0.12,
  /** Bonus applied to the ignited goal's preferred action. */
  broadcastGain: 1.25,
  /** Multiplier on module utilities that are not in the winning coalition. */
  loserGain: 0.55,
  /** Softmax temperature over the final integrated utilities. */
  policyTemperature: 0.7,
  /** Epistemic weight of the multi-step option value discovered by AE-2. */
  optionValueWeight: 1.0,
  /** Discount on expected physical value inside rollouts. */
  rolloutDiscount: 0.72,
  /** Uncertainty decayed by a maximally informative action. */
  informationGainRate: 0.6,
  /** Reliability gain from an informative action. */
  reliabilityGainRate: 0.2,
  /** Uncertainty below which the rollout expects a mode switch to foraging. */
  competentUncertainty: 0.4,
  /** Window used for throughput / thrash diagnostics. */
  window: 24,
  /** Scheduled experiment ticks. */
  glitchAt: [120, 220, 620, 720],
  conflictAt: 300,
  conflictEnd: 344,
  disruptionAt: 300,
  reversalAt: 300,
  forkHorizon: 1200,
} as const;

export const DEFAULT_V06_OPTIONS = {
  seed: 20261119,
  difficulty: "standard" as Difficulty,
  priorRegime: "uninformed" as PriorRegime,
  explorationMode: "voi" as const,
  scenario: "stable" as const,
  control: "full" as const,
  ablation: "none" as const,
  lambda: 0.45,
  beliefTrap: "none" as const,
  disruption: "energy_sensor" as const,
  recordEvents: true,
  historyLimit: 2000,
};

/** Human-readable descriptions used by the lab. */
export const ABLATION_EFFECTS: Record<string, string> = {
  no_rpt: "One feedforward pass: no within-tick settling, so a top-down prior cannot absorb a single-channel spike.",
  no_gwt_bottleneck: "Every module writes to the workspace at once: no competition, no winner-take-all ignition.",
  no_gwt_broadcast: "A winner is chosen for action, but nothing is broadcast back to perception, learning or partner modules.",
  no_hot_meta: "Second-order reliability and attribution are frozen at chance; first-order learning still runs.",
  no_ast: "The attention schema no longer models or allocates precision; recovery after a glitch is unscheduled.",
  no_cognitive_self_sim: "Rollouts stop at one step and predict only physical state, never future belief or mode.",
};
