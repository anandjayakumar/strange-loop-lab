import { clamp, mean } from "../math";
import { Rng, normaliseSeed, streamSeed } from "../rng";
import { World } from "../environment/world";
import { ACTIONS, type Action, type OutcomeSignal } from "../types";
import { V02Agent } from "./agent";
import { BASE_SENSORS, DEFAULT_V02_OPTIONS, DIFFICULTIES, META, SHIFT_TICKS } from "./config";
import { applyV02Action, createV02PhysicalState } from "./dynamics";
import type {
  Difficulty,
  DifficultyConfig,
  ExplorationMode,
  MetaPrediction,
  PriorRegime,
  Scenario,
  SensorConfig,
  ShiftKind,
  V02Metrics,
  V02Observation,
  V02Options,
  V02SeriesPoint,
  V02Snapshot,
  V02StepOutcome,
} from "./types";

export const V02_PHASES = [
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
  withinTolerance: boolean;
  metaPrediction: MetaPrediction;
  selectedFeatures: ReturnType<V02Agent["predict"]>[number]["features"] | null;
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

export interface V02RenderState {
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

export class V02Engine {
  readonly seed: number;
  readonly difficulty: Difficulty;
  readonly priorRegime: PriorRegime;
  readonly scenario: Scenario;
  readonly explorationMode: ExplorationMode;
  readonly lambda: number;
  readonly world: World;
  readonly physical: ReturnType<typeof createV02PhysicalState>;
  readonly agent: V02Agent;
  readonly options: V02Options;
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
  private preObservation: V02Observation | null = null;
  private postObservation: V02Observation | null = null;
  private preEnergyReading = 0;
  private lastEnergyReading: number | null = null;
  private lastEffortReading: number | null = null;
  private predictions: ReturnType<V02Agent["predict"]> = [];
  private selection: ReturnType<V02Agent["select"]> | null = null;
  private lastOutcome: V02StepOutcome | null = null;
  private lastSignal: OutcomeSignal | null = null;
  private tickSample: TickSample | null = null;
  private series: V02SeriesPoint[] = [];
  private events: { tick: number; kind: string; text: string }[] = [];
  private beliefTrap: string | null = null;
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
    metaOutcome: [] as number[],
    latentFailure: [] as number[],
    actions: [] as Action[],
    metaBrier: [] as number[],
    metaLogLoss: [] as number[],
  };

  constructor(
    input: Partial<V02Options> & {
      seed?: number;
      difficulty?: Difficulty;
      sensorOverrides?: Partial<SensorConfig>;
    },
  ) {
    this.seed = normaliseSeed(input.seed ?? DEFAULT_V02_OPTIONS.seed);
    this.difficulty = input.difficulty ?? DEFAULT_V02_OPTIONS.difficulty;
    this.priorRegime = input.priorRegime ?? DEFAULT_V02_OPTIONS.priorRegime;
    this.scenario = input.scenario ?? DEFAULT_V02_OPTIONS.scenario;
    this.explorationMode = input.explorationMode ?? DEFAULT_V02_OPTIONS.explorationMode;
    this.lambda = input.lambda ?? DEFAULT_V02_OPTIONS.lambda;
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
      recordEvents: input.recordEvents ?? true,
      historyLimit: input.historyLimit ?? 2000,
    };
    this.cfg = { ...DIFFICULTIES[this.difficulty] };
    this.sensors = {
      ...BASE_SENSORS,
      energySigma: this.cfg.sensorNoise.energy,
      strainSigma: this.cfg.sensorNoise.strain,
      effortSigma: this.cfg.sensorNoise.effort,
      ...input.sensorOverrides,
    };
    this.world = new World(this.seed, { resourceDensity: this.cfg.resourceDensity });
    this.physical = createV02PhysicalState(this.world.start, this.cfg);
    const priorRng = new Rng(streamSeed(this.seed, "v02-priors"));
    this.agent = new V02Agent(this.priorRegime, priorRng, {
      worldModelEnabled: this.options.worldModelEnabled,
      worldLearning: this.options.worldLearning,
      selfLearning: this.options.selfLearning,
      selfFeedback: this.options.selfFeedback,
      metaFeedback: this.options.metaFeedback,
      metaLearning: this.options.metaLearning,
    });
    this.sensorRng = new Rng(streamSeed(this.seed, "v02-sensors"));
    this.dynamicsRng = new Rng(streamSeed(this.seed, "v02-dynamics"));
    this.policyRng = new Rng(streamSeed(this.seed, "v02-policy"));
    this.alive = this.physical.alive;
    if (this.options.beliefTrap === "pessimistic_cost") {
      this.injectBeliefTrap("pessimistic_cost");
    }
    this.emit("system", `V0.2 run · seed ${this.seed} · ${this.cfg.label} · ${this.priorRegime} priors · ${this.explorationMode}.`);
  }

  step(): void {
    if (!this.alive) return;
    let guard = 0;
    while (guard < V02_PHASES.length * 2) {
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
    if (this.phase >= V02_PHASES.length) this.phase = 0;
  }

  getSnapshot(): V02Snapshot {
    const metrics = this.metrics();
    const selectedMeta = this.selection
      ? this.predictions[this.selection.actionIndex]?.meta ?? null
      : null;
    return {
      seed: this.seed,
      tick: this.tick,
      phase: this.phase,
      phaseName: V02_PHASES[this.phase],
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

  getSeries(): readonly V02SeriesPoint[] {
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

  getRenderState(): V02RenderState {
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
    this.agent.selfModel.movementCost = 30;
    this.agent.selfModel.restGain = 10;
    this.agent.selfModel.predictionErrorEma = 0.7;
    this.beliefTrap = kind;
    this.emit("belief", "Injected pessimistic movement-cost belief: the self-model now expects movement to be extremely expensive.");
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
      this.cfg.restGain *= 0.55;
      this.emit("shift", "Physical regime shift: movement is more expensive, fatigue accumulates faster, and rest restores less.");
    } else if (kind === "energy_sensor") {
      this.sensors.energySigma *= 2.8;
      this.sensors.energyBias += 7;
      this.emit("shift", "Energy channel degraded: variance and positive bias increased. Other channels unchanged.");
    } else if (kind === "fatigue_sensor") {
      this.sensors.strainSigma *= 3.2;
      this.sensors.strainBias += 0.18;
      this.emit("shift", "Fatigue/strain channel degraded: variance and positive bias increased.");
    } else if (kind === "shared") {
      this.sensors.energySigma *= 2.4;
      this.sensors.energyBias += 5;
      this.sensors.strainSigma *= 2.4;
      this.sensors.strainBias += 0.12;
      this.emit("shift", "Shared sensory degradation: both energy and strain channels became noisier and biased.");
    }
  }

  private readEnergy(): { value: number; noise: number; stale: boolean } {
    const stale =
      this.lastEnergyReading !== null && this.sensorRng.chance(this.sensors.energyStaleChance);
    const noise = this.sensorRng.gaussian() * this.sensors.energySigma;
    const value = stale && this.lastEnergyReading !== null
      ? this.lastEnergyReading
      : clamp(
          this.physical.energy + this.sensors.energyBias + noise,
          -20,
          135,
        );
    this.lastEnergyReading = value;
    return { value, noise: value - this.physical.energy, stale };
  }

  private readStrain(): number {
    const value = clamp(
      this.physical.fatigue + this.sensors.strainBias + this.sensorRng.gaussian() * this.sensors.strainSigma,
      -0.2,
      1.4,
    );
    return value;
  }

  private readEffort(cost: number): number {
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
  ): V02Observation {
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
      withinTolerance: false,
      metaPrediction: this.selection && this.predictions[this.selection.actionIndex]
        ? this.predictions[this.selection.actionIndex].meta
        : {
            expectedError: 0.4,
            toleranceProbability: 0.5,
            uncertainty: 1,
            systematicBias: 0,
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
    const outcome = applyV02Action(
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
    const effort = this.lastOutcome
      ? this.readEffort(this.lastOutcome.trueCost)
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
      this.options.metaFeedback && selected ? selected.meta.learningMultiplier : 1;
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
    const point: V02SeriesPoint = {
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
      tolerance: this.tickSample.withinTolerance,
      metaTargetTolerance: this.agent.metaModel.lastToleranceTarget,
      senseEnergyTrue: this.tickSample.senseEnergyTrue,
      senseEnergyRaw: this.tickSample.senseEnergyRaw,
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
    this.tickSample = null;
    this.postObservation = null;
  }

  private recordMetrics(point: V02SeriesPoint, meta: MetaPrediction | undefined): void {
    const w = this.valueWindows;
    w.energy.push(point.energy);
    w.selfError.push(point.energyError);
    w.rawError.push(point.rawEnergyError);
    w.fatigueError.push(point.fatigueError);
    w.costError.push(point.costError);
    w.trust.push(meta?.toleranceProbability ?? 0.5);
    w.influence.push(meta?.influence ?? 0.5);
    w.uncertainty.push(meta?.uncertainty ?? 0);
    w.info.push(point.infoValue);
    w.voi.push(point.voi);
    w.actions.push(point.action);
    if (meta) {
      w.metaPred.push(meta.toleranceProbability);
      w.metaOutcome.push(point.metaTargetTolerance ? 1 : 0);
      w.latentFailure.push(point.latentError > META.tolerance ? 1 : 0);
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
        "metaOutcome",
        "latentFailure",
        "metaBrier",
        "metaLogLoss",
      ] as const) {
        (w[key] as number[]).shift();
      }
      w.actions.shift();
    }
  }

  private metrics(): V02Metrics {
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
    const outcome = applyV02Action(
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
