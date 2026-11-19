/**
 * V0.6 validation harness.
 *
 *   npx tsx tools/v06validate.ts
 *   SEEDS=20 npx tsx tools/v06validate.ts
 *
 * Five indicator experiments, six mechanism ablations, four adversarial
 * controls and three unseen-environment suites. 100 paired seeds by default.
 * Writes per-run summaries to research/v06-results.json and aggregates to
 * research/v06-analysis.json.
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
  formatP,
  holm,
  meanOf,
  pairedComparison,
  proportionCI,
  summarize,
} from "./stats";

type Experiment = "exp1" | "exp2" | "exp3" | "exp4" | "exp5" | "generalization";

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

const SEEDS = Array.from({ length: Number(process.env.SEEDS ?? 100) }, (_, i) => i + 1);
const H900 = 900;
const H700 = 700;
const H600 = 600;
const H1200 = 1200;
const H800 = 800;

const CONDITIONS: Condition[] = [
  // ---------------------------------------------------------------- exp 1
  { key: "e1_full", label: "Intact", experiment: "exp1", scenario: "glitch", horizon: H900 },
  { key: "e1_no_rpt", label: "No-RPT", experiment: "exp1", scenario: "glitch", ablation: "no_rpt", horizon: H900 },
  { key: "e1_no_ast", label: "No-AST", experiment: "exp1", scenario: "glitch", ablation: "no_ast", horizon: H900 },
  { key: "e1_feedforward", label: "Matched feedforward", experiment: "exp1", scenario: "glitch", control: "matched_feedforward", horizon: H900 },

  // ---------------------------------------------------------------- exp 2
  { key: "e2_full", label: "Intact", experiment: "exp2", scenario: "conflict", horizon: H600 },
  { key: "e2_no_bottleneck", label: "No bottleneck", experiment: "exp2", scenario: "conflict", ablation: "no_gwt_bottleneck", horizon: H600 },
  { key: "e2_no_broadcast", label: "No broadcast", experiment: "exp2", scenario: "conflict", ablation: "no_gwt_broadcast", horizon: H600 },
  { key: "e2_no_ast", label: "No-AST", experiment: "exp2", scenario: "conflict", ablation: "no_ast", horizon: H600 },
  { key: "e2_flat", label: "Flat blackboard", experiment: "exp2", scenario: "conflict", control: "flat_blackboard", horizon: H600 },

  // ---------------------------------------------------------------- exp 3
  ...(["self", "energy_sensor", "fatigue_sensor", "shared"] as DisruptionKind[]).flatMap(
    (disruption) =>
      [
        { key: `e3_full_${disruption}`, label: `Intact · ${disruption}`, experiment: "exp3" as const, scenario: "self_disruption" as const, disruption, horizon: H700 },
        { key: `e3_no_hot_${disruption}`, label: `No-HOT · ${disruption}`, experiment: "exp3" as const, scenario: "self_disruption" as const, disruption, ablation: "no_hot_meta" as const, horizon: H700 },
        { key: `e3_reactive_${disruption}`, label: `Reactive · ${disruption}`, experiment: "exp3" as const, scenario: "self_disruption" as const, disruption, control: "reactive" as const, horizon: H700 },
      ],
  ),

  // ---------------------------------------------------------------- exp 4
  { key: "e4_full", label: "Intact", experiment: "exp4", scenario: "epistemic_fork", horizon: H1200 },
  { key: "e4_no_selfsim", label: "No cognitive self-sim", experiment: "exp4", scenario: "epistemic_fork", ablation: "no_cognitive_self_sim", horizon: H1200 },
  { key: "e4_mpc", label: "Physical MPC", experiment: "exp4", scenario: "epistemic_fork", control: "physical_mpc", horizon: H1200 },
  { key: "e4_reactive", label: "Reactive", experiment: "exp4", scenario: "epistemic_fork", control: "reactive", horizon: H1200 },
  { key: "e4_no_hot", label: "No-HOT", experiment: "exp4", scenario: "epistemic_fork", ablation: "no_hot_meta", horizon: H1200 },

  // ---------------------------------------------------------------- exp 5
  { key: "e5_full", label: "Intact", experiment: "exp5", scenario: "contingency_reversal", horizon: H700 },
  { key: "e5_no_broadcast", label: "No broadcast", experiment: "exp5", scenario: "contingency_reversal", ablation: "no_gwt_broadcast", horizon: H700 },
  { key: "e5_no_hot", label: "No-HOT", experiment: "exp5", scenario: "contingency_reversal", ablation: "no_hot_meta", horizon: H700 },
  { key: "e5_feedforward", label: "Matched feedforward", experiment: "exp5", scenario: "contingency_reversal", control: "matched_feedforward", horizon: H700 },

  // ---------------------------------------------------------- generalization
  ...(["unseen_topology", "unseen_nonlinear", "unseen_compound"] as V06Scenario[]).flatMap(
    (scenario) =>
      [
        { key: `g_${scenario}_full`, label: "Intact", experiment: "generalization" as const, scenario, horizon: H800 },
        { key: `g_${scenario}_reactive`, label: "Reactive", experiment: "generalization" as const, scenario, control: "reactive" as const, horizon: H800 },
        { key: `g_${scenario}_mpc`, label: "Physical MPC", experiment: "generalization" as const, scenario, control: "physical_mpc" as const, horizon: H800 },
        { key: `g_${scenario}_flat`, label: "Flat blackboard", experiment: "generalization" as const, scenario, control: "flat_blackboard" as const, horizon: H800 },
        { key: `g_${scenario}_feedforward`, label: "Matched feedforward", experiment: "generalization" as const, scenario, control: "matched_feedforward" as const, horizon: H800 },
      ],
  ),
];

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
  absorption: number | null;
  pulses: number;
  convergence: number;
  qualityStability: number;
  thrash: number;
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
  routingCorruption: number;
  probed: boolean;
  probeTick: number | null;
  roughSteps: number;
  forkSolved: boolean;
  forkRegret: number;
  detectLatency: number | null;
  preCostMae: number;
  postCostMae: number;
  recalibration: number;
  computeUnits: number;
}

function windowPoints(
  points: readonly V06SeriesPoint[],
  from: number,
  to: number,
): V06SeriesPoint[] {
  return points.filter((p) => p.t >= from && p.t < to);
}

function windowMean(
  points: readonly V06SeriesPoint[],
  from: number,
  to: number,
  key: keyof V06SeriesPoint,
): number {
  const slice = windowPoints(points, from, to).map((p) => Number(p[key]));
  return slice.length ? meanOf(slice) : NaN;
}

function windowAttribution(
  points: readonly V06SeriesPoint[],
  from: number,
  to: number,
): { top: string; scores: Record<string, number> } {
  const slice = windowPoints(points, from, to);
  if (!slice.length) return { top: "insufficient", scores: {} };
  const keys = ["physical", "energy_sensor", "fatigue_sensor", "shared", "insufficient"] as const;
  const scores = Object.fromEntries(
    keys.map((key) => [
      key === "physical"
        ? "physical"
        : key === "energy_sensor"
          ? "energy"
          : key === "fatigue_sensor"
            ? "fatigue"
            : key,
      meanOf(slice.map((p) => Number(p.attribution[key]))),
    ]),
  );
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const map: Record<string, string> = {
    physical: "physical",
    energy: "energy_sensor",
    fatigue: "fatigue_sensor",
    shared: "shared",
    insufficient: "insufficient",
  };
  return { top: map[entries[0][0]] ?? "insufficient", scores };
}

function pulseAbsorption(points: readonly V06SeriesPoint[]): {
  mean: number | null;
  count: number;
} {
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

function stationaryMae(points: readonly V06SeriesPoint[]): number {
  const pulseTicks = [120, 220, 620, 720];
  const values = points
    .filter((p) => !pulseTicks.some((t) => Math.abs(p.t - t) <= 2))
    .map((p) => p.energyError);
  return values.length ? meanOf(values) : NaN;
}

function switchRate(points: readonly V06SeriesPoint[], from: number, to: number): number {
  const slice = windowPoints(points, from, to);
  if (slice.length < 2) return 0;
  let switches = 0;
  for (let i = 1; i < slice.length; i++) {
    if (slice[i].action !== slice[i - 1].action) switches++;
  }
  return switches / (slice.length - 1);
}

function windowEntropy(points: readonly V06SeriesPoint[], from: number, to: number): number {
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

function detectionLatency(
  points: readonly V06SeriesPoint[],
  from: number,
  acceptable: string[],
  horizon: number,
): number | null {
  const match = points.find((p) => p.t >= from && acceptable.includes(p.attributionTop));
  if (!match) return horizon - from;
  return match.t - from;
}

function recoveryLatency(points: readonly V06SeriesPoint[], from: number, horizon: number): number {
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
  const roughSteps = probes.length;
  const probed = roughSteps > 0 || snapshot.selfModel.roughObservations > 0;
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
    absorption: abs.mean,
    pulses: abs.count,
    convergence: metrics.settlingConvergence,
    qualityStability: metrics.qualityStability,
    thrash: metrics.thrashRate,
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
    routingCorruption: windowMean(points, 310, 380, "somaticGain"),
    probed,
    probeTick,
    roughSteps,
    forkSolved,
    forkRegret: Math.max(0, 90 - metrics.resources) / 90,
    detectLatency: detect,
    preCostMae: preCost,
    postCostMae: postCost,
    recalibration: preCost - postCost,
    computeUnits: metrics.computeUnits,
  };
}

// ---------------------------------------------------------------- analysis
function metric(run: RunSummary, key: keyof RunSummary): number {
  const value = run[key];
  if (typeof value === "boolean") return value ? 1 : 0;
  return typeof value === "number" && Number.isFinite(value) ? value : NaN;
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

function contrast(
  a: RunSummary[],
  b: RunSummary[],
  keys: (keyof RunSummary)[],
  seedOffset: number,
): ContrastRow[] {
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
  const adjusted = holm(rows.map((row) => row.p));
  rows.forEach((row, index) => (row.adjusted = adjusted[index]));
  return rows;
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
  return { macroF1: meanOf(labels.map((label) => perClass[label].f1)), perClass };
}

function summarizeCondition(runs: RunSummary[], keys: (keyof RunSummary)[], seedBase: number) {
  return Object.fromEntries(
    keys.map((key, index) => [
      key,
      summarize(
        runs.map((r) => metric(r, key)).filter((v) => Number.isFinite(v)),
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
    path.resolve("research/v06-results.json"),
    JSON.stringify(
      {
        metadata: {
          generatedAt: new Date().toISOString(),
          seeds: SEEDS,
          conditions: CONDITIONS,
          architecture: "V0.6 unified cognitive architecture",
          note: "Every entry is a per-run summary; latent labels are evaluation-only.",
        },
        results,
      },
      null,
      2,
    ),
  );

  const byKey = (key: string) => results[key] ?? [];
  const keysOf = (condition: Condition) => condition.key;

  // ------------------------------------------------------------- condition summary
  console.log("\n=== CONDITION SUMMARY ===");
  for (const condition of CONDITIONS) {
    const runs = byKey(keysOf(condition));
    const res = summarize(runs.map((r) => r.resources), 11, 1000);
    const self = summarize(runs.map((r) => r.selfMae), 12, 1000);
    const alive = runs.filter((r) => r.alive).length;
    console.log(
      `${condition.key.padEnd(28)} res ${res.mean.toFixed(1)} [${res.ciLow.toFixed(1)},${res.ciHigh.toFixed(1)}] self ${self.mean.toFixed(2)} alive ${alive}/${runs.length} attr ${runs[0].attrTop}`,
    );
  }

  // ------------------------------------------------------------- exp 1
  console.log("\n=== EXP 1: AMBIGUOUS MULTI-CHANNEL SETTLING ===");
  const exp1Keys: (keyof RunSummary)[] = ["absorption", "stationaryMae", "convergence", "qualityStability", "selfMae"];
  for (const key of ["e1_full", "e1_no_rpt", "e1_no_ast", "e1_feedforward"]) {
    const runs = byKey(key);
    const absorption = summarize(
      runs.map((r) => r.absorption).filter((v): v is number => v !== null),
      21,
      1000,
    );
    const stationary = summarize(runs.map((r) => r.stationaryMae), 22, 1000);
    const conv = summarize(runs.map((r) => r.convergence), 23, 1000);
    console.log(
      `${key.padEnd(18)} absorption ${absorption.mean.toFixed(3)} [${absorption.ciLow.toFixed(3)},${absorption.ciHigh.toFixed(3)}] stationaryMAE ${stationary.mean.toFixed(2)} conv ${conv.mean.toFixed(2)}`,
    );
  }
  const exp1Contrasts = {
    no_rpt: contrast(byKey("e1_full"), byKey("e1_no_rpt"), exp1Keys, 31),
    no_ast: contrast(byKey("e1_full"), byKey("e1_no_ast"), exp1Keys, 41),
    feedforward: contrast(byKey("e1_full"), byKey("e1_feedforward"), exp1Keys, 51),
  };
  for (const [label, rows] of Object.entries(exp1Contrasts)) {
    console.log(`\nfull vs ${label}`);
    for (const row of rows) {
      console.log(
        `  ${row.metric.padEnd(16)} ${row.diff >= 0 ? "+" : ""}${row.diff.toFixed(2)} [${row.ciLow.toFixed(2)},${row.ciHigh.toFixed(2)}] dz ${row.dz.toFixed(2)} p=${formatP(row.adjusted)}`,
      );
    }
  }

  // ------------------------------------------------------------- exp 2
  console.log("\n=== EXP 2: COMPETITION, BINDING & SEQUENTIAL QUERYING ===");
  for (const key of ["e2_full", "e2_no_bottleneck", "e2_no_broadcast", "e2_no_ast", "e2_flat"]) {
    const runs = byKey(key);
    const thrash = summarize(runs.map((r) => r.windowThrash), 61, 1000);
    const coherence = summarize(runs.map((r) => r.coherence), 62, 1000);
    const binding = summarize(runs.map((r) => r.binding), 63, 1000);
    const recovery = summarize(
      runs.map((r) => r.detectLatency ?? NaN).filter((v) => Number.isFinite(v)),
      64,
      1000,
    );
    console.log(
      `${key.padEnd(18)} thrash ${thrash.mean.toFixed(3)} coherence ${coherence.mean.toFixed(2)} binding ${binding.mean.toFixed(2)} recovery ${recovery.mean.toFixed(0)}`,
    );
  }
  const exp2Keys: (keyof RunSummary)[] = ["windowThrash", "coherence", "binding", "actionEntropy", "detectLatency"];
  const exp2Contrasts = {
    no_bottleneck: contrast(byKey("e2_full"), byKey("e2_no_bottleneck"), exp2Keys, 71),
    no_broadcast: contrast(byKey("e2_full"), byKey("e2_no_broadcast"), exp2Keys, 81),
    no_ast: contrast(byKey("e2_full"), byKey("e2_no_ast"), exp2Keys, 91),
    flat: contrast(byKey("e2_full"), byKey("e2_flat"), exp2Keys, 101),
  };
  for (const [label, rows] of Object.entries(exp2Contrasts)) {
    console.log(`\nfull vs ${label}`);
    for (const row of rows) {
      console.log(
        `  ${row.metric.padEnd(16)} ${row.diff >= 0 ? "+" : ""}${row.diff.toFixed(2)} [${row.ciLow.toFixed(2)},${row.ciHigh.toFixed(2)}] dz ${row.dz.toFixed(2)} p=${formatP(row.adjusted)}`,
      );
    }
  }

  // ------------------------------------------------------------- exp 3
  console.log("\n=== EXP 3: METACOGNITIVE CALIBRATION & ATTRIBUTION ===");
  const exp3Labels = ["physical", "energy_sensor", "fatigue_sensor", "shared", "insufficient"];
  const exp3 = { full: { truth: [] as string[], pred: [] as string[] }, no_hot: { truth: [] as string[], pred: [] as string[] }, reactive: { truth: [] as string[], pred: [] as string[] } };
  for (const disruption of ["self", "energy_sensor", "fatigue_sensor", "shared"]) {
    for (const [variant, key] of [
      ["full", `e3_full_${disruption}`],
      ["no_hot", `e3_no_hot_${disruption}`],
      ["reactive", `e3_reactive_${disruption}`],
    ] as const) {
      const runs = byKey(key);
      const expected = EXPECTED[disruption];
      for (const run of runs) {
        exp3[variant].truth.push(expected);
        exp3[variant].pred.push(run.attrTop);
      }
      const correct = runs.filter((r) => r.attrCorrect).length;
      const ci = proportionCI(correct, runs.length);
      const rel = summarize(
        runs.map((r) => r.relAuroc).filter((v): v is number => v !== null),
        111,
        1000,
      );
      const route = summarize(runs.map((r) => r.routingCorruption), 112, 1000);
      console.log(
        `${key.padEnd(30)} correct ${correct}/${runs.length} [${(ci[0] * 100).toFixed(0)},${(ci[1] * 100).toFixed(0)}] relAUROC ${rel.mean.toFixed(2)} routing ${route.mean.toFixed(2)}`,
      );
    }
  }
  const f1 = {
    full: macroF1(exp3.full.truth, exp3.full.pred, exp3Labels),
    no_hot: macroF1(exp3.no_hot.truth, exp3.no_hot.pred, exp3Labels),
    reactive: macroF1(exp3.reactive.truth, exp3.reactive.pred, exp3Labels),
  };
  console.log(
    `\n4-way attribution macro-F1: full ${f1.full.macroF1.toFixed(3)} · no-HOT ${f1.no_hot.macroF1.toFixed(3)} · reactive ${f1.reactive.macroF1.toFixed(3)}`,
  );

  const exp3Keys: (keyof RunSummary)[] = ["metaBrier", "metaAuroc", "relBrier", "relAuroc", "routingCorruption", "selfMae"];
  const exp3Contrasts: Record<string, ContrastRow[]> = {};
  for (const disruption of ["self", "energy_sensor", "fatigue_sensor", "shared"]) {
    exp3Contrasts[`${disruption}_no_hot`] = contrast(
      byKey(`e3_full_${disruption}`),
      byKey(`e3_no_hot_${disruption}`),
      exp3Keys,
      120,
    );
    exp3Contrasts[`${disruption}_reactive`] = contrast(
      byKey(`e3_full_${disruption}`),
      byKey(`e3_reactive_${disruption}`),
      exp3Keys,
      140,
    );
  }
  for (const [label, rows] of Object.entries(exp3Contrasts)) {
    console.log(`\nfull vs ${label}`);
    for (const row of rows) {
      console.log(
        `  ${row.metric.padEnd(18)} ${row.diff >= 0 ? "+" : ""}${row.diff.toFixed(2)} [${row.ciLow.toFixed(2)},${row.ciHigh.toFixed(2)}] dz ${row.dz.toFixed(2)} p=${formatP(row.adjusted)}`,
      );
    }
  }

  // ------------------------------------------------------------- exp 4
  console.log("\n=== EXP 4: THE EPISTEMIC FORK ===");
  for (const key of ["e4_full", "e4_no_selfsim", "e4_mpc", "e4_reactive", "e4_no_hot"]) {
    const runs = byKey(key);
    const probed = runs.filter((r) => r.probed).length;
    const solved = runs.filter((r) => r.forkSolved).length;
    const ci = proportionCI(solved, runs.length);
    const tick = summarize(
      runs.map((r) => r.probeTick ?? NaN).filter((v) => Number.isFinite(v)),
      151,
      1000,
    );
    const res = summarize(runs.map((r) => r.resources), 152, 1000);
    console.log(
      `${key.padEnd(18)} probed ${(100 * probed / runs.length).toFixed(0)}% solved ${(100 * solved / runs.length).toFixed(0)}% [${(ci[0] * 100).toFixed(0)},${(ci[1] * 100).toFixed(0)}] firstProbe ${Number.isFinite(tick.mean) ? tick.mean.toFixed(0) : "—"} res ${res.mean.toFixed(1)}`,
    );
  }
  const exp4Keys: (keyof RunSummary)[] = ["probed", "forkSolved", "resources", "forkRegret", "probeTick"];
  const exp4Contrasts = {
    no_selfsim: contrast(byKey("e4_full"), byKey("e4_no_selfsim"), exp4Keys, 161),
    mpc: contrast(byKey("e4_full"), byKey("e4_mpc"), exp4Keys, 171),
    reactive: contrast(byKey("e4_full"), byKey("e4_reactive"), exp4Keys, 181),
    no_hot: contrast(byKey("e4_full"), byKey("e4_no_hot"), exp4Keys, 191),
  };
  for (const [label, rows] of Object.entries(exp4Contrasts)) {
    console.log(`\nfull vs ${label}`);
    for (const row of rows) {
      console.log(
        `  ${row.metric.padEnd(16)} ${row.diff >= 0 ? "+" : ""}${row.diff.toFixed(2)} [${row.ciLow.toFixed(2)},${row.ciHigh.toFixed(2)}] dz ${row.dz.toFixed(2)} p=${formatP(row.adjusted)}`,
      );
    }
  }

  // ------------------------------------------------------------- exp 5
  console.log("\n=== EXP 5: ACTION–PERCEPTION CONTINGENCY REVERSAL ===");
  for (const key of ["e5_full", "e5_no_broadcast", "e5_no_hot", "e5_feedforward"]) {
    const runs = byKey(key);
    const latency = summarize(
      runs.map((r) => r.detectLatency ?? NaN).filter((v) => Number.isFinite(v)),
      201,
      1000,
    );
    const pre = summarize(runs.map((r) => r.preCostMae), 202, 1000);
    const post = summarize(runs.map((r) => r.postCostMae), 203, 1000);
    const recal = summarize(runs.map((r) => r.recalibration), 204, 1000);
    console.log(
      `${key.padEnd(18)} latency ${latency.mean.toFixed(0)} pre ${pre.mean.toFixed(2)} post ${post.mean.toFixed(2)} recal ${recal.mean.toFixed(2)} [${recal.ciLow.toFixed(2)},${recal.ciHigh.toFixed(2)}]`,
    );
  }
  const exp5Keys: (keyof RunSummary)[] = ["detectLatency", "preCostMae", "postCostMae", "recalibration", "resources"];
  const exp5Contrasts = {
    no_broadcast: contrast(byKey("e5_full"), byKey("e5_no_broadcast"), exp5Keys, 211),
    no_hot: contrast(byKey("e5_full"), byKey("e5_no_hot"), exp5Keys, 221),
    feedforward: contrast(byKey("e5_full"), byKey("e5_feedforward"), exp5Keys, 231),
  };
  for (const [label, rows] of Object.entries(exp5Contrasts)) {
    console.log(`\nfull vs ${label}`);
    for (const row of rows) {
      console.log(
        `  ${row.metric.padEnd(16)} ${row.diff >= 0 ? "+" : ""}${row.diff.toFixed(2)} [${row.ciLow.toFixed(2)},${row.ciHigh.toFixed(2)}] dz ${row.dz.toFixed(2)} p=${formatP(row.adjusted)}`,
      );
    }
  }

  // ------------------------------------------------------------- generalization
  console.log("\n=== GENERALIZATION (ZERO RE-TUNING) ===");
  const genKeys: (keyof RunSummary)[] = ["resources", "alive", "selfMae", "thrash", "coherence"];
  const genContrasts: Record<string, ContrastRow[]> = {};
  for (const scenario of ["unseen_topology", "unseen_nonlinear", "unseen_compound"]) {
    const full = byKey(`g_${scenario}_full`);
    const res = summarize(full.map((r) => r.resources), 241, 1000);
    const alive = full.filter((r) => r.alive).length;
    console.log(
      `${scenario.padEnd(20)} full res ${res.mean.toFixed(1)} [${res.ciLow.toFixed(1)},${res.ciHigh.toFixed(1)}] alive ${alive}/${full.length}`,
    );
    for (const control of ["reactive", "mpc", "flat", "feedforward"]) {
      genContrasts[`${scenario}_${control}`] = contrast(
        full,
        byKey(`g_${scenario}_${control}`),
        genKeys,
        251,
      );
      const other = summarize(byKey(`g_${scenario}_${control}`).map((r) => r.resources), 242, 1000);
      console.log(
        `  vs ${control.padEnd(12)} res ${other.mean.toFixed(1)} [${other.ciLow.toFixed(1)},${other.ciHigh.toFixed(1)}]`,
      );
    }
  }

  // ------------------------------------------------------------- capability matrix
  const matrix: Record<string, Record<string, number | null>> = {};
  const matrixMetric: Record<Experiment, keyof RunSummary> = {
    exp1: "absorption",
    exp2: "windowThrash",
    exp3: "relAuroc",
    exp4: "probeTick",
    exp5: "detectLatency",
    generalization: "resources",
  };
  const matrixConditions: Record<Experiment, string[]> = {
    exp1: ["e1_full", "e1_no_rpt", "e1_no_ast", "e1_feedforward"],
    exp2: ["e2_full", "e2_no_bottleneck", "e2_no_broadcast", "e2_no_ast", "e2_flat"],
    exp3: ["e3_full_self", "e3_no_hot_self", "e3_reactive_self"],
    exp4: ["e4_full", "e4_no_selfsim", "e4_mpc", "e4_reactive", "e4_no_hot"],
    exp5: ["e5_full", "e5_no_broadcast", "e5_no_hot", "e5_feedforward"],
    generalization: ["g_unseen_compound_full", "g_unseen_compound_reactive", "g_unseen_compound_mpc", "g_unseen_compound_flat", "g_unseen_compound_feedforward"],
  };
  for (const experiment of Object.keys(matrixConditions) as Experiment[]) {
    matrix[experiment] = {};
    for (const key of matrixConditions[experiment]) {
      const runs = byKey(key);
      const values = runs
        .map((r) => metric(r, matrixMetric[experiment]))
        .filter((v) => Number.isFinite(v));
      matrix[experiment][key] = values.length ? meanOf(values) : null;
    }
  }

  const analysis = {
    generatedAt: new Date().toISOString(),
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
              "resources",
              "ticks",
              "selfMae",
              "rawMae",
              "stationaryMae",
              "convergence",
              "thrash",
              "coherence",
              "metaBrier",
              "metaAuroc",
              "relAuroc",
              "routingCorruption",
              "probeTick",
            ],
            301,
          ),
        },
      ]),
    ),
    exp1: { contrasts: exp1Contrasts },
    exp2: { contrasts: exp2Contrasts },
    exp3: {
      macroF1: {
        full: f1.full.macroF1,
        no_hot: f1.no_hot.macroF1,
        reactive: f1.reactive.macroF1,
      },
      perClass: f1,
      contrasts: exp3Contrasts,
    },
    exp4: { contrasts: exp4Contrasts },
    exp5: { contrasts: exp5Contrasts },
    generalization: { contrasts: genContrasts },
    capabilityMatrix: matrix,
    capabilityMetric: matrixMetric,
    counts: { runs: count, conditions: CONDITIONS.length, seeds: SEEDS.length },
  };
  fs.writeFileSync(path.resolve("research/v06-analysis.json"), JSON.stringify(analysis, null, 2));
  console.log(
    `\nWrote research/v06-results.json and research/v06-analysis.json in ${((Date.now() - started) / 1000).toFixed(1)}s (${count} runs).`,
  );
}

main();
