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
import { TemporalAttributor } from "./attribution";
import { AttentionSchema } from "./attentionSchema";
import { EXPLORATION, META } from "./config";
import { ResidualMetaModel } from "./metaModel";
import { SelfModelV04 } from "./selfModel";
import { WorldModelV04 } from "./worldModel";
import type {
  MetaContext,
  MetaPrediction,
  PriorRegime,
  V04Observation,
  V04Selection,
  ActionPrediction,
  ObservableStepOutcome,
} from "./types";

export class V04Agent {
  readonly worldModel: WorldModelV04;
  readonly selfModel: SelfModelV04;
  readonly metaModel = new ResidualMetaModel();
  /**
   * Non-controlling copy of the meta-model. It trains on exactly the same
   * observations but its outputs never influence action selection or the
   * precision filter, so its predictive validity can be measured without the
   * control-feedback artefact (a high failure estimate opens the filter, which
   * changes the very errors being predicted).
   */
  readonly shadowMeta = new ResidualMetaModel();
  shadowFailure = 0.5;
  readonly memory = new Memory(160);
  readonly attributor = new TemporalAttributor();
  readonly attention = new AttentionSchema();
  private lastPerception: ReturnType<typeof perceive> | null = null;
  private lastPredictions: ActionPrediction[] = [];
  private lastContexts = new Map<Action, MetaContext>();
  private lastMeta = new Map<Action, MetaPrediction>();
  private lastSelectedContext: MetaContext | null = null;
  private lastSelectedPrediction: ActionPrediction | null = null;
  private lastSelection: V04Selection | null = null;
  private lastInfoGain = 0;
  private readonly worldModelEnabled: boolean;
  private readonly worldLearning: boolean;
  private readonly selfLearning: boolean;
  private readonly selfFeedback: boolean;
  private readonly metaFeedback: boolean;
  private readonly metaLearning: boolean;
  private readonly riskControl: boolean;
  private readonly preparation: boolean;
  private readonly preparationStrength: number;

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
      riskControl?: boolean;
      residualMeta?: boolean;
      preparation?: boolean;
      preparationStrength?: number;
      attentionSchema?: boolean;
      precisionSuppression?: number;
    } = {},
  ) {
    this.worldModel = new WorldModelV04(rng, priorRegime);
    this.selfModel = new SelfModelV04(rng, priorRegime, options.precisionSuppression ?? 1);
    this.worldModelEnabled = options.worldModelEnabled ?? true;
    this.worldLearning = options.worldLearning ?? true;
    this.selfLearning = options.selfLearning ?? true;
    this.selfFeedback = options.selfFeedback ?? true;
    this.metaFeedback = options.metaFeedback ?? true;
    this.metaLearning = options.metaLearning ?? true;
    this.riskControl = options.riskControl ?? true;
    this.preparation = options.preparation ?? true;
    this.preparationStrength = options.preparationStrength ?? 1;
    this.metaModel.residualEnabled = options.residualMeta ?? true;
    this.attention.enabled = options.attentionSchema ?? true;
  }

  observePre(observation: V04Observation, priorWeight: number): void {
    if (!this.selfLearning) {
      this.selfModel.initialise(observation);
      return;
    }
    const failure = this.lastSelectedPrediction?.meta.failureProbability ?? 0.5;
    this.selfModel.observePre(
      observation,
      priorWeight,
      failure,
      this.attention.enabled ? this.attention.recovery : 0,
    );
  }

  perceived(observation: V04Observation): ReturnType<typeof perceive> {
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
      const rawWorld = this.worldModelEnabled ? this.worldModel.predict(features) : null;
      const world = rawWorld
        ? this.blendWorld(rawWorld, features.action)
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
        roughTarget: features.resourceAtTarget,
        roughEvidence: self.roughObservations,
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

  /**
   * Accuracy-weighted world-model integration.
   *
   * A learned world model only earns influence over a neutral prior to the
   * extent that its predictions show Brier skill against the outcome base
   * rate. With zero skill the agent behaves exactly like the no-world
   * baseline instead of acting on miscalibrated predictions.
   */
  private blendWorld(
    prediction: { pSuccess: number; pCollect: number; pCollision: number },
    action: Action,
  ): { pSuccess: number; pCollect: number; pCollision: number } {
    if (action === "REST") return prediction;
    const skill = this.worldModel.skill();
    const gain = (value: number): number => Math.sqrt(clamp(value, 0, 1));
    const collect = clamp(0.05 + gain(skill.collect) * (prediction.pCollect - 0.05), 0, 1);
    const success = clamp(0.5 + gain(skill.success) * (prediction.pSuccess - 0.5), 0, 1);
    const collision = clamp(0.2 + gain(skill.collision) * (prediction.pCollision - 0.2), 0, 1);
    return {
      pSuccess: success,
      pCollect: collect,
      pCollision: collision,
    };
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
  ): V04Selection {
    const pragmatic: number[] = [];
    const info: number[] = [];
    const lowEnergy = Math.max(0, 30 - sensedEnergy);
    let blockedProbeValue = 0;
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
      const nearCliff =
        this.selfModel.energyEstimate < 20 ||
        self.fatigueNext > 0.62;
      const riskActive = this.metaFeedback && this.riskControl;
      const correctedDelta = riskActive
        ? self.energyDelta + meta.biasCorrection
        : self.energyDelta;
      const evaluatedDelta =
        riskActive && nearCliff
          ? correctedDelta - 0.35 * meta.errorBound
          : correctedDelta + (riskActive ? 0.1 * meta.errorBound : 0);
      const nextEnergy = this.selfModel.energyEstimate + evaluatedDelta;
      const risk =
        nextEnergy < EXPLORATION.riskThreshold
          ? -(EXPLORATION.riskThreshold - nextEnergy) * EXPLORATION.riskPenalty
          : 0;
      const selfTerm =
        evaluatedDelta * EXPLORATION.selfEnergyValue -
        self.fatigueDelta * EXPLORATION.selfFatigueValue +
        self.pSuccess * EXPLORATION.selfSuccessValue +
        risk;
      const influence = this.metaFeedback ? meta.influence : 1;
      base += selfTerm * influence * (this.selfFeedback ? 1 : 0);
      pragmatic.push(base);

      const unsafe =
        this.selfModel.energyEstimate + self.energyDelta <
          EXPLORATION.infoSafetyEnergy ||
        self.fatigueNext > EXPLORATION.infoSafetyFatigue;
      let infoValue = 0;
      if (!unsafe) {
        infoValue = meta.uncertainty;
        if (explorationMode === "voi") {
          // Decision value of information: probe contexts whose predicted
          // outcome is costly but uncertain. Without this term a pessimistic
          // self-belief makes exploration look worthless precisely where it
          // matters most. Uncertainty itself decays as the context is
          // sampled, so the bonus is self-liquidating.
          const stake = Math.max(0, -self.energyDelta) * EXPLORATION.selfEnergyValue;
          infoValue = meta.uncertainty * (0.5 + stake);
        }
      } else if (
        this.preparation &&
        explorationMode === "voi" &&
        prediction.features.resourceAtTarget
      ) {
        // Epistemic preparation: the diagnostic probe is currently blocked by
        // the safety envelope. Record the value that is being deferred so it
        // can be transferred to preparatory actions (V0.4).
        const stake = Math.max(0, -self.energyDelta) * EXPLORATION.selfEnergyValue;
        blockedProbeValue = Math.max(
          blockedProbeValue,
          meta.uncertainty * (0.5 + stake),
        );
      }
      info.push(infoValue);
    }

    if (blockedProbeValue > 0) {
      // Transfer deferred epistemic value to REST so the agent actively
      // prepares (recovers energy / relieves fatigue) instead of abandoning
      // the experiment. The transfer is self-limiting: once the probe becomes
      // safe, blockedProbeValue is zero and the bonus disappears.
      const restIndex = predictions.findIndex((p) => p.action === "REST");
      if (restIndex >= 0) {
        info[restIndex] += blockedProbeValue * 3 * this.preparationStrength;
      }
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

    const selection: V04Selection = {
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
      preparationValue: blockedProbeValue,
    };
    this.lastSelection = selection;
    return selection;
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
    post: V04Observation,
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
    post: V04Observation,
    preEnergyReading: number,
    observedError: number,
    signedError: number,
    multiStepError: number,
    _withinTolerance: boolean,
  ): void {
    const prediction = this.lastSelectedPrediction;
    const context = this.lastSelectedContext;
    if (!prediction || !context) return;
    const metaBefore = prediction.meta;
    const channelsBefore = this.attributor.stats();
    const energyBiasRatio =
      Math.abs(channelsBefore.energyInnovationEma) /
      (this.selfModel.energyVariance + META.errorScale);
    const strainBiasRatio = Math.abs(channelsBefore.strainResidualEma) / 0.5;
    const effortBiasRatio = Math.abs(channelsBefore.effortResidualEma) / 2;
    const crossChannelBias =
      energyBiasRatio + 0.5 * strainBiasRatio + 0.3 * effortBiasRatio;
    if (this.metaLearning) {
      const absDelta = Math.abs(post.energyReading - preEnergyReading);
      this.shadowFailure = this.shadowMeta.predict(context).failureProbability;
      this.shadowMeta.update(
        context,
        observedError,
        signedError,
        absDelta,
        crossChannelBias,
        multiStepError,
      );
      this.metaModel.update(
        context,
        observedError,
        signedError,
        absDelta,
        crossChannelBias,
        multiStepError,
      );
    }
    this.attributor.update({
      action: outcome.action,
      energyInnovation: this.selfModel.lastInnovation,
      strainResidual:
        post.strainReading - (this.selfModel.fatigue - this.selfModel.fatigueBias),
      effortResidual:
        outcome.action === "REST"
          ? null
          : outcome.effortReading -
            (outcome.terrainRough ? this.selfModel.roughCost : this.selfModel.movementCost),
      slipped: outcome.slipped,
      predictedSuccess: prediction.self.pSuccess,
      energyBias: this.selfModel.energyBias,
      energyVariance: this.selfModel.energyNoiseVariance,
    });
    const after = this.metaModel.predict(context);
    this.lastInfoGain = Math.max(0, metaBefore.uncertainty - after.uncertainty);

    // AST-1: update the schema from the *observable* precision allocation and
    // the observed error. `energy` is the sensor share of the posterior gain,
    // `prior` its complement, `strain` the corroborating-channel gain, `world`
    // the learned world model's demonstrated skill, and `epistemic` the
    // deferred probe value that was transferred to preparation.
    const self = this.selfModel;
    const worldSkill = this.worldModelEnabled ? this.worldModel.skill().collect : 0;
    const preparationValue = this.lastSelection?.preparationValue ?? 0;
    const cliffPressure = clamp(
      (20 - self.energyEstimate) / 20 + Math.max(0, self.fatigue - 0.7) * 2,
      0,
      1,
    );
    this.attention.update({
      energy: self.precisionGain,
      strain: 0.28 + 0.4 * clamp(self.instantDisagreement, 0, 1),
      prior: 1 - self.precisionGain,
      world: clamp(worldSkill, 0, 1),
      epistemic: clamp(preparationValue / 5, 0, 1),
      observedError,
      disagreement: self.instantDisagreement,
      cliff: cliffPressure,
    });

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

  /**
   * Targeted plasticity routing from observable attribution. Physical shifts
   * are opportunities to learn; individual sensor shifts should not corrupt
   * first-order weights while the channel is unreliable.
   */
  plasticityScale(): number {
    if (!this.riskControl) return 1;
    const kind = this.attributor.scores().top;
    if (kind === "physical") return 1.3;
    if (kind === "energy_sensor" || kind === "fatigue_sensor") return 0.6;
    if (kind === "shared") return 0.7;
    return 1;
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
