import { clamp, mean } from "../math";
import type { Action, ActionFeatures } from "../types";
import { V06_EXPLORATION } from "./config";
import type {
  ActionPredictionV06,
  AttributionKind,
  ModuleId,
  ModuleProposal,
} from "./types";

export interface ModuleInput {
  tick: number;
  predictions: ActionPredictionV06[];
  energy: number;
  fatigue: number;
  reliability: number;
  uncertainty: number;
  novelty: number;
  roughObservations: number;
  conflict: number;
  nearCliff: boolean;
  restPlateau: number;
  lambda: number;
  worldSkill: number;
  lastAttribution: AttributionKind;
  /** Broadcast bias from the previous micro-pass. */
  broadcast: number[];
  /** Precision allocation predicted by AST-1. */
  allocation: { energy: number; strain: number; effort: number; prior: number; epistemic: number };
}

interface Common {
  base: number[];
  stake: number[];
  info: number[];
}

function baseUtilities(input: ModuleInput): Common {
  const base: number[] = [];
  const stake: number[] = [];
  const info: number[] = [];
  const lowEnergy = Math.max(0, 30 - input.energy);
  for (const prediction of input.predictions) {
    const { action, world, self } = prediction;
    let value = 0;
    if (action !== "REST") {
      value += world.pCollect * V06_EXPLORATION.pragmaticCollectValue;
      value += self.pCollect * 8;
      value += world.pSuccess * V06_EXPLORATION.pragmaticMoveValue;
      value -= world.pCollision * V06_EXPLORATION.pragmaticCollisionPenalty;
      value += input.novelty * V06_EXPLORATION.pragmaticNoveltyValue;
      value -= lowEnergy * 0.55;
    } else {
      value += lowEnergy * 1.35;
    }
    if (input.fatigue > 0.72) value += action === "REST" ? 4.2 : -2.2;
    const selfTerm =
      self.energyDelta * V06_EXPLORATION.selfEnergyValue -
      self.fatigueDelta * V06_EXPLORATION.selfFatigueValue +
      self.pSuccess * V06_EXPLORATION.selfSuccessValue;
    value += selfTerm;
    base.push(value);
    const cost = Math.max(0, -self.energyDelta);
    stake.push(cost);
    const safety = input.energy + self.energyDelta;
    const unsafe = safety < 7 || self.fatigueNext > V06_EXPLORATION.infoSafetyFatigue;
    info.push(unsafe ? 0 : input.uncertainty * (0.5 + cost));
  }
  return { base, stake, info };
}

function bestIndex(values: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return best;
}

function salienceOf(
  utilities: readonly number[],
  confidence: number,
  drive: number,
): number {
  const avg = mean(utilities);
  const variance = mean(utilities.map((u) => (u - avg) ** 2));
  const sorted = [...utilities].sort((a, b) => b - a);
  const margin = sorted[0] - (sorted[2] ?? sorted[sorted.length - 1]);
  const spread = Math.sqrt(Math.max(0, variance));
  return clamp((0.55 * spread + 0.45 * Math.max(0, margin)) / 11, 0, 1) * confidence * drive;
}

function proposal(
  module: ModuleId,
  action: Action,
  utilities: number[],
  confidence: number,
  drive: number,
  localError: number,
  goal: string,
  hypothesis: string,
  evidence: Record<string, number>,
  base: readonly number[],
): ModuleProposal {
  // Competition is over *distinctive* proposals. A module that merely repeats
  // the shared pragmatic baseline has low salience even if its absolute
  // utilities are large, so the workspace is not captured by whichever module
  // happens to restate the strongest prior.
  const delta = utilities.map((value, index) => value - (base[index] ?? 0));
  return {
    module,
    action,
    utilities,
    salience: salienceOf(delta, confidence, drive),
    confidence,
    localError,
    goal,
    hypothesis,
    evidence,
  };
}

function clip(values: number[]): number[] {
  return values.map((v) => clamp(v, -60, 80));
}

/**
 * Four specialist modules. Each one reads the same observable prediction table
 * but weights it by a different representational concern and returns an
 * independent action proposal. The modules have no privileged access to latent
 * state: everything they use is either sensed, predicted, or a running
 * internal statistic.
 */
export function buildProposals(input: ModuleInput): ModuleProposal[] {
  const { base, info } = baseUtilities(input);
  const features = input.predictions.map((p) => p.features);
  const anyRoughUnverified = features.some(
    (f) => f.resourceAtTarget === 1 && input.roughObservations === 0,
  );
  const proposals: ModuleProposal[] = [];

  // ------------------------------------------------------------- world
  const worldUtilities = base.map((u, i) => {
    const f: ActionFeatures = features[i];
    const p = input.predictions[i];
    let value = u;
    value += p.world.pCollect * 8;
    value += f.directionResourceSignal * 12;
    value -= p.world.pCollision * 2;
    if (f.obstacleAtTarget || f.boundary) value -= 2.5;
    return value;
  });
  proposals.push(
    proposal(
      "world",
      input.predictions[bestIndex(worldUtilities)].action,
      clip(worldUtilities),
      clamp(0.55 + 0.45 * clamp(input.worldSkill, 0, 1) - 0.2 * input.conflict, 0.15, 0.98),
      (0.7 + 0.6 * (1 - input.uncertainty)) * (0.75 + 0.5 * (1 - input.allocation.prior)),
      0.35 * input.conflict + 0.25 * (1 - clamp(input.worldSkill, 0, 1)),
      "forage along the perceived resource gradient",
      "a resource-bearing direction is worth more than the local baseline",
      {
        worldSkill: input.worldSkill,
        bestCollect: Math.max(...input.predictions.map((p) => p.world.pCollect)),
        novelty: input.novelty,
      },
      base,
    ),
  );

  // ----------------------------------------------------------- somatic
  const somaticUtilities = base.map((u, i) => {
    const p = input.predictions[i];
    let value = u;
    value -= p.self.energyDelta * 0.6;
    value -= p.self.fatigueDelta * 10;
    if (input.nearCliff && p.action !== "REST") value -= 8;
    if (input.fatigue > 0.8) value += p.action === "REST" ? 5 : -3;
    return value;
  });
  const viability = clamp(input.energy / 100, 0, 1) * (1 - input.fatigue);
  proposals.push(
    proposal(
      "somatic",
      input.predictions[bestIndex(somaticUtilities)].action,
      clip(somaticUtilities),
      clamp(0.55 + 0.45 * (1 - Math.min(1, input.fatigue)), 0.2, 0.98),
      (0.6 + 1.4 * (1 - viability)) *
        (0.6 + 0.8 * input.allocation.energy + 0.5 * input.allocation.strain),
      0.3 * input.fatigue + 0.2 * (input.nearCliff ? 1 : 0),
      input.nearCliff ? "restore energy above the metabolic cliff" : "hold homeostasis",
      "the predicted next state is inside the safe envelope",
      {
        viability,
        fatigue: input.fatigue,
        nearCliff: input.nearCliff ? 1 : 0,
        riskMargin: Math.min(...input.predictions.map((p) => input.energy + p.self.energyDelta)),
      },
      base,
    ),
  );

  // -------------------------------------------------------------- meta
  const metaUtilities = base.map((u, i) => {
    const p = input.predictions[i];
    let value = u;
    const cost = Math.max(0, -p.self.energyDelta);
    value -= input.uncertainty * cost * 0.8;
    value += p.meta.biasCorrection * 0.5;
    if (input.reliability < 0.45 && p.action === "REST") value += 3;
    if (p.features.resourceAtTarget && input.roughObservations === 0) value += 2;
    if (p.action !== "REST") value -= (1 - input.reliability) * 2.2;
    return value;
  });
  const metaEvidence =
    input.lastAttribution === "insufficient" ? 0 : 1;
  proposals.push(
    proposal(
      "meta",
      input.predictions[bestIndex(metaUtilities)].action,
      clip(metaUtilities),
      clamp(0.4 + 0.55 * input.reliability, 0.1, 0.96),
      (0.5 + 1.5 * (1 - input.reliability)) * (0.6 + 1.2 * input.allocation.prior),
      0.6 * (1 - input.reliability) + 0.4 * (1 - metaEvidence),
      input.reliability < 0.45 ? "diagnose the unreliable channel" : "act on a calibrated estimate",
      "the first-order prediction is trustworthy enough to commit",
      {
        reliability: input.reliability,
        uncertainty: input.uncertainty,
        attributionKnown: metaEvidence,
        biasCorrection: mean(input.predictions.map((p) => p.meta.biasCorrection)),
      },
      base,
    ),
  );

  // ---------------------------------------------------------- epistemic
  const epistemicUtilities = base.map((u, i) => {
    const p = input.predictions[i];
    let value = u;
    value += 0.55 * input.lambda * info[i];
    value += input.novelty * 2.5;
    if (p.features.resourceAtTarget && input.roughObservations === 0) value += 2.5;
    if (p.action !== "REST" && p.features.directionResourceSignal > 0.05) value += 0.8;
    return value;
  });
  const probeIndex = bestIndex(epistemicUtilities);
  proposals.push(
    proposal(
      "epistemic",
      input.predictions[probeIndex].action,
      clip(epistemicUtilities),
      clamp(0.45 + 0.5 * input.uncertainty, 0.15, 0.95),
      (0.4 + 1.8 * input.uncertainty + 0.4 * input.novelty) *
        (0.5 + 1.6 * input.allocation.epistemic),
      0.5 * input.uncertainty,
      anyRoughUnverified ? "probe an unverified rough cell" : "reduce the largest uncertainty",
      anyRoughUnverified
        ? "the next observation is worth more than its immediate reward"
        : "information would change the next decision",
      {
        uncertainty: input.uncertainty,
        infoValue: Math.max(...info),
        novelty: input.novelty,
        unverifiedRough: anyRoughUnverified ? 1 : 0,
        restPlateau: input.restPlateau,
      },
      base,
    ),
  );

  return proposals;
}

/** Add a workspace broadcast bias to a module's utilities. */
export function withBroadcast(proposal: ModuleProposal, broadcast: readonly number[]): ModuleProposal {
  if (broadcast.every((v) => Math.abs(v) < 1e-9)) return proposal;
  const utilities = proposal.utilities.map((u, i) => u + (broadcast[i] ?? 0));
  return {
    ...proposal,
    utilities,
    action: (["UP", "DOWN", "LEFT", "RIGHT", "REST"] as Action[])[bestIndex(utilities)],
  };
}
