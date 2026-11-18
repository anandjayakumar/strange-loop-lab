/**
 * V0.2 validation harness. 100 paired seeds by default.
 *
 *   npx tsx tools/v02validate.ts
 *   SEEDS=20 HORIZON=600 npx tsx tools/v02validate.ts
 */

import fs from "node:fs";
import path from "node:path";
import { V02Engine } from "../src/simulation/v02/engine";
import type {
  Difficulty,
  ExplorationMode,
  PriorRegime,
  Scenario,
  V02SeriesPoint,
} from "../src/simulation/v02/types";
import {
  auc,
  bootstrapCorrelation,
  formatP,
  holm,
  meanOf,
  pairedComparison,
  proportionCI,
  summarize,
} from "./stats";

interface Condition {
  key: string;
  label: string;
  difficulty?: Difficulty;
  prior?: PriorRegime;
  scenario?: Scenario;
  exploration?: ExplorationMode;
  selfLearning?: boolean;
  selfFeedback?: boolean;
  metaFeedback?: boolean;
  metaLearning?: boolean;
  worldLearning?: boolean;
  worldModelEnabled?: boolean;
  beliefTrap?: "none" | "pessimistic_cost";
}

const CONDITIONS: Condition[] = [
  { key: "full", label: "Full V0.2 · standard", difficulty: "standard", exploration: "voi" },
  { key: "docile", label: "Docile", difficulty: "docile", exploration: "voi" },
  { key: "harsh", label: "Harsh", difficulty: "harsh", exploration: "voi" },
  { key: "severe", label: "Severe uninformed priors", difficulty: "standard", prior: "severe" },
  { key: "severe_harsh", label: "Severe priors · harsh", difficulty: "harsh", prior: "severe" },
  { key: "pragmatic", label: "Pragmatic only", difficulty: "standard", exploration: "pragmatic" },
  { key: "random", label: "Random exploration", difficulty: "standard", exploration: "random" },
  { key: "uncertainty", label: "Uncertainty bonus", difficulty: "standard", exploration: "uncertainty" },
  { key: "self_off", label: "Self feedback off", difficulty: "standard", selfFeedback: false },
  { key: "self_frozen", label: "Self learning off", difficulty: "standard", selfLearning: false },
  { key: "meta_off", label: "Meta feedback off", difficulty: "standard", metaFeedback: false },
  { key: "meta_frozen", label: "Meta learning off", difficulty: "standard", metaLearning: false },
  { key: "world_frozen", label: "World learning off", difficulty: "standard", worldLearning: false },
  { key: "world_off", label: "World model off", difficulty: "standard", worldModelEnabled: false },
  { key: "physical", label: "Physical regime shift", difficulty: "standard", scenario: "physical_shift" },
  { key: "energy_shift", label: "Energy sensor shift", difficulty: "standard", scenario: "energy_sensor_shift" },
  { key: "fatigue_shift", label: "Fatigue sensor shift", difficulty: "standard", scenario: "fatigue_sensor_shift" },
  { key: "shared_shift", label: "Shared sensor shift", difficulty: "standard", scenario: "shared_shift" },
  { key: "mixed", label: "Mixed regime shifts", difficulty: "standard", scenario: "mixed_shifts" },
  { key: "trap_pragmatic", label: "Pessimistic trap · pragmatic", difficulty: "standard", exploration: "pragmatic", beliefTrap: "pessimistic_cost" },
  { key: "trap_random", label: "Pessimistic trap · random", difficulty: "standard", exploration: "random", beliefTrap: "pessimistic_cost" },
  { key: "trap_uncertainty", label: "Pessimistic trap · uncertainty", difficulty: "standard", exploration: "uncertainty", beliefTrap: "pessimistic_cost" },
  { key: "trap_voi", label: "Pessimistic trap · VoI", difficulty: "standard", exploration: "voi", beliefTrap: "pessimistic_cost" },
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
  fatigueMae: number;
  costMae: number;
  toleranceRate: number;
  metaBrier: number;
  metaBss: number;
  metaBssRolling: number;
  metaBrierHoldout: number;
  metaEceHoldout: number;
  metaEce: number;
  metaAuroc: number | null;
  meanUncertainty: number;
  meanInfluence: number;
  meanInfo: number;
  meanVoi: number;
  infoGain: number;
  actionEntropy: number;
  coverage: number;
  attributionTop: string;
  attributionConfidence: number;
  shifted: boolean;
  postShiftSelfMae: number | null;
  preShiftSelfMae: number | null;
  postShiftRawMae: number | null;
  emaMae: number;
  kalmanMae: number;
  shadowObservations: number;
  shadowBrier: number | null;
  shadowAuroc: number | null;
}

interface ShadowRecord {
  predictedTolerance: number;
  observedTolerance: boolean;
  predictedError: number;
  observedError: number;
  latentFailure: boolean;
}

const SEEDS = Array.from({ length: Number(process.env.SEEDS ?? 100) }, (_, i) => i + 1);
const HORIZON = Number(process.env.HORIZON ?? 1000);
const SHADOW = process.env.SHADOW !== "0";
const SHADOW_EVERY = 40;
const OUTPUT = path.resolve("research");

function normalizeError(pred: number, observed: number): number {
  return Math.abs(pred - observed) / (Math.abs(observed) + 3);
}

function computeOfflineFilters(series: readonly V02SeriesPoint[]): {
  emaMae: number;
  kalmanMae: number;
} {
  let ema = series[0]?.senseEnergyRaw ?? 0;
  let kalman = series[0]?.senseEnergyRaw ?? 0;
  let emaError = 0;
  let kalmanError = 0;
  let n = 0;
  for (const point of series) {
    ema = ema + 0.35 * (point.senseEnergyRaw - ema);
    // Known-noise random-walk Kalman: Q=0.35, R estimated from base channel.
    const gain = 0.4;
    kalman = kalman + gain * (point.senseEnergyRaw - kalman);
    emaError += Math.abs(ema - point.senseEnergyTrue);
    kalmanError += Math.abs(kalman - point.senseEnergyTrue);
    n++;
  }
  return {
    emaMae: n ? emaError / n : 0,
    kalmanMae: n ? kalmanError / n : 0,
  };
}

function runCondition(condition: Condition, seed: number, shadow: boolean): {
  summary: RunSummary;
  series: V02SeriesPoint[];
  shadows: ShadowRecord[];
} {
  const engine = new V02Engine({
    seed,
    difficulty: condition.difficulty ?? "standard",
    priorRegime: condition.prior ?? "uninformed",
    scenario: condition.scenario ?? "stable",
    explorationMode: condition.exploration ?? "voi",
    lambda: 0.35,
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
  const shadows: ShadowRecord[] = [];
  while (engine.physical.alive && engine.getTick() < HORIZON) {
    engine.step();
    if (shadow && engine.getTick() > 0 && engine.getTick() % SHADOW_EVERY === 0) {
      const snapshot = engine.getSnapshot();
      for (const prediction of snapshot.predictions) {
        const shadowOutcome = engine.probeAction(prediction.action);
        if (!shadowOutcome) continue;
        const observedError = normalizeError(shadowOutcome.predictedDelta, shadowOutcome.observedDelta);
        const latentError = normalizeError(shadowOutcome.predictedDelta, shadowOutcome.latentDelta);
        shadows.push({
          predictedTolerance: prediction.meta.toleranceProbability,
          observedTolerance: observedError <= 0.45,
          predictedError: prediction.meta.expectedError,
          observedError,
          latentFailure: latentError > 0.45,
        });
      }
    }
  }
  const series = [...engine.getSeries()];
  const metrics = engine.getSnapshot().metrics;
  const filters = computeOfflineFilters(series);
  const shiftAt = condition.scenario && condition.scenario !== "stable" ? 360 : null;
  const pre = shiftAt ? series.filter((p) => p.t < shiftAt) : [];
  const post = shiftAt ? series.filter((p) => p.t >= shiftAt) : [];
  const mean = (values: readonly number[]) => (values.length ? meanOf(values) : NaN);
  const toleranceRate = metrics.toleranceRate;
  const bss =
    toleranceRate > 0 && toleranceRate < 1
      ? 1 - metrics.metaBrier / (toleranceRate * (1 - toleranceRate))
      : 0;
  const targets = series.map((p) => (p.metaTargetTolerance ? 1 : 0));
  const predictions = series.map((p) => p.predictedTolerance ?? 0.5);
  const split = Math.floor(series.length * 0.7);
  const heldPred = predictions.slice(split);
  const heldTarget = targets.slice(split);
  const metaBrierHoldout = heldPred.length
    ? meanOf(heldPred.map((p, i) => (p - heldTarget[i]) ** 2))
    : 0;
  const eceBins = 8;
  let heldEce = 0;
  if (heldPred.length > 20) {
    for (let b = 0; b < eceBins; b++) {
      const lo = b / eceBins;
      const hi = (b + 1) / eceBins;
      let count = 0;
      let pSum = 0;
      let ySum = 0;
      for (let i = 0; i < heldPred.length; i++) {
        if (heldPred[i] >= lo && (b === eceBins - 1 ? heldPred[i] <= hi : heldPred[i] < hi)) {
          count++;
          pSum += heldPred[i];
          ySum += heldTarget[i];
        }
      }
      if (count) heldEce += (count / heldPred.length) * Math.abs(pSum / count - ySum / count);
    }
  }
  let rollingRate = 0.5;
  let rollingBrier = 0;
  for (let i = 0; i < series.length; i++) {
    rollingBrier += (rollingRate - (targets[i] ?? 0)) ** 2;
    rollingRate = 0.9 * rollingRate + 0.1 * (targets[i] ?? 0);
  }
  const rollingBaseline = series.length ? rollingBrier / series.length : 0;
  const metaBssRolling =
    rollingBaseline > 1e-9 ? 1 - metrics.metaBrier / rollingBaseline : 0;
  const shadowBrier = shadows.length
    ? meanOf(
        shadows.map(
          (s) => (s.predictedTolerance - (s.observedTolerance ? 1 : 0)) ** 2,
        ),
      )
    : null;
  const shadowPositives = shadows.filter((s) => s.latentFailure).length;
  const shadowAuroc =
    shadows.length > 10 && shadowPositives > 2 && shadowPositives < shadows.length - 2
      ? auc(
          shadows.map((s) => 1 - s.predictedTolerance),
          shadows.map((s) => s.latentFailure),
        )
      : null;
  return {
    summary: {
      condition: condition.key,
      seed,
      alive: engine.physical.alive,
      ticks: engine.getTick(),
      resources: engine.physical.resources,
      meanEnergy: mean(series.map((p) => p.energy)),
      minEnergy: series.length ? Math.min(...series.map((p) => p.energy)) : engine.physical.energy,
      selfMae: metrics.selfEnergyMae,
      rawMae: metrics.rawEnergyMae,
      fatigueMae: metrics.fatigueMae,
      costMae: metrics.costMae,
      toleranceRate,
      metaBrier: metrics.metaBrier,
      metaBss: bss,
      metaBssRolling,
      metaBrierHoldout,
      metaEceHoldout: heldEce,
      metaEce: metrics.metaEce,
      metaAuroc: metrics.metaAuroc,
      meanUncertainty: metrics.meanUncertainty,
      meanInfluence: metrics.meanInfluence,
      meanInfo: metrics.meanInfoValue,
      meanVoi: metrics.meanVoi,
      infoGain: metrics.infoGain,
      actionEntropy: metrics.actionEntropy,
      coverage: metrics.explorationCoverage,
      attributionTop: metrics.topAttribution,
      attributionConfidence: metrics.attributionConfidence,
      shifted: metrics.shifted,
      postShiftSelfMae: post.length ? mean(post.map((p) => p.energyError)) : null,
      preShiftSelfMae: pre.length ? mean(pre.map((p) => p.energyError)) : null,
      postShiftRawMae: post.length ? mean(post.map((p) => p.rawEnergyError)) : null,
      emaMae: filters.emaMae,
      kalmanMae: filters.kalmanMae,
      shadowObservations: shadows.length,
      shadowBrier,
      shadowAuroc,
    },
    series,
    shadows,
  };
}

const METRICS: { key: keyof RunSummary; label: string; digits: number }[] = [
  { key: "ticks", label: "ticks", digits: 0 },
  { key: "resources", label: "resources", digits: 1 },
  { key: "meanEnergy", label: "mean energy", digits: 1 },
  { key: "selfMae", label: "self MAE", digits: 2 },
  { key: "rawMae", label: "raw MAE", digits: 2 },
  { key: "fatigueMae", label: "fatigue MAE", digits: 2 },
  { key: "metaBrier", label: "meta Brier", digits: 3 },
  { key: "metaBss", label: "meta BSS", digits: 2 },
  { key: "metaBssRolling", label: "BSS rolling", digits: 2 },
  { key: "metaBrierHoldout", label: "Brier holdout", digits: 3 },
  { key: "metaEceHoldout", label: "ECE holdout", digits: 3 },
  { key: "metaEce", label: "meta ECE", digits: 3 },
  { key: "metaAuroc", label: "meta AUROC", digits: 2 },
  { key: "meanVoi", label: "mean VoI", digits: 2 },
  { key: "infoGain", label: "info gain", digits: 3 },
];

function metric(run: RunSummary, key: keyof RunSummary): number {
  const value = run[key];
  return typeof value === "number" && Number.isFinite(value) ? value : NaN;
}

function main(): void {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const started = Date.now();
  const results: Record<string, RunSummary[]> = {};
  const allShadows: Record<string, ShadowRecord[]> = {};
  let count = 0;
  const total = CONDITIONS.length * SEEDS.length;
  for (const condition of CONDITIONS) {
    const runs: RunSummary[] = [];
    const shadows: ShadowRecord[] = [];
    for (const seed of SEEDS) {
      const result = runCondition(condition, seed, SHADOW && ["full", "meta_off", "severe", "physical", "energy_shift"].includes(condition.key));
      runs.push(result.summary);
      shadows.push(...result.shadows);
      count++;
      if (count % 100 === 0) {
        console.log(`${count}/${total} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
      }
    }
    results[condition.key] = runs;
    allShadows[condition.key] = shadows;
  }

  fs.writeFileSync(
    path.resolve("research/v02-results.json"),
    JSON.stringify({ metadata: { seeds: SEEDS, horizon: HORIZON, conditions: CONDITIONS }, results }, null, 2),
  );

  console.log("\nCONDITION SUMMARY");
  for (const condition of CONDITIONS) {
    const runs = results[condition.key];
    const alive = runs.filter((r) => r.alive).length;
    console.log(`\n${condition.key} (${condition.label}) alive ${alive}/${runs.length}`);
    for (const m of METRICS) {
      const values = runs.map((r) => metric(r, m.key));
      const s = summarize(values, 700 + m.key.length);
      if (s.n) console.log(`  ${m.label.padEnd(14)} ${s.mean.toFixed(m.digits)} [${s.ciLow.toFixed(m.digits)}, ${s.ciHigh.toFixed(m.digits)}] med ${s.median.toFixed(m.digits)} SD ${s.sd.toFixed(m.digits)}`);
    }
  }

  console.log("\nPAIRED CONTRASTS (Holm within contrast)");
  const contrasts: [string, string, string][] = [
    ["Meta off", "full", "meta_off"],
    ["Self feedback off", "full", "self_off"],
    ["Self learning off", "full", "self_frozen"],
    ["Meta learning off", "full", "meta_frozen"],
    ["World learning off", "full", "world_frozen"],
    ["World model off", "full", "world_off"],
    ["VoI vs pragmatic", "full", "pragmatic"],
    ["VoI vs random", "full", "random"],
    ["VoI vs uncertainty", "full", "uncertainty"],
    ["Severe priors", "full", "severe"],
    ["Physical shift", "full", "physical"],
    ["Energy sensor shift", "full", "energy_shift"],
    ["Fatigue sensor shift", "full", "fatigue_shift"],
    ["Shared shift", "full", "shared_shift"],
  ];
  for (const [label, a, b] of contrasts) {
    const aRuns = results[a] ?? [];
    const bRuns = results[b] ?? [];
    const rows: { label: string; diff: number; ciLow: number; ciHigh: number; dz: number; p: number }[] = [];
    for (const m of METRICS) {
      const av = aRuns.map((r) => metric(r, m.key));
      const bv = bRuns.map((r) => metric(r, m.key));
      const aa: number[] = [];
      const bb: number[] = [];
      for (let i = 0; i < Math.min(av.length, bv.length); i++) {
        if (Number.isFinite(av[i]) && Number.isFinite(bv[i])) {
          aa.push(av[i]);
          bb.push(bv[i]);
        }
      }
      if (aa.length < 10) continue;
      const r = pairedComparison(aa, bb, 300 + rows.length);
      rows.push({ label: m.label, diff: r.meanDiff, ciLow: r.ciLow, ciHigh: r.ciHigh, dz: r.cohenDz, p: r.pPermutation });
    }
    const adjusted = holm(rows.map((r) => r.p));
    console.log(`\n${label}`);
    rows.forEach((r, i) => {
      if (!["resources", "mean energy", "self MAE", "meta Brier", "meta AUROC", "mean VoI"].includes(r.label)) return;
      console.log(`  ${r.label.padEnd(14)} ${r.diff.toFixed(2)} [${r.ciLow.toFixed(2)}, ${r.ciHigh.toFixed(2)}] dz ${r.dz.toFixed(2)} p ${formatP(adjusted[i])}`);
    });
  }

  console.log("\nFILTER BENCHMARKS");
  for (const key of ["full", "severe", "docile", "harsh", "physical", "energy_shift", "fatigue_shift", "shared_shift"]) {
    const runs = results[key];
    const s = (k: keyof RunSummary) => meanOf(runs.map((r) => metric(r, k)).filter(Number.isFinite));
    console.log(
      `${key.padEnd(13)} self ${s("selfMae").toFixed(2)} raw ${s("rawMae").toFixed(2)} EMA ${s("emaMae").toFixed(2)} Kalman ${s("kalmanMae").toFixed(2)} | pre-shift ${s("preShiftSelfMae").toFixed(2)} post ${s("postShiftSelfMae").toFixed(2)}`,
    );
  }

  console.log("\nSHADOW OFF-POLICY META SCORES");
  for (const [key, shadows] of Object.entries(allShadows)) {
    if (!shadows.length) continue;
    const brier = meanOf(
      shadows.map((s) => (s.predictedTolerance - (s.observedTolerance ? 1 : 0)) ** 2),
    );
    const positives = shadows.filter((s) => s.latentFailure).length;
    const auroc =
      positives > 2 && positives < shadows.length - 2
        ? auc(
            shadows.map((s) => 1 - s.predictedTolerance),
            shadows.map((s) => s.latentFailure),
          )
        : null;
    console.log(`${key}: ${shadows.length} probes · Brier ${brier.toFixed(3)} · AUROC ${auroc?.toFixed(2) ?? "—"}`);
  }

  console.log("\nATTRIBUTION AFTER SHIFT");
  for (const [key, expected] of [
    ["physical", "physical"],
    ["energy_shift", "energy_sensor"],
    ["fatigue_shift", "fatigue_sensor"],
    ["shared_shift", "shared"],
  ] as const) {
    const runs = results[key];
    const correct = runs.filter((r) => r.attributionTop === expected).length;
    const ci = proportionCI(correct, runs.length);
    console.log(`${key}: top attribution ${correct}/${runs.length} = ${(100 * correct / runs.length).toFixed(1)}% [${(ci[0] * 100).toFixed(0)}, ${(ci[1] * 100).toFixed(0)}]`);
  }

  console.log("\nMETA PREDICTIVE VALUE / CALIBRATION");
  const full = results.full;
  for (const k of ["metaBrier", "metaBss", "metaEce", "metaAuroc", "metaBss"] as const) {
    const s = summarize(full.map((r) => metric(r, k)).filter(Number.isFinite), 801);
    console.log(`${k.padEnd(10)} ${s.mean.toFixed(3)} [${s.ciLow.toFixed(3)}, ${s.ciHigh.toFixed(3)}]`);
  }
  const trustInfo = bootstrapCorrelation(
    full.map((r) => r.meanInfluence),
    full.map((r) => r.selfMae),
    77,
  );
  console.log(`influence~self MAE r=${trustInfo.r.toFixed(2)} [${trustInfo.ciLow.toFixed(2)}, ${trustInfo.ciHigh.toFixed(2)}]`);

  fs.writeFileSync(
    path.resolve("research/v02-analysis.json"),
    JSON.stringify({ results, shadow: allShadows }, null, 2),
  );
  console.log(`\nWrote research/v02-results.json in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main();
