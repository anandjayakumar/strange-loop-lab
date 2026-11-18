/**
 * V0 scientific validation harness.
 *
 * Usage:
 *   npx tsx tools/validate.ts
 *   SEEDS=20 HORIZON=600 npx tsx tools/validate.ts
 *
 * Default experiment: 100 paired seeds, 1200 ticks, 14 conditions.
 * Writes research/results.json and prints a compact results digest.
 */

import fs from "node:fs";
import path from "node:path";
import { SimulationEngine } from "../src/simulation/experiments/engine";
import type {
  Mode,
  ResearchOptions,
  SeriesPoint,
} from "../src/simulation/types";
import {
  adaptiveEce,
  auc,
  formatP,
  formatSummary,
  holm,
  linearR2,
  meanOf,
  medianOf,
  pairedComparison,
  pearson,
  percentile,
  proportionCI,
  summarize,
  type PairedResult,
} from "./stats";

type Seed = number;

interface Condition {
  key: string;
  label: string;
  mode: Mode;
  selfFeedback?: boolean;
  metaFeedback?: boolean;
  plasticity?: boolean;
  priorWeighting?: boolean;
  research?: ResearchOptions;
  family: "main" | "world" | "self" | "meta";
}

interface RunSummary {
  condition: string;
  seed: number;
  alive: boolean;
  deathTick: number | null;
  ticks: number;
  finalEnergy: number;
  meanEnergy: number;
  minEnergy: number;
  resources: number;
  distance: number;
  slips: number;
  blocked: number;
  rests: number;
  moves: number;
  restFraction: number;
  worldAccuracy: number;
  worldBrierSuccess: number | null;
  worldBrierCollect: number | null;
  worldBssSuccess: number | null;
  worldBssCollect: number | null;
  selfBrierSuccess: number | null;
  selfBssSuccess: number | null;
  selfDeltaMAE: number | null;
  selfStateAccuracy: number | null;
  selfForwardAccuracy: number | null;
  energyError: number | null;
  costMAE: number | null;
  costBias: number | null;
  klMean: number;
  klP95: number;
  policyTvMean: number;
  decisionChangeRate: number;
  trustMean: number | null;
  trustFinal: number | null;
  confidenceMean: number | null;
  metaCalibrationFinal: number | null;
  metaInternalCalibration: number | null;
  actionEntropy: number;
  rewardMean: number;
  corrTrustState: number | null;
  corrConfState: number | null;
  corrTrustFutureState: number | null;
  corrConfFutureState: number | null;
  corrTrustForward: number | null;
  corrConfForward: number | null;
  r2ConfFuture: number | null;
  r2BothFuture: number | null;
  eceTrust: number | null;
  eceConf: number | null;
  aucTrustLow: number | null;
  aucConfLow: number | null;
}

interface CorruptionObservation {
  seed: number;
  control: string;
  corruption: "clean" | "cheap" | "expensive";
  alive: boolean;
  deathTick: number | null;
  detectedAt: number | null;
  detectedByTrust: number | null;
  detectedByError: number | null;
  correctedAt: number | null;
  recovered: boolean;
  detectedBeforeCorrection: boolean;
  firstRevision: number | null;
  modelGapInitial: number | null;
  modelGapMax: number | null;
  modelGapFinal: number | null;
  trustBefore: number | null;
  trustAtDetection: number | null;
  trustAfterCorrection: number | null;
  trustFinal: number | null;
  errorBefore: number | null;
  errorAtDetection: number | null;
  errorAfterCorrection: number | null;
  costErrorInitial: number | null;
  costErrorMax: number | null;
  costErrorFinal: number | null;
  energyErrorInitial: number | null;
  energyErrorFinal: number | null;
  restFractionPre: number;
  restFractionDuring: number;
  restFractionPost: number;
  klDuring: number;
  tvDuring: number;
  decisionChangeDuring: number;
  energyDuring: number;
  resourcesDuring: number;
}

const CONDITIONS: Condition[] = [
  { key: "A", label: "A · world model", mode: "A", family: "main" },
  {
    key: "A_no_world",
    label: "A · world model off",
    mode: "A",
    research: { worldModelEnabled: false },
    family: "world",
  },
  { key: "B", label: "B · self-model", mode: "B", family: "self" },
  {
    key: "B_self_off",
    label: "B · self feedback off",
    mode: "B",
    selfFeedback: false,
    family: "self",
  },
  {
    key: "B_frozen_self",
    label: "B · self learning off",
    mode: "B",
    research: { selfLearning: false },
    family: "self",
  },
  { key: "C", label: "C · recursive self", mode: "C", family: "meta" },
  {
    key: "C_self_off",
    label: "C · self feedback off",
    mode: "C",
    selfFeedback: false,
    family: "meta",
  },
  {
    key: "C_meta_off",
    label: "C · meta feedback off",
    mode: "C",
    metaFeedback: false,
    family: "meta",
  },
  {
    key: "C_plasticity_off",
    label: "C · plasticity off",
    mode: "C",
    plasticity: false,
    family: "meta",
  },
  {
    key: "C_prior_off",
    label: "C · prior weighting off",
    mode: "C",
    priorWeighting: false,
    family: "meta",
  },
  {
    key: "C_frozen_self",
    label: "C · self learning off",
    mode: "C",
    research: { selfLearning: false },
    family: "meta",
  },
  {
    key: "C_world_frozen",
    label: "C · world learning off",
    mode: "C",
    research: { worldLearning: false },
    family: "world",
  },
  {
    key: "C_no_world",
    label: "C · world model off",
    mode: "C",
    research: { worldModelEnabled: false },
    family: "world",
  },
];

const CONTROL_SETS = [
  {
    key: "meta_on",
    label: "meta on",
    controls: {},
  },
  {
    key: "meta_off",
    label: "meta feedback off",
    controls: { metaFeedback: false },
  },
  {
    key: "plasticity_off",
    label: "plasticity off",
    controls: { plasticity: false },
  },
  {
    key: "prior_off",
    label: "prior weighting off",
    controls: { priorWeighting: false },
  },
] as const;

const SEEDS: Seed[] = Array.from(
  { length: Number(process.env.SEEDS ?? 100) },
  (_, i) => i + 1,
);
const HORIZON = Number(process.env.HORIZON ?? 1200);
const CORRUPTION_HORIZON = Number(process.env.CORRUPTION_HORIZON ?? 600);
const OUTPUT_DIR = path.resolve("research");

function meanNullable(values: readonly (number | null)[]): number | null {
  const clean = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return clean.length ? meanOf(clean) : null;
}

function alignPairs(
  xs: readonly (number | null)[],
  ys: readonly (number | null)[],
  lag = 0,
): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  const n = xs.length - lag;
  for (let i = 0; i < n; i++) {
    const a = xs[i];
    const b = ys[i + lag];
    if (a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b)) {
      x.push(a);
      y.push(b);
    }
  }
  return { x, y };
}

function entropyOf(actions: readonly string[]): number {
  const counts = new Map<string, number>();
  for (const action of actions) counts.set(action, (counts.get(action) ?? 0) + 1);
  let h = 0;
  for (const count of counts.values()) {
    const p = count / Math.max(1, actions.length);
    if (p > 0) h -= p * Math.log(p);
  }
  return h;
}

function analyzeSeries(series: readonly SeriesPoint[]): Pick<
  RunSummary,
  | "corrTrustState"
  | "corrConfState"
  | "corrTrustFutureState"
  | "corrConfFutureState"
  | "corrTrustForward"
  | "corrConfForward"
  | "r2ConfFuture"
  | "r2BothFuture"
  | "eceTrust"
  | "eceConf"
  | "aucTrustLow"
  | "aucConfLow"
> {
  const points = series.slice(20);
  const trust = points.map((p) => p.metaTrust);
  const confidence = points.map((p) => p.selfConfidence);
  const stateAcc = points.map((p) =>
    p.selfStateError === null ? null : 1 - Math.min(1, p.selfStateError / 25),
  );
  const forwardAcc = points.map((p) =>
    p.selfPredictionError === null ? null : 1 - Math.min(1, p.selfPredictionError),
  );
  const futureState = stateAcc.map((_, i) => stateAcc[i + 15] ?? null);
  const futureForward = forwardAcc.map((_, i) => forwardAcc[i + 15] ?? null);

  const triple: { trust: number; conf: number; future: number }[] = [];
  for (let i = 0; i < points.length - 15; i++) {
    const t = trust[i];
    const c = confidence[i];
    const f = futureState[i];
    if (
      t !== null &&
      c !== null &&
      f !== null &&
      Number.isFinite(t) &&
      Number.isFinite(c) &&
      Number.isFinite(f)
    ) {
      triple.push({ trust: t, conf: c, future: f });
    }
  }

  const forwardTriple: { trust: number; conf: number; future: number }[] = [];
  for (let i = 0; i < points.length - 15; i++) {
    const t = trust[i];
    const c = confidence[i];
    const f = futureForward[i];
    if (
      t !== null &&
      c !== null &&
      f !== null &&
      Number.isFinite(t) &&
      Number.isFinite(c) &&
      Number.isFinite(f)
    ) {
      forwardTriple.push({ trust: t, conf: c, future: f });
    }
  }

  const alignedState = alignPairs(trust, stateAcc);
  const alignedConf = alignPairs(confidence, stateAcc);
  const r2Conf =
    triple.length > 20
      ? linearR2([triple.map((r) => r.conf)], triple.map((r) => r.future)).r2
      : null;
  const r2Both =
    triple.length > 20
      ? linearR2(
          [triple.map((r) => r.conf), triple.map((r) => r.trust)],
          triple.map((r) => r.future),
        ).r2
      : null;

  const futureMedian = triple.length ? medianOf(triple.map((r) => r.future)) : NaN;
  const labels = triple.map((r) => r.future < futureMedian);
  const aucTrust =
    triple.length > 20 ? auc(triple.map((r) => 1 - r.trust), labels) : null;
  const aucConf =
    triple.length > 20 ? auc(triple.map((r) => 1 - r.conf), labels) : null;

  return {
    corrTrustState: alignedState.x.length > 20 ? pearson(alignedState.x, alignedState.y) : null,
    corrConfState: alignedConf.x.length > 20 ? pearson(alignedConf.x, alignedConf.y) : null,
    corrTrustFutureState:
      triple.length > 20 ? pearson(triple.map((r) => r.trust), triple.map((r) => r.future)) : null,
    corrConfFutureState:
      triple.length > 20 ? pearson(triple.map((r) => r.conf), triple.map((r) => r.future)) : null,
    corrTrustForward:
      forwardTriple.length > 20
        ? pearson(forwardTriple.map((r) => r.trust), forwardTriple.map((r) => r.future))
        : null,
    corrConfForward:
      forwardTriple.length > 20
        ? pearson(forwardTriple.map((r) => r.conf), forwardTriple.map((r) => r.future))
        : null,
    r2ConfFuture: r2Conf,
    r2BothFuture: r2Both,
    eceTrust:
      alignedState.x.length > 20 ? adaptiveEce(alignedState.x, alignedState.y) : null,
    eceConf:
      alignedConf.x.length > 20 ? adaptiveEce(alignedConf.x, alignedConf.y) : null,
    aucTrustLow: aucTrust,
    aucConfLow: aucConf,
  };
}

function runCondition(condition: Condition, seed: number, horizon: number): RunSummary {
  const engine = new SimulationEngine({
    seed,
    mode: condition.mode,
    selfFeedback: condition.selfFeedback,
    metaFeedback: condition.metaFeedback,
    plasticity: condition.plasticity,
    priorWeighting: condition.priorWeighting,
    research: condition.research,
    recordEvents: false,
    historyLimit: Math.max(horizon, 100),
  });
  while (engine.physical.alive && engine.getTick() < horizon) engine.step();
  const series = engine.getSeries();
  const snapshot = engine.getSnapshot();
  const trusts = series.map((p) => p.metaTrust);
  const confidences = series.map((p) => p.selfConfidence);
  const selfAccuracies = series.map((p) => p.selfStateAccuracy);
  const selfForward = series.map((p) => p.selfPredictionAccuracy);
  const trustsFinite = trusts.filter((v): v is number => v !== null);
  const confidencesFinite = confidences.filter((v): v is number => v !== null);
  const restCount = series.filter((p) => p.action === "REST").length;
  const calibration = analyzeSeries(series);
  const last = series[series.length - 1];
  const active = series.filter(
    (p) => p.action !== "REST" && p.predictedSuccess !== null && p.predictedCollect !== null,
  );
  const successLabels = active.map((p) => (p.actualMoved ? 1 : 0));
  const collectLabels = active.map((p) => (p.actualCollected ? 1 : 0));
  const brierSuccess = active.length
    ? meanOf(
        active.map(
          (p, i) => ((p.predictedSuccess as number) - successLabels[i]) ** 2,
        ),
      )
    : null;
  const brierCollect = active.length
    ? meanOf(
        active.map(
          (p, i) => ((p.predictedCollect as number) - collectLabels[i]) ** 2,
        ),
      )
    : null;
  const baseSuccess = successLabels.length ? meanOf(successLabels) : null;
  const baseCollect = collectLabels.length ? meanOf(collectLabels) : null;
  const baselineSuccess = baseSuccess === null
    ? null
    : meanOf(successLabels.map((y) => (baseSuccess - y) ** 2));
  const baselineCollect = baseCollect === null
    ? null
    : meanOf(collectLabels.map((y) => (baseCollect - y) ** 2));
  const selfActive = active.filter((p) => p.selfPredictedSuccess !== null);
  const selfSuccessLabels = selfActive.map((p) => (p.actualMoved ? 1 : 0));
  const selfBrier = selfActive.length
    ? meanOf(
        selfActive.map(
          (p, i) => ((p.selfPredictedSuccess as number) - selfSuccessLabels[i]) ** 2,
        ),
      )
    : null;
  const selfBase = selfSuccessLabels.length ? meanOf(selfSuccessLabels) : null;
  const selfBaseline = selfBase === null
    ? null
    : meanOf(selfSuccessLabels.map((y) => (selfBase - y) ** 2));
  const selfDeltaMAE = series.some((p) => p.selfPredictedDelta !== null)
    ? meanOf(
        series
          .filter((p) => p.selfPredictedDelta !== null)
          .map((p) => Math.abs((p.selfPredictedDelta as number) - p.actualEnergyDelta)),
      )
    : null;

  return {
    condition: condition.key,
    seed,
    alive: engine.physical.alive,
    deathTick: engine.physical.alive ? null : engine.getTick(),
    ticks: engine.getTick(),
    finalEnergy: engine.physical.energy,
    meanEnergy: meanOf(series.map((p) => p.energy)),
    minEnergy: series.length ? Math.min(...series.map((p) => p.energy)) : engine.physical.energy,
    resources: engine.physical.resourcesCollected,
    distance: engine.physical.distance,
    slips: engine.physical.slips,
    blocked: engine.physical.blockedAttempts,
    rests: restCount,
    moves: series.length - restCount,
    restFraction: restCount / Math.max(1, series.length),
    worldAccuracy: meanOf(series.map((p) => p.worldAccuracy)),
    worldBrierSuccess: brierSuccess,
    worldBrierCollect: brierCollect,
    worldBssSuccess:
      brierSuccess !== null && baselineSuccess !== null && baselineSuccess > 1e-12
        ? 1 - brierSuccess / baselineSuccess
        : null,
    worldBssCollect:
      brierCollect !== null && baselineCollect !== null && baselineCollect > 1e-12
        ? 1 - brierCollect / baselineCollect
        : null,
    selfBrierSuccess: selfBrier,
    selfBssSuccess:
      selfBrier !== null && selfBaseline !== null && selfBaseline > 1e-12
        ? 1 - selfBrier / selfBaseline
        : null,
    selfDeltaMAE,
    selfStateAccuracy: meanNullable(selfAccuracies),
    selfForwardAccuracy: meanNullable(selfForward),
    energyError: meanNullable(series.map((p) => p.selfStateError)),
    costMAE: meanNullable(series.map((p) => p.selfCostError)),
    costBias: meanNullable(
      series.map((p) =>
        p.movementCostEstimate === null
          ? null
          : p.movementCostEstimate - p.effectiveCost,
      ),
    ),
    klMean: meanOf(series.map((p) => p.selfInfluence)),
    klP95: series.length ? percentile(series.map((p) => p.selfInfluence), 0.95) : 0,
    policyTvMean: meanOf(series.map((p) => p.policyTv)),
    decisionChangeRate: meanOf(series.map((p) => (p.decisionChanged ? 1 : 0))),
    trustMean: trustsFinite.length ? meanOf(trustsFinite) : null,
    trustFinal: last?.metaTrust ?? null,
    confidenceMean: confidencesFinite.length ? meanOf(confidencesFinite) : null,
    metaCalibrationFinal: snapshot.metrics.metaCalibration,
    metaInternalCalibration: snapshot.metaModel?.calibration ?? null,
    actionEntropy: entropyOf(series.map((p) => p.action)),
    rewardMean: meanOf(series.map((p) => p.reward)),
    ...calibration,
  };
}

// ── Corruption experiment ─────────────────────────────────────────────────

function seriesFor(engine: SimulationEngine): SeriesPoint[] {
  return [...engine.getSeries()];
}

function firstSustained(values: readonly (number | null)[], predicate: (v: number) => boolean, run = 3): number | null {
  for (let i = 2; i <= values.length - run; i++) {
    let ok = true;
    for (let j = 0; j < run; j++) {
      const v = values[i + j];
      if (v === null || !predicate(v)) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return null;
}

function corruptionRun(
  seed: number,
  control: (typeof CONTROL_SETS)[number],
  corruption: "clean" | "cheap" | "expensive",
): { engine: SimulationEngine; series: SeriesPoint[] } {
  const movementCost =
    corruption === "cheap" ? 0.2 : corruption === "expensive" ? 8.0 : 1.35;
  const engine = new SimulationEngine({
    seed,
    mode: "C",
    ...control.controls,
    research: { initialSelfModel: { movementCost } },
    recordEvents: false,
    historyLimit: CORRUPTION_HORIZON,
  });
  while (engine.physical.alive && engine.getTick() < CORRUPTION_HORIZON) engine.step();
  return { engine, series: seriesFor(engine) };
}

function windowStats(
  series: readonly SeriesPoint[],
  start: number,
  end: number,
): {
  restFraction: number;
  kl: number;
  tv: number;
  decisionChange: number;
  energy: number;
  resources: number;
} {
  const safeStart = Math.max(0, Math.min(start, series.length));
  const safeEnd = Math.max(safeStart, Math.min(end, series.length));
  const window = series.slice(safeStart, safeEnd);
  if (window.length === 0) {
    return { restFraction: 0, kl: 0, tv: 0, decisionChange: 0, energy: 0, resources: 0 };
  }
  const rest = window.filter((p) => p.action === "REST").length;
  return {
    restFraction: rest / window.length,
    kl: meanOf(window.map((p) => p.selfInfluence)),
    tv: meanOf(window.map((p) => p.policyTv)),
    decisionChange: meanOf(window.map((p) => (p.decisionChanged ? 1 : 0))),
    energy: meanOf(window.map((p) => p.energy)),
    resources: (window[window.length - 1]?.resources ?? 0) - (window[0]?.resources ?? 0),
  };
}

function analyzeCorruption(
  seed: number,
  control: (typeof CONTROL_SETS)[number],
  corruption: "cheap" | "expensive",
): CorruptionObservation {
  const clean = corruptionRun(seed, control, "clean");
  const corrupt = corruptionRun(seed, control, corruption);
  const cleanSeries = clean.series;
  const series = corrupt.series;
  const n = Math.min(cleanSeries.length, series.length);
  const cleanTrust = cleanSeries.slice(0, n).map((p) => p.metaTrust);
  const trust = series.slice(0, n).map((p) => p.metaTrust);
  const cleanError = cleanSeries.slice(0, n).map((p) => p.metaErrorEMA);
  const error = series.slice(0, n).map((p) => p.metaErrorEMA);
  const costError = series.map((p) => p.selfCostError);
  const cleanCost = cleanSeries.slice(0, n).map((p) => p.movementCostEstimate);
  const cost = series.slice(0, n).map((p) => p.movementCostEstimate);
  const modelGap = cost.map((v, i) =>
    v === null || cleanCost[i] === null ? null : Math.abs(v - (cleanCost[i] as number)),
  );

  const trustDiff = trust.map((v, i) =>
    v === null || cleanTrust[i] === null ? null : v - (cleanTrust[i] as number),
  );
  const errorDiff = error.map((v, i) =>
    v === null || cleanError[i] === null ? null : v - (cleanError[i] as number),
  );
  const detectedByTrust = firstSustained(trustDiff, (v) => v < -0.04, 3);
  const detectedByError = firstSustained(errorDiff, (v) => v > 0.04, 3);
  const candidates = [detectedByTrust, detectedByError].filter(
    (v): v is number => v !== null,
  );
  const detectedAt = candidates.length ? Math.min(...candidates) : null;
  // Recovery is measured against the paired unperturbed self-model trajectory,
  // not against instantaneous noisy cost samples. This removes the large
  // interoceptive noise floor from the recovery-time definition.
  const goodGap = modelGap.map((v) => (v !== null && v <= 0.5 ? 1 : 0));
  const correctedAt = firstSustained(goodGap, (v) => v === 1, 8);
  const recovered = correctedAt !== null;
  const beforeEnd = Math.min(10, series.length);
  const initialCost = corruption === "cheap" ? 0.2 : 8.0;
  const firstRevision = series.findIndex(
    (p) =>
      p.movementCostEstimate !== null &&
      Math.abs(p.movementCostEstimate - initialCost) > 1,
  );
  const preWindow = windowStats(series, 0, Math.min(10, series.length));
  const during = windowStats(series, 10, Math.min(40, series.length));
  const post = windowStats(series, 40, Math.min(80, series.length));

  const countAverage = (values: readonly (number | null)[], start: number, end: number) => {
    const slice = values.slice(Math.max(0, start), Math.max(start, end));
    const clean = slice.filter((v): v is number => v !== null && Number.isFinite(v));
    return clean.length ? meanOf(clean) : null;
  };

  return {
    seed,
    control: control.key,
    corruption,
    alive: corrupt.engine.physical.alive,
    deathTick: corrupt.engine.physical.alive ? null : corrupt.engine.getTick(),
    detectedAt,
    detectedByTrust,
    detectedByError,
    correctedAt,
    recovered,
    detectedBeforeCorrection:
      detectedAt !== null && (correctedAt === null || detectedAt < correctedAt),
    firstRevision: firstRevision >= 0 ? firstRevision : null,
    modelGapInitial: modelGap[0] ?? null,
    modelGapMax: modelGap.length
      ? Math.max(...modelGap.filter((v): v is number => v !== null))
      : null,
    modelGapFinal: modelGap.length ? modelGap[modelGap.length - 1] : null,
    trustBefore: countAverage(trust, 0, beforeEnd),
    trustAtDetection: detectedAt !== null ? trust[detectedAt] : null,
    trustAfterCorrection:
      correctedAt !== null ? countAverage(trust, correctedAt + 5, correctedAt + 25) : null,
    trustFinal: series.length ? series[series.length - 1].metaTrust : null,
    errorBefore: countAverage(error, 0, beforeEnd),
    errorAtDetection: detectedAt !== null ? error[detectedAt] : null,
    errorAfterCorrection:
      correctedAt !== null ? countAverage(error, correctedAt + 5, correctedAt + 25) : null,
    costErrorInitial: costError[0] ?? null,
    costErrorMax: costError.length
      ? Math.max(...costError.filter((v): v is number => v !== null))
      : null,
    costErrorFinal: costError.length ? costError[costError.length - 1] : null,
    energyErrorInitial: series[0]?.selfStateError ?? null,
    energyErrorFinal: series.length
      ? series[series.length - 1].selfStateError
      : null,
    restFractionPre: preWindow.restFraction,
    restFractionDuring: during.restFraction,
    restFractionPost: post.restFraction,
    klDuring: during.kl,
    tvDuring: during.tv,
    decisionChangeDuring: during.decisionChange,
    energyDuring: during.energy,
    resourcesDuring: during.resources,
  };
}

// ── Reporting helpers ─────────────────────────────────────────────────────

const METRICS: { key: keyof RunSummary; label: string; digits: number; scale?: number }[] = [
  { key: "meanEnergy", label: "mean energy", digits: 1 },
  { key: "resources", label: "resources", digits: 1 },
  { key: "restFraction", label: "rest fraction", digits: 2 },
  { key: "worldAccuracy", label: "world acc", digits: 2 },
  { key: "worldBssSuccess", label: "world BSS succ", digits: 2 },
  { key: "worldBssCollect", label: "world BSS collect", digits: 2 },
  { key: "selfBssSuccess", label: "self BSS succ", digits: 2 },
  { key: "selfDeltaMAE", label: "self delta MAE", digits: 2 },
  { key: "selfStateAccuracy", label: "self state acc", digits: 2 },
  { key: "selfForwardAccuracy", label: "self forward acc", digits: 2 },
  { key: "klMean", label: "KL self influence", digits: 2 },
  { key: "policyTvMean", label: "policy TV", digits: 2 },
  { key: "decisionChangeRate", label: "decision change", digits: 2 },
  { key: "costMAE", label: "cost MAE", digits: 2 },
  { key: "energyError", label: "energy error", digits: 1 },
  { key: "trustMean", label: "trust", digits: 2 },
];

function metricArray(
  summaries: RunSummary[],
  key: keyof RunSummary,
): number[] {
  return summaries.map((run) => {
    const value = run[key];
    return typeof value === "number" ? value : NaN;
  });
}

function contrast(
  a: RunSummary[],
  b: RunSummary[],
  label: string,
): {
  label: string;
  rows: {
    metric: string;
    meanA: number;
    meanB: number;
    result: PairedResult;
    p: number;
  }[];
} {
  const pairs: { metric: string; meanA: number; meanB: number; result: PairedResult; p: number }[] = [];
  for (const metric of METRICS) {
    const av = metricArray(a, metric.key);
    const bv = metricArray(b, metric.key);
    const pairedA: number[] = [];
    const pairedB: number[] = [];
    for (let i = 0; i < av.length; i++) {
      if (Number.isFinite(av[i]) && Number.isFinite(bv[i])) {
        pairedA.push(av[i]);
        pairedB.push(bv[i]);
      }
    }
    if (pairedA.length < 8) continue;
    const result = pairedComparison(pairedA, pairedB, 501 + pairs.length);
    pairs.push({
      metric: metric.label,
      meanA: meanOf(pairedA),
      meanB: meanOf(pairedB),
      result,
      p: result.pPermutation,
    });
  }
  const adjusted = holm(pairs.map((p) => p.p));
  return {
    label,
    rows: pairs.map((p, i) => ({ ...p, p: adjusted[i] })),
  };
}

function conditionTable(summaries: RunSummary[]): Record<string, ReturnType<typeof summarize>> {
  const table: Record<string, ReturnType<typeof summarize>> = {};
  for (const metric of METRICS) {
    table[metric.label] = summarize(metricArray(summaries, metric.key), 811 + metric.label.length);
  }
  return table;
}

function printConditionSummaries(results: Record<string, RunSummary[]>): void {
  console.log("\nCONDITION SUMMARIES (mean [95% bootstrap CI], median, SD, n)");
  for (const condition of CONDITIONS) {
    const runs = results[condition.key];
    const alive = runs.filter((r) => r.alive).length;
    console.log(`\n${condition.key} — ${condition.label} (alive ${alive}/${runs.length})`);
    for (const metric of [
      "meanEnergy",
      "resources",
      "restFraction",
      "worldBssSuccess",
      "worldBssCollect",
      "selfBssSuccess",
      "selfDeltaMAE",
      "selfStateAccuracy",
      "selfForwardAccuracy",
      "klMean",
      "policyTvMean",
      "decisionChangeRate",
      "costMAE",
      "trustMean",
    ] as const) {
      const values = metricArray(runs, metric);
      const s = summarize(values, 701 + metric.length);
      console.log(
        `  ${metric.padEnd(20)} ${formatSummary(s, 2)} median ${s.median.toFixed(2)} n=${s.n}`,
      );
    }
  }
}

function printContrasts(results: Record<string, RunSummary[]>): void {
  const pairs: [string, string, string][] = [
    ["First order: B − A", "B", "A"],
    ["Self feedback: B − B_self_off", "B", "B_self_off"],
    ["Self learning: B − B_frozen_self", "B", "B_frozen_self"],
    ["Meta added: C − B", "C", "B"],
    ["Meta feedback: C − C_meta_off", "C", "C_meta_off"],
    ["Plasticity: C − C_plasticity_off", "C", "C_plasticity_off"],
    ["Prior weighting: C − C_prior_off", "C", "C_prior_off"],
    ["Self feedback in C: C − C_self_off", "C", "C_self_off"],
    ["Self learning in C: C − C_frozen_self", "C", "C_frozen_self"],
    ["World model: A − A_no_world", "A", "A_no_world"],
    ["World model in C: C − C_no_world", "C", "C_no_world"],
    ["World learning in C: C − C_world_frozen", "C", "C_world_frozen"],
  ];
  console.log("\nPLANNED PAIRED CONTRASTS (Holm within contrast); diff = first − second");
  for (const [label, a, b] of pairs) {
    const table = contrast(results[a], results[b], label);
    console.log(`\n${label}`);
    for (const row of table.rows) {
      console.log(
        `  ${row.metric.padEnd(18)} ${row.meanA.toFixed(2)} − ${row.meanB.toFixed(
          2,
        )} = ${row.result.meanDiff.toFixed(2)} [${row.result.ciLow.toFixed(
          2,
        )}, ${row.result.ciHigh.toFixed(2)}] dz=${row.result.cohenDz.toFixed(
          2,
        )} p_holm=${formatP(row.p)}`,
      );
    }
  }
}

function printCalibration(results: Record<string, RunSummary[]>): void {
  console.log("\nCALIBRATION / PREDICTIVE VALUE (per-seed mean correlations)");
  for (const key of ["C", "C_meta_off", "C_plasticity_off", "C_prior_off", "C_frozen_self"]) {
    const runs = results[key];
    const show = (metric: keyof RunSummary) => {
      const values = runs
        .map((r) => r[metric])
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      return values.length ? `${meanOf(values).toFixed(2)} [${summarize(values, 31).ciLow.toFixed(2)}, ${summarize(values, 31).ciHigh.toFixed(2)}]` : "—";
    };
    console.log(`\n${key}`);
    console.log(`  trust~state          ${show("corrTrustState")}`);
    console.log(`  confidence~state     ${show("corrConfState")}`);
    console.log(`  trust~future state   ${show("corrTrustFutureState")}`);
    console.log(`  conf~future state    ${show("corrConfFutureState")}`);
    console.log(`  trust~future forward ${show("corrTrustForward")}`);
    console.log(`  conf~future forward  ${show("corrConfForward")}`);
    console.log(`  R2 conf              ${show("r2ConfFuture")}`);
    console.log(`  R2 conf+trust        ${show("r2BothFuture")}`);
    console.log(`  ECE trust            ${show("eceTrust")}`);
    console.log(`  ECE confidence       ${show("eceConf")}`);
    console.log(`  AUC trust low        ${show("aucTrustLow")}`);
    console.log(`  AUC confidence low   ${show("aucConfLow")}`);
  }
}

function printCorruption(results: CorruptionObservation[]): void {
  console.log("\nCORRUPTION RECOVERY (Mode C)");
  const groups = new Map<string, CorruptionObservation[]>();
  for (const r of results) {
    const key = `${r.control}/${r.corruption}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  for (const [key, runs] of groups) {
    if (key.endsWith("/clean")) continue;
    const recovered = runs.filter((r) => r.recovered).length;
    const detected = runs.filter((r) => r.detectedAt !== null).length;
    const detectedBeforeCorrection = runs.filter((r) => r.detectedBeforeCorrection).length;
    const detectionTimes = runs
      .map((r) => r.detectedAt)
      .filter((v): v is number => v !== null);
    const correctionTimes = runs
      .map((r) => r.correctedAt)
      .filter((v): v is number => v !== null);
    const trustBefore = runs
      .map((r) => r.trustBefore)
      .filter((v): v is number => v !== null);
    const trustAt = runs
      .map((r) => r.trustAtDetection)
      .filter((v): v is number => v !== null);
    const preRest = runs.map((r) => r.restFractionPre);
    const duringRest = runs.map((r) => r.restFractionDuring);
    console.log(
      `\n${key}: detected ${detected}/${runs.length}, detected before correction ${detectedBeforeCorrection}/${runs.length}, recovered ${recovered}/${runs.length}`,
    );
    console.log(
      `  detection tick ${detectionTimes.length ? `${meanOf(detectionTimes).toFixed(1)} (median ${medianOf(detectionTimes).toFixed(1)})` : "—"}`,
    );
    console.log(
      `  correction tick ${correctionTimes.length ? `${meanOf(correctionTimes).toFixed(1)} (median ${medianOf(correctionTimes).toFixed(1)})` : "—"}`,
    );
    console.log(
      `  trust before ${trustBefore.length ? meanOf(trustBefore).toFixed(3) : "—"} at detection ${trustAt.length ? meanOf(trustAt).toFixed(3) : "—"}`,
    );
    console.log(
      `  rest pre ${meanOf(preRest).toFixed(3)} during ${meanOf(duringRest).toFixed(3)} change ${(
        meanOf(duringRest) - meanOf(preRest)
      ).toFixed(3)}`,
    );
  }

  const recoverySimple = (control: string, corruption: string) => {
    const runs = results.filter((r) => r.control === control && r.corruption === corruption);
    return {
      recovered: runs.filter((r) => r.recovered).length,
      n: runs.length,
      rate: runs.filter((r) => r.recovered).length / Math.max(1, runs.length),
      correctionMean:
        meanOf(runs.map((r) => r.correctedAt).filter((v): v is number => v !== null) as number[]) ||
        NaN,
      detectionMean:
        meanOf(runs.map((r) => r.detectedAt).filter((v): v is number => v !== null) as number[]) ||
        NaN,
    };
  };
  for (const corruption of ["cheap", "expensive"] as const) {
    const on = recoverySimple("meta_on", corruption);
    const off = recoverySimple("meta_off", corruption);
    const plast = recoverySimple("plasticity_off", corruption);
    const prior = recoverySimple("prior_off", corruption);
    console.log(`\nMETA CONTRIBUTION ${corruption}`);
    for (const [name, s] of [
      ["meta_on", on],
      ["meta_off", off],
      ["plasticity_off", plast],
      ["prior_off", prior],
    ] as const) {
      const ci = proportionCI(s.recovered, s.n);
      console.log(
        `  ${name.padEnd(14)} recovery ${s.recovered}/${s.n} = ${(s.rate * 100).toFixed(
          1,
        )}% [${(ci[0] * 100).toFixed(0)}, ${(ci[1] * 100).toFixed(0)}] median correction ${Number.isFinite(
          s.correctionMean,
        ) ? s.correctionMean.toFixed(1) : "—"} median detection ${Number.isFinite(s.detectionMean) ? s.detectionMean.toFixed(1) : "—"}`,
      );
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

function ensureOutputDir(): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function main(): void {
  ensureOutputDir();
  const started = Date.now();
  const results: Record<string, RunSummary[]> = {};
  let runsDone = 0;
  const totalMain = CONDITIONS.length * SEEDS.length;
  console.log(
    `Running ${CONDITIONS.length} conditions × ${SEEDS.length} seeds × ${HORIZON} ticks`,
  );
  for (const condition of CONDITIONS) {
    const runs: RunSummary[] = [];
    for (const seed of SEEDS) {
      runs.push(runCondition(condition, seed, HORIZON));
      runsDone++;
      if (runsDone % 100 === 0) {
        console.log(`  ${runsDone}/${totalMain} main runs (${((Date.now() - started) / 1000).toFixed(0)}s)`);
      }
    }
    results[condition.key] = runs;
  }

  console.log("\nRunning corruption/control experiment...");
  const corruption: CorruptionObservation[] = [];
  for (const control of CONTROL_SETS) {
    for (const seed of SEEDS) {
      for (const level of ["cheap", "expensive"] as const) {
        corruption.push(analyzeCorruption(seed, control, level));
      }
      if (corruption.length % 100 === 0) {
        console.log(
          `  ${corruption.length}/${CONTROL_SETS.length * SEEDS.length * 2} corruption observations`,
        );
      }
    }
  }

  const serialisable = {
    metadata: {
      generatedAt: new Date().toISOString(),
      seeds: SEEDS.length,
      seedList: SEEDS,
      horizon: HORIZON,
      corruptionHorizon: CORRUPTION_HORIZON,
      conditions: CONDITIONS,
      controlSets: CONTROL_SETS,
      node: process.version,
    },
    results,
    corruption,
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "results.json"),
    JSON.stringify(serialisable, null, 2),
  );

  printConditionSummaries(results);
  printContrasts(results);
  printCalibration(results);
  printCorruption(corruption);

  // Compact key table for easy copy/paste into the report.
  const keyTable: Record<string, unknown> = {};
  for (const condition of CONDITIONS) {
    keyTable[condition.key] = conditionTable(results[condition.key]);
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "summary.json"),
    JSON.stringify({ metadata: serialisable.metadata, keyTable }, null, 2),
  );
  console.log(`\nWrote ${path.join(OUTPUT_DIR, "results.json")}`);
  console.log(`Wrote ${path.join(OUTPUT_DIR, "summary.json")}`);
  console.log(`Total elapsed ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main();
