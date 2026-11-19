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
import { ResidualMetaModel } from "../v05/metaModel";
import type {
  MetaContext,
  MetaPrediction,
  ObservableStepOutcome,
} from "../v05/types";
import { WorldModelV05 } from "../v05/worldModel";
import { AttentionSchemaV06 } from "./attention";
import { V06, V06_META } from "./config";
import { HigherOrderMonitor } from "./higherOrder";
import { buildProposals, type ModuleInput } from "./modules";
import { SelfModelV06 } from "./selfModel";
import { planRollout } from "./selfSim";
import { RecurrentSettler, type SettleResult } from "./settling";
import type {
  Ablation,
  ActionPredictionV06,
  AttentionSnapshot,
  ControlKind,
  ExplorationMode,
  HigherOrderSnapshot,
  ModuleId,
  ModuleProposal,
  PriorRegime,
  QueryPass,
  SelfSimResult,
  V06Observation,
  WorkspaceState,
} from "./types";
import { ignite } from "./workspace";
import { withBroadcast } from "./modules";

export interface AgentSettings {
  control: ControlKind;
  ablation: Ablation;
  lambda: number;
}

export interface V06Decision {
  predictions: ActionPredictionV06[];
  proposals: ModuleProposal[];
  workspace: WorkspaceState;
  query: QueryPass[];
  selfSim: SelfSimResult;
  utilities: number[];
  probabilities: number[];
  action: Action;
  actionIndex: number;
  explorationMode: ExplorationMode;
  uncertainty: number;
  conflict: number;
  settling: SettleResult;
}

function sampleIndex(probabilities: readonly number[], random: number): number {
  let threshold = clamp(random, 0, 0.999999999);
  for (let i = 0; i < probabilities.length; i++) {
    threshold -= probabilities[i];
    if (threshold <= 0) return i;
  }
  return probabilities.length - 1;
}

function meanOf(values: readonly number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

const MODULE_ORDER: ModuleId[] = ["world", "somatic", "meta", "epistemic"];

/**
 * V0.6 agent.
 *
 * Components are deliberately separable so that each ablation removes one
 * causal edge rather than retuning the rest: RPT (settler), AST (attention),
 * GWT (workspace), HOT (higher-order monitor), AE (self-simulation). The
 * first-order self/world models are inherited unchanged from V0.5.
 */
export class V06Agent {
  readonly worldModel: WorldModelV05;
  readonly selfModel: SelfModelV06;
  readonly metaModel = new ResidualMetaModel();
  readonly shadowMeta = new ResidualMetaModel();
  readonly memory = new Memory(160);
  readonly attention = new AttentionSchemaV06();
  readonly higherOrder = new HigherOrderMonitor();
  readonly settler: RecurrentSettler;
  readonly settings: AgentSettings;

  restPlateau = 0;
  private lastPerception: ReturnType<typeof perceive> | null = null;
  private lastPredictions: ActionPredictionV06[] = [];
  private lastContexts = new Map<Action, MetaContext>();
  private lastSelectedContext: MetaContext | null = null;
  private lastSelectedPrediction: ActionPredictionV06 | null = null;
  private lastDecision: V06Decision | null = null;
  private lastSettling: SettleResult | null = null;
  private lastInfoGain = 0;
  private lastUncertainty = 0.55;
  private lastConflict = 0;
  private lastPredictedEnergy: number | null = null;
  private predictedEnergyAfterAction = 0;
  private lastDiagnosticProbe = false;
  private conflictEpisode = false;

  constructor(priorRegime: PriorRegime, rng: Rng, seed: number, settings: AgentSettings) {
    this.worldModel = new WorldModelV05(rng, priorRegime);
    this.selfModel = new SelfModelV06(rng, priorRegime);
    this.settler = new RecurrentSettler(seed);
    this.settings = settings;
    const reflex = settings.control === "reactive" || settings.control === "physical_mpc";
    this.higherOrder.enabled = !reflex && settings.ablation !== "no_hot_meta";
    this.attention.enabled = !reflex && settings.ablation !== "no_ast";
    this.attention.fixedDecay = settings.control === "fixed_decay";
    this.metaModel.residualEnabled = settings.control !== "rolling_tracker";
  }

  // ------------------------------------------------------------------ sense
  settleAndObserve(
    observation: V06Observation,
    conflict: number,
    predictedEnergy: number | null,
  ): SettleResult {
    const self = this.selfModel;
    const energyUncertainty = clamp(
      Math.abs(observation.energyReading - self.energyEstimate) / 16 +
        self.energyVariance / 24,
      0,
      1,
    );
    const strainUncertainty = clamp(
      Math.abs(observation.strainReading - self.fatigue) * 2.4,
      0,
      1,
    );
    const epistemicNeed = clamp(this.lastUncertainty, 0, 1);
    const priorNeed = clamp(1 - this.higherOrder.reliability, 0, 1);
    const allocation = this.attention.allocate({
      energyUncertainty,
      strainUncertainty,
      epistemicNeed,
      priorNeed,
      conflict,
    });

    const passes =
      this.settings.ablation === "no_rpt" || this.settings.control === "reactive"
        ? 1
        : V06.settlePasses;
    const topDownEnabled =
      passes > 1 &&
      this.settings.ablation !== "no_rpt" &&
      this.settings.control !== "matched_feedforward" &&
      this.settings.control !== "reactive";
    const quality = this.higherOrder.quality;
    const settle = this.settler.settle(
      {
        energyReading: observation.energyReading,
        energyEstimate: self.energyEstimate,
        strainReading: observation.strainReading,
        fatigueEstimate: self.fatigue,
        effortReading: observation.lastEffortReading,
        expectedEffort: self.movementCost,
        novelty: clamp(1 - this.higherOrder.reliability, 0, 1),
        topDown: [
          clamp(quality[0], 0, 1),
          clamp(quality[1], 0, 1),
          clamp(quality[2], 0, 1),
          clamp(0.35 + 0.4 * this.lastUncertainty, 0, 1),
        ],
        topDownEnabled,
      },
      passes,
    );
    this.lastSettling = settle;
    this.lastConflict = conflict;
    if (conflict > 0.4) this.conflictEpisode = true;

    self.softMode = passes < 2;
    self.gainScale =
      passes < 2
        ? 1
        : clamp(0.95 - 0.35 * settle.disagreement + 0.1 * settle.convergence, 0.45, 1.1);
    if (this.attention.enabled) {
      // AST-1's allocation is causal: a prior-heavy allocation strengthens
      // top-down influence and discounts the sensory gain, and vice versa.
      self.topDownWeight = 0.01 + 0.04 * allocation.prior;
      self.gainScale *= clamp(0.85 + 0.25 * allocation.energy, 0.7, 1.1);
    }
    if (this.settings.control === "matched_feedforward") {
      // Strictly feedforward: no recurrent gain modulation and no top-down
      // prior. The precision gate remains, but the recurrent refinement is
      // removed.
      self.gainScale = 1;
      self.topDownWeight = 0;
    }
    const priorUseful = this.lastConflict > 0.3;
    self.topDownPrior =
      topDownEnabled && predictedEnergy !== null && priorUseful
        ? clamp(predictedEnergy, observation.energyReading - 12, observation.energyReading + 12)
        : null;
    this.lastPredictedEnergy = predictedEnergy;

    const priorWeight = this.lastSelectedPrediction?.meta.priorWeight ?? 0.5;
    self.observePre(
      observation,
      priorWeight,
      this.higherOrder.reliability,
      this.attention.recovery,
    );
    this.lastUncertainty = clamp(
      0.55 * (1 - this.higherOrder.reliability) + 0.45 * settle.uncertainty,
      0,
      1,
    );
    return settle;
  }

  perceived(observation: V06Observation): ReturnType<typeof perceive> {
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

  // ----------------------------------------------------------------- decide
  /**
   * Stage 1 of a decision: build the prediction table and each module's
   * independent proposal. Cached so the UI can advance one phase at a time.
   */
  stagePropose(
    record: ReturnType<typeof perceive>,
    explorationMode: ExplorationMode,
    lambda: number,
  ): ModuleProposal[] {
    const self = this.selfModel;
    const recent = this.recentErrorStats();
    const channels = this.higherOrder.attributor.stats();
    const sensorDisagreement =
      Math.abs(self.lastInnovation) / 6 +
      Math.abs(channels.strainResidualEma) * 3 +
      Math.abs(channels.effortResidualEma) / 2;
    const control = this.settings.control;
    const ablation = this.settings.ablation;
    if (this.higherOrder.enabled) {
      this.higherOrder.setContext({
        energyVariance: self.energyVariance,
        energyBias: self.energyBias,
        strainResidual: channels.strainResidualEma,
        strainVolatility: channels.strainResidualVolatility,
        energyInnovation: channels.energyInnovationEma,
      });
      this.higherOrder.predict({
        uncertainty: this.lastSettling?.uncertainty ?? 0.5,
        recentError: recent.abs,
        disagreement: self.instantDisagreement,
        evidence: channels.evidenceCount,
        ambiguity: this.higherOrder.scores().confidence,
        energy: self.energyEstimate,
      });
    }
    let reliability = this.higherOrder.enabled ? this.higherOrder.reliability : 0.5;
    if (control === "rolling_tracker") {
      reliability = clamp(this.metaModel.snapshot().toleranceProbability, 0.05, 0.95);
    }
    const predictions: ActionPredictionV06[] = ACTIONS.map((action, actionIndex) => {      const features = record.features[action];
      const rawWorld = this.worldModel.predict(features);
      const world = this.blendWorld(rawWorld, action);
      const selfPrediction = self.predict(features);
      const energyBin = clamp(Math.floor(self.energyEstimate / 25), 0, 3);
      const fatigueBin = clamp(Math.floor(self.fatigue * 3), 0, 2);
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

    const nonRest = predictions.filter((p) => p.action !== "REST");
    const safeMoves = nonRest.filter((p) => p.features.resourceAtTarget !== 1);
    const bestNextEnergy = Math.max(
      ...(safeMoves.length ? safeMoves : nonRest).map((p) => self.energyEstimate + p.self.energyDelta),
      self.energyEstimate,
    );
    const minNextFatigue = Math.min(
      ...nonRest.map((p) => p.self.fatigueNext),
      self.fatigue,
    );
    const predictedCliffRisk = bestNextEnergy < 20 || minNextFatigue > 0.72;
    const safeForaging =
      control === "full" &&
      ablation === "none" &&
      self.energyEstimate > 38 &&
      self.fatigue < 0.55 &&
      this.lastConflict < 0.25 &&
      !this.conflictEpisode &&
      bestNextEnergy > 24 &&
      minNextFatigue < 0.75 &&
      !predictedCliffRisk;
    const probeAvailable =
      self.roughObservations <= 3 &&
      predictions.some((p) => p.features.resourceAtTarget === 1);
    const novelty = Math.max(
      ...predictions.map((p) => this.memory.stats(p.features.target).novelty),
      0,
    );
    const uncertainty = clamp(
      0.6 * (1 - reliability) + 0.4 * (this.lastSettling?.uncertainty ?? 0.5),
      0,
      1,
    );
    const moduleInput: ModuleInput = {
      tick: this.lastPerception?.observation.tick ?? 0,
      predictions,
      energy: self.energyEstimate,
      fatigue: self.fatigue,
      reliability,
      uncertainty,
      novelty,
      roughObservations: self.roughObservations,
      conflict: this.lastConflict,
      nearCliff: self.energyEstimate < 20 || self.fatigue > 0.62,
      restPlateau: this.restPlateau,
      lambda,
      worldSkill: this.worldModel.skill().collect,
      lastAttribution: this.higherOrder.top(),
      broadcast: [0, 0, 0, 0, 0],
      allocation: this.attention.allocation,
    };

    const reflex = control === "reactive" || control === "physical_mpc";
    const bottleneck =
      !reflex && control !== "flat_blackboard" && ablation !== "no_gwt_bottleneck";
    const broadcastEnabled =
      bottleneck && control !== "matched_feedforward" && ablation !== "no_gwt_broadcast";
    const passes = bottleneck ? V06.queryPasses : 1;
    const routing = control !== "flat_blackboard" && ablation !== "no_hot_meta";
    const proposals = reflex
      ? [toReflexProposal(buildProposals(moduleInput)[0], control)]
      : buildProposals(moduleInput);

    this.stage = {
      predictions,
      moduleInput,
      proposals,
      bottleneck,
      broadcastEnabled,
      routing,
      passes,
      explorationMode,
      uncertainty,
      safeForaging,
      diagnosticProbe: probeAvailable,
      result: null,
      query: [],
    };
    this.lastUncertainty = uncertainty;
    return proposals;
  }

  /** Stage 2: competition, ignition and the first broadcast. */
  stageIgnite(): WorkspaceState {
    const stage = this.requireStage();
    let result = ignite(stage.proposals, {
      bottleneck: stage.bottleneck,
      broadcastEnabled: stage.broadcastEnabled,
      previousFrame: this.lastDecision?.workspace.frame ?? null,
      quality: this.higherOrder.quality,
      allocation: this.attention.allocation,
      attribution: this.higherOrder.top(),
      routing: stage.routing,
      safeForaging: stage.safeForaging,
      diagnosticProbe: stage.diagnosticProbe,
    });
    stage.result = result;
    stage.query = [
      {
        pass: 1,
        frame: result.state.frame,
        action: bestAction(result.integrated, stage.predictions),
        goal: result.state.goal,
        revised: false,
        note: "initial coalition",
      },
    ];
    return result.state;
  }

  /** Stage 3: sequential querying, recursive self-simulation and commitment. */
  stageCommit(random: number): V06Decision {
    const stage = this.requireStage();
    let result = stage.result;
    if (!result) {
      this.stageIgnite();
      result = this.requireStage().result;
    }
    if (!result) throw new Error("workspace was not ignited");
    let previousFrame = result.state.frame;
    for (let pass = 2; pass <= stage.passes; pass++) {
      const proposals = stage.proposals.map((proposal) =>
        withBroadcast(proposal, result!.state.broadcast),
      );
      result = ignite(proposals, {
        bottleneck: stage.bottleneck,
        broadcastEnabled: stage.broadcastEnabled,
        previousFrame,
        quality: this.higherOrder.quality,
        allocation: this.attention.allocation,
        attribution: this.higherOrder.top(),
        routing: stage.routing,
        safeForaging: stage.safeForaging,
        diagnosticProbe: stage.diagnosticProbe,
      });
      const action = bestAction(result.integrated, stage.predictions);
      stage.query.push({
        pass,
        frame: result.state.frame,
        action,
        goal: result.state.goal,
        revised: result.state.frame !== previousFrame,
        note:
          result.state.frame !== previousFrame
            ? "broadcast revised the winning coalition"
            : "broadcast confirmed the coalition",
      });
      previousFrame = result.state.frame;
    }
    stage.proposals = stage.proposals.map((proposal) =>
      withBroadcast(proposal, result!.state.broadcast),
    );

    const self = this.selfModel;
    const cognitive =
      this.settings.ablation !== "no_cognitive_self_sim" &&
      this.settings.control !== "reactive" &&
      this.settings.control !== "physical_mpc";
    const horizon =
      this.settings.ablation === "no_cognitive_self_sim" ||
      this.settings.control === "reactive"
        ? 1
        : V06.cognitiveHorizon;
    const selfSim = planRollout({
      predictions: stage.predictions,
      energy: self.energyEstimate,
      fatigue: self.fatigue,
      uncertainty: stage.uncertainty,
      reliability: this.higherOrder.enabled ? this.higherOrder.reliability : 0.5,
      roughObservations: self.roughObservations,
      roughCost: self.roughCost,
      horizon,
      cognitive,
    });

    const utilities = [...result.integrated];
    if (selfSim.cognitive && selfSim.epistemicValue > 0) {
      utilities[selfSimActionIndex(stage.predictions, selfSim.bestAction)] +=
        selfSim.epistemicValue * 0.9;
    }
    if (this.settings.control === "physical_mpc") {
      utilities[selfSimActionIndex(stage.predictions, selfSim.bestAction)] += 5;
    }

    const probabilities = softmax(utilities, V06.policyTemperature);
    const actionIndex = sampleIndex(probabilities, random);
    const selected = stage.predictions[actionIndex];
    this.lastSelectedContext = selected.context;
    this.lastSelectedPrediction = selected;
    self.setIntention(selected.action, selected.self.energyDelta);
    this.predictedEnergyAfterAction = self.energyEstimate + selected.self.energyDelta;

    const decision: V06Decision = {
      predictions: stage.predictions,
      proposals: stage.proposals,
      workspace: {
        ...result.state,
        diagnosticProbe: stage.diagnosticProbe,
        safeForaging: stage.safeForaging,
      },
      query: stage.query,
      selfSim,
      utilities,
      probabilities,
      action: selected.action,
      actionIndex,
      explorationMode: stage.explorationMode,
      uncertainty: stage.uncertainty,
      conflict: this.lastConflict,
      settling: this.lastSettling ?? {
        latent: [0, 0, 0, 0],
        convergence: 0,
        disagreement: 0,
        uncertainty: 0.5,
        interpretation: [0.25, 0.25, 0.25, 0.25],
        passes: 1,
        entropyFirst: 0,
        entropyLast: 0,
        entropyDrop: 0,
        disagreementFirst: 0,
        disagreementLast: 0,
        disagreementDrop: 0,
      },
    };
    this.lastDecision = decision;
    this.lastDiagnosticProbe = stage.diagnosticProbe;
    this.stage = null;
    return decision;
  }

  /** Convenience wrapper used by headless probes and tests. */
  decide(
    record: ReturnType<typeof perceive>,
    random: number,
    explorationMode: ExplorationMode,
    lambda: number,
  ): V06Decision {
    this.stagePropose(record, explorationMode, lambda);
    this.stageIgnite();
    return this.stageCommit(random);
  }

  private stage:
    | {
        predictions: ActionPredictionV06[];
        moduleInput: ModuleInput;
        proposals: ModuleProposal[];
        bottleneck: boolean;
        broadcastEnabled: boolean;
        routing: boolean;
        passes: number;
        explorationMode: ExplorationMode;
        uncertainty: number;
        safeForaging: boolean;
        diagnosticProbe: boolean;
        result: ReturnType<typeof ignite> | null;
        query: QueryPass[];
      }
    | null = null;

  private requireStage() {
    if (!this.stage) throw new Error("no decision stage in progress");
    return this.stage;
  }


  private blendWorld(
    prediction: { pSuccess: number; pCollect: number; pCollision: number },
    action: Action,
  ): { pSuccess: number; pCollect: number; pCollision: number } {
    if (action === "REST") return prediction;
    const skill = this.worldModel.skill();
    const gain = (value: number): number => Math.sqrt(clamp(value, 0, 1));
    return {
      pSuccess: clamp(0.5 + gain(skill.success) * (prediction.pSuccess - 0.5), 0, 1),
      pCollect: clamp(0.05 + gain(skill.collect) * (prediction.pCollect - 0.05), 0, 1),
      pCollision: clamp(0.2 + gain(skill.collision) * (prediction.pCollision - 0.2), 0, 1),
    };
  }

  private recentErrorStats(): { abs: number; signed: number; volatility: number } {
    const entries = this.memory.all.slice(-20);
    if (entries.length === 0) return { abs: 0.4, signed: 0, volatility: 0.2 };
    const abs = meanOf(entries.map((e) => Math.abs(e.selfPredictedDelta - e.sensedEnergyDelta)));
    const signed = meanOf(entries.map((e) => e.selfPredictedDelta - e.sensedEnergyDelta));
    const volatility = meanOf(
      entries.map(
        (e) => Math.abs(Math.abs(e.selfPredictedDelta - e.sensedEnergyDelta) - abs),
      ),
    );
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

  // ------------------------------------------------------------------ learn
  learnWorld(outcome: ObservableStepOutcome): void {
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
    post: V06Observation,
    preEnergyReading: number,
    rateScale: number,
  ): { observedError: number; signedError: number; withinTolerance: boolean } {
    const prediction = this.lastSelectedPrediction;
    if (!prediction) return { observedError: 0, signedError: 0, withinTolerance: true };
    const sensedDelta = post.energyReading - preEnergyReading;
    const predictedDelta = prediction.self.energyDelta;
    const signedError = predictedDelta - sensedDelta;
    const observedError = Math.abs(signedError) / (Math.abs(sensedDelta) + V06_META.errorScale);
    this.selfModel.learnOutcome(
      outcome,
      prediction.features,
      post,
      preEnergyReading,
      rateScale,
      this.lastDiagnosticProbe,
    );
    return {
      observedError,
      signedError,
      withinTolerance: observedError <= V06_META.tolerance,
    };
  }

  learnMeta(
    outcome: ObservableStepOutcome,
    post: V06Observation,
    preEnergyReading: number,
    observedError: number,
    signedError: number,
    multiStepError: number,
    latentError: number,
  ): void {
    const prediction = this.lastSelectedPrediction;
    const context = this.lastSelectedContext;
    if (!prediction || !context) return;
    const metaBefore = prediction.meta;
    const channelsBefore = this.higherOrder.attributor.stats();
    const energyBiasRatio =
      Math.abs(channelsBefore.energyInnovationEma) /
      (this.selfModel.energyVariance + V06_META.errorScale);
    const strainBiasRatio = Math.abs(channelsBefore.strainResidualEma) / 0.5;
    const effortBiasRatio = Math.abs(channelsBefore.effortResidualEma) / 2;
    const crossChannelBias = energyBiasRatio + 0.5 * strainBiasRatio + 0.3 * effortBiasRatio;
    const absDelta = Math.abs(post.energyReading - preEnergyReading);

    const hotOn = this.settings.ablation !== "no_hot_meta";
    if (hotOn) {
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
      this.higherOrder.updateAttribution({
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
    const stateFailureProxy =
      this.selfModel.energyVariance > 8 ||
      Math.abs(this.selfModel.energyBias) > 3 ||
      Math.abs(this.selfModel.instantDisagreement) > 0.2 ||
      Math.abs(channelsBefore.energyInnovationEma) > 2.5 ||
      Math.abs(channelsBefore.strainResidualEma) > 0.2;
    const reliable = !stateFailureProxy;
    const latentFailure = latentError > V06_META.tolerance;
    this.higherOrder.learnControl(reliable, latentFailure);
      const after = this.metaModel.predict(context);
      this.lastInfoGain = Math.max(0, metaBefore.uncertainty - after.uncertainty);
    }

    this.attention.update({
      observedError,
      disagreement: this.selfModel.instantDisagreement,
      reliability: this.higherOrder.enabled ? this.higherOrder.reliability : 0.5,
      reliabilityDrop: this.higherOrder.enabled ? this.higherOrder.reliabilityDrop : 0,
      conflict: this.lastConflict,
    });

    const divergence =
      Math.abs(this.selfModel.lastInnovation) / 8 +
      Math.abs(post.strainReading - this.selfModel.fatigue);
    this.higherOrder.updateQuality({
      energy: this.selfModel.energyEstimate,
      fatigue: this.selfModel.fatigue,
      uncertainty: this.lastUncertainty,
      disagreement: divergence,
    });
    if (this.settings.control === "raw_sensor") {
      this.higherOrder.updateQualityRaw(
        post.energyReading,
        post.strainReading,
        post.lastEffortReading,
      );
    }

    const sensedDelta = post.energyReading - preEnergyReading;
    if (outcome.action === "REST" && sensedDelta < 0.3) {
      this.restPlateau++;
    } else if (!outcome.collected) {
      this.restPlateau = 0;
    }
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

  /** Off-policy reliability probe. `features` describe the shadow context. */
  recordShadowProbe(
    features: {
      uncertainty: number;
      recentError: number;
      disagreement: number;
      evidence: number;
      ambiguity: number;
      energy: number;
      energyVariance: number;
      energyBias: number;
      strainResidual: number;
      strainVolatility: number;
      energyInnovation: number;
    },
    observedError: number,
    latentFailure: boolean,
  ): void {
    this.higherOrder.setContext({
      energyVariance: features.energyVariance,
      energyBias: features.energyBias,
      strainResidual: features.strainResidual,
      strainVolatility: features.strainVolatility,
      energyInnovation: features.energyInnovation,
    });
    const reliable =
      observedError <= V06_META.tolerance &&
      features.energyVariance <= 8 &&
      Math.abs(features.energyBias) <= 3 &&
      Math.abs(features.strainResidual) <= 0.2 &&
      features.energyInnovation <= 2.5;
    this.higherOrder.shadowProbe(features, reliable, latentFailure);
  }

  shadowProbeFeatures(): {
    uncertainty: number;
    recentError: number;
    disagreement: number;
    evidence: number;
    ambiguity: number;
    energy: number;
    energyVariance: number;
    energyBias: number;
    strainResidual: number;
    strainVolatility: number;
    energyInnovation: number;
  } {
    const recent = this.recentErrorStats();
    const channels = this.higherOrder.attributor.stats();
    return {
      uncertainty: this.lastUncertainty,
      recentError: recent.abs,
      disagreement: this.selfModel.instantDisagreement,
      evidence: channels.evidenceCount,
      ambiguity: this.higherOrder.scores().confidence,
      energy: this.selfModel.energyEstimate,
      energyVariance: this.selfModel.energyVariance,
      energyBias: this.selfModel.energyBias,
      strainResidual: channels.strainResidualEma,
      strainVolatility: channels.strainResidualVolatility,
      energyInnovation: channels.energyInnovationEma,
    };
  }

  get infoGain(): number {
    return this.lastInfoGain;
  }

  plasticityScale(): number {
    return this.lastDecision?.workspace.learningGains.somatic ?? 1;
  }

  learningGain(module: ModuleId): number {
    return this.lastDecision?.workspace.learningGains[module] ?? 1;
  }

  selectedContext(): MetaContext | null {
    return this.lastSelectedContext;
  }

  get selectedMeta(): MetaPrediction | null {
    return this.lastSelectedPrediction?.meta ?? null;
  }

  get selectedPrediction(): ActionPredictionV06 | null {
    return this.lastSelectedPrediction;
  }

  get predictions(): ActionPredictionV06[] {
    return this.lastPredictions;
  }

  get decision(): V06Decision | null {
    return this.lastDecision;
  }

  get predictedEnergy(): number {
    return this.predictedEnergyAfterAction || this.lastPredictedEnergy || this.selfModel.energyEstimate;
  }

  get uncertainty(): number {
    return this.lastUncertainty;
  }

  attentionSnapshot(): AttentionSnapshot {
    return this.attention.snapshot();
  }

  correctPost(observation: V06Observation, gain: number): void {
    this.selfModel.correctPost(observation, gain);
  }

  higherOrderSnapshot(): HigherOrderSnapshot {
    return this.higherOrder.snapshot(this.lastDecision?.workspace.learningGains ?? {
      world: 1,
      somatic: 1,
      meta: 1,
      epistemic: 1,
    });
  }

  quality(): [number, number, number] {
    return [...this.higherOrder.quality];
  }

  moduleOrder(): ModuleId[] {
    return MODULE_ORDER;
  }
}

function bestAction(utilities: readonly number[], predictions: ActionPredictionV06[]): Action {
  let best = 0;
  for (let i = 1; i < utilities.length; i++) if (utilities[i] > utilities[best]) best = i;
  return predictions[best]?.action ?? "REST";
}

function selfSimActionIndex(predictions: ActionPredictionV06[], action: Action): number {
  const index = predictions.findIndex((p) => p.action === action);
  return index >= 0 ? index : 4;
}

function toReflexProposal(
  base: ModuleProposal,
  control: ControlKind,
): ModuleProposal {
  return {
    ...base,
    module: "somatic",
    salience: 0.5,
    goal: control === "physical_mpc" ? "physical model-predictive plan" : "first-order reflex",
    hypothesis:
      control === "physical_mpc"
        ? "the horizon-4 physical plan dominates the immediate option"
        : "sensor-to-utility mapping without a workspace",
    evidence: { firstOrderOnly: 1 },
  };
}
