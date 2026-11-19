/**
 * Scientific hardening harness for the frozen V0.1--V0.6.1 engines.
 *
 *   npm run validate:hardening
 *
 * Experiment A: 2x2 factorial on V0.3 (residual meta-model x risk-sensitive bound)
 * Experiment B: 9-point precision-suppression sweep on V0.4
 * Experiment C: comparison of development seeds 1--100 with the untouched
 *               holdout 10001--10100 produced by `npm run validate:holdout`
 *
 * No decision or learning equation is changed. The only new knob is an
 * experimental suppression exponent whose default (1.0) is bit-identical to the
 * frozen V0.4 rule; it exists solely to map the trade-off curve.
 */

import fs from "node:fs";
import path from "node:path";
import { V03Engine } from "../src/simulation/v03/engine";
import { V04Engine } from "../src/simulation/v04/engine";
import type { Scenario as V03Scenario } from "../src/simulation/v03/types";
import type { Scenario as V04Scenario } from "../src/simulation/v04/types";

const RESEARCH = path.resolve("research");
const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);
const HORIZON = 1000;
const SHIFT_WINDOW_START = 378;
const SHIFT_WINDOW_END = 406;

const mean = (xs: readonly number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

function sd(xs: readonly number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(
    xs.reduce((sum, x) => sum + (x - m) ** 2, 0) / (xs.length - 1),
  );
}

function quantile(sorted: readonly number[], q: number) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function summarise(values: readonly number[], rngSeed: number) {
  const clean = values.filter((v) => Number.isFinite(v));
  const n = clean.length;
  const m = mean(clean);
  const s = sd(clean);
  const rng = mulberry32(rngSeed);
  const boots: number[] = [];
  for (let b = 0; b < 2000; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += clean[Math.floor(rng() * n)];
    boots.push(sum / n);
  }
  boots.sort((a, b) => a - b);
  return {
    n,
    mean: m,
    sd: s,
    se: s / Math.sqrt(Math.max(1, n)),
    ciLow: quantile(boots, 0.025),
    ciHigh: quantile(boots, 0.975),
    dz: s === 0 ? 0 : m / s,
  };
}

/** Exact two-sided paired sign-flip test with +1 correction. */
function signFlip(values: readonly number[], permutations = 2000, rngSeed = 20261119) {
  const clean = values.filter((v) => Number.isFinite(v));
  const observed = Math.abs(mean(clean));
  const rng = mulberry32(rngSeed);
  let extreme = 0;
  for (let p = 0; p < permutations; p++) {
    let sum = 0;
    for (const value of clean) sum += rng() < 0.5 ? -value : value;
    if (Math.abs(sum / clean.length) >= observed) extreme++;
  }
  return (extreme + 1) / (permutations + 1);
}

function effect(values: readonly number[], label: string, rngSeed: number) {
  const summary = summarise(values, rngSeed);
  return {
    label,
    ...summary,
    p: signFlip(values, 2000, rngSeed + 1),
  };
}

/* ------------------------------------------------------------ experiment A */

type V03Arm = {
  key: "A" | "B" | "C" | "D";
  label: string;
  residualMeta: boolean;
  riskControl: boolean;
};

const ARMS: V03Arm[] = [
  { key: "A", label: "Residual OFF / Risk OFF", residualMeta: false, riskControl: false },
  { key: "B", label: "Residual ON / Risk OFF", residualMeta: true, riskControl: false },
  { key: "C", label: "Residual OFF / Risk ON", residualMeta: false, riskControl: true },
  { key: "D", label: "Residual ON / Risk ON", residualMeta: true, riskControl: true },
];

type V03Run = {
  seed: number;
  arm: V03Arm["key"];
  resources: number;
  alive: boolean;
  minEnergy: number;
  selfMae: number;
  metaBrier: number;
};

function runFactorial(regime: "standard" | "shift"): V03Run[] {
  const scenario: V03Scenario = regime === "standard" ? "stable" : "physical_shift";
  const rows: V03Run[] = [];
  for (const arm of ARMS) {
    for (const seed of SEEDS) {
      const engine = new V03Engine({
        seed,
        difficulty: "standard",
        priorRegime: "uninformed",
        scenario,
        explorationMode: "voi",
        lambda: 0.35,
        beliefTrap: "none",
        riskControl: arm.riskControl,
        residualMeta: arm.residualMeta,
        recordEvents: false,
        historyLimit: 1100,
      });
      while (engine.getTick() < HORIZON && engine.getSnapshot().alive) engine.step();
      const snapshot = engine.getSnapshot();
      rows.push({
        seed,
        arm: arm.key,
        resources: snapshot.metrics.resources,
        alive: snapshot.metrics.alive,
        minEnergy: snapshot.metrics.minEnergy,
        selfMae: snapshot.metrics.selfEnergyMae,
        metaBrier: snapshot.metrics.metaBrier,
      });
    }
  }
  return rows;
}

function factorialExperiment() {
  const output: Record<string, unknown> = {};
  for (const regime of ["standard", "shift"] as const) {
    const rows = runFactorial(regime);
    const bySeed = new Map<number, Record<string, V03Run>>();
    for (const row of rows) {
      const entry = bySeed.get(row.seed) ?? {};
      entry[row.arm] = row;
      bySeed.set(row.seed, entry);
    }
    const ordered = ARMS.map((arm) => ({
      key: arm.key,
      label: arm.label,
      resources: summarise(
        rows.filter((r) => r.arm === arm.key).map((r) => r.resources),
        9001 + arm.key.charCodeAt(0),
      ),
      selfMae: summarise(
        rows.filter((r) => r.arm === arm.key).map((r) => r.selfMae),
        9101 + arm.key.charCodeAt(0),
      ),
      survival: rows.filter((r) => r.arm === arm.key && r.alive).length,
    }));

    const residual: number[] = [];
    const risk: number[] = [];
    const interaction: number[] = [];
    for (const entry of bySeed.values()) {
      if (!entry.A || !entry.B || !entry.C || !entry.D) continue;
      const a = entry.A.resources;
      const b = entry.B.resources;
      const c = entry.C.resources;
      const d = entry.D.resources;
      residual.push((b - a + (d - c)) / 2);
      risk.push((c - a + (d - b)) / 2);
      interaction.push(d - c - (b - a));
    }

    output[regime] = {
      conditions: ordered,
      effects: {
        residualMain: effect(residual, "Residual meta-model main effect", 9200),
        riskMain: effect(risk, "Risk-sensitive bound main effect", 9300),
        interaction: effect(interaction, "Residual x risk interaction", 9400),
      },
    };
    console.log(
      `factorial ${regime}: residual ${mean(residual).toFixed(2)} (p=${signFlip(residual).toFixed(4)}), ` +
        `risk ${mean(risk).toFixed(2)} (p=${signFlip(risk).toFixed(4)}), ` +
        `interaction ${mean(interaction).toFixed(2)} (p=${signFlip(interaction).toFixed(4)})`,
    );
  }
  fs.writeFileSync(
    path.join(RESEARCH, "hardening-factorial.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        version: "V0.3 frozen",
        design: "2x2 factorial: residual meta-model x risk-sensitive bound",
        seeds: SEEDS,
        horizon: HORIZON,
        metric: "resources per 1,000 ticks, paired by seed",
        regimes: output,
      },
      null,
      2,
    )}\n`,
  );
  console.log("wrote research/hardening-factorial.json");
}

/* ------------------------------------------------------------ experiment B */

const SUPPRESSION_POINTS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function runStandard(seed: number, suppression: number) {
  const engine = new V04Engine({
    seed,
    difficulty: "standard",
    priorRegime: "uninformed",
    scenario: "stable",
    explorationMode: "voi",
    lambda: 0.35,
    precisionSuppression: suppression,
    recordEvents: false,
    historyLimit: 1100,
  });
  while (engine.getTick() < HORIZON && engine.getSnapshot().alive) engine.step();
  const snapshot = engine.getSnapshot();
  return {
    selfMae: snapshot.metrics.selfEnergyMae,
    resources: snapshot.metrics.resources,
    precisionGain: snapshot.selfModel.precisionGain,
  };
}

function runPp1(seed: number, suppression: number) {
  const engine = new V04Engine({
    seed,
    difficulty: "standard",
    priorRegime: "uninformed",
    scenario: "stable",
    explorationMode: "voi",
    lambda: 0.35,
    precisionSuppression: suppression,
    recordEvents: false,
    historyLimit: 600,
  });
  while (engine.getTick() < 200) engine.step();
  const before = engine.getSnapshot().selfModel.energyEstimate;
  engine.injectPulse(12, 0, 1);
  engine.step();
  const after = engine.getSnapshot().selfModel.energyEstimate;
  return 1 - Math.abs(after - before) / 12;
}

const SHIFT_SCENARIOS: { scenario: V04Scenario; expected: string }[] = [
  { scenario: "physical_shift", expected: "physical" },
  { scenario: "energy_sensor_shift", expected: "energy_sensor" },
  { scenario: "fatigue_sensor_shift", expected: "fatigue_sensor" },
  { scenario: "shared_shift", expected: "shared" },
];

function attributionLabel(seed: number, suppression: number, scenario: V04Scenario) {
  const horizon = SHIFT_WINDOW_END + 4;
  const engine = new V04Engine({
    seed,
    difficulty: "standard",
    priorRegime: "uninformed",
    scenario,
    explorationMode: "voi",
    lambda: 0.35,
    precisionSuppression: suppression,
    recordEvents: false,
    historyLimit: horizon + 10,
  });
  while (engine.getTick() < horizon) engine.step();
  const points = engine
    .getSeries()
    .filter((p) => p.t >= SHIFT_WINDOW_START && p.t < SHIFT_WINDOW_END);
  if (!points.length) return "insufficient";
  const values = {
    physical: mean(points.map((p) => p.attributionPhysical)),
    energy_sensor: mean(points.map((p) => p.attributionEnergy)),
    fatigue_sensor: mean(points.map((p) => p.attributionFatigue)),
    shared: mean(points.map((p) => p.attributionShared)),
    insufficient: mean(points.map((p) => p.attributionInsufficient)),
  };
  return (Object.entries(values) as [string, number][]).sort((a, b) => b[1] - a[1])[0][0];
}

function macroF1(pairs: { expected: string; predicted: string }[]) {
  const labels = ["physical", "energy_sensor", "fatigue_sensor", "shared", "insufficient"];
  const f1s: number[] = [];
  for (const label of labels) {
    const tp = pairs.filter((p) => p.expected === label && p.predicted === label).length;
    const fp = pairs.filter((p) => p.expected !== label && p.predicted === label).length;
    const fn = pairs.filter((p) => p.expected === label && p.predicted !== label).length;
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    f1s.push(precision + recall ? (2 * precision * recall) / (precision + recall) : 0);
  }
  return mean(f1s);
}

function sweepExperiment() {
  const rows = SUPPRESSION_POINTS.map((suppression, index) => {
    const standard = SEEDS.map((seed) => runStandard(seed, suppression));
    const absorption = SEEDS.map((seed) => runPp1(seed, suppression));
    const predictions: { expected: string; predicted: string }[] = [];
    for (const shift of SHIFT_SCENARIOS) {
      for (const seed of SEEDS) {
        predictions.push({
          expected: shift.expected,
          predicted: attributionLabel(seed, suppression, shift.scenario),
        });
      }
    }
    const row = {
      suppression,
      absorption: summarise(absorption, 9500 + index),
      stationaryMae: summarise(standard.map((r) => r.selfMae), 9600 + index),
      resources: summarise(standard.map((r) => r.resources), 9700 + index),
      macroF1: macroF1(predictions),
      meanPrecisionGain: mean(standard.map((r) => r.precisionGain)),
      confusion: predictions,
    };
    console.log(
      `sweep ${suppression.toFixed(2)}: absorption ${row.absorption.mean.toFixed(3)}, ` +
        `MAE ${row.stationaryMae.mean.toFixed(3)}, macro-F1 ${row.macroF1.toFixed(3)}`,
    );
    return row;
  });

  fs.writeFileSync(
    path.join(RESEARCH, "hardening-sweep.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        version: "V0.4 frozen (suppression exponent 1.0)",
        design: "9-point precision-suppression sweep",
        seeds: SEEDS,
        horizon: HORIZON,
        shiftWindow: [SHIFT_WINDOW_START, SHIFT_WINDOW_END],
        note: "Suppression exponent 0 disables the V0.4 suppression term; 1 reproduces the frozen rule; 2 strengthens it. Only the sweep uses this knob.",
        points: rows.map(({ confusion: _confusion, ...rest }) => rest),
      },
      null,
      2,
    )}\n`,
  );
  console.log("wrote research/hardening-sweep.json");
}

/* ------------------------------------------------------------ experiment C */

type Analysis = {
  counts: { runs: number; conditions: number; seeds: number };
  conditions: Record<string, { summary: Record<string, { mean: number; ciLow: number; ciHigh: number }> }>;
  capabilityMatrix?: Record<string, Record<string, number>>;
};

function compareHoldout() {
  const devPath = path.join(RESEARCH, "v06-analysis.json");
  const holdoutPath = path.join(RESEARCH, "v06-holdout-analysis.json");
  if (!fs.existsSync(devPath) || !fs.existsSync(holdoutPath)) {
    console.log("holdout comparison skipped: missing development or holdout analysis");
    return;
  }
  const dev = JSON.parse(fs.readFileSync(devPath, "utf8")) as Analysis;
  const holdout = JSON.parse(fs.readFileSync(holdoutPath, "utf8")) as Analysis;
  const shared = Object.keys(dev.conditions).filter((key) => key in holdout.conditions);

  const resourceDiffs = shared
    .map((key) => ({
      condition: key,
      dev: dev.conditions[key].summary.resources?.mean,
      holdout: holdout.conditions[key].summary.resources?.mean,
    }))
    .filter((row) => Number.isFinite(row.dev) && Number.isFinite(row.holdout))
    .map((row) => ({
      ...row,
      difference: (row.holdout as number) - (row.dev as number),
    }));

  const maxAbsResourceDiff = resourceDiffs.reduce(
    (best, row) => (Math.abs(row.difference) > Math.abs(best.difference) ? row : best),
    { condition: "none", dev: 0, holdout: 0, difference: 0 },
  );

  const headline: Record<string, unknown> = {};
  const devMatrix = dev.capabilityMatrix ?? {};
  const holdMatrix = holdout.capabilityMatrix ?? {};
  for (const key of Object.keys(devMatrix)) {
    if (!holdMatrix[key]) continue;
    headline[key] = Object.fromEntries(
      Object.keys(devMatrix[key]).map((metric) => [
        metric,
        {
          dev: devMatrix[key][metric],
          holdout: holdMatrix[key][metric],
          difference: holdMatrix[key][metric] - devMatrix[key][metric],
        },
      ]),
    );
  }

  const comparison = {
    generatedAt: new Date().toISOString(),
    development: { seeds: dev.counts.seeds, runs: dev.counts.runs },
    holdout: { seeds: holdout.counts.seeds, runs: holdout.counts.runs },
    sharedConditions: shared.length,
    maxAbsResourceDifference: maxAbsResourceDiff,
    meanAbsResourceDifference: mean(resourceDiffs.map((row) => Math.abs(row.difference))),
    headline,
    perConditionResources: resourceDiffs,
  };
  fs.writeFileSync(
    path.join(RESEARCH, "hardening-holdout-comparison.json"),
    `${JSON.stringify(comparison, null, 2)}\n`,
  );
  console.log(
    `wrote research/hardening-holdout-comparison.json (${shared.length} conditions, ` +
      `max |resource diff| ${Math.abs(maxAbsResourceDiff.difference).toFixed(2)})`,
  );
}

/* ------------------------------------------------------------------- main */

fs.mkdirSync(RESEARCH, { recursive: true });
const only = process.argv.find((value) => value.startsWith("--only="))?.split("=")[1];

if (!only || only === "factorial") factorialExperiment();
if (!only || only === "sweep") sweepExperiment();
if (!only || only === "compare") compareHoldout();
