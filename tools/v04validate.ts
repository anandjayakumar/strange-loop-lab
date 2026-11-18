/**
 * V0.4 validation harness. 100 paired seeds by default.
 *
 *   npx tsx tools/v04validate.ts
 *   SEEDS=20 HORIZON=600 npx tsx tools/v04validate.ts
 *
 * Answers the five V0.4 target questions and the three mechanistic indicator
 * controls. Writes raw per-run summaries to research/v04-results.json and
 * analysis aggregates to research/v04-analysis.json.
 */

import fs from "node:fs";
import path from "node:path";
import { V03Engine } from "../src/simulation/v03/engine";
import { V04Engine } from "../src/simulation/v04/engine";
import type {
  Difficulty,
  ExplorationMode,
  PriorRegime,
  Scenario,
  V04SeriesPoint,
} from "../src/simulation/v04/types";
import {
  formatP,
  holm,
  meanOf,
  pairedComparison,
  proportionCI,
  summarize,
} from "./stats";

type EngineVersion = "v03" | "v04";

interface Condition {
  key: string;
  label: string;
  version?: EngineVersion;
  difficulty?: Difficulty;
  prior?: PriorRegime;
  scenario?: Scenario;
  exploration?: ExplorationMode;
  lambda?: number;
  selfLearning?: boolean;
  selfFeedback?: boolean;
  metaFeedback?: boolean;
  metaLearning?: boolean;
  riskControl?: boolean;
  residualMeta?: boolean;
  preparation?: boolean;
  attentionSchema?: boolean;
  evidenceLink?: boolean;
  worldLearning?: boolean;
  worldModelEnabled?: boolean;
  beliefTrap?: "none" | "pessimistic_cost";
}

const CONDITIONS: Condition[] = [
  // --- Baseline / ablations ------------------------------------------------
  { key: "full", label: "V0.4 full · standard", exploration: "voi" },
  { key: "docile", label: "Docile", difficulty: "docile", exploration: "voi" },
  { key: "harsh", label: "Harsh", difficulty: "harsh", exploration: "voi" },
  { key: "severe", label: "Severe uninformed priors", prior: "severe", exploration: "voi" },
  { key: "severe_harsh", label: "Severe priors · harsh", difficulty: "harsh", prior: "severe", exploration: "voi" },
  { key: "pragmatic", label: "Pragmatic only", exploration: "pragmatic" },
  { key: "random", label: "Random exploration", exploration: "random" },
  { key: "uncertainty", label: "Uncertainty bonus", exploration: "uncertainty" },
  { key: "self_off", label: "Self feedback off", selfFeedback: false },
  { key: "self_frozen", label: "Self learning off", selfLearning: false },
  { key: "meta_off", label: "Meta feedback off", metaFeedback: false },
  { key: "risk_off", label: "Risk control off (naive meta)", riskControl: false },
  { key: "residual_off", label: "Residual meta off (baseline only)", residualMeta: false },
  { key: "meta_frozen", label: "Meta learning off", metaLearning: false },
  { key: "world_frozen", label: "World learning off", worldLearning: false },
  { key: "world_off", label: "World model off (neutral)", worldModelEnabled: false },
  { key: "evidence_off", label: "Action→evidence link broken", evidenceLink: false },

  // --- Regime shifts -------------------------------------------------------
  { key: "physical", label: "Physical regime shift", scenario: "physical_shift" },
  { key: "energy_shift", label: "Energy sensor shift", scenario: "energy_sensor_shift" },
  { key: "fatigue_shift", label: "Fatigue sensor shift", scenario: "fatigue_sensor_shift" },
  { key: "shared_shift", label: "Shared sensor shift", scenario: "shared_shift" },
  { key: "mixed", label: "Mixed regime shifts", scenario: "mixed_shifts" },

  // --- Meta-on vs meta-off under shifts / harsh ----------------------------
  { key: "harsh_meta_off", label: "Harsh · meta off", difficulty: "harsh", metaFeedback: false },
  { key: "severe_meta_off", label: "Severe priors · meta off", prior: "severe", metaFeedback: false },
  { key: "physical_meta_off", label: "Physical shift · meta off", scenario: "physical_shift", metaFeedback: false },
  { key: "energy_meta_off", label: "Energy shift · meta off", scenario: "energy_sensor_shift", metaFeedback: false },
  { key: "fatigue_meta_off", label: "Fatigue shift · meta off", scenario: "fatigue_sensor_shift", metaFeedback: false },
  { key: "shared_meta_off", label: "Shared shift · meta off", scenario: "shared_shift", metaFeedback: false },
  { key: "mixed_meta_off", label: "Mixed shifts · meta off", scenario: "mixed_shifts", metaFeedback: false },

  // --- Decoupled epistemic trap -------------------------------------------
  { key: "trap_pragmatic", label: "Trap · pragmatic", exploration: "pragmatic", beliefTrap: "pessimistic_cost" },
  { key: "trap_random", label: "Trap · random", exploration: "random", beliefTrap: "pessimistic_cost" },
  { key: "trap_uncertainty", label: "Trap · uncertainty", exploration: "uncertainty", beliefTrap: "pessimistic_cost" },
  { key: "trap_voi", label: "Trap · VoI", exploration: "voi", lambda: 0.9, beliefTrap: "pessimistic_cost" },
  { key: "trap_voi_meta_off", label: "Trap · VoI · meta off", exploration: "voi", lambda: 0.9, metaFeedback: false, beliefTrap: "pessimistic_cost" },
  { key: "trap_voi_prep_off", label: "Trap · VoI · preparation off", exploration: "voi", lambda: 0.9, preparation: false, beliefTrap: "pessimistic_cost" },
  { key: "trap_voi_ast_off", label: "Trap · VoI · AST off", exploration: "voi", lambda: 0.9, attentionSchema: false, beliefTrap: "pessimistic_cost" },
  { key: "trap_voi_l1", label: "Trap · VoI · L1 broken", exploration: "voi", lambda: 0.9, selfFeedback: false, beliefTrap: "pessimistic_cost" },
  { key: "trap_voi_l2", label: "Trap · VoI · L2 broken", exploration: "voi", lambda: 0.9, evidenceLink: false, beliefTrap: "pessimistic_cost" },
  { key: "trap_voi_l3", label: "Trap · VoI · L3 broken", exploration: "voi", lambda: 0.9, selfLearning: false, beliefTrap: "pessimistic_cost" },
  { key: "trap_voi_l4", label: "Trap · VoI · L4 broken", exploration: "voi", lambda: 0.9, metaLearning: false, beliefTrap: "pessimistic_cost" },
  { key: "trap_voi_l5", label: "Trap · VoI · L5 broken", exploration: "voi", lambda: 0.9, metaFeedback: false, beliefTrap: "pessimistic_cost" },
  { key: "shift_l1", label: "Shift · L1 broken", scenario: "physical_shift", selfFeedback: false },
  { key: "shift_l2", label: "Shift · L2 broken", scenario: "physical_shift", evidenceLink: false },
  { key: "shift_l3", label: "Shift · L3 broken", scenario: "physical_shift", selfLearning: false },
  { key: "shift_l4", label: "Shift · L4 broken", scenario: "physical_shift", metaLearning: false },
  { key: "shift_l5", label: "Shift · L5 broken", scenario: "physical_shift", metaFeedback: false },

  // --- Direct V0.3 comparison on the same seeds ----------------------------
  { key: "v03_full", label: "V0.3 full · standard", version: "v03" },
  { key: "v03_harsh", label: "V0.3 harsh", version: "v03", difficulty: "harsh" },
  { key: "v03_meta_off", label: "V0.3 meta off", version: "v03", metaFeedback: false },
  { key: "v03_physical", label: "V0.3 physical shift", version: "v03", scenario: "physical_shift" },
  { key: "v03_energy", label: "V0.3 energy shift", version: "v03", scenario: "energy_sensor_shift" },
  { key: "v03_fatigue", label: "V0.3 fatigue shift", version: "v03", scenario: "fatigue_sensor_shift" },
  { key: "v03_shared", label: "V0.3 shared shift", version: "v03", scenario: "shared_shift" },
  { key: "v03_trap_voi", label: "V0.3 trap · VoI", version: "v03", exploration: "voi", lambda: 0.9, beliefTrap: "pessimistic_cost" },
];

interface RunSummary {
  condition: string;
  seed: number;
  alive: boolean;
  ticks: number;
  resources: number;
  meanEnergy: number;
  minEnergy: number;
  selfMae: number;
  rawMae: number;
  postSelfMae: number | null;
  preSelfMae: number | null;
  postRawMae: number | null;
  metaBrier: number;
  metaEce: number;
  rollingBss: number;
  latentAuroc: number | null;
  toleranceRate: number;
  meanInfluence: number;
  meanUncertainty: number;
  meanInfo: number;
  meanVoi: number;
  meanRiskMargin: number;
  attributionTop: string;
  attributionConfidence: number;
  attributionPhysical: number;
  attributionEnergy: number;
  attributionFatigue: number;
  attributionShared: number;
  attributionInsufficient: number;
  attributionCorrect: boolean;
  roughCostMae: number;
  roughObservations: number;
  roughSteps: number;
  firstRoughTick: number | null;
  trapEscaped: boolean;
  recipeVersion: EngineVersion;
}

const SEEDS = Array.from({ length: Number(process.env.SEEDS ?? 100) }, (_, i) => i + 1);
const HORIZON = Number(process.env.HORIZON ?? 1000);
const TRAP_HORIZON = Number(process.env.TRAP_HORIZON ?? 1600);
const SHIFT_AT = 360;
const WINDOW_START = SHIFT_AT + 18;
const WINDOW_END = SHIFT_AT + 46;
const OUTPUT = path.resolve("research");

const EXPECTED_ATTRIBUTION: Record<string, string> = {
  physical: "physical",
  energy_shift: "energy_sensor",
  fatigue_shift: "fatigue_sensor",
  shared_shift: "shared",
};

function mean(values: readonly number[]): number {
  return values.length ? meanOf(values) : NaN;
}

function windowMean(points: V04SeriesPoint[], from: number, to: number): number | null {
  const slice = points.filter((p) => p.t >= from && p.t < to);
  return slice.length ? meanOf(slice.map((p) => p.energyError)) : null;
}

function attributionWindow(points: V04SeriesPoint[]): {
  physical: number;
  energy: number;
  fatigue: number;
  shared: number;
  insufficient: number;
  top: string;
} {
  const slice = points.filter((p) => p.t >= WINDOW_START && p.t < WINDOW_END);
  if (!slice.length) {
    return { physical: 0, energy: 0, fatigue: 0, shared: 0, insufficient: 1, top: "insufficient" };
  }
  const av = (key: keyof V04SeriesPoint): number =>
    meanOf(slice.map((p) => Number(p[key])));
  const values = {
    physical: av("attributionPhysical"),
    energy_sensor: av("attributionEnergy"),
    fatigue_sensor: av("attributionFatigue"),
    shared: av("attributionShared"),
    insufficient: av("attributionInsufficient"),
  };
  const entries = Object.entries(values) as [string, number][];
  entries.sort((a, b) => b[1] - a[1]);
  return {
    physical: values.physical,
    energy: values.energy_sensor,
    fatigue: values.fatigue_sensor,
    shared: values.shared,
    insufficient: values.insufficient,
    top: entries[0][0],
  };
}

function trapStats(points: V04SeriesPoint[], roughCostTrue: number): {
  roughSteps: number;
  firstRoughTick: number | null;
  trapEscaped: boolean;
  roughCostError: number;
  medianRoughEffort: number | null;
} {
  const rough = points.filter((p) => p.terrainRough);
  const first = rough.length ? rough[0].t : null;
  const efforts = rough
    .map((p) => p.lastEffort)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const meanEffort = efforts.length
    ? efforts.reduce((a, b) => a + b, 0) / efforts.length
    : null;
  const lastEstimate = points.length ? points[points.length - 1].roughCostEstimate : roughCostTrue;
  const target = meanEffort ?? roughCostTrue;
  return {
    roughSteps: rough.length,
    firstRoughTick: first,
    trapEscaped:
      rough.length >= 5 && Math.abs(lastEstimate - target) < 1.5,
    roughCostError: Math.abs(lastEstimate - roughCostTrue),
    medianRoughEffort: meanEffort,
  };
}

function runV04(condition: Condition, seed: number): RunSummary {
  const engine = new V04Engine({
    seed,
    difficulty: condition.difficulty ?? "standard",
    priorRegime: condition.prior ?? "uninformed",
    scenario: condition.scenario ?? "stable",
    explorationMode: condition.exploration ?? "voi",
    lambda: condition.lambda ?? 0.35,
    selfLearning: condition.selfLearning,
    selfFeedback: condition.selfFeedback,
    metaFeedback: condition.metaFeedback,
    metaLearning: condition.metaLearning,
    riskControl: condition.riskControl,
    residualMeta: condition.residualMeta,
    preparation: condition.preparation,
    attentionSchema: condition.attentionSchema,
    evidenceLink: condition.evidenceLink,
    worldLearning: condition.worldLearning,
    worldModelEnabled: condition.worldModelEnabled,
    beliefTrap: condition.beliefTrap,
    recordEvents: false,
    historyLimit: Math.max(HORIZON, TRAP_HORIZON),
  });
  const horizon = condition.beliefTrap === "pessimistic_cost" ? TRAP_HORIZON : HORIZON;
  while (engine.physical.alive && engine.getTick() < horizon) {
    engine.step();
  }
  const snapshot = engine.getSnapshot();
  const metrics = snapshot.metrics;
  const points = [...engine.getSeries()];
  const isShift = Boolean(condition.scenario && condition.scenario !== "stable");
  const shiftAt = condition.scenario === "mixed_shifts" ? 320 : SHIFT_AT;
  const attribution = attributionWindow(points);
  const roughCostTrue = points.length
    ? points[points.length - 1].roughCostTrue
    : snapshot.selfModel.roughCost;
  const trap = trapStats(points, roughCostTrue);

  return {
    condition: condition.key,
    seed,
    alive: snapshot.alive,
    ticks: snapshot.tick,
    resources: metrics.resources,
    meanEnergy: metrics.meanEnergy,
    minEnergy: metrics.minEnergy,
    selfMae: metrics.selfEnergyMae,
    rawMae: metrics.rawEnergyMae,
    preSelfMae: isShift ? windowMean(points, 0, shiftAt) : null,
    postSelfMae: isShift ? windowMean(points, shiftAt + 20, shiftAt + 220) : null,
    postRawMae: isShift
      ? mean(points.filter((p) => p.t >= shiftAt + 20 && p.t < shiftAt + 220).map((p) => p.rawEnergyError))
      : null,
    metaBrier: metrics.metaBrier,
    metaEce: metrics.metaEce,
    rollingBss: metrics.rollingBss,
    latentAuroc: metrics.latentAuroc,
    toleranceRate: metrics.toleranceRate,
    meanInfluence: metrics.meanInfluence,
    meanUncertainty: metrics.meanUncertainty,
    meanInfo: metrics.meanInfoValue,
    meanVoi: metrics.meanVoi,
    meanRiskMargin: mean(points.map((p) => p.riskMargin)),
    attributionTop: attribution.top,
    attributionConfidence: metrics.attributionConfidence,
    attributionPhysical: attribution.physical,
    attributionEnergy: attribution.energy,
    attributionFatigue: attribution.fatigue,
    attributionShared: attribution.shared,
    attributionInsufficient: attribution.insufficient,
    attributionCorrect: EXPECTED_ATTRIBUTION[condition.key]
      ? attribution.top === EXPECTED_ATTRIBUTION[condition.key]
      : false,
    roughCostMae: metrics.roughCostMae,
    roughObservations: snapshot.selfModel.roughObservations,
    roughSteps: trap.roughSteps,
    firstRoughTick: trap.firstRoughTick,
    trapEscaped: trap.trapEscaped,
    recipeVersion: "v04",
  };
}

function runV03(condition: Condition, seed: number): RunSummary {
  const engine = new V03Engine({
    seed,
    difficulty: condition.difficulty ?? "standard",
    priorRegime: condition.prior ?? "uninformed",
    scenario: condition.scenario ?? "stable",
    explorationMode: condition.exploration ?? "voi",
    lambda: condition.lambda ?? 0.35,
    selfLearning: condition.selfLearning,
    selfFeedback: condition.selfFeedback,
    metaFeedback: condition.metaFeedback,
    metaLearning: condition.metaLearning,
    worldLearning: condition.worldLearning,
    worldModelEnabled: condition.worldModelEnabled,
    beliefTrap: condition.beliefTrap,
    recordEvents: false,
    historyLimit: HORIZON,
  });
  const horizon = condition.beliefTrap === "pessimistic_cost" ? TRAP_HORIZON : HORIZON;
  while (engine.physical.alive && engine.getTick() < horizon) {
    engine.step();
  }
  const snapshot = engine.getSnapshot();
  const metrics = snapshot.metrics;
  const isShift = Boolean(condition.scenario && condition.scenario !== "stable");
  return {
    condition: condition.key,
    seed,
    alive: snapshot.alive,
    ticks: snapshot.tick,
    resources: metrics.resources,
    meanEnergy: metrics.meanEnergy,
    minEnergy: metrics.minEnergy,
    selfMae: metrics.selfEnergyMae,
    rawMae: metrics.rawEnergyMae,
    preSelfMae: null,
    postSelfMae: isShift ? null : null,
    postRawMae: null,
    metaBrier: metrics.metaBrier,
    metaEce: metrics.metaEce,
    rollingBss: NaN,
    latentAuroc: metrics.latentAuroc,
    toleranceRate: metrics.toleranceRate,
    meanInfluence: metrics.meanInfluence,
    meanUncertainty: metrics.meanUncertainty,
    meanInfo: metrics.meanInfoValue,
    meanVoi: metrics.meanVoi,
    meanRiskMargin: NaN,
    attributionTop: metrics.topAttribution,
    attributionConfidence: metrics.attributionConfidence,
    attributionPhysical: NaN,
    attributionEnergy: NaN,
    attributionFatigue: NaN,
    attributionShared: NaN,
    attributionInsufficient: NaN,
    attributionCorrect: false,
    roughCostMae: NaN,
    roughObservations: 0,
    roughSteps: NaN,
    firstRoughTick: null,
    trapEscaped: false,
    recipeVersion: "v03",
  };
}

function metric(run: RunSummary, key: keyof RunSummary): number {
  const value = run[key];
  return typeof value === "number" && Number.isFinite(value) ? value : NaN;
}

function paired(a: RunSummary[], b: RunSummary[], key: keyof RunSummary, seedOffset: number) {
  const mapA = new Map(a.map((r) => [r.seed, r]));
  const av: number[] = [];
  const bv: number[] = [];
  for (const run of b) {
    const other = mapA.get(run.seed);
    if (!other) continue;
    const x = metric(other, key);
    const y = metric(run, key);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      av.push(x);
      bv.push(y);
    }
  }
  if (av.length < 8) return null;
  return pairedComparison(av, bv, seedOffset);
}

function reportContrast(
  label: string,
  a: RunSummary[],
  b: RunSummary[],
  keys: (keyof RunSummary)[],
  seedOffset: number,
): void {
  const rows: { label: string; diff: number; ciLow: number; ciHigh: number; dz: number; p: number }[] = [];
  for (const key of keys) {
    const result = paired(a, b, key, seedOffset + rows.length);
    if (!result) continue;
    rows.push({
      label: String(key),
      diff: result.meanDiff,
      ciLow: result.ciLow,
      ciHigh: result.ciHigh,
      dz: result.cohenDz,
      p: result.pPermutation,
    });
  }
  if (!rows.length) return;
  const adjusted = holm(rows.map((r) => r.p));
  console.log(`\n${label}`);
  rows.forEach((row, i) => {
    console.log(
      `  ${row.label.padEnd(14)} ${row.diff >= 0 ? "+" : ""}${row.diff.toFixed(2)} [${row.ciLow.toFixed(2)}, ${row.ciHigh.toFixed(2)}] dz ${row.dz.toFixed(2)} p=${formatP(adjusted[i])}`,
    );
  });
}

function macroF1(
  truth: string[],
  predicted: string[],
  labels: string[],
): { macroF1: number; perClass: Record<string, { precision: number; recall: number; f1: number; support: number }> } {
  const perClass: Record<string, { precision: number; recall: number; f1: number; support: number }> = {};
  for (const label of labels) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let support = 0;
    for (let i = 0; i < truth.length; i++) {
      const t = truth[i] === label;
      const p = predicted[i] === label;
      if (t) support++;
      if (t && p) tp++;
      else if (!t && p) fp++;
      else if (t && !p) fn++;
    }
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    perClass[label] = { precision, recall, f1, support };
  }
  const macroF1 = mean(labels.map((label) => perClass[label].f1));
  return { macroF1, perClass };
}

function confusion(
  truth: string[],
  predicted: string[],
  labels: string[],
): Record<string, Record<string, number>> {
  const table: Record<string, Record<string, number>> = {};
  for (const t of labels) {
    table[t] = {};
    for (const p of labels) table[t][p] = 0;
  }
  for (let i = 0; i < truth.length; i++) {
    if (!table[truth[i]]) continue;
    if (!table[truth[i]][predicted[i]]) table[truth[i]][predicted[i]] = 0;
    table[truth[i]][predicted[i]]++;
  }
  return table;
}

/** PP-1: confident-prior probe. Compare a pulse early (naive) and late (trained). */
function pp1Probe(seed: number): {
  absorption: number;
  sustainedAbsorption: number;
  metaConfidence: number;
  precisionGain: number;
} {
  const engine = new V04Engine({
    seed,
    difficulty: "standard",
    priorRegime: "uninformed",
    scenario: "stable",
    explorationMode: "voi",
    lambda: 0.35,
    recordEvents: false,
    historyLimit: 600,
  });
  while (engine.getTick() < 200) engine.step();
  const before = engine.getSnapshot().selfModel.energyEstimate;
  const confidence = engine.getSnapshot().metaModel.toleranceProbability;
  const pulse = 12;
  engine.injectPulse(pulse, 0, 1);
  engine.step();
  const after = engine.getSnapshot().selfModel.energyEstimate;
  const absorption = 1 - Math.abs(after - before) / pulse;
  const precisionGain = engine.getSnapshot().selfModel.precisionGain;

  // Sustained multi-tick shift on the same seed: the prior must eventually
  // yield, so the residual absorption measured at the END of the pulse should
  // be small (the estimate has caught up).
  const sustained = new V04Engine({
    seed,
    difficulty: "standard",
    priorRegime: "uninformed",
    scenario: "stable",
    explorationMode: "voi",
    lambda: 0.35,
    recordEvents: false,
    historyLimit: 600,
  });
  while (sustained.getTick() < 200) sustained.step();
  const sustainedBefore = sustained.getSnapshot().selfModel.energyEstimate;
  sustained.injectPulse(pulse, 0, 10);
  for (let i = 0; i < 12; i++) sustained.step();
  const sustainedAfter = sustained.getSnapshot().selfModel.energyEstimate;
  const sustainedAbsorption = 1 - Math.abs(sustainedAfter - sustainedBefore) / pulse;
  return { absorption, sustainedAbsorption, metaConfidence: confidence, precisionGain };
}

/** AST-1 ablation: precision recovery after a 10-tick sensor glitch. */
function astProbe(seed: number, ast: boolean): {
  recoveryGain: number;
  postMae: number;
} {
  const engine = new V04Engine({
    seed,
    attentionSchema: ast,
    recordEvents: false,
    historyLimit: 900,
  });
  while (engine.getTick() < 300) engine.step();
  engine.injectPulse(12, 0, 10);
  const gains: number[] = [];
  const errors: number[] = [];
  for (let i = 0; i < 70; i++) {
    engine.step();
    const point = engine.getSeries()[engine.getSeries().length - 1];
    if (!point) continue;
    gains.push(point.precisionGain);
    if (i >= 10 && i < 35) errors.push(point.energyError);
  }
  const recoveryGain = gains.slice(10, 30).reduce((a, b) => a + b, 0) / 20;
  const postMae = errors.length
    ? errors.reduce((a, b) => a + b, 0) / errors.length
    : 0;
  return { recoveryGain, postMae };
}

/** Goodhart check: local meta loss vs unoptimised system outcomes, across seeds. */
function goodhart(
  local: RunSummary[],
  outcomes: RunSummary[],
): { correlation: number; lower: number; upper: number } {
  const map = new Map(outcomes.map((r) => [r.seed, r]));
  const xs: number[] = [];
  const ys: number[] = [];
  for (const run of local) {
    const other = map.get(run.seed);
    if (!other) continue;
    if (!Number.isFinite(run.metaBrier) || !Number.isFinite(other.resources)) continue;
    xs.push(-run.metaBrier);
    ys.push(other.resources);
  }
  if (xs.length < 8) return { correlation: 0, lower: 0, upper: 0 };
  const mx = meanOf(xs);
  const my = meanOf(ys);
  const cov = meanOf(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  const sx = Math.sqrt(meanOf(xs.map((x) => (x - mx) ** 2)));
  const sy = Math.sqrt(meanOf(ys.map((y) => (y - my) ** 2)));
  return {
    correlation: sx * sy > 1e-9 ? cov / (sx * sy) : 0,
    lower: 0,
    upper: 0,
  };
}

function main(): void {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const started = Date.now();
  const results: Record<string, RunSummary[]> = {};
  let count = 0;
  const total = CONDITIONS.length * SEEDS.length;
  for (const condition of CONDITIONS) {
    const runs: RunSummary[] = [];
    for (const seed of SEEDS) {
      runs.push(condition.version === "v03" ? runV03(condition, seed) : runV04(condition, seed));
      count++;
      if (count % 100 === 0) {
        console.log(`${count}/${total} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
      }
    }
    results[condition.key] = runs;
  }

  fs.writeFileSync(
    path.resolve("research/v04-results.json"),
    JSON.stringify(
      { metadata: { seeds: SEEDS, horizon: HORIZON, trapHorizon: TRAP_HORIZON, conditions: CONDITIONS }, results },
      null,
      2,
    ),
  );

  const s = (key: string) => {
    const runs = results[key];
    const alive = runs.filter((r) => r.alive).length;
    const r = summarize(runs.map((x) => x.resources), 11);
    const self = summarize(runs.map((x) => x.selfMae), 12);
    const raw = summarize(runs.map((x) => x.rawMae), 13);
    return `res ${r.mean.toFixed(1)} [${r.ciLow.toFixed(1)},${r.ciHigh.toFixed(1)}] alive ${alive}/${runs.length} self ${self.mean.toFixed(2)} raw ${raw.mean.toFixed(2)}`;
  };

  console.log("\n=== CONDITION SUMMARY ===");
  for (const condition of CONDITIONS) {
    console.log(`${condition.key.padEnd(20)} ${s(condition.key)}`);
  }

  // ---------------------------------------------------------------- Q1
  console.log("\n=== Q1: RESIDUAL META-MODEL ===");
  const metaKeys = ["full", "docile", "harsh", "severe", "physical", "energy_shift", "fatigue_shift", "shared_shift", "mixed"];
  for (const key of metaKeys) {
    const runs = results[key];
    const bss = summarize(runs.map((r) => r.rollingBss), 21);
    const aurocValues = runs.map((r) => r.latentAuroc).filter((v): v is number => v !== null && Number.isFinite(v));
    const roc = summarize(aurocValues, 22);
    const ece = summarize(runs.map((r) => r.metaEce), 23);
    console.log(
      `${key.padEnd(14)} rollingBSS ${bss.mean.toFixed(3)} [${bss.ciLow.toFixed(3)},${bss.ciHigh.toFixed(3)}] latentAUROC ${roc.mean.toFixed(3)} [${roc.ciLow.toFixed(3)},${roc.ciHigh.toFixed(3)}] ECE ${ece.mean.toFixed(3)}`,
    );
  }
  reportContrast("Q1 residual vs baseline-only", results.full, results.residual_off, ["metaBrier", "rollingBss", "latentAuroc", "selfMae"], 30);
  reportContrast("Q1 meta learning off", results.full, results.meta_frozen, ["metaBrier", "rollingBss", "latentAuroc"], 40);
  console.log(
    `V0.3 meta AUROC (full) ${mean(results.v03_full.map((r) => r.latentAuroc).filter((v): v is number => v !== null && Number.isFinite(v))).toFixed(3)} · V0.4 ${mean(results.full.map((r) => r.latentAuroc).filter((v): v is number => v !== null && Number.isFinite(v))).toFixed(3)}`,
  );

  // ---------------------------------------------------------------- Q2
  console.log("\n=== Q2: RISK-SENSITIVE META-CONTROL ===");
  const controlPairs: [string, string, string][] = [
    ["stable", "full", "meta_off"],
    ["harsh", "harsh", "harsh_meta_off"],
    ["severe", "severe", "severe_meta_off"],
    ["physical", "physical", "physical_meta_off"],
    ["energy", "energy_shift", "energy_meta_off"],
    ["fatigue", "fatigue_shift", "fatigue_meta_off"],
    ["shared", "shared_shift", "shared_meta_off"],
    ["mixed", "mixed", "mixed_meta_off"],
  ];
  for (const [label, on, off] of controlPairs) {
    const onRuns = results[on];
    const offRuns = results[off];
    const aliveOn = onRuns.filter((r) => r.alive).length;
    const aliveOff = offRuns.filter((r) => r.alive).length;
    const ciOn = proportionCI(aliveOn, onRuns.length);
    const ciOff = proportionCI(aliveOff, offRuns.length);
    console.log(
      `\n${label}: alive ${aliveOn}/${onRuns.length} [${(ciOn[0] * 100).toFixed(0)},${(ciOn[1] * 100).toFixed(0)}] vs ${aliveOff}/${offRuns.length} [${(ciOff[0] * 100).toFixed(0)},${(ciOff[1] * 100).toFixed(0)}]`,
    );
    reportContrast(
      `${label} meta-on vs meta-off`,
      onRuns,
      offRuns,
      ["resources", "ticks", "minEnergy", "postSelfMae", "meanVoi"],
      50,
    );
  }
  reportContrast("Risk control on vs naive meta", results.full, results.risk_off, ["resources", "minEnergy", "selfMae", "metaBrier"], 60);

  // ---------------------------------------------------------------- Q3
  console.log("\n=== Q3: ACTION-CONDITIONED ATTRIBUTION ===");
  const attrKeys = ["physical", "energy_shift", "fatigue_shift", "shared_shift"];
  const truth: string[] = [];
  const predicted: string[] = [];
  for (const key of attrKeys) {
    for (const run of results[key]) {
      truth.push(EXPECTED_ATTRIBUTION[key]);
      predicted.push(run.attributionTop);
    }
  }
  const labels = ["physical", "energy_sensor", "fatigue_sensor", "shared", "insufficient"];
  const f1 = macroF1(truth, predicted, labels);
  console.log(`macro-F1 ${f1.macroF1.toFixed(3)} over ${truth.length} shift runs`);
  for (const label of labels) {
    const c = f1.perClass[label];
    console.log(`  ${label.padEnd(15)} P ${c.precision.toFixed(2)} R ${c.recall.toFixed(2)} F1 ${c.f1.toFixed(2)} n ${c.support}`);
  }
  console.log("\nconfusion matrix (rows truth, cols predicted)");
  const table = confusion(truth, predicted, labels);
  console.log(`${"".padEnd(15)}${labels.map((l) => l.slice(0, 10).padStart(11)).join("")}`);
  for (const t of labels) {
    console.log(`${t.padEnd(15)}${labels.map((p) => String(table[t][p] ?? 0).padStart(11)).join("")}`);
  }
  for (const key of attrKeys) {
    const runs = results[key];
    const correct = runs.filter((r) => r.attributionCorrect).length;
    const ci = proportionCI(correct, runs.length);
    console.log(
      `${key.padEnd(14)} correct ${correct}/${runs.length} = ${(100 * correct / runs.length).toFixed(1)}% [${(ci[0] * 100).toFixed(0)},${(ci[1] * 100).toFixed(0)}]`,
    );
  }
  console.log("\nV0.3 attribution (top over whole run)");
  for (const [key, expected] of [
    ["v03_physical", "physical"],
    ["v03_energy", "energy_sensor"],
    ["v03_fatigue", "fatigue_sensor"],
    ["v03_shared", "shared"],
  ] as const) {
    const runs = results[key];
    const correct = runs.filter((r) => r.attributionTop === expected).length;
    console.log(`${key.padEnd(14)} ${correct}/${runs.length}`);
  }

  // ---------------------------------------------------------------- Q4
  console.log("\n=== Q4: DECOUPLED EPISTEMIC TRAP ===");
  const trapKeys = ["trap_pragmatic", "trap_random", "trap_uncertainty", "trap_voi", "trap_voi_meta_off", "v03_trap_voi"];
  for (const key of trapKeys) {
    const runs = results[key];
    const escaped = runs.filter((r) => r.trapEscaped).length;
    const rough = runs.filter((r) => r.roughSteps > 0).length;
    const ci = proportionCI(escaped, runs.length);
    const res = summarize(runs.map((r) => r.resources), 71);
    const first = summarize(
      runs.map((r) => r.firstRoughTick).filter((v): v is number => v !== null),
      72,
    );
    console.log(
      `${key.padEnd(18)} escaped ${escaped}/${runs.length} [${(ci[0] * 100).toFixed(0)},${(ci[1] * 100).toFixed(0)}] anyRough ${rough}/${runs.length} res ${res.mean.toFixed(1)} firstRough ${Number.isFinite(first.mean) ? first.mean.toFixed(0) : "—"}`,
    );
  }
  reportContrast("VoI vs pragmatic (trap)", results.trap_voi, results.trap_pragmatic, ["resources", "roughSteps", "roughObservations", "roughCostMae"], 80);
  reportContrast("VoI vs random (trap)", results.trap_voi, results.trap_random, ["resources", "roughSteps", "roughObservations", "roughCostMae"], 90);

  console.log("\n5-link intervention (trap · VoI)");
  const links: [string, string][] = [
    ["L1 prediction→action", "trap_voi_l1"],
    ["L2 action→evidence", "trap_voi_l2"],
    ["L3 evidence→M1", "trap_voi_l3"],
    ["L4 M1→M2", "trap_voi_l4"],
    ["L5 M2→control", "trap_voi_l5"],
  ];
  const fullEscape = results.trap_voi.filter((r) => r.trapEscaped).length / results.trap_voi.length;
  for (const [label, key] of links) {
    const runs = results[key];
    const escaped = runs.filter((r) => r.trapEscaped).length;
    const ci = proportionCI(escaped, runs.length);
    const res = summarize(runs.map((r) => r.resources), 100);
    console.log(
      `${label.padEnd(22)} escape ${(100 * escaped / runs.length).toFixed(0)}% [${(ci[0] * 100).toFixed(0)},${(ci[1] * 100).toFixed(0)}] (full ${(100 * fullEscape).toFixed(0)}%) res ${res.mean.toFixed(1)}`,
    );
  }
  console.log("\n5-link intervention (physical shift)");
  const shiftFull = results.physical;
  const fullAlive = shiftFull.filter((r) => r.alive).length / shiftFull.length;
  const fullPost = summarize(shiftFull.map((r) => r.postSelfMae ?? NaN), 101);
  console.log(
    `Full                   alive ${(100 * fullAlive).toFixed(0)}% post-shift MAE ${fullPost.mean.toFixed(2)} res ${mean(shiftFull.map((r) => r.resources)).toFixed(1)}`,
  );
  for (const [label, key] of [
    ["L1 prediction→action", "shift_l1"],
    ["L2 action→evidence", "shift_l2"],
    ["L3 evidence→M1", "shift_l3"],
    ["L4 M1→M2", "shift_l4"],
    ["L5 M2→control", "shift_l5"],
  ] as [string, string][]) {
    const runs = results[key];
    const alive = runs.filter((r) => r.alive).length;
    const ci = proportionCI(alive, runs.length);
    const post = summarize(runs.map((r) => r.postSelfMae ?? NaN), 102);
    const res = summarize(runs.map((r) => r.resources), 103);
    console.log(
      `${label.padEnd(22)} alive ${(100 * alive / runs.length).toFixed(0)}% [${(ci[0] * 100).toFixed(0)},${(ci[1] * 100).toFixed(0)}] post MAE ${post.mean.toFixed(2)} res ${res.mean.toFixed(1)}`,
    );
  }

  // ---------------------------------------------------------------- Q5
  console.log("\n=== Q5: LEARNED WORLD VS NEUTRAL NO-WORLD ===");
  reportContrast("Learned vs frozen world", results.full, results.world_frozen, ["resources", "selfMae"], 110);
  reportContrast("Learned vs neutral no-world", results.full, results.world_off, ["resources", "selfMae"], 120);

  // ---------------------------------------------------------------- V0.3 vs V0.4
  console.log("\n=== DIRECT V0.3 VS V0.4 (same seeds) ===");
  const versionPairs: [string, string, string][] = [
    ["standard", "full", "v03_full"],
    ["harsh", "harsh", "v03_harsh"],
    ["meta off", "meta_off", "v03_meta_off"],
    ["physical", "physical", "v03_physical"],
    ["energy", "energy_shift", "v03_energy"],
    ["fatigue", "fatigue_shift", "v03_fatigue"],
    ["shared", "shared_shift", "v03_shared"],
    ["trap VoI", "trap_voi", "v03_trap_voi"],
  ];
  for (const [label, a, b] of versionPairs) {
    reportContrast(`V0.4 vs V0.3 · ${label}`, results[a], results[b], ["resources", "selfMae", "metaBrier"], 140);
  }

  // ---------------------------------------------------------------- PP-1
  console.log("\n=== Q1: PP-1 PRECISION-GATED ABSORPTION ===");
  const pp1 = SEEDS.slice(0, 60).map((seed) => pp1Probe(seed));
  const absorption = summarize(pp1.map((p) => p.absorption), 150);
  const sustainedAbsorption = summarize(pp1.map((p) => p.sustainedAbsorption), 151);
  const conf = summarize(pp1.map((p) => p.metaConfidence), 153);
  const gainPulse = summarize(pp1.map((p) => p.precisionGain), 154);
  console.log(
    `1-tick absorption ${absorption.mean.toFixed(3)} [${absorption.ciLow.toFixed(3)},${absorption.ciHigh.toFixed(3)}] · sustained-shift absorption ${sustainedAbsorption.mean.toFixed(3)} · gain during pulse ${gainPulse.mean.toFixed(2)} · meta confidence ${conf.mean.toFixed(2)}`,
  );

  console.log("\n=== Q5: ATTENTION SCHEMA (AST-1) ABLATION ===");
  const astSeeds = SEEDS.slice(0, 40);
  const astOn = astSeeds.map((seed) => astProbe(seed, true));
  const astOff = astSeeds.map((seed) => astProbe(seed, false));
  const gainOn = summarize(astOn.map((r) => r.recoveryGain), 170);
  const gainOff = summarize(astOff.map((r) => r.recoveryGain), 171);
  const maeOn = summarize(astOn.map((r) => r.postMae), 172);
  const maeOff = summarize(astOff.map((r) => r.postMae), 173);
  const astDiff = pairedComparison(
    astOn.map((r) => r.recoveryGain),
    astOff.map((r) => r.recoveryGain),
    174,
  );
  console.log(
    `post-glitch gain AST-on ${gainOn.mean.toFixed(3)} vs AST-off ${gainOff.mean.toFixed(3)} · Δ ${astDiff.meanDiff.toFixed(3)} [${astDiff.ciLow.toFixed(3)},${astDiff.ciHigh.toFixed(3)}] dz ${astDiff.cohenDz.toFixed(2)} p=${formatP(astDiff.pPermutation)}`,
  );
  console.log(
    `post-glitch MAE AST-on ${maeOn.mean.toFixed(2)} vs AST-off ${maeOff.mean.toFixed(2)}`,
  );

  // ---------------------------------------------------------------- Goodhart
  console.log("\n=== GOODHART / GAMING CHECK ===");
  const gh = goodhart(results.full, results.full);
  console.log(
    `local meta Brier skill vs resources r=${gh.correlation.toFixed(3)} (r>0 means lower local meta loss is associated with more resources)`,
  );
  reportContrast("Local meta loss vs system outcome", results.full, results.residual_off, ["metaBrier", "resources", "ticks"], 160);

  // ---------------------------------------------------------------- write analysis
  const analysis = {
    q1: Object.fromEntries(
      metaKeys.map((key) => [
        key,
        {
          rollingBss: summarize(results[key].map((r) => r.rollingBss), 200),
          latentAuroc: summarize(
            results[key].map((r) => r.latentAuroc).filter((v): v is number => v !== null && Number.isFinite(v)),
            201,
          ),
          metaEce: summarize(results[key].map((r) => r.metaEce), 202),
        },
      ]),
    ),
    q3: { macroF1: f1.macroF1, perClass: f1.perClass, confusion: table },
    q4: Object.fromEntries(
      trapKeys.map((key) => [
        key,
        {
          escapeRate: results[key].filter((r) => r.trapEscaped).length / results[key].length,
          anyRough: results[key].filter((r) => r.roughSteps > 0).length / results[key].length,
        },
      ]),
    ),
    pp1: { absorption, sustainedAbsorption, confidence: conf, gainPulse },
    ast: { gainOn, gainOff, maeOn, maeOff, diff: astDiff },
  };
  fs.writeFileSync(path.resolve("research/v04-analysis.json"), JSON.stringify(analysis, null, 2));
  console.log(`\nWrote research/v04-results.json in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main();
