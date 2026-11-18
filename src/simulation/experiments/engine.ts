import { Agent, type RuntimeControls } from "../agent/agent";
import { DEFAULT_SEED, INTEROCEPTION } from "../config";
import { applyAction, createPhysicalState } from "../environment/dynamics";
import { World } from "../environment/world";
import {
  adaptationText,
  costRevisionText,
  deathText,
  energyThresholdText,
  fatigueText,
  outcomeText,
  plasticityText,
  priorText,
  resetText,
  restRevisionText,
  selfErrorText,
  toggleText,
  trustText,
} from "../events/events";
import { clamp, klDivergence } from "../math";
import { MetricTracker } from "../metrics/metrics";
import { createObservation } from "../agent/perception/perception";
import { Rng, normaliseSeed, streamSeed } from "../rng";
import {
  MODE_META,
  type Action,
  type ActionPrediction,
  type EngineMetrics,
  type EngineOptions,
  type EngineSnapshot,
  type Mode,
  type Observation,
  type OutcomeSignal,
  type PerceptionRecord,
  type PhysicalState,
  type PredictionSet,
  type Selection,
  type SeriesPoint,
  type SimEvent,
  type StepOutcome,
} from "../types";

export const PHASES = [
  { name: "Sense", description: "Sample the local 7×7 world and a noisy interoceptive energy reading." },
  { name: "Observation update", description: "Correct world-model coefficients from what is visible now." },
  { name: "Predict", description: "World model predicts external outcomes; self-model predicts internal ones." },
  { name: "Evaluate & select", description: "Five utilities pass through a seeded softmax; self influence is measurable." },
  { name: "Execute", description: "Apply the selected action to the environment and pay its energy cost." },
  { name: "Perceive outcome", description: "Proprioception, collision/slip signal and a second noisy interoceptive sample." },
  { name: "Prediction errors", description: "Compare every prediction with what actually happened." },
  { name: "Update world model", description: "Delta-rule update of external outcome coefficients." },
  { name: "Update self-model", description: "Revise energy belief, costs, fatigue and success coefficients." },
  { name: "Update meta-model", description: "Track self-model reliability; adjust plasticity and prior weight." },
] as const;

const PHASE_COUNT = PHASES.length;

interface TickSample {
  worldBrier: number;
  selfStateError: number | null;
  sensorStateError: number | null;
  selfPredictionError: number | null;
  selfInfluence: number;
  trust: number | null;
  energy: number;
  action: Action;
  predictedSuccess: number;
  predictedCollect: number;
  selfDeltaError: number | null;
  metaError: number | null;
}

export interface RenderState {
  tick: number;
  cells: Uint8Array;
  agent: {
    x: number;
    y: number;
    alive: boolean;
    energy: number;
    fatigue: number;
    lastAction: Action | null;
    effectiveCost: number;
    effectiveSuccess: number;
  };
  target: { x: number; y: number } | null;
  selectedAction: Action | null;
  phase: number;
}

const DEFAULTS = {
  selfFeedback: true,
  metaFeedback: true,
  plasticity: true,
  priorWeighting: true,
  recordEvents: true,
  historyLimit: 4000,
};

export class SimulationEngine {
  readonly seed: number;
  readonly mode: Mode;
  readonly world: World;
  readonly physical: PhysicalState;
  readonly agent: Agent;
  readonly options: EngineOptions;
  private readonly controls: RuntimeControls;
  private readonly senseRng: Rng;
  private readonly dynamicsRng: Rng;
  private readonly policyRng: Rng;
  private readonly tracker = new MetricTracker();
  private events: SimEvent[] = [];
  private series: SeriesPoint[] = [];
  private tick = 0;
  private phase = 0;
  private nextEventId = 1;
  private perception: PerceptionRecord | null = null;
  private preObservation: Observation | null = null;
  private postObservation: Observation | null = null;
  private predictions: PredictionSet | null = null;
  private selection: Selection | null = null;
  private tickSample: TickSample | null = null;
  private lastOutcome: StepOutcome | null = null;
  private lastSignal: OutcomeSignal | null = null;
  private lastSensed: { value: number; noise: number; stale: boolean } | null = null;
  private sensedEnergy = 0;
  private sensedNoise = 0;
  private staleReading = false;
  private senseStateError: number | null = null;
  private previousSelfError = 0;
  private costCooldown = 0;
  private restCooldown = 0;
  private trustCooldown = 0;
  private lrCooldown = 0;
  private priorCooldown = 0;
  private eventCooldown = 0;
  private adaptationCooldown = 0;
  private prevCost: number | null = null;
  private prevRestGain: number | null = null;
  private prevTrust: number | null = null;
  private prevLr: number | null = null;
  private prevPrior: number | null = null;
  private energyFlags = new Set<number>();
  private highFatigue = false;
  private criticalFatigue = false;

  constructor(input: Partial<EngineOptions> & { mode: Mode; seed?: number }) {
    this.seed = normaliseSeed(input.seed ?? DEFAULT_SEED);
    this.mode = input.mode;
    this.options = {
      seed: this.seed,
      mode: input.mode,
      selfFeedback: input.selfFeedback ?? DEFAULTS.selfFeedback,
      metaFeedback: input.metaFeedback ?? DEFAULTS.metaFeedback,
      plasticity: input.plasticity ?? DEFAULTS.plasticity,
      priorWeighting: input.priorWeighting ?? DEFAULTS.priorWeighting,
      recordEvents: input.recordEvents ?? DEFAULTS.recordEvents,
      historyLimit: input.historyLimit ?? DEFAULTS.historyLimit,
      research: input.research,
    };
    this.controls = {
      selfFeedback: this.options.selfFeedback,
      metaFeedback: this.options.metaFeedback,
      plasticity: this.options.plasticity,
      priorWeighting: this.options.priorWeighting,
    };
    this.world = new World(this.seed);
    this.physical = createPhysicalState(this.world.start);
    this.agent = new Agent(this.mode, input.research);
    this.senseRng = new Rng(streamSeed(this.seed, "interoception"));
    this.dynamicsRng = new Rng(streamSeed(this.seed, "dynamics"));
    this.policyRng = new Rng(streamSeed(this.seed, "policy"));
    this.emit(
      "system",
      `Run initialised · seed ${this.seed} · Mode ${this.mode} (${MODE_META[this.mode].name}) · 30×30 world · ${this.world.resourceCount} resource cells.`,
    );
  }

  // ── Public controls ──────────────────────────────────────────────────────

  step(): void {
    if (!this.physical.alive) return;
    let guard = 0;
    while (guard < PHASE_COUNT * 2) {
      const before = this.tick;
      this.advancePhase();
      guard++;
      if (this.tick !== before) break;
    }
  }

  advancePhase(): void {
    // A dead agent still completes the cognitive phases of the tick in which it
    // died (so the outcome is learned and logged), but cannot start a new tick.
    if (!this.physical.alive && this.phase === 0) return;
    this.runPhase(this.phase);
    this.phase++;
    if (this.phase >= PHASE_COUNT) {
      this.phase = 0;
    }
  }

  setOptions(partial: Partial<Pick<EngineOptions, "selfFeedback" | "metaFeedback" | "plasticity" | "priorWeighting">>): void {
    if (partial.selfFeedback !== undefined && partial.selfFeedback !== this.controls.selfFeedback) {
      this.controls.selfFeedback = partial.selfFeedback;
      this.options.selfFeedback = partial.selfFeedback;
      this.emit("system", toggleText("Self-model feedback", partial.selfFeedback));
    }
    if (partial.metaFeedback !== undefined && partial.metaFeedback !== this.controls.metaFeedback) {
      this.controls.metaFeedback = partial.metaFeedback;
      this.options.metaFeedback = partial.metaFeedback;
      this.emit("system", toggleText("Meta-model feedback", partial.metaFeedback));
    }
    if (partial.plasticity !== undefined && partial.plasticity !== this.controls.plasticity) {
      this.controls.plasticity = partial.plasticity;
      this.options.plasticity = partial.plasticity;
      this.emit("system", toggleText("Plasticity modulation", partial.plasticity));
    }
    if (partial.priorWeighting !== undefined && partial.priorWeighting !== this.controls.priorWeighting) {
      this.controls.priorWeighting = partial.priorWeighting;
      this.options.priorWeighting = partial.priorWeighting;
      this.emit("system", toggleText("Prior weighting", partial.priorWeighting));
    }
  }

  resetAgentModels(): void {
    this.agent.reset();
    this.tracker.reset();
    this.lastSensed = null;
    this.senseStateError = null;
    this.previousSelfError = 0;
    this.prevCost = null;
    this.prevRestGain = null;
    this.prevTrust = null;
    this.prevLr = null;
    this.prevPrior = null;
    this.emit("system", resetText());
  }

  // ── Phases ──────────────────────────────────────────────────────────────

  private runPhase(phase: number): void {
    switch (phase) {
      case 0:
        this.sense();
        break;
      case 1:
        this.updateWorldFromObservation();
        break;
      case 2:
        this.predict();
        break;
      case 3:
        this.evaluateAndSelect();
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

  private sense(): void {
    const reading = this.readInteroception();
    this.sensedEnergy = reading.value;
    this.sensedNoise = reading.noise;
    this.staleReading = reading.stale;
    this.preObservation = createObservation(
      this.world,
      this.physical,
      this.tick,
      reading.value,
      this.lastSignal,
    );
    this.agent.observe(this.preObservation, this.controls);
    const self = this.agent.selfModel;
    this.senseStateError = self ? Math.abs(self.energyEstimate - this.physical.energy) : null;
    this.tickSample = {
      worldBrier: 0,
      selfStateError: this.senseStateError,
      sensorStateError: Math.abs(reading.value - this.physical.energy),
      selfPredictionError: null,
      selfInfluence: 0,
      trust: this.agent.metaModel?.trust ?? null,
      energy: this.physical.energy,
      action: "REST",
      predictedSuccess: 0,
      predictedCollect: 0,
      selfDeltaError: null,
      metaError: null,
    };
  }

  private updateWorldFromObservation(): void {
    if (!this.preObservation) return;
    this.perception = this.agent.perceive(this.preObservation);
    this.agent.learnFromObservation(this.perception);
  }

  private predict(): void {
    if (!this.perception) return;
    this.predictions = this.agent.predict(this.perception);
  }

  private evaluateAndSelect(): void {
    if (!this.predictions || !this.preObservation) return;
    this.selection = this.agent.select(
      this.predictions,
      this.preObservation.sensedEnergy,
      this.policyRng.next(),
      this.controls,
    );
    if (this.tickSample) {
      this.tickSample.selfInfluence = klDivergence(
        this.selection.probabilities,
        this.selection.probabilitiesWithoutSelf,
      );
      this.tickSample.trust = this.agent.metaModel?.trust ?? null;
    }
  }

  private execute(): void {
    if (!this.selection) return;
    const outcome = applyAction(
      this.world,
      this.physical,
      this.selection.action,
      this.tick,
      this.dynamicsRng,
    );
    this.lastOutcome = outcome;
    this.lastSignal = {
      action: outcome.action,
      moved: outcome.moved,
      blocked: outcome.blocked,
      slipped: outcome.slipped,
      collected: outcome.collected,
    };
  }

  private perceiveOutcome(): void {
    const reading = this.readInteroception();
    this.sensedEnergy = reading.value;
    this.sensedNoise = reading.noise;
    this.staleReading = reading.stale;
    this.postObservation = createObservation(
      this.world,
      this.physical,
      this.tick,
      reading.value,
      this.lastSignal,
    );
  }

  private computeErrors(): void {
    if (!this.tickSample || !this.predictions || !this.selection || !this.lastOutcome) return;
    const prediction = this.predictions.actions[this.selection.actionIndex];
    const outcome = this.lastOutcome;
    // A rest is a successfully executed action; it has no external movement or
    // collection to score, so treat its success label as 1.
    const succeeded = outcome.action === "REST" ? true : outcome.moved;
    const successError = (prediction.world.pSuccess - (succeeded ? 1 : 0)) ** 2;
    const collectError = (prediction.world.pCollect - (outcome.collected ? 1 : 0)) ** 2;
    this.tickSample.worldBrier = 0.5 * (successError + collectError);
    this.tickSample.predictedSuccess = prediction.world.pSuccess;
    this.tickSample.predictedCollect = prediction.world.pCollect;
    this.tickSample.action = outcome.action;
    this.tickSample.energy = outcome.energyAfter;

    const self = this.agent.selfModel;
    if (self && prediction.self) {
      const actualDelta = outcome.energyAfter - outcome.energyBefore;
      const normalizedDeltaError = Math.min(
        1,
        Math.abs(prediction.self.energyDelta - actualDelta) / (Math.abs(actualDelta) + 2),
      );
      const selfBrier = (prediction.self.pSuccess - (succeeded ? 1 : 0)) ** 2;
      this.tickSample.selfDeltaError = normalizedDeltaError;
      this.tickSample.selfPredictionError = 0.6 * normalizedDeltaError + 0.4 * selfBrier;
    }
    if (self) {
      this.tickSample.selfStateError = Math.abs(self.energyEstimate - this.physical.energy);
    }
  }

  private updateWorld(): void {
    if (!this.lastSignal) return;
    this.agent.learnWorld(this.lastSignal);
  }

  private updateSelf(): void {
    if (!this.lastSignal || !this.postObservation || !this.preObservation || !this.tickSample) {
      return;
    }
    const result = this.agent.learnOutcome(
      this.lastSignal,
      this.postObservation,
      this.preObservation.sensedEnergy,
      this.controls,
    );
    this.tickSample.metaError = result.metaError;
    if (this.tickSample.selfDeltaError === null && result.selfDeltaError !== null) {
      // Use the agent's own sensed-delta error until ground truth is available.
      this.tickSample.selfDeltaError = result.selfDeltaError;
    }
  }

  private updateMetaAndFinalise(): void {
    if (!this.tickSample) return;
    this.agent.updateMeta(this.tickSample.metaError);
    this.finaliseTick();
  }

  // ── Tick finalisation ───────────────────────────────────────────────────

  private finaliseTick(): void {
    if (!this.tickSample || !this.selection) return;
    const sample = this.tickSample;
    const self = this.agent.selfModel;
    const meta = this.agent.metaModel;
    const learningRate = this.agent.effectiveLearningRate(this.controls);
    const priorWeight = this.agent.effectivePriorWeight(this.controls);
    const trust = meta?.trust ?? null;
    const effectiveCost = this.lastOutcome?.effectiveCost ?? this.physical.effectiveCost;
    const costError = self ? Math.abs(self.movementCost - effectiveCost) : null;
    const prediction = this.predictions?.actions[this.selection.actionIndex] ?? null;
    const actualMoved = this.lastOutcome?.moved ?? false;
    const actualCollected = this.lastOutcome?.collected ?? false;
    const actualEnergyDelta = this.lastOutcome
      ? this.lastOutcome.energyAfter - this.lastOutcome.energyBefore
      : 0;

    this.tracker.record({
      worldBrier: sample.worldBrier,
      selfStateError: sample.selfStateError,
      selfPredictionError: sample.selfPredictionError,
      selfInfluence: sample.selfInfluence,
      trust,
      learningRate,
      priorWeight,
      energy: sample.energy,
      action: sample.action,
      policyTv: this.selection.policyTv,
      decisionChanged: this.selection.decisionChanged,
      costError,
    });

    const point: SeriesPoint = {
      t: this.tick,
      energy: sample.energy,
      energyEstimate: self?.energyEstimate ?? null,
      fatigue: this.physical.fatigue,
      fatigueEstimate: self?.fatigueEstimate ?? null,
      selfStateError: sample.selfStateError,
      sensorStateError: sample.sensorStateError,
      selfPredictionError: sample.selfPredictionError,
      worldAccuracy: this.tracker.worldAccuracy(),
      selfStateAccuracy: this.tracker.selfStateAccuracy(),
      selfPredictionAccuracy: this.tracker.selfPredictionAccuracy(),
      selfInfluence: sample.selfInfluence,
      metaTrust: trust,
      metaErrorEMA: meta?.errorEMA ?? null,
      selfConfidence: self?.confidence ?? null,
      predictionErrorEMA: self?.predictionErrorEMA ?? null,
      learningRate,
      priorWeight,
      action: sample.action,
      reward: this.lastOutcome ? this.lastOutcome.energyAfter - this.lastOutcome.energyBefore : 0,
      resources: this.physical.resourcesCollected,
      alive: this.physical.alive,
      survivalHorizon: self?.survivalHorizon ?? null,
      effectiveCost,
      movementCostEstimate: self?.movementCost ?? null,
      selfCostError: costError,
      policyTv: this.selection.policyTv,
      decisionChanged: this.selection.decisionChanged,
      counterfactualAction: this.selection.counterfactualAction,
      sensedEnergy: this.sensedEnergy,
      predictedSuccess: prediction?.world.pSuccess ?? null,
      predictedCollect: prediction?.world.pCollect ?? null,
      selfPredictedSuccess: prediction?.self?.pSuccess ?? null,
      selfPredictedDelta: prediction?.self?.energyDelta ?? null,
      actualMoved,
      actualCollected,
      actualEnergyDelta,
    };
    this.series.push(point);
    if (this.series.length > this.options.historyLimit) this.series.shift();

    this.detectEvents(sample, priorWeight);

    this.previousSelfError = sample.selfStateError ?? 0;
    this.prevCost = self?.movementCost ?? null;
    this.prevRestGain = self?.restGain ?? null;
    this.prevTrust = trust;
    this.prevLr = self
      ? meta && this.controls.metaFeedback
        ? meta.learningRateMultiplier
        : 1
      : null;
    this.prevPrior = priorWeight;

    this.tick++;
    this.tickSample = null;
    this.postObservation = null;
    // Predictions, selection and the pre-observation are deliberately retained
    // so the dashboard keeps showing the last completed cognitive cycle.
  }

  private detectEvents(sample: TickSample, priorWeight: number): void {
    if (!this.options.recordEvents) return;
    this.costCooldown = Math.max(0, this.costCooldown - 1);
    this.restCooldown = Math.max(0, this.restCooldown - 1);
    this.trustCooldown = Math.max(0, this.trustCooldown - 1);
    this.lrCooldown = Math.max(0, this.lrCooldown - 1);
    this.priorCooldown = Math.max(0, this.priorCooldown - 1);
    this.eventCooldown = Math.max(0, this.eventCooldown - 1);
    this.adaptationCooldown = Math.max(0, this.adaptationCooldown - 1);

    const self = this.agent.selfModel;
    const meta = this.agent.metaModel;
    const outcome = this.lastOutcome;

    if (outcome) {
      if (outcome.action === "REST") {
        if (
          outcome.fatigueBefore > 0.5 &&
          outcome.energyGained > 0.05 &&
          this.eventCooldown === 0 &&
          this.restCooldown === 0
        ) {
          this.emit("action", outcomeText(outcome) ?? "Rested.");
          this.restCooldown = 14;
        }
      } else {
        const text = outcomeText(outcome);
        if (text) {
          this.emit(outcome.collected ? "env" : "action", text);
        }
      }
    }

    const energyThresholds = [60, 35, 20, 8];
    for (const threshold of energyThresholds) {
      if (this.physical.energy < threshold && !this.energyFlags.has(threshold)) {
        this.energyFlags.add(threshold);
        this.emit("risk", energyThresholdText(threshold, this.physical.energy));
      } else if (this.physical.energy > threshold + 5) {
        this.energyFlags.delete(threshold);
      }
    }

    if (this.physical.fatigue > 0.55 && !this.highFatigue) {
      this.highFatigue = true;
      this.emit("risk", fatigueText(this.physical.fatigue, "above"));
    }
    if (this.physical.fatigue > 0.8 && !this.criticalFatigue) {
      this.criticalFatigue = true;
      this.emit("risk", fatigueText(this.physical.fatigue, "above"));
    }
    if (this.physical.fatigue < 0.35) {
      if (this.highFatigue) this.emit("risk", fatigueText(this.physical.fatigue, "below"));
      this.highFatigue = false;
      this.criticalFatigue = false;
    }

    if (self) {
      const cost = self.movementCost;
      if (
        this.prevCost !== null &&
        Math.abs(cost - this.prevCost) > 0.12 &&
        this.costCooldown === 0
      ) {
        const reason = this.lastSignal?.slipped
          ? "after a slip"
          : this.lastSignal?.blocked
            ? "after a blocked attempt"
            : this.lastSignal?.collected
              ? "after a resource collection"
              : "after a movement sample";
        this.emit("model", costRevisionText(this.prevCost, cost, reason));
        this.costCooldown = 7;
      }
      if (
        this.prevRestGain !== null &&
        Math.abs(self.restGain - this.prevRestGain) > 0.12 &&
        this.restCooldown === 0
      ) {
        this.emit("model", restRevisionText(this.prevRestGain, self.restGain));
        this.restCooldown = 8;
      }
      if (
        sample.selfStateError !== null &&
        sample.selfStateError > 8 &&
        this.previousSelfError <= 8 &&
        this.eventCooldown === 0
      ) {
        this.emit(
          "model",
          selfErrorText(self.energyEstimate, this.physical.energy, sample.selfStateError),
        );
        this.eventCooldown = 12;
      }
    }

    if (meta && this.prevTrust !== null) {
      if (Math.abs(meta.trust - this.prevTrust) > 0.06 && this.trustCooldown === 0) {
        this.emit(
          "meta",
          trustText(this.prevTrust, meta.trust, sample.metaError ?? meta.errorEMA),
        );
        this.trustCooldown = 6;
      }
      if (this.prevLr !== null) {
        if (Math.abs(meta.learningRateMultiplier - this.prevLr) > 0.12 && this.lrCooldown === 0) {
          this.emit(
            "meta",
            plasticityText(this.prevLr, meta.learningRateMultiplier, meta.trust),
          );
          this.lrCooldown = 8;
        }
      }
      if (this.prevPrior !== null) {
        if (Math.abs(priorWeight - this.prevPrior) > 0.05 && this.priorCooldown === 0) {
          this.emit("meta", priorText(priorWeight, meta.trust));
          this.priorCooldown = 8;
        }
      }
    }

    if (this.tracker.adaptation() > 0.18 && this.adaptationCooldown === 0) {
      const mix = this.tracker.actionMix();
      const dominant = (Object.entries(mix) as [Action, number][]).sort((a, b) => b[1] - a[1])[0][0];
      this.emit("action", adaptationText(this.tracker.adaptation(), dominant));
      this.adaptationCooldown = 22;
    }

    if (!this.physical.alive && this.lastOutcome) {
      this.emit("risk", deathText(this.lastOutcome, this.tick + 1));
    }
  }

  private readInteroception(): { value: number; noise: number; stale: boolean } {
    const noise = this.senseRng.gaussian() * INTEROCEPTION.noiseSigma;
    const stale = this.lastSensed !== null && this.senseRng.chance(INTEROCEPTION.staleChance);
    const trueEnergy = this.physical.energy;
    const value = stale && this.lastSensed ? this.lastSensed.value : clamp(trueEnergy + noise, 0, 112);
    const reading = { value, noise: value - trueEnergy, stale };
    this.lastSensed = reading;
    return reading;
  }

  private emit(kind: SimEvent["kind"], text: string): void {
    if (!this.options.recordEvents) return;
    this.events.push({ id: this.nextEventId++, tick: this.tick, kind, text });
    if (this.events.length > 500) this.events.shift();
  }

  // ── Readout ─────────────────────────────────────────────────────────────

  getSnapshot(): EngineSnapshot {
    const self = this.agent.selfModel;
    const learningRate = this.agent.effectiveLearningRate(this.controls);
    const metrics: EngineMetrics = this.tracker.snapshot({
      survival: this.tick,
      resources: this.physical.resourcesCollected,
      distance: this.physical.distance,
    });
    return {
      seed: this.seed,
      mode: this.mode,
      tick: this.tick,
      phase: this.phase,
      phaseName: PHASES[this.phase].name,
      phaseDescription: PHASES[this.phase].description,
      alive: this.physical.alive,
      options: { ...this.options },
      physical: { ...this.physical },
      sensedEnergy: this.sensedEnergy,
      energyNoise: this.sensedNoise,
      staleReading: this.staleReading,
      observation: this.preObservation,
      predictions: this.predictions?.actions ?? [],
      selection: this.selection,
      worldModel: this.agent.worldModel.snapshot(),
      selfModel: self ? self.snapshot(learningRate) : null,
      metaModel: this.agent.metaSnapshot(this.controls),
      metrics,
      actionMix: this.tracker.actionMix(),
      lastOutcome: this.lastOutcome,
      memorySize: this.agent.memory.size,
      eventCount: this.events.length,
    };
  }

  getSeries(): readonly SeriesPoint[] {
    return this.series;
  }

  getEvents(): readonly SimEvent[] {
    return this.events;
  }

  getTick(): number {
    return this.tick;
  }

  getPhase(): number {
    return this.phase;
  }

  getCurrentLearningRate(): number {
    return this.agent.effectiveLearningRate(this.controls);
  }

  getCurrentPriorWeight(): number {
    return this.agent.effectivePriorWeight(this.controls);
  }

  getRenderState(): RenderState {
    const prediction: ActionPrediction | null =
      this.selection && this.predictions
        ? (this.predictions.actions[this.selection.actionIndex] ?? null)
        : null;
    return {
      tick: this.tick,
      cells: this.world.renderCells(this.tick),
      agent: {
        x: this.physical.x,
        y: this.physical.y,
        alive: this.physical.alive,
        energy: this.physical.energy,
        fatigue: this.physical.fatigue,
        lastAction: this.physical.lastAction,
        effectiveCost: this.physical.effectiveCost,
        effectiveSuccess: this.physical.effectiveSuccess,
      },
      target: prediction ? prediction.features.target : null,
      selectedAction: this.selection?.action ?? null,
      phase: this.phase,
    };
  }
}
