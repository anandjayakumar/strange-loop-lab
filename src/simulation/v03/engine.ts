import { clamp, mean } from "../math";
import { Rng, normaliseSeed, streamSeed } from "../rng";
import { World } from "../environment/world";
import { ACTIONS, type Action, type OutcomeSignal } from "../types";
import { V03Agent } from "./agent";
import { BASE_SENSORS, DEFAULT_V03_OPTIONS, DIFFICULTIES, META, SHIFT_TICKS } from "./config";
import { applyV03Action, createV03PhysicalState } from "./dynamics";
import type {
  Difficulty,
  DifficultyConfig,
  ExplorationMode,
  MetaPrediction,
  PriorRegime,
  Scenario,
  SensorConfig,
  ShiftKind,
  V03Metrics,
  V03Observation,
  V03Options,
  V03SeriesPoint,
  V03Snapshot,
  V03StepOutcome,
} from "./types";

export const V03_PHASES = [
  "Sense channels",
  "Perceive & update world",
  "Predict",
  "Select (with epistemic value)",
  "Execute",
  "Perceive outcome",
  "Observable / latent errors",
  "Update world model",
  "Update self-model",
  "Update learned meta-model",
];

interface TickSample {
  sensorEnergyError: number;
  selfEnergyError: number;
  senseEnergyTrue: number;
  senseEnergyRaw: number;
  observedError: number;
  latentError: number;
  signedLatentError: number;
  absLatentDelta: number;
  withinTolerance: boolean;
  metaPrediction: MetaPrediction;
  selectedFeatures: ReturnType<V03Agent["predict"]>[number]["features"] | null;
  observedSignedError: number;
  shift: ShiftKind;
}

export interface ShadowObservation {
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

export interface V03RenderState {
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
  shift: ShiftKind;
}

export class V03Engine {
  readonly seed: number;
  readonly difficulty: Difficulty;
  readonly priorRegime: PriorRegime;
  readonly scenario: Scenario;
  readonly explorationMode: ExplorationMode;
  readonly lambda: number;
  readonly world: World;
  readonly physical: ReturnType<typeof createV03PhysicalState>;
  readonly agent: V03Agent;
  readonly options: V03Options;
  private cfg: DifficultyConfig;
  private sensors: SensorConfig;
  private sensorRng: Rng;
  private dynamicsRng: Rng;
  private policyRng: Rng;
  private tick = 0;
  private phase = 0;
  private alive = true;
  private shift: ShiftKind = "none";
  private shiftAge = 0;
  private shifted = false;
  private scheduledPhysical = false;
  private scheduledSensor = false;
  private preObservation: V03Observation | null = null;
  private postObservation: V03Observation | null = null;
  private preEnergyReading = 0;
  private lastEnergyReading: number | null = null;
  private lastEffortReading: number | null = null;
  private predictions: ReturnType<V03Agent["predict"]> = [];
  private selection: ReturnType<V03Agent["select"]> | null = null;
  private lastOutcome: V03StepOutcome | null = null;
  private lastSignal: OutcomeSignal | null = null;
  private tickSample: TickSample | null = null;
  private series: V03SeriesPoint[] = [];
  private events: { tick: number; kind: string; text: string }[] = [];
  private beliefTrap: string | null = null;
  private evidenceLink = true;
  private latentBuffer: number[] = [];
  private latentSignedBuffer: number[] = [];
  private latentAbsBuffer: number[] = [];
  private pulse = { energy: 0, strain: 0, remaining: 0 };
  private valueWindows = {
    energy: [] as number[],
    selfError: [] as number[],
    rawError: [] as number[],
    fatigueError: [] as number[],
    costError: [] as number[],
    trust: [] as number[],
    influence: [] as number[],
    uncertainty: [] as number[],
    info: [] as number[],
    voi: [] as number[],
    metaPred: [] as number[],
    basePred: [] as number[],
    failurePred: [] as number[],
    metaOutcome: [] as number[],
    latentFailure: [] as number[],
    latentPersist: [] as number[],
    roughError: [] as number[],
    actions: [] as Action[],
    metaBrier: [] as number[],
    metaLogLoss: [] as number[],
  };

  constructor(
    input: Partial<V03Options> & {
      seed?: number;
      difficulty?: Difficulty;
      sensorOverrides?: Partial<SensorConfig>;
    },
  ) {
    this.seed = normaliseSeed(input.seed ?? DEFAULT_V03_OPTIONS.seed);
    this.difficulty = input.difficulty ?? DEFAULT_V03_OPTIONS.difficulty;
    this.priorRegime = input.priorRegime ?? DEFAULT_V03_OPTIONS.priorRegime;
    this.scenario = input.scenario ?? DEFAULT_V03_OPTIONS.scenario;
    this.explorationMode = input.explorationMode ?? DEFAULT_V03_OPTIONS.explorationMode;
    this.lambda = input.lambda ?? DEFAULT_V03_OPTIONS.lambda;
    this.options = {
      seed: this.seed,
      difficulty: this.difficulty,
      priorRegime: this.priorRegime,
      scenario: this.scenario,
      explorationMode: this.explorationMode,
      lambda: this.lambda,
      beliefTrap: input.beliefTrap ?? "none",
      worldModelEnabled: input.worldModelEnabled ?? true,
      worldLearning: input.worldLearning ?? true,
      selfLearning: input.selfLearning ?? true,
      selfFeedback: input.selfFeedback ?? true,
      metaFeedback: input.metaFeedback ?? true,
      metaLearning: input.metaLearning ?? true,
      riskControl: input.riskControl ?? true,
      residualMeta: input.residualMeta ?? true,
      evidenceLink: input.evidenceLink ?? true,
      recordEvents: input.recordEvents ?? true,
      historyLimit: input.historyLimit ?? 2000,
    };
    this.evidenceLink = this.options.evidenceLink ?? true;
    this.cfg = { ...DIFFICULTIES[this.difficulty] };
    this.sensors = {
      ...BASE_SENSORS,
      energySigma: this.cfg.sensorNoise.energy,
      strainSigma: this.cfg.sensorNoise.strain,
      effortSigma: this.cfg.sensorNoise.effort,
      ...input.sensorOverrides,
    };
    this.world = new World(this.seed, { resourceDensity: this.cfg.resourceDensity });
    this.physical = createV03PhysicalState(this.world.start, this.cfg);
    const priorRng = new Rng(streamSeed(this.seed, "v03-priors"));
    this.agent = new V03Agent(this.priorRegime, priorRng, {
      worldModelEnabled: this.options.worldModelEnabled,
      worldLearning: this.options.worldLearning,
      selfLearning: this.options.selfLearning,
      selfFeedback: this.options.selfFeedback,
      metaFeedback: this.options.metaFeedback,
      metaLearning: this.options.metaLearning,
      riskControl: this.options.riskControl,
      residualMeta: this.options.residualMeta,
    });
    this.sensorRng = new Rng(streamSeed(this.seed, "v03-sensors"));
    this.dynamicsRng = new Rng(streamSeed(this.seed, "v03-dynamics"));
    this.policyRng = new Rng(streamSeed(this.seed, "v03-policy"));
    this.alive = this.physical.alive;
    if (this.options.beliefTrap === "pessimistic_cost") {
      this.injectBeliefTrap("pessimistic_cost");
    }
    this.emit("system", `V0.3 run · seed ${this.seed} · ${this.cfg.label} · ${this.priorRegime} priors · ${this.explorationMode}.`);
  }

  step(): void {
    if (!this.alive) return;
    let guard = 0;
    while (guard < V03_PHASES.length * 2) {
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
    if (this.phase >= V03_PHASES.length) this.phase = 0;
  }

  getSnapshot(): V03Snapshot {
    const metrics = this.metrics();
    const selectedMeta = this.selection
      ? this.predictions[this.selection.actionIndex]?.meta ?? null
      : null;
    return {
      seed: this.seed,
      tick: this.tick,
      phase: this.phase,
      phaseName: V03_PHASES[this.phase],
      difficulty: this.difficulty,
      priorRegime: this.priorRegime,
      scenario: this.scenario,
      explorationMode: this.explorationMode,
      lambda: this.lambda,
      alive: this.alive,
      shift: this.shift,
      shiftAge: this.shiftAge,
      physical: { ...this.physical },
      observation: this.preObservation,
      predictions: this.predictions,
      selection: this.selection,
      selfModel: this.agent.selfModel.snapshot(this.learningRate()),
      worldModel: this.agent.worldModel.snapshot(),
      metaModel: this.agent.metaModel.snapshot(),
      currentMeta: selectedMeta,
      channelStats: this.agent.attributor.stats(),
      attribution: this.agent.attributor.scores(),
      metrics,
      events: [...this.events],
      beliefTrap: this.beliefTrap,
    };
  }

  getSeries(): readonly V03SeriesPoint[] {
    return this.series;
  }

  getEvents(): readonly { tick: number; kind: string; text: string }[] {
    return this.events;
  }

  getTick(): number {
    return this.tick;
  }

  getPhase(): number {
    return this.phase;
  }

  getRenderState(): V03RenderState {
    const prediction = this.selection
      ? this.predictions[this.selection.actionIndex] ?? null
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
      selectedAction: this.selection?.action ?? null,
      shift: this.shift,
    };
  }

  triggerShift(kind: Exclude<ShiftKind, "none">): void {
    this.applyShift(kind);
  }

  injectBeliefTrap(kind: "pessimistic_cost"): void {
    this.agent.selfModel.roughCost = 25;
    this.agent.selfModel.roughObservations = 0;
    this.agent.selfModel.predictionErrorEma = 0.7;
    this.beliefTrap = kind;
    this.emit("belief", "Injected pessimistic rough-terrain cost belief: resources are now expected to cost 25 energy to reach.");
  }

  /**
   * PP-1 probe: a brief, ambiguous sensory pulse. It perturbs the reading for
   * a bounded number of ticks and then disappears, so no persistent regime
   * change occurred. Used to test whether a confident top-down prior absorbs
   * the spike without rewriting the self-model.
   */
  injectPulse(energyOffset: number, strainOffset = 0, ticks = 1): void {
    this.pulse = { energy: energyOffset, strain: strainOffset, remaining: Math.max(1, ticks) };
    this.emit(
      "probe",
      `PP-1 interoceptive pulse: energy reading offset ${energyOffset.toFixed(1)} for ${ticks} tick(s).`,
    );
  }

  private learningRate(): number {
    return 0.11;
  }

  private runPhase(phase: number): void {
    switch (phase) {
      case 0:
        this.sense();
        break;
      case 1:
        this.perceive();
        break;
      case 2:
        this.predict();
        break;
      case 3:
        this.select();
        break;
      case 4:
        this.execute();
        break;
      case 5:
        this.perceiveOutcome();
        break;
      case 6:
        this.computeErrors();
        break;
      case 7:
        this.updateWorld();
        break;
      case 8:
        this.updateSelf();
        break;
      case 9:
        this.updateMetaAndFinalise();
        break;
      default:
        break;
    }
  }

  private maybeShift(): void {
    if (this.scenario === "stable") return;
    if (this.scenario === "mixed_shifts") {
      if (!this.scheduledPhysical && this.tick >= 320) {
        this.scheduledPhysical = true;
        this.applyShift("physical");
      }
      if (!this.scheduledSensor && this.tick >= 620) {
        this.scheduledSensor = true;
        this.applyShift("shared");
      }
      return;
    }
    if (this.shifted || this.tick < SHIFT_TICKS.defaultAt) return;
    if (this.scenario === "physical_shift") {
      this.shifted = true;
      this.applyShift("physical");
    } else if (this.scenario === "energy_sensor_shift") {
      this.shifted = true;
      this.applyShift("energy_sensor");
    } else if (this.scenario === "fatigue_sensor_shift") {
      this.shifted = true;
      this.applyShift("fatigue_sensor");
    } else if (this.scenario === "shared_shift") {
      this.shifted = true;
      this.applyShift("shared");
    }
  }

  private applyShift(kind: Exclude<ShiftKind, "none">): void {
    this.shift = kind;
    this.shiftAge = 0;
    this.shifted = true;
    if (kind === "physical") {
      this.cfg.baseCost *= 1.55;
      this.cfg.fatigueCostSlope *= 1.4;
      this.cfg.moveFatigue *= 1.35;
      this.emit("shift", "Physical regime shift: movement costs more and fatigue accumulates faster. Rest dynamics are unchanged, so the change is confined to MOVE transitions.");
    } else if (kind === "energy_sensor") {
      this.sensors.energySigma *= 2.8;
      this.sensors.energyBias += 7;
      this.emit("shift", "Energy channel degraded: variance and positive bias increased. Other channels unchanged.");
    } else if (kind === "fatigue_sensor") {
      this.sensors.strainSigma *= 3.2;
      this.sensors.strainBias += 0.18;
      this.emit("shift", "Fatigue/strain channel degraded: variance and positive bias increased.");
    } else if (kind === "shared") {
      this.sensors.energySigma *= 2.8;
      this.sensors.energyBias += 7;
      this.sensors.strainSigma *= 3.2;
      this.sensors.strainBias += 0.18;
      this.emit("shift", "Shared sensory degradation: both energy and strain channels degraded simultaneously (the union of the two sensor shifts).");
    }
  }

  private readEnergy(): { value: number; noise: number; stale: boolean } {
    const stale =
      !this.evidenceLink ||
      (this.lastEnergyReading !== null && this.sensorRng.chance(this.sensors.energyStaleChance));
    const noise = this.sensorRng.gaussian() * this.sensors.energySigma;
    const pulsed = this.pulse.remaining > 0 ? this.pulse.energy : 0;    const value = stale && this.lastEnergyReading !== null
      ? this.lastEnergyReading
      : clamp(
          this.physical.energy + this.sensors.energyBias + noise + pulsed,
          -20,
          135,
        );
    this.lastEnergyReading = value;
    return { value, noise: value - this.physical.energy, stale };
  }

  private readStrain(): number {
    const pulsed = this.pulse.remaining > 0 ? this.pulse.strain : 0;
    const value = clamp(
      this.physical.fatigue +
        this.sensors.strainBias +
        this.sensorRng.gaussian() * this.sensors.strainSigma +
        pulsed,
      -0.2,
      1.4,
    );
    return value;
  }

  private readEffort(cost: number, expected: number): number {
    if (!this.evidenceLink) {
      // Broken action→evidence link: acting yields no new proprioceptive
      // information, so the effort channel only echoes the current belief.
      return expected;
    }
    const value = clamp(
      cost + this.sensors.effortBias + this.sensorRng.gaussian() * this.sensors.effortSigma,
      -1,
      15,
    );
    this.lastEffortReading = value;
    return value;
  }

  private makeObservation(
    energyReading: number,
    strainReading: number,
    stale: boolean,
  ): V03Observation {
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
    const priorWeight =
      this.options.metaFeedback &&
      this.selection &&
      this.predictions[this.selection.actionIndex]
        ? this.predictions[this.selection.actionIndex].meta.priorWeight
        : 0.5;
    this.agent.observePre(this.preObservation, priorWeight);
    this.tickSample = {
      sensorEnergyError: Math.abs(energy.value - this.physical.energy),
      selfEnergyError: Math.abs(this.agent.selfModel.energyEstimate - this.physical.energy),
      senseEnergyTrue: this.physical.energy,
      senseEnergyRaw: energy.value,
      observedError: 0,
      latentError: 0,
      signedLatentError: 0,
      absLatentDelta: 0,
      withinTolerance: false,
      metaPrediction: this.selection && this.predictions[this.selection.actionIndex]
        ? this.predictions[this.selection.actionIndex].meta
        : {
            expectedError: 0.4,
            toleranceProbability: 0.5,
            uncertainty: 1,
            systematicBias: 0,
            biasCorrection: 0,
            errorBound: 1.6,
            failureProbability: 0.5,
            persistentBias: 0,
            rollingBase: 0.5,
            residualWeight: 0,
            evidenceCount: 0,
            evidenceWeight: 0,
            influence: 0.5,
            learningMultiplier: 1,
            priorWeight: 0.5,
          },
      selectedFeatures: null,
      observedSignedError: 0,
      shift: this.shift,
    };
  }

  private perceive(): void {
    if (!this.preObservation) return;
    this.agent.perceived(this.preObservation);
  }

  private predict(): void {
    if (!this.preObservation) return;
    const record = this.agent.perceived(this.preObservation);
    this.predictions = this.agent.predict(record);
  }

  private select(): void {
    if (this.predictions.length === 0) return;
    this.selection = this.agent.select(
      this.predictions,
      this.preObservation?.energyReading ?? this.physical.energy,
      this.policyRng.next(),
      this.explorationMode,
      this.lambda,
    );
    if (this.tickSample && this.selection) {
      const selected = this.predictions[this.selection.actionIndex];
      this.tickSample.metaPrediction = selected.meta;
      this.tickSample.selectedFeatures = selected.features;
    }
  }

  private execute(): void {
    if (!this.selection) return;
    const outcome = applyV03Action(
      this.world,
      this.physical,
      this.selection.action,
      this.tick,
      this.dynamicsRng,
      this.cfg,
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
      : null;
    const effort = this.lastOutcome
      ? this.readEffort(this.lastOutcome.trueCost, expected ?? this.lastOutcome.trueCost)
      : this.lastEffortReading;
    this.postObservation = this.makeObservation(energy.value, strain, energy.stale);
    if (this.lastOutcome && effort !== null) {
      this.lastOutcome.effortReading = effort;
    }
  }

  private computeErrors(): void {
    if (!this.lastOutcome || !this.postObservation || !this.selection || !this.tickSample) return;
    const prediction = this.predictions[this.selection.actionIndex];
    const sensedDelta = this.postObservation.energyReading - this.preEnergyReading;
    const predictedDelta = prediction.self.energyDelta;
    const latentDelta = this.lastOutcome.energyAfter - this.lastOutcome.energyBefore;
    const observedError =
      Math.abs(predictedDelta - sensedDelta) / (Math.abs(sensedDelta) + META.errorScale);
    const latentError =
      Math.abs(predictedDelta - latentDelta) / (Math.abs(latentDelta) + META.errorScale);
    this.tickSample.observedError = observedError;
    this.tickSample.latentError = latentError;
    this.tickSample.signedLatentError = predictedDelta - latentDelta;
    this.tickSample.absLatentDelta = Math.abs(latentDelta);
    this.tickSample.withinTolerance = observedError <= META.tolerance;
  }

  private updateWorld(): void {
    if (!this.lastOutcome) return;
    this.agent.learnWorld(this.lastOutcome);
  }

  private updateSelf(): void {
    if (!this.lastOutcome || !this.postObservation || !this.tickSample) return;
    const selected = this.predictions[this.selection?.actionIndex ?? 0];
    const rateScale =
      (this.options.metaFeedback && selected ? selected.meta.learningMultiplier : 1) *
      this.agent.plasticityScale();
    const result = this.agent.learnSelf(
      this.lastOutcome,
      this.postObservation,
      this.preEnergyReading,
      rateScale,
    );
    this.tickSample.observedError = result.observedError;
    this.tickSample.observedSignedError = result.signedError;
    this.tickSample.withinTolerance = result.withinTolerance;
  }

  private updateMetaAndFinalise(): void {
    if (!this.lastOutcome || !this.postObservation || !this.tickSample) return;
    this.agent.learnMeta(
      this.lastOutcome,
      this.postObservation,
      this.preEnergyReading,
      this.tickSample.observedError,
      this.tickSample.observedSignedError,
      this.tickSample.withinTolerance,
    );
    this.finaliseTick();
  }

  private finaliseTick(): void {
    if (!this.tickSample || !this.selection || !this.lastOutcome) return;
    const self = this.agent.selfModel;
    const selected = this.predictions[this.selection.actionIndex];
    const meta = selected?.meta;
    const attribution = this.agent.attributor.scores();
    const stats = this.agent.attributor.stats();
    const effectiveCost = this.lastOutcome.trueCost;
    const nearCliff =
      self.energyEstimate < 20 || self.fatigue > 0.62;
    this.latentBuffer.push(this.tickSample.latentError);
    if (this.latentBuffer.length > 20) this.latentBuffer.shift();
    this.latentSignedBuffer.push(this.tickSample.signedLatentError);
    if (this.latentSignedBuffer.length > 20) this.latentSignedBuffer.shift();
    this.latentAbsBuffer.push(this.tickSample.absLatentDelta);
    if (this.latentAbsBuffer.length > 20) this.latentAbsBuffer.shift();
    const meanSigned =
      this.latentSignedBuffer.reduce((a, b) => a + b, 0) / this.latentSignedBuffer.length;
    const meanAbs =
      this.latentAbsBuffer.reduce((a, b) => a + b, 0) / this.latentAbsBuffer.length;
    const latentPersistent =
      Math.abs(meanSigned) / (meanAbs + META.errorScale) > 0.18;
    const riskMargin =
      this.options.riskControl && meta
        ? nearCliff
          ? -0.8 * meta.errorBound
          : 0.1 * meta.errorBound
        : 0;
    const point: V03SeriesPoint = {
      t: this.tick,
      energy: this.physical.energy,
      energyEstimate: self.energyEstimate,
      rawEnergyReading: this.postObservation?.energyReading ?? this.preEnergyReading,
      energyError: this.tickSample.selfEnergyError,
      rawEnergyError: this.tickSample.sensorEnergyError,
      fatigue: this.physical.fatigue,
      fatigueEstimate: self.fatigue,
      fatigueError: Math.abs(self.fatigue - this.physical.fatigue),
      costTrue: effectiveCost,
      costEstimate: self.movementCost,
      costError: Math.abs(self.movementCost - effectiveCost),
      observedError: this.tickSample.observedError,
      latentError: this.tickSample.latentError,
      signedLatentError: this.tickSample.signedLatentError,
      absLatentDelta: this.tickSample.absLatentDelta,
      latentPersistent,
      tolerance: this.tickSample.withinTolerance,
      metaTargetTolerance: this.agent.metaModel.lastToleranceTarget,
      senseEnergyTrue: this.tickSample.senseEnergyTrue,
      senseEnergyRaw: this.tickSample.senseEnergyRaw,
      roughCostTrue: this.cfg.roughCost,
      roughCostEstimate: self.roughCost,
      roughCostError: Math.abs(self.roughCost - this.cfg.roughCost),
      terrainRough: this.lastOutcome.terrainRough,
      pulseActive: this.pulse.remaining > 0,
      metaFailureProbability: meta?.failureProbability ?? null,
      metaPersistentBias: meta?.persistentBias ?? null,
      riskMargin,
      attributionPhysical: attribution.physical,
      attributionEnergy: attribution.energy_sensor,
      attributionFatigue: attribution.fatigue_sensor,
      attributionShared: attribution.shared,
      attributionInsufficient: attribution.insufficient,
      predictedError: meta?.expectedError ?? null,
      predictedTolerance: meta?.toleranceProbability ?? null,
      predictionUncertainty: meta?.uncertainty ?? null,
      influence: meta?.influence ?? null,
      metaBias: meta?.systematicBias ?? null,
      evidenceCount: meta?.evidenceCount ?? 0,
      infoValue: this.selection.infoGainEstimate,
      voi: this.selection.voiEstimate,
      action: this.selection.action,
      explorationMode: this.explorationMode,
      alive: this.physical.alive,
      resources: this.physical.resources,
      shift: this.shift,
      attribution,
      sensorDisagreement:
        Math.abs(stats.energyInnovationEma) / 6 +
        Math.abs(stats.strainResidualEma) * 3,
      channelEnergy: this.postObservation?.energyReading ?? this.preEnergyReading,
      channelStrain: this.postObservation?.strainReading ?? 0,
      lastEffort: this.lastEffortReading,
    };
    this.series.push(point);
    if (this.series.length > this.options.historyLimit) this.series.shift();
    this.recordMetrics(point, meta);
    if (this.tick % 40 === 0 && this.tick > 0) {
      this.emit("status", `t=${this.tick} · E ${this.physical.energy.toFixed(0)} · F ${this.physical.fatigue.toFixed(2)} · self MAE ${this.tickSample.selfEnergyError.toFixed(1)} · meta ${meta ? `p(tol)=${meta.toleranceProbability.toFixed(2)} u=${meta.uncertainty.toFixed(2)}` : "—"}.`);
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

  private recordMetrics(point: V03SeriesPoint, meta: MetaPrediction | undefined): void {
    const w = this.valueWindows;
    w.energy.push(point.energy);
    w.selfError.push(point.energyError);
    w.rawError.push(point.rawEnergyError);
    w.fatigueError.push(point.fatigueError);
    w.costError.push(point.costError);
    w.roughError.push(point.roughCostError);
    w.trust.push(meta?.toleranceProbability ?? 0.5);
    w.influence.push(meta?.influence ?? 0.5);
    w.uncertainty.push(meta?.uncertainty ?? 0);
    w.info.push(point.infoValue);
    w.voi.push(point.voi);
    w.actions.push(point.action);
    if (meta && this.tickSample) {
      w.metaPred.push(meta.toleranceProbability);
      w.basePred.push(meta.rollingBase);
      w.failurePred.push(meta.failureProbability);
      w.metaOutcome.push(point.metaTargetTolerance ? 1 : 0);
      w.latentFailure.push(point.latentError > META.tolerance ? 1 : 0);
      w.latentPersist.push(point.latentPersistent ? 1 : 0);
      w.metaBrier.push(
        (meta.toleranceProbability - (point.metaTargetTolerance ? 1 : 0)) ** 2,
      );
      const q = point.metaTargetTolerance
        ? meta.toleranceProbability
        : 1 - meta.toleranceProbability;
      w.metaLogLoss.push(-Math.log(clamp(q, 0.001, 0.999)));
    }
    if (w.energy.length > 2000) {
      for (const key of [
        "energy",
        "selfError",
        "rawError",
        "fatigueError",
        "costError",
        "trust",
        "influence",
        "uncertainty",
        "info",
        "voi",
        "metaPred",
        "basePred",
        "failurePred",
        "metaOutcome",
        "latentFailure",
        "latentPersist",
        "roughError",
        "metaBrier",
        "metaLogLoss",
      ] as const) {
        (w[key] as number[]).shift();
      }
      w.actions.shift();
    }
  }

  private metrics(): V03Metrics {
    const w = this.valueWindows;
    const actions = w.actions;
    const counts = new Map<Action, number>();
    for (const action of actions) counts.set(action, (counts.get(action) ?? 0) + 1);
    let entropy = 0;
    for (const count of counts.values()) {
      const p = count / Math.max(1, actions.length);
      if (p > 0) entropy -= p * Math.log(p);
    }
    const ece = this.ece();
    const auroc = this.auroc();
    const rollingBss = this.rollingBss();
    const latentAuroc = this.failureAuroc();
    const attributions = this.agent.attributor.scores();
    return {
      alive: this.alive,
      ticks: this.tick,
      resources: this.physical.resources,
      distance: this.physical.distance,
      meanEnergy: mean(w.energy),
      minEnergy: w.energy.length ? Math.min(...w.energy) : this.physical.energy,
      selfEnergyMae: mean(w.selfError),
      rawEnergyMae: mean(w.rawError),
      fatigueMae: mean(w.fatigueError),
      costMae: mean(w.costError),
      toleranceRate: w.metaOutcome.length ? mean(w.metaOutcome) : 0,
      metaBrier: mean(w.metaBrier),
      metaLogLoss: mean(w.metaLogLoss),
      metaEce: ece,
      metaAuroc: auroc,
      meanUncertainty: mean(w.uncertainty),
      meanInfluence: mean(w.influence),
      meanInfoValue: mean(w.info),
      meanVoi: mean(w.voi),
      infoGain: this.agent.infoGain,
      rollingBss,
      latentAuroc,
      roughCostMae: mean(w.roughError),
      actionEntropy: entropy,
      explorationCoverage: counts.size / ACTIONS.length,
      topAttribution: attributions.top,
      attributionConfidence: attributions.confidence,
      shifted: this.shifted,
    };
  }

  private ece(): number {
    const preds = this.valueWindows.metaPred;
    const outs = this.valueWindows.metaOutcome;
    if (preds.length < 20) return 0;
    let ece = 0;
    const bins = 8;
    for (let i = 0; i < bins; i++) {
      const lo = i / bins;
      const hi = (i + 1) / bins;
      let count = 0;
      let p = 0;
      let y = 0;
      for (let j = 0; j < preds.length; j++) {
        if (preds[j] >= lo && (i === bins - 1 ? preds[j] <= hi : preds[j] < hi)) {
          count++;
          p += preds[j];
          y += outs[j];
        }
      }
      if (count > 0) ece += (count / preds.length) * Math.abs(p / count - y / count);
    }
    return ece;
  }

  private auroc(): number | null {
    const p = this.valueWindows.metaPred;
    const labels = this.valueWindows.latentFailure.map((v) => v === 1);
    if (p.length < 20) return null;
    const positives = labels.filter(Boolean).length;
    const negatives = labels.length - positives;
    if (positives === 0 || negatives === 0) return null;
    let concordant = 0;
    for (let i = 0; i < p.length; i++) {
      for (let j = 0; j < p.length; j++) {
        if (labels[i] && !labels[j]) {
          if (p[i] < p[j]) concordant++;
          else if (Math.abs(p[i] - p[j]) < 1e-12) concordant += 0.5;
        }
      }
    }
    return concordant / (positives * negatives);
  }

  /**
   * Skill of the learned meta-model against the model's own rolling baseline
   * over the same observations. Positive means the residual/contextual model
   * is better than the 1-parameter tracker it collapses toward.
   */
  private rollingBss(): number {
    const w = this.valueWindows;
    if (w.metaPred.length < 20) return 0;
    let model = 0;
    let base = 0;
    for (let i = 0; i < w.metaPred.length; i++) {
      const y = w.metaOutcome[i];
      model += (w.metaPred[i] - y) ** 2;
      base += (w.basePred[i] - y) ** 2;
    }
    if (base <= 1e-9) return 0;
    return 1 - model / base;
  }

  /** AUROC of the persistent-failure head against latent (unsensed) failure. */
  private failureAuroc(): number | null {
    const p = this.valueWindows.failurePred;
    const labels = this.valueWindows.latentPersist.map((v) => v === 1);
    if (p.length < 20) return null;
    const positives = labels.filter(Boolean).length;
    const negatives = labels.length - positives;
    if (positives === 0 || negatives === 0) return null;
    let concordant = 0;
    for (let i = 0; i < p.length; i++) {
      for (let j = 0; j < p.length; j++) {
        if (labels[i] && !labels[j]) {
          if (p[i] > p[j]) concordant++;
          else if (Math.abs(p[i] - p[j]) < 1e-12) concordant += 0.5;
        }
      }
    }
    return concordant / (positives * negatives);
  }

  private emit(kind: string, text: string): void {
    if (!this.options.recordEvents) return;
    this.events.push({ tick: this.tick, kind, text });
    if (this.events.length > 400) this.events.shift();
  }

  /**
   * Isolated forced-action probe. It copies world/physical state and never
   * touches the agent's memory, self-model, meta-model or world model.
   */
  probeAction(action: Action): ShadowObservation | null {
    const prediction = this.predictions.find((p) => p.action === action);
    if (!prediction) return null;
    const shadowWorld = this.world.clone();
    const shadowState = { ...this.physical };
    const shadowRng = new Rng(streamSeed(this.seed, `shadow:${this.tick}:${action}`));
    const outcome = applyV03Action(
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
}
