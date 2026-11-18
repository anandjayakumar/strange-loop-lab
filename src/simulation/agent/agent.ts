import { LEARNING, SELECTION } from "../config";
import { clamp, softmax } from "../math";
import {
  ACTIONS,
  type Action,
  type ActionFeatures,
  type ActionPrediction,
  type MemoryStats,
  type Mode,
  type Observation,
  type OutcomeSignal,
  type PerceptionRecord,
  type PredictionSet,
  type Selection,
  type MetaModelSnapshot,
  type ResearchOptions,
  type WorldPrediction,
} from "../types";
import { Memory, type MemoryEntry } from "./memory/memory";
import { perceive } from "./perception/perception";
import { SelfModel, type SelfLearnInput } from "./self-model/selfModel";
import { MetaModel } from "./meta-model/metaModel";
import { WorldModel } from "./world-model/worldModel";

export interface RuntimeControls {
  selfFeedback: boolean;
  metaFeedback: boolean;
  plasticity: boolean;
  priorWeighting: boolean;
}

export class Agent {
  readonly mode: Mode;
  readonly worldModel = new WorldModel();
  readonly selfModel: SelfModel | null;
  readonly metaModel: MetaModel | null;
  readonly memory = new Memory(160);
  private readonly research: ResearchOptions;
  private lastStats = new Map<Action, MemoryStats>();
  private lastPerception: PerceptionRecord | null = null;
  private lastPredictions: PredictionSet | null = null;

  constructor(mode: Mode, research: ResearchOptions = {}) {
    this.mode = mode;
    this.research = research;
    this.selfModel =
      mode === "A" ? null : new SelfModel(research.initialSelfModel);
    this.metaModel = mode === "C" ? new MetaModel() : null;
  }

  effectiveLearningRate(controls: RuntimeControls): number {
    if (!this.selfModel) return 0;
    if (
      this.metaModel &&
      controls.metaFeedback &&
      controls.plasticity
    ) {
      return LEARNING.selfRate * this.metaModel.learningRateMultiplier;
    }
    return LEARNING.selfRate;
  }

  effectivePriorWeight(controls: RuntimeControls): number {
    if (!this.selfModel) return 0.5;
    if (this.metaModel && controls.metaFeedback && controls.priorWeighting) {
      return this.metaModel.priorWeight;
    }
    return 0.5;
  }

  /** Phase: sense. Energy belief is advanced with its own last prediction, then corrected. */
  observe(observation: Observation, controls: RuntimeControls): void {
    if (!this.selfModel) return;
    if (this.research.selfLearning === false) {
      this.selfModel.initialise(observation.sensedEnergy);
      return;
    }
    const priorWeight = this.effectivePriorWeight(controls);
    this.selfModel.advanceAndCorrect(
      observation.sensedEnergy,
      controls.priorWeighting && this.mode === "C" && controls.metaFeedback,
      priorWeight,
    );
  }

  perceive(observation: Observation): PerceptionRecord {
    const record = perceive(observation);
    this.lastPerception = record;
    return record;
  }

  statsFor(features: ActionFeatures): MemoryStats {
    const stats = this.memory.stats(features.target);
    this.lastStats.set(features.action, stats);
    return stats;
  }

  learnFromObservation(record: PerceptionRecord): void {
    if (this.research.worldModelEnabled === false || this.research.worldLearning === false) {
      return;
    }
    for (const action of ACTIONS) {
      this.worldModel.learnFromObservation(record.features[action]);
    }
  }

  predict(record: PerceptionRecord): PredictionSet {
    const actions: ActionPrediction[] = ACTIONS.map((action, actionIndex) => {
      const features = record.features[action];
      const stats = this.statsFor(features);
      return {
        action,
        actionIndex,
        features,
        world:
          this.research.worldModelEnabled === false
            ? neutralWorldPrediction(features)
            : this.worldModel.predict(features),
        self: this.selfModel ? this.selfModel.predict(features, stats) : null,
      };
    });
    const set: PredictionSet = { tick: record.observation.tick, actions };
    this.lastPredictions = set;
    return set;
  }

  select(
    predictions: PredictionSet,
    sensedEnergy: number,
    random: number,
    controls: RuntimeControls,
  ): Selection {
    const utilities: number[] = [];
    const baseUtilities: number[] = [];
    const selfTerms: number[] = [];

    const influence =
      !this.selfModel || !controls.selfFeedback
        ? 0
        : this.metaModel && controls.metaFeedback
          ? this.metaModel.trust
          : 1;

    for (const prediction of predictions.actions) {
      const stats = this.statsFor(prediction.features);
      const world = prediction.world;
      const moving = prediction.action !== "REST";

      let base = 0;
      if (moving) {
        base += world.pCollect * SELECTION.collectValue;
        base += world.pSuccess * SELECTION.moveValue;
        base -= world.pCollision * SELECTION.collisionPenalty;
        base += stats.novelty * SELECTION.noveltyValue;
      }

      // Homeostatic fallback present in every mode. It reads only the noisy
      // interoceptive signal, never the physical energy.
      const reactiveRest =
        sensedEnergy < SELECTION.restThreshold
          ? (SELECTION.restThreshold - sensedEnergy) * SELECTION.restUrgency
          : 0;
      if (this.mode === "A" || influence === 0) {
        base += prediction.action === "REST" ? reactiveRest : -SELECTION.nominalMoveCost * 0.5;
      } else {
        base += prediction.action === "REST" ? reactiveRest * 0.25 : 0;
      }

      let selfTerm = 0;
      if (influence > 0 && prediction.self) {
        const self = prediction.self;
        const energyTerm =
          self.energyDelta >= 0
            ? self.energyDelta * 0.45
            : self.energyDelta * 0.9;
        const fatigueTerm = -self.fatigueDelta * 4.5;
        const nextEnergy = (this.selfModel?.energyEstimate ?? sensedEnergy) + self.energyDelta;
        const risk =
          nextEnergy < SELECTION.riskThreshold
            ? -(SELECTION.riskThreshold - nextEnergy) * SELECTION.riskPenalty
            : 0;
        const successTerm = self.pSuccess * 0.8;
        const horizonTerm = Math.min(self.survivalHorizon, 80) * 0.012;
        selfTerm = energyTerm + fatigueTerm + risk + successTerm + horizonTerm;
      }

      const scaledSelf = selfTerm * influence;
      selfTerms.push(scaledSelf);
      utilities.push(base + scaledSelf);
      baseUtilities.push(base);
    }

    const probabilities = softmax(utilities, SELECTION.temperature);
    const probabilitiesWithoutSelf = softmax(baseUtilities, SELECTION.temperature);
    const actionIndex = sampleIndex(probabilities, random);
    const counterfactualActionIndex = sampleIndex(probabilitiesWithoutSelf, random);
    let policyTv = 0;
    for (let i = 0; i < probabilities.length; i++) {
      policyTv += Math.abs(probabilities[i] - probabilitiesWithoutSelf[i]);
    }
    policyTv *= 0.5;
    const selection: Selection = {
      action: ACTIONS[actionIndex],
      actionIndex,
      utilities,
      utilitiesWithoutSelf: baseUtilities,
      probabilities,
      probabilitiesWithoutSelf,
      temperature: SELECTION.temperature,
      selfInfluence: influence,
      selfTerm: selfTerms,
      reasoning:
        influence > 0
          ? `Softmax over world model + self-model at influence ${influence.toFixed(2)}`
          : "Softmax over world model and reactive homeostasis",
      counterfactualAction: ACTIONS[counterfactualActionIndex],
      counterfactualActionIndex,
      decisionChanged: counterfactualActionIndex !== actionIndex,
      policyTv,
    };
    const chosen = predictions.actions[actionIndex];
    if (this.selfModel && chosen.self) {
      this.selfModel.setIntention(selection.action, chosen.self.energyDelta);
    }
    return selection;
  }

  /** Phase: learn after the outcome has been perceived. */
  learnOutcome(
    outcome: OutcomeSignal,
    postObservation: Observation,
    preEnergy: number,
    controls: RuntimeControls,
  ): {
    selfDeltaError: number | null;
    selfBrier: number | null;
    metaError: number | null;
  } {
    const prediction = this.lastPredictions?.actions.find(
      (p) => p.action === outcome.action,
    );
    const perception = this.lastPerception;
    if (!prediction || !perception) {
      return { selfDeltaError: null, selfBrier: null, metaError: null };
    }
    const sensedDelta = postObservation.sensedEnergy - preEnergy;
    // A single raw interoceptive difference is too noisy to judge the self-model
    // by. Filter the post-action reading against the model's own prediction and
    // use the residual innovation for reliability accounting.
    const preview = this.selfModel && prediction.self
      ? this.selfModel.energyEstimate + prediction.self.energyDelta
      : 0;
    const innovation = postObservation.sensedEnergy - preview;

    let selfDeltaError: number | null = null;
    let selfBrier: number | null = null;
    let metaError: number | null = null;

    if (this.selfModel && prediction.self) {
      const success = outcome.action === "REST" ? true : outcome.moved;
      const innovationError = Math.min(1, Math.abs(innovation) / 9);
      const calibration = this.memory.calibrationError(24);
      metaError = 0.7 * innovationError + 0.3 * calibration;

      if (this.research.selfLearning === false) {
        // Frozen-self ablation: the model is still queried and scored, but no
        // coefficient or belief is updated from this outcome.
        selfDeltaError = clamp(
          Math.abs(prediction.self.energyDelta - sensedDelta) /
            (Math.abs(sensedDelta) + 3),
          0,
          1.3,
        );
        selfBrier = (prediction.self.pSuccess - (success ? 1 : 0)) ** 2;
      } else {
        const rateScale =
          this.metaModel && controls.metaFeedback && controls.plasticity
            ? this.metaModel.learningRateMultiplier
            : 1;
        const learnInput: SelfLearnInput = {
          prediction: prediction.self,
          action: outcome.action,
          success,
          collected: outcome.collected,
          slipped: outcome.slipped,
          blocked: outcome.blocked,
          // Learning uses the raw, unbiased (if noisy) interoceptive difference.
          // The filtered delta is only used for the preview innovation.
          sensedEnergyDelta: sensedDelta,
          innovation,
          rateScale,
        };
        const learned = this.selfModel.learn(learnInput);
        this.selfModel.learnSuccess(prediction.features, outcome.moved, rateScale);
        this.selfModel.learnCollect(prediction.features, outcome.collected, rateScale);
        selfDeltaError = learned.deltaError;
        selfBrier = learned.brier;
      }
    }

    const successLabel = outcome.action === "REST" ? 1 : outcome.moved ? 1 : 0;
    const entry: MemoryEntry = {
      tick: postObservation.tick,
      action: outcome.action,
      outcome,
      observation: {
        x: perception.observation.x,
        y: perception.observation.y,
        local: perception.observation.local.slice(),
      },
      sensedEnergy: postObservation.sensedEnergy,
      sensedEnergyDelta: sensedDelta,
      selfPredictedDelta: prediction.self?.energyDelta ?? 0,
      selfPredictedSuccess: prediction.self?.pSuccess ?? 0,
      worldPredictedSuccess: prediction.world.pSuccess,
      selfEnergyError: prediction.self
        ? Math.abs(prediction.self.energyDelta - sensedDelta)
        : null,
      selfSuccessError: prediction.self
        ? Math.abs(prediction.self.pSuccess - successLabel)
        : null,
      worldSuccessError: Math.abs(prediction.world.pSuccess - successLabel),
      target: prediction.features.target,
    };
    this.memory.push(entry);
    return { selfDeltaError, selfBrier, metaError };
  }

  updateMeta(normalizedError: number | null): void {
    if (this.metaModel && normalizedError !== null) {
      this.metaModel.update(normalizedError);
    }
  }

  learnWorld(
    outcome: OutcomeSignal,
  ): { successError: number; collectError: number; collisionError: number } {
    if (this.research.worldModelEnabled === false || this.research.worldLearning === false) {
      return { successError: 0, collectError: 0, collisionError: 0 };
    }
    const prediction = this.lastPredictions?.actions.find(
      (p) => p.action === outcome.action,
    );
    if (!prediction) return { successError: 0, collectError: 0, collisionError: 0 };
    return this.worldModel.learn(prediction.world, outcome.action, outcome);
  }

  metaSnapshot(controls: RuntimeControls): MetaModelSnapshot | null {
    if (!this.metaModel) return null;
    return this.metaModel.snapshot(
      controls.metaFeedback,
      controls.metaFeedback && controls.plasticity,
      controls.metaFeedback && controls.priorWeighting,
    );
  }

  reset(): void {
    this.memory.clear();
    this.selfModel?.reset();
    this.metaModel?.reset();
    this.lastStats.clear();
    this.lastPerception = null;
    this.lastPredictions = null;
    this.worldModel.reset();
  }
}

export function sampleIndex(probabilities: readonly number[], random: number): number {
  let threshold = clamp(random, 0, 0.999999999);
  for (let i = 0; i < probabilities.length; i++) {
    threshold -= probabilities[i];
    if (threshold <= 0) return i;
  }
  return probabilities.length - 1;
}

function neutralWorldPrediction(features: ActionFeatures): WorldPrediction {
  if (features.action === "REST") {
    return {
      pSuccess: 1,
      pCollect: 0,
      pCollision: 0,
      expectedTarget: { ...features.target },
      features: [],
      collectFeatures: [],
      collisionFeatures: [],
    };
  }
  return {
    pSuccess: 0.5,
    pCollect: 0.05,
    pCollision: 0.2,
    expectedTarget: { ...features.target },
    features: [],
    collectFeatures: [],
    collisionFeatures: [],
  };
}
