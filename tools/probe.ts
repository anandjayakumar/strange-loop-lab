import { SimulationEngine } from "../src/simulation/experiments/engine";
import { mean } from "../src/simulation/math";
import { MODES, type Mode } from "../src/simulation/types";

const seeds = process.argv.slice(2).map(Number).filter(Number.isFinite);
const runSeeds = seeds.length ? seeds : [20261117, 7, 99, 1234, 55501];
const horizon = 1200;

function pct(values: number[], digits = 2): string {
  return mean(values).toFixed(digits);
}

for (const seed of runSeeds) {
  console.log(`\nseed ${seed}`);
  console.log(
    "mode  alive  tick  res  energy  world  self   kl    trust  rest  slip  moves",
  );
  for (const mode of MODES as Mode[]) {
    const engine = new SimulationEngine({ seed, mode, recordEvents: false });
    const started = Date.now();
    while (engine.physical.alive && engine.getTick() < horizon) engine.step();
    const series = engine.getSeries();
    const selfAcc = series
      .map((p) => p.selfStateAccuracy)
      .filter((v): v is number => v !== null);
    const trust = series.map((p) => p.metaTrust).filter((v): v is number => v !== null);
    const rests = series.filter((p) => p.action === "REST").length;
    const moves = series.length - rests;
    const sn = engine.getSnapshot();
    console.log(
      [
        mode.padEnd(5),
        String(engine.physical.alive).padEnd(6),
        String(engine.getTick()).padEnd(5),
        String(engine.physical.resourcesCollected).padEnd(4),
        engine.physical.energy.toFixed(1).padEnd(7),
        pct(series.map((p) => p.worldAccuracy)).padEnd(6),
        (selfAcc.length ? pct(selfAcc) : "—").padEnd(6),
        pct(series.map((p) => p.selfInfluence)).padEnd(5),
        (trust.length ? pct(trust) : "—").padEnd(6),
        `${rests}`.padEnd(5),
        `${engine.physical.slips}`.padEnd(5),
        `${moves}`.padEnd(5),
        `${Date.now() - started}ms`,
      ].join(" "),
    );
    if (!engine.physical.alive) {
      console.log(`      death at ${engine.getTick()}, final self err ${sn.selfModel ? Math.abs(sn.selfModel.energyEstimate - sn.physical.energy).toFixed(1) : "—"}`);
    }
  }
}
