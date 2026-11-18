import { clamp, softmax } from "../math";
import type { Rng } from "../rng";
import { perceive } from "../agent/perception/perception";
import { Memory } from "../agent/memory/memory";
import {
  ACTIONS,
  type Action,
  type Observation,
  type OutcomeSignal,
} from "../types";
import { FailureAttributor } from "./attribution";
import { EXPLORATION, META } from "./config";
import { LearnedMetaModel } from "./metaModel";
import { SelfModelV02 } from "./selfModel";
import { WorldModelV02 } from "./worldModel";
import type {
  MetaContext,
  MetaPrediction,
  PriorRegime,
  V02Observation,
  V02Selection,
  ActionPrediction,
  ObservableStepOutcome,
} from "./types";

export class V02Agent {
  readonly worldModel: WorldModelV02;
  readonly selfModel: SelfModelV02;
  readonly metaModel = new LearnedMetaModel();
  readonly memory = new Memory(160);
  readonly attributor = new FailureAttributor();
  private lastPerception: ReturnType<typeof perceive> | null = null;
  private lastPredictions: ActionPrediction[] = [];
  private lastContexts = new Map<Action, MetaContext>();
  private lastMeta = new Map<Action, MetaPrediction>();
  private lastSelectedContext: MetaContext | null = null;
  private lastSelectedPrediction: ActionPrediction | null = null;
  private lastInfoGain = 0;
  private readonly worldModelEnabled: boolean;
  private readonly worldLearning: boolean;
  private readonly selfLearning: boolean;
  private readonly selfFeedback: boolean;
  private readonly metaFeedback: boolean;
  private readonly metaLearning: boolean;

  constructor(
    priorRegime: PriorRegime,
    rng: Rng,
    options: {
      worldModelEnabled?: boolean;
      worldLearning?: boolean;
      selfLearning?: boolean;
      selfFeedback?: boolean;
      metaFeedback?: boolean;
      metaLearning?: boolean;
    } = {},
  ) {
    this.worldModel = new WorldModelV02(rng, priorRegime);
    this.selfModel = new SelfModelV02(rng, priorRegime);
    this.worldModelEnabled = options.worldModelEnabled ?? true;
    this.worldLearning = options.worldLearning ?? true;
    this.selfLearning = options.selfLearning ?? true;
    this.selfFeedback = options.selfFeedback ?? true;
    this.metaFeedback = options.metaFeedback ?? true;
    this.metaLearning = options.metaLearning ?? true;
  }

  observePre(observation: V02Observation, priorWeight: number): void {
    if (!this.selfLearning) {
      this.selfModel.initialise(observation);
      return;
    }
    this.selfModel.observePre(observation, priorWeight);
  }

  perceived(observation: V02Observation): ReturnType<typeof perceive> {
    // Perception only reads local cells, position and a numeric reading. The
    // legacy sensor field is populated with the energy channel for feature
    // construction; no latent state is included.
    const legacy: Observation = {
      tick: observation.tick,
      x: observation.x,
      y: observation.y,
      radius: observation.radius,
      local: observation.local,
      sensedEnergy: observation.energyReading,
      lastOutcome: observation.lastOutcome,
    };
    const record = perceive(legacy);
    this.lastPerception = record;
    return record;
  }

  predict(record: ReturnType<typeof perceive>): ActionPrediction[] {
    const self = this.selfModel;
    const recent = this.recentErrorStats();
    const predictions = ACTIONS.map((action, actionIndex) => {
      const features = record.features[action];
      const world = this.worldModelEnabled
        ? this.worldModel.predict(features)
        : {
            pSuccess: features.action === "REST" ? 1 : 0.5,
            pCollect: features.action === "REST" ? 0 : 0.05,
            pCollision: features.action === "REST" ? 0 : 0.2,
          };
      const selfPrediction = self.predict(features);
      const energyBin = clamp(Math.floor(self.energyEstimate / 25), 0, 3);
      const fatigueBin = clamp(Math.floor(self.fatigue * 3), 0, 2);
      const statsChannels = this.attributor.stats();
      const sensorDisagreement =
        Math.abs(self.lastInnovation) / 6 +
        Math.abs(statsChannels.strainResidualEma) * 3 +
        Math.abs(statsChannels.effortResidualEma) / 2;
      const context: MetaContext = {
        action,
        features: [],
        energyBin,
        fatigueBin,
        count: 0,
        sensorDisagreement,
        lastInnovation: self.lastInnovation,
        recentAbsError: recent.abs,
        recentSignedBias: recent.signed,
        recentVolatility: recent.volatility,
        timeSinceRest: this.timeSinceRest(),
        slipRate: self.slipRate,
      };
      const meta = this.metaModel.predict(context);
      this.lastContexts.set(action, context);
      this.lastMeta.set(action, meta);
      return {
        action,
        actionIndex,
        features,
        world,
        self: selfPrediction,
        meta,
        context,
      };
    });
    this.lastPredictions = predictions;
    return predictions;
  }

  private recentErrorStats(): { abs: number; signed: number; volatility: number } {
    const entries = this.memory.all.slice(-20);
    if (entries.length === 0) return { abs: 0.4, signed: 0, volatility: 0.2 };
    const abs = entries.reduce((acc, e) => acc + Math.abs(e.selfPredictedDelta - e.sensedEnergyDelta), 0) / entries.length;
    const signed =
      entries.reduce((acc, e) => acc + (e.selfPredictedDelta - e.sensedEnergyDelta), 0) / entries.length;
    const volatility =
      entries.reduce(
        (acc, e) => acc + Math.abs(Math.abs(e.selfPredictedDelta - e.sensedEnergyDelta) - abs),
        0,
      ) / entries.length;
    return { abs, signed, volatility };
  }

  private timeSinceRest(): number {
    let count = 0;
    for (let i = this.memory.all.length - 1; i >= 0; i--) {
      if (this.memory.all[i].action === "REST") break;
      count++;
    }
    return count;
  }

  select(
    predictions: ActionPrediction[],
    sensedEnergy: number,
    random: number,
    explorationMode: "pragmatic" | "random" | "uncertainty" | "voi",
    lambda: number,
  ): V02Selection {
    const pragmatic: number[] = [];
    const info: number[] = [];
    const lowEnergy = Math.max(0, 30 - sensedEnergy);
    for (const prediction of predictions) {
      const world = prediction.world;
      const self = prediction.self;
      const meta = prediction.meta;
      let base = 0;
      if (prediction.action !== "REST") {
        base += world.pCollect * EXPLORATION.pragmaticCollectValue;
        base += world.pSuccess * EXPLORATION.pragmaticMoveValue;
        base -= world.pCollision * EXPLORATION.pragmaticCollisionPenalty;
        base += this.memory.stats(prediction.features.target).novelty * EXPLORATION.pragmaticNoveltyValue;
        base -= lowEnergy * 0.55;
      } else {
        base += lowEnergy * 1.35;
      }
      if (this.selfModel.fatigue > 0.72) {
        base += prediction.action === "REST" ? 4.2 : -2.2;
      }
      const nextEnergy = this.selfModel.energyEstimate + self.energyDelta;
      const risk =
        nextEnergy < EXPLORATION.riskThreshold
          ? -(EXPLORATION.riskThreshold - nextEnergy) * EXPLORATION.riskPenalty
          : 0;
      const selfTerm =
        self.energyDelta * EXPLORATION.selfEnergyValue -
        self.fatigueDelta * EXPLORATION.selfFatigueValue +
        self.pSuccess * EXPLORATION.selfSuccessValue +
        risk;
      const influence = this.metaFeedback ? meta.influence : 1;
      base += selfTerm * influence * (this.selfFeedback ? 1 : 0);
      pragmatic.push(base);

      const unsafe =
        nextEnergy < EXPLORATION.infoSafetyEnergy ||
        self.fatigueNext > EXPLORATION.infoSafetyFatigue;
      let infoValue = 0;
      if (!unsafe) {
        infoValue = meta.uncertainty;
        if (explorationMode === "voi") {
          const best = Math.max(...predictions.map((p) => {
            const w = p.world;
            return w.pCollect * EXPLORATION.pragmaticCollectValue + w.pSuccess;
          }));
          const relevance = 1 + Math.abs(base - best) * 0.12;
          infoValue *= relevance;
        }
      }
      info.push(infoValue);
    }

    const modeLambda = explorationMode === "pragmatic" ? 0 : lambda;
    const utilities = pragmatic.map((v, i) => v + modeLambda * info[i]);
    const probabilities = softmax(utilities, 0.72);
    const pragmaticProbabilities = softmax(pragmatic, 0.72);
    const actionIndex = sampleIndex(probabilities, random);
    let pragmaticActionIndex = 0;
    for (let i = 1; i < pragmaticProbabilities.length; i++) {
      if (pragmaticProbabilities[i] > pragmaticProbabilities[pragmaticActionIndex]) {
        pragmaticActionIndex = i;
      }
    }
    let randomized = false;
    let finalIndex = actionIndex;
    if (explorationMode === "random" && random < EXPLORATION.randomEpsilon) {
      // consume the same deterministic uniform for a legal pseudo-random action
      finalIndex = Math.floor((random / EXPLORATION.randomEpsilon) * predictions.length) % predictions.length;
      randomized = true;
    }
    const selected = predictions[finalIndex];
    this.lastSelectedContext = selected.context;
    this.lastSelectedPrediction = selected;
    this.selfModel.setIntention(selected.action, selected.self.energyDelta);

    return {
      action: selected.action,
      actionIndex: finalIndex,
      utilities,
      pragmaticUtilities: pragmatic,
      informationValues: info,
      probabilities,
      pragmaticAction: predictions[pragmaticActionIndex].action,
      randomized,
      infoGainEstimate: info[finalIndex],
      voiEstimate: explorationMode === "voi" ? info[finalIndex] * modeLambda : 0,
      safetyBlocked: info.filter((v) => v === 0).length,
    };
  }

  learnWorld(outcome: ObservableStepOutcome): void {
    if (!this.worldModelEnabled || !this.worldLearning) return;
    const prediction = this.lastSelectedPrediction;
    if (!prediction) return;
    this.worldModel.learn(prediction.features, {
      moved: outcome.moved,
      blocked: outcome.blocked,
      collected: outcome.collected,
    });
    this.worldModel.learnFromObservation(prediction.features);
  }

  learnSelf(
    outcome: ObservableStepOutcome,
    post: V02Observation,
    preEnergyReading: number,
    rateScale: number,
  ): { observedError: number; signedError: number; withinTolerance: boolean } {
    const prediction = this.lastSelectedPrediction;
    if (!prediction) {
      return { observedError: 0, signedError: 0, withinTolerance: true };
    }
    const sensedDelta = post.energyReading - preEnergyReading;
    const predictedDelta = prediction.self.energyDelta;
    const signedError = predictedDelta - sensedDelta;
    const observedError = Math.abs(signedError) / (Math.abs(sensedDelta) + META.errorScale);
    if (this.selfLearning) {
      this.selfModel.learnOutcome(
        outcome,
        prediction.features,
        post,
        preEnergyReading,
        rateScale,
      );
    }
    return {
      observedError,
      signedError,
      withinTolerance: observedError <= META.tolerance,
    };
  }

  learnMeta(
    outcome: ObservableStepOutcome,
    post: V02Observation,
    preEnergyReading: number,
    observedError: number,
    signedError: number,
    withinTolerance: boolean,
  ): void {
    const prediction = this.lastSelectedPrediction;
    const context = this.lastSelectedContext;
    if (!prediction || !context) return;
    const metaBefore = prediction.meta;
    if (this.metaLearning) {
      this.metaModel.update(context, observedError, signedError, withinTolerance);
    }
    this.attributor.update({
      energyInnovation: this.selfModel.lastInnovation,
      strainResidual:
        post.strainReading - (this.selfModel.fatigue - this.selfModel.fatigueBias),
      effortResidual:
        outcome.action === "REST" ? null : outcome.effortReading - this.selfModel.movementCost,
      slipped: outcome.slipped,
      predictedSuccess: prediction.self.pSuccess,
      energyBias: this.selfModel.energyBias,
      energyVariance: this.selfModel.energyNoiseVariance,
    });
    const after = this.metaModel.predict(context);
    this.lastInfoGain = Math.max(0, metaBefore.uncertainty - after.uncertainty);

    const sensedDelta = post.energyReading - preEnergyReading;
    const signal: OutcomeSignal = {
      action: outcome.action,
      moved: outcome.moved,
      blocked: outcome.blocked,
      slipped: outcome.slipped,
      collected: outcome.collected,
    };
    const successLabel = outcome.action === "REST" ? true : outcome.moved;
    this.memory.push({
      tick: post.tick,
      action: outcome.action,
      outcome: signal,
      observation: {
        x: this.lastPerception?.observation.x ?? post.x,
        y: this.lastPerception?.observation.y ?? post.y,
        local: (this.lastPerception?.observation.local ?? post.local).slice(),
      },
      sensedEnergy: post.energyReading,
      sensedEnergyDelta: sensedDelta,
      selfPredictedDelta: prediction.self.energyDelta,
      selfPredictedSuccess: prediction.self.pSuccess,
      worldPredictedSuccess: prediction.world.pSuccess,
      selfEnergyError: Math.abs(prediction.self.energyDelta - sensedDelta),
      selfSuccessError: Math.abs(prediction.self.pSuccess - (successLabel ? 1 : 0)),
      worldSuccessError: Math.abs(prediction.world.pSuccess - (successLabel ? 1 : 0)),
      target: prediction.features.target,
    });
  }

  get infoGain(): number {
    return this.lastInfoGain;
  }

  selectedContext(): MetaContext | null {
    return this.lastSelectedContext;
  }

  get selectedMeta(): MetaPrediction | null {
    return this.lastMeta.get(this.lastSelectedPrediction?.action ?? "REST") ?? null;
  }

  get selectedPrediction(): ActionPrediction | null {
    return this.lastSelectedPrediction;
  }

  get predictions(): ActionPrediction[] {
    return this.lastPredictions;
  }

  get contexts(): Map<Action, MetaContext> {
    return this.lastContexts;
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
