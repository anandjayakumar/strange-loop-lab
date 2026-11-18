/**
 * Read research/results.json and produce the tables used in the report.
 * Run after tools/validate.ts.
 */

import fs from "node:fs";
import path from "node:path";
import {
  bootstrapCorrelation,
  formatP,
  holm,
  meanOf,
  medianOf,
  pairedComparison,
  summarize,
} from "./stats";

interface ResultFile {
  metadata: {
    seeds: number;
    seedList: number[];
    horizon: number;
    corruptionHorizon: number;
    conditions: { key: string; label: string }[];
    controlSets: { key: string; label: string }[];
  };
  results: Record<string, any[]>;
  corruption: any[];
}

const data = JSON.parse(
  fs.readFileSync(path.resolve("research/results.json"), "utf8"),
) as ResultFile;

const KEY_METRICS: { key: string; label: string; digits: number }[] = [
  { key: "ticks", label: "ticks survived", digits: 0 },
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
  { key: "klMean", label: "KL influence", digits: 2 },
  { key: "policyTvMean", label: "policy TV", digits: 2 },
  { key: "decisionChangeRate", label: "decision change", digits: 2 },
  { key: "costMAE", label: "cost MAE", digits: 2 },
  { key: "energyError", label: "energy error", digits: 1 },
  { key: "trustMean", label: "trust", digits: 2 },
  { key: "confidenceMean", label: "confidence", digits: 2 },
  { key: "actionEntropy", label: "action entropy", digits: 2 },
  { key: "rewardMean", label: "mean reward", digits: 2 },
];

function metric(run: any, key: string): number {
  const value = run?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : NaN;
}

function metricArray(runs: any[], key: string): number[] {
  return runs.map((run) => metric(run, key));
}

const output: Record<string, unknown> = {};

console.log("CONDITION SUMMARY: mean [95% CI] · median · SD · n");
const conditionTable: Record<string, Record<string, unknown>> = {};
for (const condition of data.metadata.conditions) {
  const runs = data.results[condition.key] ?? [];
  const alive = runs.filter((r) => r.alive).length;
  const row: Record<string, unknown> = { alive, n: runs.length, metrics: {} };
  console.log(`\n${condition.key} (${condition.label}) alive ${alive}/${runs.length}`);
  for (const metricDef of KEY_METRICS) {
    const values = metricArray(runs, metricDef.key);
    const s = summarize(values, 3001 + metricDef.key.length);
    (row.metrics as Record<string, unknown>)[metricDef.key] = s;
    console.log(
      `  ${metricDef.label.padEnd(17)} ${s.mean.toFixed(metricDef.digits)} [${s.ciLow.toFixed(
        metricDef.digits,
      )}, ${s.ciHigh.toFixed(metricDef.digits)}] · med ${s.median.toFixed(
        metricDef.digits,
      )} · SD ${s.sd.toFixed(metricDef.digits)} · n ${s.n}`,
    );
  }
  conditionTable[condition.key] = row;
}
output.conditions = conditionTable;

const CONTRASTS: { label: string; a: string; b: string }[] = [
  { label: "First-order: B − A", a: "B", b: "A" },
  { label: "Self feedback: B − B_self_off", a: "B", b: "B_self_off" },
  { label: "Self learning: B − B_frozen_self", a: "B", b: "B_frozen_self" },
  { label: "Meta added: C − B", a: "C", b: "B" },
  { label: "Meta feedback: C − C_meta_off", a: "C", b: "C_meta_off" },
  { label: "Plasticity: C − C_plasticity_off", a: "C", b: "C_plasticity_off" },
  { label: "Prior weighting: C − C_prior_off", a: "C", b: "C_prior_off" },
  { label: "Self feedback in C: C − C_self_off", a: "C", b: "C_self_off" },
  { label: "Self learning in C: C − C_frozen_self", a: "C", b: "C_frozen_self" },
  { label: "World: A − A_no_world", a: "A", b: "A_no_world" },
  { label: "World in C: C − C_no_world", a: "C", b: "C_no_world" },
  { label: "World learning in C: C − C_world_frozen", a: "C", b: "C_world_frozen" },
];

console.log("\nPAIRED CONTRASTS");
const contrastOutput: Record<string, unknown> = {};
for (const contrast of CONTRASTS) {
  const aRuns = data.results[contrast.a] ?? [];
  const bRuns = data.results[contrast.b] ?? [];
  const rows: any[] = [];
  for (const metricDef of KEY_METRICS) {
    const av = metricArray(aRuns, metricDef.key);
    const bv = metricArray(bRuns, metricDef.key);
    const a: number[] = [];
    const b: number[] = [];
    for (let i = 0; i < Math.min(av.length, bv.length); i++) {
      if (Number.isFinite(av[i]) && Number.isFinite(bv[i])) {
        a.push(av[i]);
        b.push(bv[i]);
      }
    }
    if (a.length < 10) continue;
    const paired = pairedComparison(a, b, 9001 + rows.length, 10000);
    rows.push({
      key: metricDef.key,
      label: metricDef.label,
      ...paired,
      pRaw: paired.pPermutation,
    });
  }
  const adjusted = holm(rows.map((r) => r.pRaw));
  rows.forEach((row, i) => {
    row.pHolm = adjusted[i];
  });
  contrastOutput[contrast.label] = rows;
  console.log(`\n${contrast.label}`);
  for (const row of rows.filter((r) =>
    [
      "ticks",
      "meanEnergy",
      "resources",
      "restFraction",
      "worldBssSuccess",
      "worldBssCollect",
      "selfBssSuccess",
      "selfDeltaMAE",
      "selfStateAccuracy",
      "klMean",
      "decisionChangeRate",
      "costMAE",
      "trustMean",
    ].includes(r.key),
  )) {
    console.log(
      `  ${row.label.padEnd(17)} ${row.meanA.toFixed(2)} − ${row.meanB.toFixed(
        2,
      )} = ${row.meanDiff.toFixed(2)} [${row.ciLow.toFixed(2)}, ${row.ciHigh.toFixed(
        2,
      )}] dz ${row.cohenDz.toFixed(2)} p ${formatP(row.pHolm)}`,
    );
  }
}
output.contrasts = contrastOutput;

console.log("\nKL / DECISION DIAGNOSTICS");
const klOutput: Record<string, unknown> = {};
for (const key of ["B", "C", "B_frozen_self", "C_frozen_self", "B_self_off", "C_self_off"]) {
  const runs = data.results[key] ?? [];
  const kl = runs.map((r) => metric(r, "klMean"));
  const decision = runs.map((r) => metric(r, "decisionChangeRate"));
  const tv = runs.map((r) => metric(r, "policyTvMean"));
  const kd = bootstrapCorrelation(kl, decision, 77);
  const ktv = bootstrapCorrelation(kl, tv, 78);
  const positive = kl.filter((v) => v > 0.001).length;
  const row = {
    n: runs.length,
    klMean: meanOf(kl),
    klMedian: medianOf(kl),
    klP95: meanOf(runs.map((r) => metric(r, "klP95"))),
    decisionMean: meanOf(decision),
    tvMean: meanOf(tv),
    corrKlDecision: kd,
    corrKlTv: ktv,
    positiveFraction: positive / Math.max(1, kl.length),
  };
  klOutput[key] = row;
  console.log(
    `${key.padEnd(14)} KL ${row.klMean.toFixed(3)} med ${row.klMedian.toFixed(
      3,
    )} p95 ${row.klP95.toFixed(3)} · decision ${row.decisionMean.toFixed(
      3,
    )} · TV ${row.tvMean.toFixed(3)} · r(KL,decision) ${kd.r.toFixed(
      2,
    )} [${kd.ciLow.toFixed(2)}, ${kd.ciHigh.toFixed(2)}] · positive ${(
      row.positiveFraction * 100
    ).toFixed(0)}%`,
  );
}

for (const [on, off] of [
  ["B", "B_self_off"],
  ["C", "C_self_off"],
] as const) {
  const onRuns = data.results[on] ?? [];
  const offRuns = data.results[off] ?? [];
  const kl = onRuns.map((r) => metric(r, "klMean"));
  const dRest = onRuns.map((r, i) => metric(r, "restFraction") - metric(offRuns[i], "restFraction"));
  const dEnergy = onRuns.map((r, i) => metric(r, "meanEnergy") - metric(offRuns[i], "meanEnergy"));
  const dRes = onRuns.map((r, i) => metric(r, "resources") - metric(offRuns[i], "resources"));
  const cd = Math.abs(meanOf(dRest));
  const ce = Math.abs(meanOf(dEnergy));
  const cr = Math.abs(meanOf(dRes));
  console.log(`${on} − ${off}: Δrest ${meanOf(dRest).toFixed(3)} Δenergy ${meanOf(
    dEnergy,
  ).toFixed(1)} Δresources ${meanOf(dRes).toFixed(1)}`);
  klOutput[`${on}_vs_${off}`] = {
    deltaRest: meanOf(dRest),
    deltaEnergy: meanOf(dEnergy),
    deltaResources: meanOf(dRes),
    corrKlDeltaRest: bootstrapCorrelation(kl, dRest, 91),
    corrKlDeltaEnergy: bootstrapCorrelation(kl, dEnergy, 92),
    corrKlDeltaResources: bootstrapCorrelation(kl, dRes, 93),
    scaleRest: cd,
    scaleEnergy: ce,
    scaleResources: cr,
  };
}
output.kl = klOutput;

console.log("\nCONFIDENCE / META CALIBRATION");
const calibrationOutput: Record<string, unknown> = {};
for (const key of [
  "C",
  "C_meta_off",
  "C_plasticity_off",
  "C_prior_off",
  "C_frozen_self",
]) {
  const runs = data.results[key] ?? [];
  const get = (k: string) => runs.map((r) => metric(r, k)).filter(Number.isFinite);
  const row: Record<string, unknown> = {};
  const fields = [
    "corrTrustState",
    "corrConfState",
    "corrTrustFutureState",
    "corrConfFutureState",
    "corrTrustForward",
    "corrConfForward",
    "r2ConfFuture",
    "r2BothFuture",
    "eceTrust",
    "eceConf",
    "aucTrustLow",
    "aucConfLow",
    "metaCalibrationFinal",
    "metaInternalCalibration",
  ];
  console.log(`\n${key}`);
  for (const field of fields) {
    const values = get(field);
    const s = summarize(values, 9500 + field.length);
    row[field] = s;
    console.log(
      `  ${field.padEnd(24)} ${Number.isFinite(s.mean) ? `${s.mean.toFixed(2)} [${s.ciLow.toFixed(2)}, ${s.ciHigh.toFixed(2)}]` : "—"}`,
    );
  }
  calibrationOutput[key] = row;
}
const cRuns = data.results.C ?? [];
const trustFuture = cRuns.map((r) => metric(r, "corrTrustFutureState"));
const confFuture = cRuns.map((r) => metric(r, "corrConfFutureState"));
const r2Conf = cRuns.map((r) => metric(r, "r2ConfFuture"));
const r2Both = cRuns.map((r) => metric(r, "r2BothFuture"));
const aucTrust = cRuns.map((r) => metric(r, "aucTrustLow"));
const aucConf = cRuns.map((r) => metric(r, "aucConfLow"));
const incremental = pairedComparison(r2Both, r2Conf, 11);
const trustVsConf = pairedComparison(trustFuture, confFuture, 12);
const aucDiff = pairedComparison(aucTrust, aucConf, 13);
console.log(
  `\nC: trust future vs confidence future = ${trustVsConf.meanDiff.toFixed(2)} [${trustVsConf.ciLow.toFixed(2)}, ${trustVsConf.ciHigh.toFixed(2)}] p ${formatP(trustVsConf.pPermutation)}`,
);
console.log(
  `C: incremental R² (both − confidence) = ${incremental.meanDiff.toFixed(3)} [${incremental.ciLow.toFixed(3)}, ${incremental.ciHigh.toFixed(3)}] p ${formatP(incremental.pPermutation)}`,
);
console.log(
  `C: AUC trust − confidence = ${aucDiff.meanDiff.toFixed(2)} [${aucDiff.ciLow.toFixed(2)}, ${aucDiff.ciHigh.toFixed(2)}] p ${formatP(aucDiff.pPermutation)}`,
);
calibrationOutput.paired = { trustVsConf, incremental, aucDiff };
output.calibration = calibrationOutput;

console.log("\nCORRUPTION");
const corruptionOutput: Record<string, unknown> = {};
const groups = new Map<string, any[]>();
for (const obs of data.corruption) {
  const key = `${obs.control}/${obs.corruption}`;
  const list = groups.get(key) ?? [];
  list.push(obs);
  groups.set(key, list);
}
for (const [key, runs] of groups) {
  const recovered = runs.filter((r) => r.recovered).length;
  const detected = runs.filter((r) => r.detectedAt !== null).length;
  const before = runs.filter((r) => r.detectedBeforeCorrection).length;
  const corrections = runs.map((r) => r.correctedAt ?? data.metadata.corruptionHorizon + 1);
  const detections = runs.map((r) => r.detectedAt ?? data.metadata.corruptionHorizon + 1);
  const revisions = runs.map((r) => r.firstRevision ?? data.metadata.corruptionHorizon + 1);
  const trustBefore = runs.map((r) => r.trustBefore).filter(Number.isFinite);
  const trustAt = runs.map((r) => r.trustAtDetection).filter(Number.isFinite);
  const trustAfter = runs.map((r) => r.trustAfterCorrection).filter(Number.isFinite);
  const gapFinal = runs.map((r) => r.modelGapFinal).filter(Number.isFinite);
  const row = {
    n: runs.length,
    recovered,
    detected,
    detectedBeforeCorrection: before,
    correction: summarize(corrections, 501),
    detection: summarize(detections, 502),
    revision: summarize(revisions, 503),
    trustBefore: meanOf(trustBefore),
    trustAtDetection: meanOf(trustAt),
    trustAfterCorrection: meanOf(trustAfter),
    modelGapFinal: meanOf(gapFinal),
    restPre: meanOf(runs.map((r) => r.restFractionPre)),
    restDuring: meanOf(runs.map((r) => r.restFractionDuring)),
    restPost: meanOf(runs.map((r) => r.restFractionPost)),
    klDuring: meanOf(runs.map((r) => r.klDuring)),
    tvDuring: meanOf(runs.map((r) => r.tvDuring)),
    decisionDuring: meanOf(runs.map((r) => r.decisionChangeDuring)),
  };
  corruptionOutput[key] = row;
  console.log(
    `${key.padEnd(22)} rec ${recovered}/${runs.length} det ${detected} before ${before} · correction ${row.correction.median.toFixed(
      1,
    )} med · detection ${row.detection.median.toFixed(1)} · first rev ${row.revision.median.toFixed(
      1,
    )} · trust ${row.trustBefore.toFixed(2)}→${Number.isFinite(row.trustAtDetection) ? row.trustAtDetection.toFixed(2) : "—"}→${Number.isFinite(row.trustAfterCorrection) ? row.trustAfterCorrection.toFixed(2) : "—"} · gap ${row.modelGapFinal.toFixed(2)}`,
  );
}
output.corruption = corruptionOutput;

console.log("\nMETA CONTRIBUTION TO RECOVERY (paired by seed)");
const metaContribution: Record<string, unknown> = {};
for (const level of ["cheap", "expensive"] as const) {
  for (const comparator of ["meta_off", "plasticity_off", "prior_off"] as const) {
    const on = (data.corruption as any[]).filter(
      (r) => r.control === "meta_on" && r.corruption === level,
    );
    const off = (data.corruption as any[]).filter(
      (r) => r.control === comparator && r.corruption === level,
    );
    const bySeed = new Map<number, any>();
    for (const r of off) bySeed.set(r.seed, r);
    const pairs = on.filter((r) => bySeed.has(r.seed));
    const timeOn = pairs.map((r) => r.correctedAt ?? data.metadata.corruptionHorizon + 1);
    const timeOff = pairs.map((r) => bySeed.get(r.seed)!.correctedAt ?? data.metadata.corruptionHorizon + 1);
    const recOn = pairs.map((r) => (r.recovered ? 1 : 0));
    const recOff = pairs.map((r) => (bySeed.get(r.seed)!.recovered ? 1 : 0));
    const trustOn = pairs.map((r) => r.trustBefore - (r.trustAtDetection ?? r.trustBefore));
    const trustOff = pairs.map((r) => {
      const o = bySeed.get(r.seed)!;
      return o.trustBefore - (o.trustAtDetection ?? o.trustBefore);
    });
    const time = pairedComparison(timeOn, timeOff, 601);
    const rec = pairedComparison(recOn, recOff, 602);
    const trust = pairedComparison(trustOn, trustOff, 603);
    metaContribution[`${level}/${comparator}`] = { time, rec, trust };
    console.log(
      `${level} meta_on vs ${comparator}: correction ${time.meanDiff.toFixed(
        1,
      )} [${time.ciLow.toFixed(1)}, ${time.ciHigh.toFixed(1)}] p ${formatP(
        time.pPermutation,
      )} · recovery ${rec.meanDiff.toFixed(2)} p ${formatP(
        rec.pPermutation,
      )} · trust drop ${trust.meanDiff.toFixed(3)} p ${formatP(trust.pPermutation)}`,
    );
  }
}
output.metaContribution = metaContribution;

fs.writeFileSync(
  path.resolve("research/analysis.json"),
  JSON.stringify(output, null, 2),
);
console.log("\nWrote research/analysis.json");
