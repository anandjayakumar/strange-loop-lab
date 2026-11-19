import { clamp, mean } from "../math";
import { Rng, normaliseSeed, streamSeed } from "../rng";
import { World } from "../environment/world";
import { ACTIONS, type Action, type OutcomeSignal } from "../types";
import { applyV05Action, createV05PhysicalState } from "../v05/dynamics";
import type { DifficultyConfig, SensorConfig } from "../v05/types";
import { V06Agent } from "./agent";
import {
  DEFAULT_V06_OPTIONS,
  V06,
  V06_BASE_SENSORS,
  V06_DIFFICULTIES,
} from "./config";
import type {
  ActionPredictionV06,
  Difficulty,
  DisruptionKind,
  ExplorationMode,
  ModuleProposal,
  PriorRegime,
  QueryPass,
  RolloutStep,
  V06Event,
  V06Metrics,
  V06Observation,
  V06Options,
  V06Scenario,
  V06SeriesPoint,
  V06Snapshot,
  V06StepOutcome,
  WorkspaceState,
} from "./types";
import { MODULE_IDS } from "./types";

export const V06_PHASES = [
  "Sense channels",
  "Recurrent settling",
  "Modules propose",
  "Workspace ignition",
  "Query & self-simulation",
  "Execute",
  "Perceive outcome",
  "Attribute, learn & finalise",
];

export interface V06RenderState {
  tick: number;
  cells: Uint8Array;
  agent: {
    x: number;
    y: number;
    alive: boolean;
    energy: number;
    fatigue: number;
    exhaustedTicks: number;
    lastAction: Action | null;
    effectiveCost: number;
    effectiveSuccess: number;
  };
  target: { x: number; y: number } | null;
  selectedAction: Action | null;
  shift: string;
  frame: string;
}

interface TickSample {
  sensorEnergyError: number;
  selfEnergyError: number;
  observedError: number;
  latentError: number;
  signedLatentError: number;
  withinTolerance: boolean;
  selectedPrediction: ActionPredictionV06 | null;
}

interface ShadowObservation {
  action: Action;
  predictedDelta: number;
  observedDelta: number;
  latentDelta: number;
  moved: boolean;
  collected: boolean;
  slipped: boolean;
  collapsed: boolean;
  trueCost: number;
}

function worldSeedFor(scenario: V06Scenario, seed: number): number {
  return scenario === "unseen_topology" ? seed + 7919 : seed;
}

function emptyWorkspace(): WorkspaceState {
  return {
    frame: "world",
    goal: "hold station",
    hypothesis: "",
    weights: { world: 0.25, somatic: 0.25, meta: 0.25, epistemic: 0.25 },
    salience: { world: 0, somatic: 0, meta: 0, epistemic: 0 },
    broadcast: [0, 0, 0, 0, 0],
    precision: { energy: 0.2, strain: 0.2, effort: 0.2, prior: 0.2, epistemic: 0.2 },
    learningGains: { world: 1, somatic: 1, meta: 1, epistemic: 1 },
    quality: [0.5, 0.5, 0.5],
    ignition: 0,
    bottleneck: true,
    broadcastEnabled: true,
    diagnosticProbe: false,
    safeForaging: false,
  };
}

function emptyRollout(): { steps: RolloutStep[]; narrative: string } {
  return { steps: [], narrative: "awaiting first decision" };
}

/**
 * V0.6 engine.
 *
 * The world, physics and sensor model are the V0.5 substrate. The ten-phase
 * V0.5 loop is replaced by eight phases that expose the cognitive cycle:
 * sense → settle → propose → ignite → query/simulate → act → perceive → learn.
 */
export class V06Engine {
  readonly seed: number;
  readonly difficulty: Difficulty;
  readonly priorRegime: PriorRegime;
  readonly scenario: V06Scenario;
  readonly control: V06Options["control"];
  readonly ablation: V06Options["ablation"];
  readonly explorationMode: ExplorationMode;
  readonly lambda: number;
  readonly world: World;
  readonly physical: ReturnType<typeof createV05PhysicalState>;
  readonly agent: V06Agent;
  readonly options: V06Options;

  private cfg: DifficultyConfig;
  private baseCfg: DifficultyConfig;
  private sensors: SensorConfig;
  private baseSensors: SensorConfig;
  private sensorRng: Rng;
  private dynamicsRng: Rng;
  private policyRng: Rng;
  private tick = 0;
  private phase = 0;
  private alive = true;
  private shift = "none";
  private shiftAge = 0;
  private shifted = false;
  private scheduledPhysical = false;
  private scheduledSensor = false;
  private scheduledDisruption = false;
  private scheduledReversal = false;
  private preObservation: V06Observation | null = null;
  private postObservation: V06Observation | null = null;
  private preEnergyReading = 0;
  private lastEnergyReading: number | null = null;
  private lastEffortReading: number | null = null;
  private lastOutcome: V06StepOutcome | null = null;
  private lastSignal: OutcomeSignal | null = null;
  private proposals: ModuleProposal[] = [];
  private workspace: WorkspaceState = emptyWorkspace();
  private query: QueryPass[] = [];
  private decision: ReturnType<V06Agent["stageCommit"]> | null = null;
  private tickSample: TickSample | null = null;
  private series: V06SeriesPoint[] = [];
  private events: V06Event[] = [];
  private beliefTrap: string | null = null;
  private disruption: DisruptionKind | null = null;
  private pulse: { energy: number; strain: number; remaining: number; channel: "energy" | "strain" | "both" } = {
    energy: 0,
    strain: 0,
    remaining: 0,
    channel: "energy",
  };
  private conflict = 0;
  private conflictActive = false;
  private qualityHistory: [number, number, number][] = [];
  private effortScale = 1;
  private directionalDrift = 0;
  private lastAction: Action | null = null;
  private lastAttentionMode = "monitoring";
  private actionSwitches = 0;
  private coherentSteps = 0;
  private decisionSteps = 0;
  private disruptionGainSum = 0;
  private disruptionSteps = 0;
  private computeUnits = 0;
  private readonly windows = {
    energy: [] as number[],
    selfError: [] as number[],
    rawError: [] as number[],
    metaPred: [] as number[],
    basePred: [] as number[],
    metaOutcome: [] as number[],
    latentFailure: [] as number[],
    reliability: [] as number[],
    convergence: [] as number[],
    entropyDrop: [] as number[],
    actions: [] as Action[],
    quality: [] as [number, number, number][],
    rawQuality: [] as [number, number, number][],
    modes: [] as string[],
  };

  constructor(input: Partial<V06Options> = {}) {
    this.seed = normaliseSeed(input.seed ?? DEFAULT_V06_OPTIONS.seed);
    this.difficulty = input.difficulty ?? DEFAULT_V06_OPTIONS.difficulty;
    this.priorRegime = input.priorRegime ?? DEFAULT_V06_OPTIONS.priorRegime;
    this.scenario = input.scenario ?? DEFAULT_V06_OPTIONS.scenario;
    this.control = input.control ?? DEFAULT_V06_OPTIONS.control;
    this.ablation = input.ablation ?? DEFAULT_V06_OPTIONS.ablation;
    this.explorationMode = input.explorationMode ?? DEFAULT_V06_OPTIONS.explorationMode;
    this.lambda = input.lambda ?? DEFAULT_V06_OPTIONS.lambda;
    this.options = {
      seed: this.seed,
      difficulty: this.difficulty,
      priorRegime: this.priorRegime,
      explorationMode: this.explorationMode,
      scenario: this.scenario,
      control: this.control,
      ablation: this.ablation,
      lambda: this.lambda,
      beliefTrap: input.beliefTrap ?? DEFAULT_V06_OPTIONS.beliefTrap,
      disruption: input.disruption ?? DEFAULT_V06_OPTIONS.disruption,
      recordEvents: input.recordEvents ?? true,
      historyLimit: input.historyLimit ?? 2000,
    };
    this.cfg = {
      ...V06_DIFFICULTIES[this.difficulty],
      sensorNoise: { ...V06_DIFFICULTIES[this.difficulty].sensorNoise },
    };
    this.baseCfg = {
      ...V06_DIFFICULTIES[this.difficulty],
      sensorNoise: { ...V06_DIFFICULTIES[this.difficulty].sensorNoise },
    };
    this.sensors = {
      ...V06_BASE_SENSORS,
      energySigma: this.cfg.sensorNoise.energy,
      strainSigma: this.cfg.sensorNoise.strain,
      effortSigma: this.cfg.sensorNoise.effort,
    };
    this.baseSensors = { ...this.sensors };

    this.world = new World(worldSeedFor(this.scenario, this.seed), {
      resourceDensity: this.cfg.resourceDensity,
    });
    this.physical = createV05PhysicalState(this.world.start, this.cfg);
    if (this.scenario === "epistemic_fork") {
      // The fork begins below the comfortable foraging band, so the optimal
      // policy is rest → probe → exploit rather than an immediate probe.
      this.physical.energy = 26;
    }
    const priorRng = new Rng(streamSeed(this.seed, "v06-priors"));
    this.agent = new V06Agent(this.priorRegime, priorRng, this.seed, {
      control: this.control,
      ablation: this.ablation,
      lambda: this.lambda,
    });
    this.sensorRng = new Rng(streamSeed(this.seed, "v06-sensors"));
    this.dynamicsRng = new Rng(streamSeed(this.seed, "v06-dynamics"));
    this.policyRng = new Rng(streamSeed(this.seed, "v06-policy"));
    this.alive = this.physical.alive;

    if (this.options.beliefTrap === "pessimistic_cost" || this.scenario === "epistemic_fork") {
      this.injectBeliefTrap("pessimistic_cost");
    }
    if (this.scenario === "unseen_compound") {
      this.injectBeliefTrap("pessimistic_cost");
    }
    this.emit(
      "system",
      `V0.6 run · seed ${this.seed} · ${this.cfg.label} · ${this.control} · ${this.ablation} · ${this.scenario}.`,
    );
  }

  // ------------------------------------------------------------------ loop
  step(): void {
    if (!this.alive) return;
    let guard = 0;
    while (guard < V06_PHASES.length * 2) {
      const before = this.tick;
      this.advancePhase();
      guard++;
      if (this.tick !== before) break;
    }
  }

  advancePhase(): void {
    if (!this.alive && this.phase === 0) return;
    this.runPhase(this.phase);
    this.phase++;
    if (this.phase >= V06_PHASES.length) this.phase = 0;
  }

  private runPhase(phase: number): void {
    switch (phase) {
      case 0:
        this.sense();
        break;
      case 1:
        this.settle();
        break;
      case 2:
        this.propose();
        break;
      case 3:
        this.igniteWorkspace();
        break;
      case 4:
        this.queryAndSimulate();
        break;
      case 5:
        this.execute();
        break;
      case 6:
        this.perceiveOutcome();
        break;
      case 7:
        this.finalise();
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------ sense
  private maybeShift(): void {
    if (this.scenario === "stable" || this.scenario === "epistemic_fork") return;
    if (this.scenario === "glitch") {
      if ((V06.glitchAt as readonly number[]).includes(this.tick)) {
        const energy = this.tick % 200 === 120 ? 13 : 0;
        const strain = energy === 0 ? 0.3 : 0;
        this.pulse = {
          energy,
          strain,
          remaining: 1,
          channel: energy > 0 ? "energy" : "strain",
        };
        this.emit(
          "glitch",
          `Transient ${energy > 0 ? "energy" : "strain"} pulse at t=${this.tick}: one tick only, no sustained shift.`,
        );
      }
      return;
    }
    if (this.scenario === "conflict") {
      if (!this.scheduledPhysical && this.tick >= V06.conflictAt) {
        this.scheduledPhysical = true;
        this.scheduledSensor = true;
        this.conflictActive = true;
        this.applyPhysicalSurge();
        this.sensors.energySigma *= 3;
        this.sensors.energyBias += 6.5;
        this.emit("conflict", "Compound conflict: cost surge and energy-channel degradation start together.");
      }
      if (this.conflictActive && this.tick >= V06.conflictEnd) {
        this.conflictActive = false;
        this.sensors.energySigma = this.baseSensors.energySigma;
        this.sensors.energyBias = this.baseSensors.energyBias;
        this.emit("conflict", "Energy channel restored; the physical surge remains.");
      }
      return;
    }
    if (this.scenario === "self_disruption") {
      if (!this.scheduledDisruption && this.tick >= V06.disruptionAt) {
        this.scheduledDisruption = true;
        this.applyDisruption(this.options.disruption);
      }
      return;
    }
    if (this.scenario === "contingency_reversal") {
      if (!this.scheduledReversal && this.tick >= V06.reversalAt) {
        this.scheduledReversal = true;
        this.cfg.baseCost *= 1.25;
        this.cfg.fatigueCostSlope *= 1.5;
        this.cfg.minSuccess = clamp(this.cfg.minSuccess * 0.75, 0.08, 0.9);
        this.cfg.moveFatigue *= 1.4;
        this.effortScale = 1.8;
        this.emit(
          "shift",
          "Action–perception reversal: the movement-to-effort mapping changes, slips become more likely, and the effort reading is rescaled.",
        );
      }
      return;
    }
    if (this.scenario === "unseen_nonlinear") {
      const wave = 1 + 0.42 * Math.sin(this.tick / 38);
      this.cfg.baseCost = this.baseCfg.baseCost * wave;
      this.directionalDrift = this.tick > 260 ? 0.9 : 0;
      return;
    }
    if (this.scenario === "unseen_compound") {
      if (!this.scheduledPhysical && this.tick >= 280) {
        this.scheduledPhysical = true;
        this.applyPhysicalSurge();
      }
      if (!this.scheduledSensor && this.tick >= 280) {
        this.scheduledSensor = true;
        this.sensors.energySigma *= 2.6;
        this.sensors.energyBias += 5.5;
        this.emit("conflict", "Unseen compound: physical surge plus an energy-channel bias and a pessimistic belief.");
      }
      return;
    }
    if (this.scenario === "unseen_topology") return;
  }

  private applyPhysicalSurge(): void {
    this.shift = "physical";
    this.shiftAge = 0;
    this.shifted = true;
    this.cfg.baseCost *= 1.5;
    this.cfg.fatigueCostSlope *= 1.35;
    this.cfg.moveFatigue *= 1.3;
    this.emit("shift", "Physical regime shift: movement costs more and fatigue accumulates faster; rest is unchanged.");
  }

  private applyDisruption(kind: DisruptionKind): void {
    this.disruption = kind;
    this.shift = kind;
    this.shiftAge = 0;
    this.shifted = true;
    if (kind === "self") {
      this.agent.selfModel.movementCost *= 0.45;
      this.agent.selfModel.roughCost *= 0.3;
      this.agent.selfModel.predictionErrorEma = 0.9;
      this.emit("disruption", "Self-model disruption: the learned cost parameters are suddenly wrong.");
    } else if (kind === "energy_sensor") {
      this.sensors.energySigma *= 3.4;
      this.sensors.energyBias += 7;
      this.emit("disruption", "Energy sensor disruption: variance and positive bias increase.");
    } else if (kind === "fatigue_sensor") {
      this.sensors.strainSigma *= 4;
      this.sensors.strainBias += 0.2;
      this.emit("disruption", "Fatigue sensor disruption: strain variance and bias increase.");
    } else {
      this.sensors.energySigma *= 3.2;
      this.sensors.energyBias += 6.5;
      this.sensors.strainSigma *= 3.6;
      this.sensors.strainBias += 0.18;
      this.emit("disruption", "Shared disruption: both interoceptive channels degrade together.");
    }
  }

  triggerDisruption(kind: DisruptionKind): void {
    this.applyDisruption(kind);
  }

  injectBeliefTrap(kind: "pessimistic_cost"): void {
    this.agent.selfModel.roughCost = 25;
    this.agent.selfModel.roughObservations = 0;
    this.agent.selfModel.predictionErrorEma = 0.7;
    this.beliefTrap = kind;
    this.emit("belief", "Injected pessimistic rough-terrain prior: resources are expected to cost 25 energy.");
  }

  injectPulse(energyOffset: number, strainOffset = 0, ticks = 1): void {
    this.pulse = {
      energy: energyOffset,
      strain: strainOffset,
      remaining: Math.max(1, ticks),
      channel: energyOffset !== 0 && strainOffset !== 0 ? "both" : energyOffset !== 0 ? "energy" : "strain",
    };
    this.emit(
      "probe",
      `Ambiguous multi-channel pulse: energy ${energyOffset.toFixed(1)}, strain ${strainOffset.toFixed(2)} for ${ticks} tick(s).`,
    );
  }

  private readEnergy(): { value: number; stale: boolean } {
    const stale =
      this.lastEnergyReading !== null && this.sensorRng.chance(this.sensors.energyStaleChance);
    const noise = this.sensorRng.gaussian() * this.sensors.energySigma;
    const pulsed = this.pulse.remaining > 0 && this.pulse.channel !== "strain" ? this.pulse.energy : 0;
    const drift = this.directionalDrift * Math.sin(this.tick / 9);
    const value =
      stale && this.lastEnergyReading !== null
        ? this.lastEnergyReading
        : clamp(this.physical.energy + this.sensors.energyBias + noise + pulsed + drift, -20, 135);
    this.lastEnergyReading = value;
    return { value, stale };
  }

  private readStrain(): number {
    const pulsed = this.pulse.remaining > 0 && this.pulse.channel !== "energy" ? this.pulse.strain : 0;
    return clamp(
      this.physical.fatigue +
        this.sensors.strainBias +
        this.sensorRng.gaussian() * this.sensors.strainSigma +
        pulsed,
      -0.2,
      1.4,
    );
  }

  private readEffort(cost: number, expected: number): number {
    const value = clamp(
      (cost + this.sensors.effortBias + this.sensorRng.gaussian() * this.sensors.effortSigma) *
        this.effortScale,
      -1,
      15,
    );
    void expected;
    this.lastEffortReading = value;
    return value;
  }

  private makeObservation(
    energyReading: number,
    strainReading: number,
    stale: boolean,
  ): V06Observation {
    return {
      tick: this.tick,
      x: this.physical.x,
      y: this.physical.y,
      radius: 3,
      local: this.world.localView(this.physical.x, this.physical.y, 3, this.tick),
      energyReading,
      strainReading,
      lastEffortReading: this.lastEffortReading,
      staleEnergyReading: stale,
      lastOutcome: this.lastSignal,
    };
  }

  private sense(): void {
    this.maybeShift();
    const energy = this.readEnergy();
    const strain = this.readStrain();
    this.preEnergyReading = energy.value;
    this.preObservation = this.makeObservation(energy.value, strain, energy.stale);
    this.conflict = this.computeConflict(energy.value);
    this.tickSample = {
      sensorEnergyError: Math.abs(energy.value - this.physical.energy),
      selfEnergyError: Math.abs(this.agent.selfModel.energyEstimate - this.physical.energy),
      observedError: 0,
      latentError: 0,
      signedLatentError: 0,
      withinTolerance: false,
      selectedPrediction: null,
    };
  }

  private computeConflict(energyReading: number): number {
    const sigmaRatio = clamp(this.sensors.energySigma / (this.baseSensors.energySigma * 2.5), 0, 1);
    const readingMiss = clamp(
      Math.abs(energyReading - this.agent.selfModel.energyEstimate) / 28,
      0,
      1,
    );
    const pulse = this.pulse.remaining > 0 ? 0.45 : 0;
    const shift = this.conflictActive ? 0.3 : 0;
    return clamp(
      0.4 * sigmaRatio + 0.15 * readingMiss + pulse + shift,
      0,
      1,
    );
  }

  private settle(): void {
    if (!this.preObservation) return;
    this.agent.settleAndObserve(
      this.preObservation,
      this.conflict,
      this.agent.predictedEnergy,
    );
  }

  private propose(): void {
    if (!this.preObservation) return;
    const record = this.agent.perceived(this.preObservation);
    this.proposals = this.agent.stagePropose(record, this.explorationMode, this.lambda);
  }

  private igniteWorkspace(): void {
    this.workspace = this.agent.stageIgnite();
  }

  private queryAndSimulate(): void {
    if (!this.workspace) return;
    this.decision = this.agent.stageCommit(this.policyRng.next());
    this.query = this.decision.query;
    this.workspace = this.decision.workspace;
    this.computeUnits +=
      4 * 5 * Math.max(1, this.decision.query.length) +
      5 * this.decision.selfSim.horizon * 5 +
      9;
  }

  // ---------------------------------------------------------------- execute
  private execute(): void {
    if (!this.decision) return;
    const ignition = this.decision.workspace.bottleneck
      ? this.decision.workspace.ignition
      : 0.2;
    const incoherence =
      this.control === "reactive"
        ? clamp(0.4 + 0.45 * this.conflict, 0, 0.9)
        : this.control === "flat_blackboard"
          ? clamp(0.8 * (1 - ignition) + 0.4 * this.conflict, 0, 0.95)
          : clamp(0.35 * (1 - ignition) + 0.2 * this.conflict, 0, 0.55);
    const fatigueSprint =
      this.decision.action !== "REST" && this.physical.fatigue > 0.62
        ? (this.physical.fatigue - 0.62) * 1.8
        : 0;
    const interference = clamp(incoherence + fatigueSprint, 0, 0.95);
    const base =
      this.scenario === "unseen_nonlinear"
        ? { ...this.cfg, baseCost: this.cfg.baseCost * (1 + 0.1 * Math.sin(this.tick / 17)) }
        : this.cfg;
    const cfg = {
      ...base,
      collapseChance: base.collapseChance * (1 + 2.2 * interference),
      cliffSlip: clamp(base.cliffSlip * (1 + 2.2 * interference), 0, 0.95),
      minSuccess: clamp(base.minSuccess * (1 - 0.3 * interference), 0.05, 0.99),
    };
    const outcome = applyV05Action(
      this.world,
      this.physical,
      this.decision.action,
      this.tick,
      this.dynamicsRng,
      cfg,
    );
    this.lastOutcome = outcome;
    this.lastSignal = {
      action: outcome.action,
      moved: outcome.moved,
      blocked: outcome.blocked,
      slipped: outcome.slipped,
      collected: outcome.collected,
    };
    this.alive = this.physical.alive;
  }

  private perceiveOutcome(): void {
    const energy = this.readEnergy();
    const strain = this.readStrain();
    const expected = this.lastOutcome
      ? this.lastOutcome.terrainRough
        ? this.agent.selfModel.roughCost
        : this.agent.selfModel.movementCost
      : this.agent.selfModel.movementCost;
    const effort = this.lastOutcome
      ? this.readEffort(this.lastOutcome.trueCost, expected)
      : this.lastEffortReading;
    this.postObservation = this.makeObservation(energy.value, strain, energy.stale);
    if (this.lastOutcome && effort !== null) this.lastOutcome.effortReading = effort;
    this.agent.correctPost(this.postObservation, this.pulse.remaining > 0 ? 0 : 0.65);
  }

  // ------------------------------------------------------------------ learn
  private finalise(): void {
    if (!this.lastOutcome || !this.postObservation || !this.tickSample || !this.decision) return;
    const meta = this.decision.predictions[this.decision.actionIndex]?.meta;
    const sensedDelta = this.postObservation.energyReading - this.preEnergyReading;
    const predictedDelta = this.decision.predictions[this.decision.actionIndex].self.energyDelta;
    const latentDelta = this.lastOutcome.energyAfter - this.lastOutcome.energyBefore;
    const observedError =
      Math.abs(predictedDelta - sensedDelta) / (Math.abs(sensedDelta) + 3);
    const latentError =
      Math.abs(predictedDelta - latentDelta) / (Math.abs(latentDelta) + 3);
    this.tickSample.observedError = observedError;
    this.tickSample.latentError = latentError;
    this.tickSample.signedLatentError = predictedDelta - latentDelta;
    this.tickSample.withinTolerance = observedError <= 0.45;
    this.tickSample.selectedPrediction =
      this.decision.predictions[this.decision.actionIndex];

    const multiStepError = mean(this.windows.selfError.slice(-10)) || observedError;
    this.agent.learnWorld(this.lastOutcome);
    const rateScale = this.decision.workspace.learningGains.somatic;
    this.agent.learnSelf(
      this.lastOutcome,
      this.postObservation,
      this.preEnergyReading,
      rateScale,
    );
    this.agent.learnMeta(
      this.lastOutcome,
      this.postObservation,
      this.preEnergyReading,
      observedError,
      predictedDelta - sensedDelta,
      multiStepError,
      latentError,
    );

    if (this.tick % 2 === 0) this.runShadowProbe();

    const attribution = this.agent.higherOrder.scores();
    if (this.disruption) {
      this.disruptionSteps++;
      this.disruptionGainSum += this.decision.workspace.learningGains.somatic;
    }
    if (this.lastAction !== null && this.lastAction !== this.decision.action) {
      this.actionSwitches++;
    }
    this.lastAction = this.decision.action;
    this.decisionSteps++;
    const winner = this.decision.proposals.find(
      (proposal) => proposal.module === this.decision!.workspace.frame,
    );
    if (winner && winner.action === this.decision.action) this.coherentSteps++;

    const self = this.agent.selfModel;
    const quality = this.agent.quality();
    this.qualityHistory.push([...quality]);
    if (this.qualityHistory.length > 180) this.qualityHistory.shift();
    const point: V06SeriesPoint = {
      t: this.tick,
      energy: this.physical.energy,      energyEstimate: self.energyEstimate,
      rawEnergyReading: this.postObservation.energyReading,
      energyError: Math.abs(self.energyEstimate - this.physical.energy),
      rawEnergyError: Math.abs(this.postObservation.energyReading - this.physical.energy),
      fatigue: this.physical.fatigue,
      fatigueEstimate: self.fatigue,
      fatigueError: Math.abs(self.fatigue - this.physical.fatigue),
      costTrue: this.lastOutcome.trueCost,
      costEstimate: self.movementCost,
      costError: Math.abs(self.movementCost - this.lastOutcome.trueCost),
      observedError,
      tolerance: observedError <= 0.45,
      action: this.decision.action,
      frame: this.decision.workspace.frame,
      reliability: this.agent.higherOrder.reliability,
      uncertainty: this.decision.uncertainty,
      quality,
      precisionEnergy: this.decision.workspace.precision.energy,
      precisionPrior: this.decision.workspace.precision.prior,
      precisionEpistemic: this.decision.workspace.precision.epistemic,
      attentionMode: this.agent.attention.mode,
      attentionRecovery: this.agent.attention.recovery,
      somaticGain: this.decision.workspace.learningGains.somatic,
      settlingConvergence: this.decision.settling.convergence,
      settlingDisagreement: this.decision.settling.disagreement,
      withinTickEntropyDrop: this.decision.settling.entropyDrop,
      cognitiveMode: this.agent.attention.mode,
      modeSwitch: this.lastAttentionMode !== this.agent.attention.mode,
      rawQuality: [
        clamp(this.postObservation.energyReading / 100, 0, 1),
        clamp(this.postObservation.strainReading, 0, 1),
        clamp((this.postObservation.lastEffortReading ?? 0) / 6, 0, 1),
      ],
      terrainRough: this.lastOutcome.terrainRough,
      collected: this.lastOutcome.collected,
      pulseActive: this.pulse.remaining > 0,
      pulseChannel: this.pulse.remaining > 0 ? this.pulse.channel : "none",
      attributionTop: attribution.top,
      attribution,
      alive: this.physical.alive,
      resources: this.physical.resources,
      shift: this.shift,
    };
    this.series.push(point);
    if (this.series.length > this.options.historyLimit) this.series.shift();
    this.lastAttentionMode = this.agent.attention.mode;
    this.recordWindows(point, meta, latentError, this.tickSample.withinTolerance);

    if (this.tick % 50 === 0 && this.tick > 0) {
      this.emit(
        "status",
        `t=${this.tick} · E ${this.physical.energy.toFixed(0)} · F ${this.physical.fatigue.toFixed(2)} · frame ${this.decision.workspace.frame} · r ${this.agent.higherOrder.reliability.toFixed(2)} · q [${quality.map((v) => v.toFixed(2)).join(", ")}].`,
      );
    }
    if (!this.physical.alive) {
      this.emit("death", `Agent died at t=${this.tick} (energy ${this.physical.energy.toFixed(1)}).`);
    }

    this.tick++;
    this.shiftAge++;
    if (this.pulse.remaining > 0) this.pulse.remaining--;
    this.tickSample = null;
    this.postObservation = null;
  }

  private recordWindows(
    point: V06SeriesPoint,
    meta: ActionPredictionV06["meta"] | undefined,
    latentError: number,
    withinTolerance: boolean,
  ): void {
    const w = this.windows;
    w.energy.push(point.energy);
    w.selfError.push(point.energyError);
    w.rawError.push(point.rawEnergyError);
    w.convergence.push(point.settlingConvergence);
    w.entropyDrop.push(point.withinTickEntropyDrop);
    w.reliability.push(point.reliability);
    w.quality.push(point.quality);
    w.rawQuality.push(point.rawQuality);
    w.modes.push(point.cognitiveMode);
    w.actions.push(point.action);
    w.latentFailure.push(latentError > 0.45 ? 1 : 0);
    if (meta) {
      w.metaPred.push(meta.toleranceProbability);
      w.basePred.push(meta.rollingBase);
      w.metaOutcome.push(withinTolerance ? 1 : 0);
    }
    const cap = 2000;
    if (w.energy.length > cap) {
      for (const key of [
        "energy",
        "selfError",
        "rawError",
        "convergence",
        "entropyDrop",
        "reliability",
        "metaPred",
        "basePred",
        "metaOutcome",
        "latentFailure",
      ] as const) {
        (w[key] as number[]).shift();
      }
      w.actions.shift();
      w.quality.shift();
      w.rawQuality.shift();
      w.modes.shift();
    }
  }

  private runShadowProbe(): void {
    const index = (this.tick * 7 + 3) % ACTIONS.length;
    const selected = this.decision?.action;
    let action = ACTIONS[index];
    if (action === selected) action = ACTIONS[(index + 1) % ACTIONS.length];
    const shadow = this.probeAction(action);
    if (!shadow) return;
    const prediction = this.agent.predictions.find((p) => p.action === action);
    const observedError =
      Math.abs(shadow.predictedDelta - shadow.observedDelta) /
      (Math.abs(shadow.observedDelta) + 3);
    const latentStateError =
      Math.abs(this.agent.selfModel.energyEstimate - this.physical.energy) /
      (Math.abs(this.physical.energy) + 3);
    const latentFailure = latentStateError > 0.2;
    const features = this.agent.shadowProbeFeatures();
    if (prediction) {
      features.uncertainty = clamp(
        0.6 * (1 - this.agent.higherOrder.reliability) + 0.4 * prediction.meta.uncertainty,
        0,
        1,
      );
    }
    this.agent.recordShadowProbe(features, observedError, latentFailure);
  }

  // ---------------------------------------------------------------- metrics
  private metrics(): V06Metrics {
    const w = this.windows;
    const actions = w.actions;
    const counts = new Map<Action, number>();
    for (const action of actions) counts.set(action, (counts.get(action) ?? 0) + 1);
    let entropy = 0;
    for (const count of counts.values()) {
      const p = count / Math.max(1, actions.length);
      if (p > 0) entropy -= p * Math.log(p);
    }
    const reliability = this.agent.higherOrder.shadowMetrics();
    return {
      alive: this.alive,
      ticks: this.tick,
      resources: this.physical.resources,
      distance: this.physical.distance,
      meanEnergy: mean(w.energy),
      minEnergy: w.energy.length ? Math.min(...w.energy) : this.physical.energy,
      selfEnergyMae: mean(w.selfError),
      rawEnergyMae: mean(w.rawError),
      toleranceRate: w.metaOutcome.length ? mean(w.metaOutcome) : 0,
      metaBrier: this.metaBrier(),
      metaEce: this.metaEce(),
      metaAuroc: this.auroc(
        w.metaPred.map((p) => 1 - p),
        w.latentFailure,
      ),
      reliabilityBrier: reliability.brier,
      reliabilityEce: reliability.ece,
      reliabilityAuroc: reliability.auroc,
      settlingConvergence: mean(w.convergence),
      withinTickEntropyDrop: mean(w.entropyDrop),
      meanReliability: mean(w.reliability),
      actionEntropy: entropy,
      thrashRate: this.decisionSteps ? this.actionSwitches / this.decisionSteps : 0,
      goalCoherence: this.decisionSteps ? this.coherentSteps / this.decisionSteps : 0,
      bindingAccuracy: this.decisionSteps ? this.coherentSteps / this.decisionSteps : 0,
      qualityStability: this.agent.higherOrder.qualityStability(w.quality.slice(-60)),
      qualitySpaceSeparability: this.separability(w.quality, w.modes),
      rawSpaceSeparability: this.separability(w.rawQuality, w.modes),
      qualityModeSwitchCorrelation: this.modeCorrelation("quality"),
      rawModeSwitchCorrelation: this.modeCorrelation("raw"),
      rollingBss: this.rollingBss(),
      postGlitchMae: this.glitchStats().post,
      astRecoveryGainDelta: this.glitchStats().gain,
      routingCorruption: this.disruptionSteps
        ? this.disruptionGainSum / this.disruptionSteps
        : 0,
      computeUnits: this.computeUnits,
      attributionTop: this.agent.higherOrder.top(),
      attributionConfidence: this.agent.higherOrder.scores().confidence,
      shifted: this.shifted,
    };
  }

  private metaBrier(): number {
    const w = this.windows;
    if (!w.metaPred.length) return 0;
    let sum = 0;
    for (let i = 0; i < w.metaPred.length; i++) {
      sum += (w.metaPred[i] - w.metaOutcome[i]) ** 2;
    }
    return sum / w.metaPred.length;
  }

  private rollingBss(): number {
    const w = this.windows;
    if (w.metaPred.length < 20) return 0;
    let model = 0;
    let base = 0;
    for (let i = 0; i < w.metaPred.length; i++) {
      const y = w.metaOutcome[i];
      model += (w.metaPred[i] - y) ** 2;
      base += (w.basePred[i] - y) ** 2;
    }
    return base > 1e-9 ? 1 - model / base : 0;
  }

  private separability(
    points: readonly [number, number, number][],
    modes: readonly string[],
  ): number {
    const n = Math.min(points.length, modes.length);
    if (n < 20) return 0;
    const groups = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      const list = groups.get(modes[i]) ?? [];
      list.push(i);
      groups.set(modes[i], list);
    }
    if (groups.size < 2) return 0;
    const ratios: number[] = [];
    for (let axis = 0; axis < 3; axis++) {
      const values = points.slice(0, n).map((p) => p[axis]);
      const overall = mean(values);
      let between = 0;
      let within = 0;
      for (const indices of groups.values()) {
        const groupMean = mean(indices.map((i) => points[i][axis]));
        between += (indices.length / n) * (groupMean - overall) ** 2;
        for (const i of indices) within += (points[i][axis] - groupMean) ** 2 / n;
      }
      ratios.push(within > 1e-9 ? between / within : 0);
    }
    return mean(ratios);
  }

  private modeCorrelation(space: "quality" | "raw"): number {
    const points = this.series.slice(-400);
    if (points.length < 20) return 0;
    const distances: number[] = [];
    const labels: number[] = [];
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const current = points[i];
      const a = space === "quality" ? prev.quality : prev.rawQuality;
      const b = space === "quality" ? current.quality : current.rawQuality;
      distances.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
      labels.push(current.modeSwitch ? 1 : 0);
    }
    const positives = labels.filter((l) => l === 1);
    const negatives = labels.filter((l) => l === 0);
    if (positives.length === 0 || negatives.length === 0) return 0;
    const allMean = mean(distances);
    const sd = Math.sqrt(mean(distances.map((d) => (d - allMean) ** 2)));
    if (sd < 1e-9) return 0;
    const m1 = mean(distances.filter((_, i) => labels[i] === 1));
    const m0 = mean(distances.filter((_, i) => labels[i] === 0));
    const p = positives.length / labels.length;
    return ((m1 - m0) / sd) * Math.sqrt(p * (1 - p));
  }

  private glitchStats(): { gain: number; post: number } {
    const points = this.series;
    const pulses = [120, 220, 620, 720];
    const gains: number[] = [];
    const posts: number[] = [];
    for (const t of pulses) {
      const immediate = points.filter((p) => p.t >= t + 1 && p.t < t + 7).map((p) => p.energyError);
      const late = points.filter((p) => p.t >= t + 20 && p.t < t + 45).map((p) => p.energyError);
      if (immediate.length && late.length) {
        const i = mean(immediate);
        const l = mean(late);
        gains.push(i - l);
        posts.push(l);
      }
    }
    return {
      gain: gains.length ? mean(gains) : 0,
      post: posts.length ? mean(posts) : 0,
    };
  }

  private metaEce(): number {
    const w = this.windows;
    if (w.metaPred.length < 20) return 0;
    let ece = 0;
    const bins = 8;
    for (let i = 0; i < bins; i++) {
      const lo = i / bins;
      const hi = (i + 1) / bins;
      let count = 0;
      let p = 0;
      let y = 0;
      for (let j = 0; j < w.metaPred.length; j++) {
        if (w.metaPred[j] >= lo && (i === bins - 1 ? w.metaPred[j] <= hi : w.metaPred[j] < hi)) {
          count++;
          p += w.metaPred[j];
          y += w.metaOutcome[j];
        }
      }
      if (count) ece += (count / w.metaPred.length) * Math.abs(p / count - y / count);
    }
    return ece;
  }

  private auroc(scores: readonly number[], labels: readonly number[]): number | null {
    if (scores.length < 20 || labels.length !== scores.length) return null;
    const positives = labels.filter((l) => l === 1).length;
    const negatives = labels.length - positives;
    if (positives === 0 || negatives === 0) return null;
    let concordant = 0;
    for (let i = 0; i < scores.length; i++) {
      if (labels[i] !== 1) continue;
      for (let j = 0; j < scores.length; j++) {
        if (labels[j] !== 0) continue;
        if (scores[i] > scores[j]) concordant++;
        else if (Math.abs(scores[i] - scores[j]) < 1e-12) concordant += 0.5;
      }
    }
    return concordant / (positives * negatives);
  }

  // ---------------------------------------------------------------- snapshot
  getSnapshot(): V06Snapshot {
    const decision = this.decision;
    const proposals = decision?.proposals ?? this.proposals;
    const workspace = decision?.workspace ?? this.workspace ?? emptyWorkspace();
    const selfSim = decision?.selfSim ?? { ...emptyRollout(), horizon: 0, cognitive: false, bestAction: "REST" as Action, expectedValue: 0, epistemicValue: 0 };
    return {
      seed: this.seed,
      tick: this.tick,
      phase: this.phase,
      phaseName: V06_PHASES[this.phase],
      scenario: this.scenario,
      difficulty: this.difficulty,
      priorRegime: this.priorRegime,
      control: this.control,
      ablation: this.ablation,
      alive: this.alive,
      shift: this.shift,
      shiftAge: this.shiftAge,
      physical: { ...this.physical },
      observation: this.preObservation,
      predictions: decision?.predictions ?? this.agent.predictions,
      proposals: [...proposals],
      workspace,
      query: [...this.query],
      selfSim,
      attention: this.agent.attentionSnapshot(),
      higherOrder: this.agent.higherOrderSnapshot(),
      selfModel: this.agent.selfModel.snapshot(0.11),
      qualityHistory: [...this.qualityHistory],
      metrics: this.metrics(),
      events: [...this.events],
      beliefTrap: this.beliefTrap,
      disruption: this.disruption,
    };
  }

  getSeries(): readonly V06SeriesPoint[] {
    return this.series;
  }

  getEvents(): readonly V06Event[] {
    return this.events;
  }

  getTick(): number {
    return this.tick;
  }

  getPhase(): number {
    return this.phase;
  }

  getRenderState(): V06RenderState {
    const prediction = this.decision
      ? this.decision.predictions[this.decision.actionIndex]
      : null;
    return {
      tick: this.tick,
      cells: this.world.renderCells(this.tick),
      agent: {
        x: this.physical.x,
        y: this.physical.y,
        alive: this.alive,
        energy: this.physical.energy,
        fatigue: this.physical.fatigue,
        exhaustedTicks: this.physical.exhaustedTicks,
        lastAction: this.physical.lastAction,
        effectiveCost: this.physical.effectiveCost,
        effectiveSuccess: this.physical.effectiveSuccess,
      },
      target: prediction ? prediction.features.target : null,
      selectedAction: this.decision?.action ?? null,
      shift: this.shift,
      frame: this.workspace.frame,
    };
  }

  private emit(kind: string, text: string): void {
    if (!this.options.recordEvents) return;
    this.events.push({ tick: this.tick, kind, text });
    if (this.events.length > 400) this.events.shift();
  }

  /** Isolated forced-action probe; never touches agent memory or models. */
  probeAction(action: Action): ShadowObservation | null {
    const prediction = this.agent.predictions.find((p) => p.action === action);
    if (!prediction) return null;
    const shadowWorld = this.world.clone();
    const shadowState = { ...this.physical };
    const shadowRng = new Rng(streamSeed(this.seed, `v06-shadow:${this.tick}:${action}`));
    const outcome = applyV05Action(
      shadowWorld,
      shadowState,
      action,
      this.tick,
      shadowRng,
      this.cfg,
    );
    const latentDelta = outcome.energyAfter - outcome.energyBefore;
    const observedDelta = latentDelta + shadowRng.gaussian() * this.sensors.energySigma;
    return {
      action,
      predictedDelta: prediction.self.energyDelta,
      observedDelta,
      latentDelta,
      moved: outcome.moved,
      collected: outcome.collected,
      slipped: outcome.slipped,
      collapsed: outcome.collapsed,
      trueCost: outcome.trueCost,
    };
  }

  /** Diagnostics for the validator: how often each module ignited. */
  frameCounts(): Record<string, number> {
    const counts: Record<string, number> = Object.fromEntries(MODULE_IDS.map((id) => [id, 0]));
    for (const point of this.series) counts[point.frame] = (counts[point.frame] ?? 0) + 1;
    return counts;
  }
}
