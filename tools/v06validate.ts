/**
 * V0.6 full-rubric validation harness.
 *
 *   npx tsx tools/v06validate.ts
 *   SEEDS=20 npx tsx tools/v06validate.ts
 *
 * Runs the complete 7-mechanism x 5-experiment double dissociation, the four
 * adversarial controls on the common standard/shift, conflict, fork and three
 * unseen suites, and the three additional rubric controls (rolling tracker,
 * raw sensor vector, fixed decay). 100 paired seeds by default.
 */

import fs from "node:fs";
import path from "node:path";
import { V06Engine } from "../src/simulation/v06/engine";
import type {
  Ablation,
  ControlKind,
  DisruptionKind,
  V06Options,
  V06Scenario,
  V06SeriesPoint,
} from "../src/simulation/v06/types";
import {
  holm,
  meanOf,
  pairedComparison,
  proportionCI,
  summarize,
} from "./stats";

type Experiment = "exp1" | "exp2" | "exp3" | "exp4" | "exp5" | "gen";

interface Condition {
  key: string;
  label: string;
  experiment: Experiment;
  scenario: V06Scenario;
  control?: ControlKind;
  ablation?: Ablation;
  disruption?: DisruptionKind;
  horizon: number;
}

interface Mechanism {
  key: string;
  label: string;
  ablation: Ablation;
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const SEED_START = Number(arg("seed-start") ?? process.env.SEED_START ?? 1);
const SEED_COUNT = Number(arg("seeds") ?? process.env.SEEDS ?? 100);
const SEEDS = Array.from({ length: SEED_COUNT }, (_, i) => i + SEED_START);
const RESULTS_PATH = path.resolve(
  arg("out") ?? process.env.OUT ?? "research/v06-results.json",
);
const ANALYSIS_PATH = path.resolve(
  arg("analysis-out") ??
    process.env.ANALYSIS_OUT ??
    RESULTS_PATH.replace(/results\.json$/, "analysis.json"),
);

const MECHANISMS: Mechanism[] = [
  { key: "full", label: "V0.6 full", ablation: "none" },
  { key: "no_rpt", label: "No-RPT (K=1)", ablation: "no_rpt" },
  { key: "no_bottleneck", label: "No-GWT bottleneck", ablation: "no_gwt_bottleneck" },
  { key: "no_broadcast", label: "No-GWT broadcast", ablation: "no_gwt_broadcast" },
  { key: "no_hot", label: "No-HOT meta", ablation: "no_hot_meta" },
  { key: "no_ast", label: "No-AST", ablation: "no_ast" },
  { key: "no_selfsim", label: "No cognitive self-sim", ablation: "no_cognitive_self_sim" },
];

const DISRUPTIONS: DisruptionKind[] = ["self", "energy_sensor", "fatigue_sensor", "shared"];

const EXPERIMENTS: {
  key: "exp1" | "exp2" | "exp3" | "exp4" | "exp5";
  scenario: V06Scenario;
  horizon: number;
  disruptions?: DisruptionKind[];
}[] = [
  { key: "exp1", scenario: "glitch", horizon: 900 },
  { key: "exp2", scenario: "conflict", horizon: 600 },
  { key: "exp3", scenario: "self_disruption", horizon: 700, disruptions: DISRUPTIONS },
  { key: "exp4", scenario: "epistemic_fork", horizon: 1200 },
  { key: "exp5", scenario: "contingency_reversal", horizon: 700 },
];

const CONDITIONS: Condition[] = [];

for (const mechanism of MECHANISMS) {
  for (const experiment of EXPERIMENTS) {
    if (experiment.disruptions) {
      for (const disruption of experiment.disruptions) {
        CONDITIONS.push({
          key: `m_${mechanism.key}_${experiment.key}_${disruption}`,
          label: `${mechanism.label} · ${experiment.key} · ${disruption}`,
          experiment: experiment.key,
          scenario: experiment.scenario,
          ablation: mechanism.ablation,
          disruption,
          horizon: experiment.horizon,
        });
      }
    } else {
      CONDITIONS.push({
        key: `m_${mechanism.key}_${experiment.key}`,
        label: `${mechanism.label} · ${experiment.key}`,
        experiment: experiment.key,
        scenario: experiment.scenario,
        ablation: mechanism.ablation,
        horizon: experiment.horizon,
      });
    }
  }
}

// Full architecture on the unseen suites (Table C).
for (const [suffix, scenario] of [
  ["gen_topology", "unseen_topology"],
  ["gen_nonlinear", "unseen_nonlinear"],
  ["gen_compound", "unseen_compound"],
] as [string, V06Scenario][]) {
  CONDITIONS.push({
    key: `m_full_${suffix}`,
    label: `V0.6 full · ${scenario}`,
    experiment: "gen",
    scenario,
    ablation: "none",
    horizon: 800,
  });
}

// Four adversarial controls across the common benchmarks and unseen suites.
const CONTROLS: ControlKind[] = [
  "reactive",
  "physical_mpc",
  "flat_blackboard",
  "matched_feedforward",
];
const CONTROL_BENCHMARKS: {
  suffix: string;
  experiment: Experiment;
  scenario: V06Scenario;
  disruption?: DisruptionKind;
  horizon: number;
}[] = [
  { suffix: "standard_shift", experiment: "exp3", scenario: "self_disruption", disruption: "shared", horizon: 700 },
  { suffix: "conflict", experiment: "exp2", scenario: "conflict", horizon: 600 },
  { suffix: "fork", experiment: "exp4", scenario: "epistemic_fork", horizon: 1200 },
  { suffix: "gen_topology", experiment: "gen", scenario: "unseen_topology", horizon: 800 },
  { suffix: "gen_nonlinear", experiment: "gen", scenario: "unseen_nonlinear", horizon: 800 },
  { suffix: "gen_compound", experiment: "gen", scenario: "unseen_compound", horizon: 800 },
];
for (const control of CONTROLS) {
  for (const bench of CONTROL_BENCHMARKS) {
    CONDITIONS.push({
      key: `c_${control}_${bench.suffix}`,
      label: `${control} · ${bench.suffix}`,
      experiment: bench.experiment,
      scenario: bench.scenario,
      control,
      disruption: bench.disruption,
      horizon: bench.horizon,
    });
  }
}

// Three rubric controls.
CONDITIONS.push(
  {
    key: "r_rolling_exp1",
    label: "1-param rolling tracker · exp1",
    experiment: "exp1",
    scenario: "glitch",
    control: "rolling_tracker",
    horizon: 900,
  },
  {
    key: "r_rolling_exp3",
    label: "1-param rolling tracker · exp3 shared",
    experiment: "exp3",
    scenario: "self_disruption",
    control: "rolling_tracker",
    disruption: "shared",
    horizon: 700,
  },
  {
    key: "r_raw_exp1",
    label: "Raw sensor vector · exp1",
    experiment: "exp1",
    scenario: "glitch",
    control: "raw_sensor",
    horizon: 900,
  },
  {
    key: "r_fixed_exp1",
    label: "Fixed exponential decay · exp1",
    experiment: "exp1",
    scenario: "glitch",
    control: "fixed_decay",
    horizon: 900,
  },
);

interface RunSummary {
  experiment: Experiment;
  condition: string;
  seed: number;
  alive: boolean;
  ticks: number;
  resources: number;
  distance: number;
  meanEnergy: number;
  minEnergy: number;
  selfMae: number;
  rawMae: number;
  stationaryMae: number;
  conflictMae: number;
  absorption: number | null;
  pulses: number;
  convergence: number;
  entropyDrop: number;
  qualityStability: number;
  qualitySep: number;
  rawSep: number;
  qualityModeCorr: number;
  rawModeCorr: number;
  rollingBss: number;
  postGlitchMae: number;
  astGain: number;
  windowThrash: number;
  coherence: number;
  binding: number;
  actionEntropy: number;
  metaBrier: number;
  metaEce: number;
  metaAuroc: number | null;
  relBrier: number;
  relEce: number;
  relAuroc: number | null;
  attrTop: string;
  attrCorrect: boolean;
  routing: number;
  probed: boolean;
  probeTick: number | null;
  forkSolved: boolean;
  forkRegret: number;
  detectLatency: number | null;
  preCostMae: number;
  postCostMae: number;
  recalibration: number;
  computeUnits: number;
}

function windowPoints(points: readonly V06SeriesPoint[], from: number, to: number) {
  return points.filter((p) => p.t >= from && p.t < to);
}

function windowMean(points: readonly V06SeriesPoint[], from: number, to: number, key: keyof V06SeriesPoint) {
  const slice = windowPoints(points, from, to).map((p) => Number(p[key]));
  return slice.length ? meanOf(slice) : NaN;
}

function windowAttribution(points: readonly V06SeriesPoint[], from: number, to: number) {
  const slice = windowPoints(points, from, to);
  if (!slice.length) return { top: "insufficient" };
  const keys = ["physical", "energy_sensor", "fatigue_sensor", "shared", "insufficient"] as const;
  const scores = Object.fromEntries(keys.map((key) => [key, meanOf(slice.map((p) => p.attribution[key]))]));
  const top = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0] ?? ["insufficient"])[0];
  return { top };
}

function pulseAbsorption(points: readonly V06SeriesPoint[]) {
  const values: number[] = [];
  for (let i = 1; i < points.length; i++) {
    if (!points[i].pulseActive) continue;
    const prev = points[i - 1];
    const dRaw = Math.abs(points[i].rawEnergyReading - prev.rawEnergyReading);
    const dEst = Math.abs(points[i].energyEstimate - prev.energyEstimate);
    if (dRaw > 4) values.push(1 - Math.min(1, dEst / dRaw));
  }
  return { mean: values.length ? meanOf(values) : null, count: values.length };
}

function stationaryMae(points: readonly V06SeriesPoint[]) {
  const pulseTicks = [120, 220, 620, 720];
  const values = points
    .filter((p) => !pulseTicks.some((t) => Math.abs(p.t - t) <= 2))
    .map((p) => p.energyError);
  return values.length ? meanOf(values) : NaN;
}

function conflictMae(points: readonly V06SeriesPoint[]) {
  const collected = points.filter((p) => p.collected).map((p) => p.t);
  const values = points
    .filter(
      (p) =>
        p.t >= 330 &&
        p.t < 390 &&
        !collected.some((t) => Math.abs(p.t - t) <= 3),
    )
    .map((p) => p.energyError);
  return values.length ? meanOf(values) : NaN;
}

function switchRate(points: readonly V06SeriesPoint[], from: number, to: number) {
  const slice = windowPoints(points, from, to);
  if (slice.length < 2) return 0;
  let switches = 0;
  for (let i = 1; i < slice.length; i++) if (slice[i].action !== slice[i - 1].action) switches++;
  return switches / (slice.length - 1);
}

function windowEntropy(points: readonly V06SeriesPoint[], from: number, to: number) {
  const slice = windowPoints(points, from, to);
  if (!slice.length) return 0;
  const counts = new Map<string, number>();
  for (const p of slice) counts.set(p.action, (counts.get(p.action) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / slice.length;
    if (p > 0) entropy -= p * Math.log(p);
  }
  return entropy;
}

function detectionLatency(points: readonly V06SeriesPoint[], from: number, acceptable: string[], horizon: number) {
  const match = points.find((p) => p.t >= from && acceptable.includes(p.attributionTop));
  return match ? match.t - from : horizon - from;
}

function recoveryLatency(points: readonly V06SeriesPoint[], from: number, horizon: number) {
  const match = points.find((p) => p.t >= from && p.attentionRecovery > 0.2);
  return match ? match.t - from : horizon - from;
}

const EXPECTED: Record<string, string> = {
  self: "physical",
  energy_sensor: "energy_sensor",
  fatigue_sensor: "fatigue_sensor",
  shared: "shared",
};

function runEpisode(condition: Condition, seed: number): RunSummary {
  const options: Partial<V06Options> = {
    seed,
    scenario: condition.scenario,
    control: condition.control ?? "full",
    ablation: condition.ablation ?? "none",
    disruption: condition.disruption ?? "energy_sensor",
    recordEvents: false,
    historyLimit: Math.max(condition.horizon, 2000),
  };
  const engine = new V06Engine(options);
  while (engine.physical.alive && engine.getTick() < condition.horizon) engine.step();
  const snapshot = engine.getSnapshot();
  const metrics = snapshot.metrics;
  const points = [...engine.getSeries()];

  const abs = pulseAbsorption(points);
  const attrWindow =
    condition.experiment === "exp3"
      ? windowAttribution(points, 310, 400)
      : windowAttribution(points, 0, points.length);
  const expected = condition.disruption ? EXPECTED[condition.disruption] : undefined;
  const preCost = windowMean(points, 200, 300, "costError");
  const postCost = windowMean(points, 340, 520, "costError");
  const detect =
    condition.experiment === "exp5"
      ? detectionLatency(points, 300, ["physical", "shared"], condition.horizon)
      : condition.experiment === "exp2"
        ? recoveryLatency(points, 344, condition.horizon)
        : null;
  const probes = points.filter((p) => p.terrainRough);
  const probeTick = probes.length ? probes[0].t : null;
  const probed = probes.length > 0 || snapshot.selfModel.roughObservations > 0;
  const forkSolved = probed && snapshot.metrics.resources >= 25;

  return {
    experiment: condition.experiment,
    condition: condition.key,
    seed,
    alive: snapshot.alive,
    ticks: snapshot.tick,
    resources: metrics.resources,
    distance: metrics.distance,
    meanEnergy: metrics.meanEnergy,
    minEnergy: metrics.minEnergy,
    selfMae: metrics.selfEnergyMae,
    rawMae: metrics.rawEnergyMae,
    stationaryMae: stationaryMae(points),
    conflictMae: condition.experiment === "exp2" ? conflictMae(points) : NaN,
    absorption: abs.mean,
    pulses: abs.count,
    convergence: metrics.settlingConvergence,
    entropyDrop: metrics.withinTickEntropyDrop,
    qualityStability: metrics.qualityStability,
    qualitySep: metrics.qualitySpaceSeparability,
    rawSep: metrics.rawSpaceSeparability,
    qualityModeCorr: metrics.qualityModeSwitchCorrelation,
    rawModeCorr: metrics.rawModeSwitchCorrelation,
    rollingBss: metrics.rollingBss,
    postGlitchMae: metrics.postGlitchMae,
    astGain: metrics.astRecoveryGainDelta,
    windowThrash: switchRate(points, 300, 390),
    coherence: metrics.goalCoherence,
    binding: metrics.bindingAccuracy,
    actionEntropy: windowEntropy(points, 300, 390),
    metaBrier: metrics.metaBrier,
    metaEce: metrics.metaEce,
    metaAuroc: metrics.metaAuroc,
    relBrier: metrics.reliabilityBrier,
    relEce: metrics.reliabilityEce,
    relAuroc: metrics.reliabilityAuroc,
    attrTop: attrWindow.top,
    attrCorrect: expected ? attrWindow.top === expected : false,
    routing: metrics.routingCorruption,
    probed,
    probeTick,
    forkSolved,
    forkRegret: Math.max(0, 90 - metrics.resources) / 90,
    detectLatency: detect,
    preCostMae: preCost,
    postCostMae: postCost,
    recalibration: preCost - postCost,
    computeUnits: metrics.computeUnits,
  };
}

function metric(run: RunSummary, key: keyof RunSummary): number {
  const v = run[key];
  if (typeof v === "boolean") return v ? 1 : 0;
  return typeof v === "number" && Number.isFinite(v) ? v : NaN;
}

function paired(a: RunSummary[], b: RunSummary[], key: keyof RunSummary, seedOffset: number) {
  const map = new Map(a.map((r) => [r.seed, r]));
  const av: number[] = [];
  const bv: number[] = [];
  for (const run of b) {
    const other = map.get(run.seed);
    if (!other) continue;
    const x = metric(other, key);
    const y = metric(run, key);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      av.push(x);
      bv.push(y);
    }
  }
  if (av.length < 8) return null;
  return pairedComparison(av, bv, seedOffset, 2000);
}

interface ContrastRow {
  metric: string;
  diff: number;
  ciLow: number;
  ciHigh: number;
  dz: number;
  p: number;
  adjusted: number;
  n: number;
}

function contrast(a: RunSummary[], b: RunSummary[], keys: (keyof RunSummary)[], seedOffset: number): ContrastRow[] {
  const rows: ContrastRow[] = [];
  for (const key of keys) {
    const result = paired(a, b, key, seedOffset + rows.length);
    if (!result) continue;
    rows.push({
      metric: String(key),
      diff: result.meanDiff,
      ciLow: result.ciLow,
      ciHigh: result.ciHigh,
      dz: result.cohenDz,
      p: result.pPermutation,
      adjusted: 1,
      n: result.n,
    });
  }
  const adjusted = holm(rows.map((r) => r.p));
  rows.forEach((row, i) => (row.adjusted = adjusted[i]));
  return rows;
}

function macroF1(truth: string[], predicted: string[], labels: string[]) {
  const perClass: Record<string, { precision: number; recall: number; f1: number; support: number }> = {};
  for (const label of labels) {
    let tp = 0, fp = 0, fn = 0, support = 0;
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
  return { macroF1: meanOf(labels.map((l) => perClass[l].f1)), perClass };
}

function summarizeCondition(runs: RunSummary[], keys: (keyof RunSummary)[], seedBase: number) {
  return Object.fromEntries(
    keys.map((key, index) => [
      key,
      summarize(
        runs.map((r) => metric(r, key)).filter(Number.isFinite),
        seedBase + index,
        1000,
      ),
    ]),
  );
}

function main(): void {
  fs.mkdirSync(path.resolve("research"), { recursive: true });
  const started = Date.now();
  const results: Record<string, RunSummary[]> = {};
  let count = 0;
  const total = CONDITIONS.length * SEEDS.length;
  for (const condition of CONDITIONS) {
    const runs: RunSummary[] = [];
    for (const seed of SEEDS) {
      runs.push(runEpisode(condition, seed));
      count++;
      if (count % 100 === 0) {
        console.log(`${count}/${total} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
      }
    }
    results[condition.key] = runs;
  }

  fs.writeFileSync(
    RESULTS_PATH,
    JSON.stringify(
      {
        metadata: {
          generatedAt: new Date().toISOString(),
          version: "V0.6",
          seeds: SEEDS,
          conditions: CONDITIONS,
          note: "Full 7x5 mechanism matrix plus common controls; latent labels evaluation-only.",
        },
        results,
      },
      null,
      2,
    ),
  );

  const byKey = (key: string) => results[key] ?? [];

  console.log("\n=== CONDITION SUMMARY ===");
  for (const condition of CONDITIONS) {
    const runs = byKey(condition.key);
    const res = summarize(runs.map((r) => r.resources), 11, 1000);
    const self = summarize(runs.map((r) => r.selfMae), 12, 1000);
    const alive = runs.filter((r) => r.alive).length;
    console.log(
      `${condition.key.padEnd(34)} res ${res.mean.toFixed(1)} [${res.ciLow.toFixed(1)},${res.ciHigh.toFixed(1)}] self ${self.mean.toFixed(2)} alive ${alive}/${runs.length} attr ${runs[0].attrTop}`,
    );
  }

  // ---------------------------------------------------------------- exp 1
  console.log("\n=== EXP 1: AMBIGUOUS SETTLING / PP-1 ===");
  const exp1Keys: (keyof RunSummary)[] = ["absorption", "stationaryMae", "convergence", "entropyDrop"];
  for (const mechanism of MECHANISMS) {
    const runs = byKey(`m_${mechanism.key}_exp1`);
    const absorption = summarize(
      runs.map((r) => r.absorption).filter((v): v is number => v !== null),
      21,
      1000,
    );
    const mae = summarize(runs.map((r) => r.stationaryMae), 22, 1000);
    const ent = summarize(runs.map((r) => r.entropyDrop), 23, 1000);
    console.log(
      `${mechanism.key.padEnd(14)} absorption ${absorption.mean.toFixed(3)} [${absorption.ciLow.toFixed(3)},${absorption.ciHigh.toFixed(3)}] MAE ${mae.mean.toFixed(2)} [${mae.ciLow.toFixed(2)},${mae.ciHigh.toFixed(2)}] entropyDrop ${ent.mean.toFixed(3)}`,
    );
  }
  const exp1Contrasts: Record<string, ContrastRow[]> = {};
  for (const mechanism of MECHANISMS.slice(1)) {
    exp1Contrasts[mechanism.key] = contrast(
      byKey("m_full_exp1"),
      byKey(`m_${mechanism.key}_exp1`),
      exp1Keys,
      101,
    );
  }

  // ---------------------------------------------------------------- exp 2
  console.log("\n=== EXP 2: COMPOUND CONFLICT ===");
  const exp2Keys: (keyof RunSummary)[] = ["windowThrash", "coherence", "conflictMae", "detectLatency", "resources"];
  for (const mechanism of MECHANISMS) {
    const runs = byKey(`m_${mechanism.key}_exp2`);
    const thrash = summarize(runs.map((r) => r.windowThrash), 31, 1000);
    const coh = summarize(runs.map((r) => r.coherence), 32, 1000);
    const mae = summarize(runs.map((r) => r.conflictMae), 33, 1000);
    const lat = summarize(runs.map((r) => r.detectLatency ?? NaN).filter(Number.isFinite), 34, 1000);
    console.log(
      `${mechanism.key.padEnd(14)} 1-thrash ${(1 - thrash.mean).toFixed(3)} coherence ${coh.mean.toFixed(3)} conflictMAE ${mae.mean.toFixed(2)} recovery ${lat.mean.toFixed(0)}`,
    );
  }
  const exp2Contrasts: Record<string, ContrastRow[]> = {};
  for (const mechanism of MECHANISMS.slice(1)) {
    exp2Contrasts[mechanism.key] = contrast(
      byKey("m_full_exp2"),
      byKey(`m_${mechanism.key}_exp2`),
      exp2Keys,
      201,
    );
  }

  // ---------------------------------------------------------------- exp 3
  console.log("\n=== EXP 3: 4-WAY ATTRIBUTION / HOT ===");
  const labels = ["physical", "energy_sensor", "fatigue_sensor", "shared", "insufficient"];
  const exp3Stats: Record<string, { truth: string[]; pred: string[]; correct: number; n: number; relAuroc: number[]; routing: number[] }> = {};
  for (const mechanism of MECHANISMS) {
    exp3Stats[mechanism.key] = { truth: [], pred: [], correct: 0, n: 0, relAuroc: [], routing: [] };
    for (const disruption of DISRUPTIONS) {
      const runs = byKey(`m_${mechanism.key}_exp3_${disruption}`);
      const expected = EXPECTED[disruption];
      for (const run of runs) {
        exp3Stats[mechanism.key].truth.push(expected);
        exp3Stats[mechanism.key].pred.push(run.attrTop);
        if (run.attrCorrect) exp3Stats[mechanism.key].correct++;
        exp3Stats[mechanism.key].n++;
        if (run.relAuroc !== null && Number.isFinite(run.relAuroc)) exp3Stats[mechanism.key].relAuroc.push(run.relAuroc);
        if (Number.isFinite(run.routing)) exp3Stats[mechanism.key].routing.push(run.routing);
      }
    }
  }
  const exp3F1: Record<string, ReturnType<typeof macroF1>> = {};
  for (const mechanism of MECHANISMS) {
    const stats = exp3Stats[mechanism.key];
    exp3F1[mechanism.key] = macroF1(stats.truth, stats.pred, labels);
    const ci = proportionCI(stats.correct, stats.n);
    const rel = summarize(stats.relAuroc, 41, 1000);
    const route = summarize(stats.routing, 42, 1000);
    console.log(
      `${mechanism.key.padEnd(14)} macro-F1 ${exp3F1[mechanism.key].macroF1.toFixed(3)} correct ${stats.correct}/${stats.n} [${(ci[0] * 100).toFixed(0)},${(ci[1] * 100).toFixed(0)}] relAUROC ${rel.mean.toFixed(2)} routing ${route.mean.toFixed(2)}`,
    );
  }
  console.log("full per-class recall", Object.fromEntries(
    Object.entries(exp3F1.full.perClass).map(([k, v]) => [k, v.recall.toFixed(2)]),
  ));
  const exp3Contrasts: Record<string, ContrastRow[]> = {};
  for (const mechanism of MECHANISMS.slice(1)) {
    const rows: ContrastRow[] = [];
    for (const disruption of DISRUPTIONS) {
      const a = byKey(`m_full_exp3_${disruption}`);
      const b = byKey(`m_${mechanism.key}_exp3_${disruption}`);
      const pair = contrast(a, b, ["relAuroc", "routing", "metaBrier", "metaAuroc", "selfMae"], 301);
      rows.push(...pair.map((row) => ({ ...row, metric: `${disruption}:${row.metric}` })));
    }
    const adjusted = holm(rows.map((r) => r.p));
    rows.forEach((row, i) => (row.adjusted = adjusted[i]));
    exp3Contrasts[mechanism.key] = rows;
  }

  // ---------------------------------------------------------------- exp 4
  console.log("\n=== EXP 4: EPISTEMIC FORK ===");
  const exp4Keys: (keyof RunSummary)[] = ["probed", "forkSolved", "resources", "probeTick", "forkRegret"];
  for (const mechanism of MECHANISMS) {
    const runs = byKey(`m_${mechanism.key}_exp4`);
    const probed = runs.filter((r) => r.probed).length;
    const solved = runs.filter((r) => r.forkSolved).length;
    const ci = proportionCI(solved, runs.length);
    const tick = summarize(runs.map((r) => r.probeTick ?? NaN).filter(Number.isFinite), 51, 1000);
    const res = summarize(runs.map((r) => r.resources), 52, 1000);
    console.log(
      `${mechanism.key.padEnd(14)} probed ${(100 * probed / runs.length).toFixed(0)}% solved ${(100 * solved / runs.length).toFixed(0)}% [${(ci[0] * 100).toFixed(0)},${(ci[1] * 100).toFixed(0)}] firstProbe ${Number.isFinite(tick.mean) ? tick.mean.toFixed(0) : "—"} res ${res.mean.toFixed(1)}`,
    );
  }
  const exp4Contrasts: Record<string, ContrastRow[]> = {};
  for (const mechanism of MECHANISMS.slice(1)) {
    exp4Contrasts[mechanism.key] = contrast(
      byKey("m_full_exp4"),
      byKey(`m_${mechanism.key}_exp4`),
      exp4Keys,
      401,
    );
  }

  // ---------------------------------------------------------------- exp 5
  console.log("\n=== EXP 5: CONTINGENCY REVERSAL ===");
  const exp5Keys: (keyof RunSummary)[] = ["detectLatency", "postCostMae", "recalibration", "resources"];
  for (const mechanism of MECHANISMS) {
    const runs = byKey(`m_${mechanism.key}_exp5`);
    const lat = summarize(runs.map((r) => r.detectLatency ?? NaN).filter(Number.isFinite), 61, 1000);
    const post = summarize(runs.map((r) => r.postCostMae), 62, 1000);
    const rec = summarize(runs.map((r) => r.recalibration), 63, 1000);
    console.log(
      `${mechanism.key.padEnd(14)} latency ${lat.mean.toFixed(1)} postCost ${post.mean.toFixed(2)} recal ${rec.mean.toFixed(2)} [${rec.ciLow.toFixed(2)},${rec.ciHigh.toFixed(2)}]`,
    );
  }
  const exp5Contrasts: Record<string, ContrastRow[]> = {};
  for (const mechanism of MECHANISMS.slice(1)) {
    exp5Contrasts[mechanism.key] = contrast(
      byKey("m_full_exp5"),
      byKey(`m_${mechanism.key}_exp5`),
      exp5Keys,
      501,
    );
  }

  // ---------------------------------------------------------------- table C
  console.log("\n=== TABLE C: CONTROLS ===");
  const tableC: Record<string, Record<string, { resources: ReturnType<typeof summarize>; alive: number; n: number }>> = {};
  const architectures: { key: string; label: string }[] = [
    { key: "m_full", label: "V0.6 full" },
    { key: "c_reactive", label: "Reactive" },
    { key: "c_physical_mpc", label: "Physical MPC" },
    { key: "c_flat_blackboard", label: "Flat blackboard" },
    { key: "c_matched_feedforward", label: "Matched feedforward" },
  ];
  for (const arch of architectures) {
    tableC[arch.label] = {};
    for (const bench of CONTROL_BENCHMARKS) {
      const fullBenchKey: Record<string, string> = {
        standard_shift: "m_full_exp3_shared",
        conflict: "m_full_exp2",
        fork: "m_full_exp4",
        gen_topology: "m_full_gen_topology",
        gen_nonlinear: "m_full_gen_nonlinear",
        gen_compound: "m_full_gen_compound",
      };
      const key =
        arch.key === "m_full"
          ? fullBenchKey[bench.suffix]
          : `${arch.key}_${bench.suffix}`;
      const runs = byKey(key);
      if (!runs.length) continue;
      tableC[arch.label][bench.suffix] = {
        resources: summarize(runs.map((r) => r.resources), 71, 1000),
        alive: runs.filter((r) => r.alive).length,
        n: runs.length,
      };
      console.log(
        `${arch.label.padEnd(22)} ${bench.suffix.padEnd(16)} res ${tableC[arch.label][bench.suffix].resources.mean.toFixed(2)} [${tableC[arch.label][bench.suffix].resources.ciLow.toFixed(2)},${tableC[arch.label][bench.suffix].resources.ciHigh.toFixed(2)}] alive ${runs.filter((r) => r.alive).length}/${runs.length}`,
      );
    }
  }

  // ---------------------------------------------------------------- table A extras
  console.log("\n=== TABLE A CONTROLS ===");
  for (const key of ["m_full_exp1", "r_rolling_exp1", "r_raw_exp1", "r_fixed_exp1", "r_rolling_exp3"]) {
    const runs = byKey(key);
    const q = summarize(runs.map((r) => r.qualitySep), 81, 1000);
    const raw = summarize(runs.map((r) => r.rawSep), 82, 1000);
    const qm = summarize(runs.map((r) => r.qualityModeCorr), 83, 1000);
    const rm = summarize(runs.map((r) => r.rawModeCorr), 84, 1000);
    const bss = summarize(runs.map((r) => r.rollingBss), 85, 1000);
    const glitch = summarize(runs.map((r) => r.postGlitchMae), 86, 1000);
    const gain = summarize(runs.map((r) => r.astGain), 87, 1000);
    console.log(
      `${key.padEnd(20)} qSep ${q.mean.toFixed(3)} rawSep ${raw.mean.toFixed(3)} qMode ${qm.mean.toFixed(3)} rawMode ${rm.mean.toFixed(3)} rollingBSS ${bss.mean.toFixed(3)} postGlitchMAE ${glitch.mean.toFixed(2)} astGain ${gain.mean.toFixed(3)}`,
    );
  }

  // ---------------------------------------------------------------- write analysis
  const exp3Macro = Object.fromEntries(
    MECHANISMS.map((m) => [m.key, exp3F1[m.key]]),
  );
  const analysis = {
    generatedAt: new Date().toISOString(),
    version: "V0.6",
    counts: { runs: count, conditions: CONDITIONS.length, seeds: SEEDS.length },
    conditions: Object.fromEntries(
      CONDITIONS.map((condition) => [
        condition.key,
        {
          label: condition.label,
          experiment: condition.experiment,
          n: byKey(condition.key).length,
          summary: summarizeCondition(
            byKey(condition.key),
            [
              "resources", "ticks", "selfMae", "rawMae", "stationaryMae", "conflictMae",
              "convergence", "entropyDrop", "qualityStability", "qualitySep", "rawSep",
              "qualityModeCorr", "rawModeCorr", "rollingBss", "postGlitchMae", "astGain",
              "windowThrash", "coherence", "metaBrier", "metaAuroc", "relAuroc",
              "routing", "probeTick", "detectLatency",
            ],
            601,
          ),
        },
      ]),
    ),
    exp1: { contrasts: exp1Contrasts },
    exp2: { contrasts: exp2Contrasts },
    exp3: { macroF1: exp3Macro, contrasts: exp3Contrasts },
    exp4: { contrasts: exp4Contrasts },
    exp5: { contrasts: exp5Contrasts },
    tableC,
    capabilityMatrix: Object.fromEntries(
      MECHANISMS.map((m) => [
        m.key,
        {
          absorption: summarize(
            byKey(`m_${m.key}_exp1`).map((r) => r.absorption).filter((v): v is number => v !== null),
            91,
            1000,
          ).mean,
          oneMinusThrash: 1 - summarize(byKey(`m_${m.key}_exp2`).map((r) => r.windowThrash), 92, 1000).mean,
          macroF1: exp3F1[m.key].macroF1,
          solved: summarize(byKey(`m_${m.key}_exp4`).map((r) => (r.forkSolved ? 1 : 0)), 93, 1000).mean,
          latency: summarize(
            byKey(`m_${m.key}_exp5`).map((r) => r.detectLatency ?? NaN).filter(Number.isFinite),
            94,
            1000,
          ).mean,
        },
      ]),
    ),
  };
  fs.writeFileSync(ANALYSIS_PATH, JSON.stringify(analysis, null, 2));
  console.log(
    `\nWrote ${RESULTS_PATH} and ${ANALYSIS_PATH} in ${((Date.now() - started) / 1000).toFixed(1)}s (${count} runs).`,
  );
}

main();
