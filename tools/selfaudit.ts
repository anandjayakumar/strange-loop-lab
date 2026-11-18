/**
 * Focused audit of what the self-model actually estimates.
 * 100 paired seeds, 1200 ticks, no changes to the simulator.
 */

import { SimulationEngine } from "../src/simulation/experiments/engine";
import { meanOf, pearson, summarize } from "./stats";

const MODES = ["B", "C", "B_frozen_self", "C_frozen_self"] as const;
const seeds = Array.from({ length: Number(process.env.SEEDS ?? 100) }, (_, i) => i + 1);

interface Row {
  energyMAE: number;
  energyMax: number;
  sensorMAE: number;
  fatigueMAE: number;
  fatigueCorr: number;
  restGain: number;
  collectGain: number;
  costBias: number;
  costMAE: number;
  successBrier: number;
}

for (const mode of MODES) {
  const rows: Row[] = [];
  for (const seed of seeds) {
    const engine = new SimulationEngine({
      seed,
      mode: mode.startsWith("B") ? "B" : "C",
      research:
        mode === "B_frozen_self" || mode === "C_frozen_self"
          ? { selfLearning: false }
          : undefined,
      selfFeedback: true,
      metaFeedback: mode.startsWith("C"),
      recordEvents: false,
      historyLimit: 1200,
    });
    while (engine.physical.alive && engine.getTick() < 1200) engine.step();
    const series = engine.getSeries();
    const self = engine.getSnapshot().selfModel;
    if (!self) continue;
    const energyErrors = series
      .map((p) => p.selfStateError)
      .filter((v): v is number => v !== null);
    const sensorErrors = series
      .map((p) => p.sensorStateError)
      .filter((v): v is number => v !== null);
    const fatigueErrors = series
      .map((p) =>
        p.fatigueEstimate === null ? null : Math.abs(p.fatigueEstimate - p.fatigue),
      )
      .filter((v): v is number => v !== null);
    const fatigueActual = series
      .map((p) => p.fatigue)
      .filter((_, i) => series[i].fatigueEstimate !== null);
    const fatigueEstimate = series
      .map((p) => p.fatigueEstimate)
      .filter((v): v is number => v !== null);
    const costPairs = series.filter(
      (p) => p.movementCostEstimate !== null && p.effectiveCost !== undefined,
    );
    const costs = costPairs.map(
      (p) => (p.movementCostEstimate as number) - p.effectiveCost,
    );
    rows.push({
      energyMAE: meanOf(energyErrors),
      energyMax: Math.max(...energyErrors),
      sensorMAE: meanOf(sensorErrors),
      fatigueMAE: meanOf(fatigueErrors),
      fatigueCorr: pearson(fatigueActual, fatigueEstimate),
      restGain: self.restGain,
      collectGain: self.collectGain,
      costBias: meanOf(costs),
      costMAE: meanOf(costs.map((v) => Math.abs(v))),
      successBrier: meanOf(
        series
          .map((p) => p.selfPredictionError)
          .filter((v): v is number => v !== null),
      ),
    });
  }
  console.log(`\n${mode} (n=${rows.length})`);
  for (const key of [
    "energyMAE",
    "sensorMAE",
    "energyMax",
    "fatigueMAE",
    "fatigueCorr",
    "restGain",
    "collectGain",
    "costBias",
    "costMAE",
    "successBrier",
  ] as const) {
    const s = summarize(rows.map((r) => r[key]), 4400 + key.length);
    console.log(
      `  ${key.padEnd(14)} ${s.mean.toFixed(2)} [${s.ciLow.toFixed(2)}, ${s.ciHigh.toFixed(
        2,
      )}] median ${s.median.toFixed(2)} SD ${s.sd.toFixed(2)}`,
    );
  }
}
