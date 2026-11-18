import { describe, expect, it } from "vitest";
import { V02Engine } from "../src/simulation/v02/engine";

function run(seed = 7, steps = 80, extra = {}) {
  const engine = new V02Engine({
    seed,
    difficulty: "standard",
    priorRegime: "uninformed",
    explorationMode: "voi",
    scenario: "stable",
    recordEvents: false,
    historyLimit: 300,
    ...extra,
  });
  for (let i = 0; i < steps && engine.physical.alive; i++) engine.step();
  return engine;
}

describe("V0.2 simulator", () => {
  it("is deterministic under identical seeds and options", () => {
    const a = run(19, 160, { priorRegime: "severe" });
    const b = run(19, 160, { priorRegime: "severe" });
    expect(a.getSnapshot().physical).toEqual(b.getSnapshot().physical);
    expect(a.getSnapshot().metrics.selfEnergyMae).toBe(
      b.getSnapshot().metrics.selfEnergyMae,
    );
    expect(a.getSeries()).toEqual(b.getSeries());
  });

  it("uses randomized priors rather than a fixed true prior", () => {
    const a = run(1, 10);
    const b = run(2, 10);
    expect(a.getSnapshot().selfModel.movementCost).not.toBe(
      b.getSnapshot().selfModel.movementCost,
    );
    expect(a.getSnapshot().selfModel.restGain).not.toBe(
      b.getSnapshot().selfModel.restGain,
    );
  });

  it("keeps shadow probes counterfactually isolated", () => {
    const engine = run(3, 120);
    const before = engine.getSnapshot();
    const seriesLength = engine.getSeries().length;
    const probes = ["UP", "DOWN", "LEFT", "RIGHT", "REST"].map((action) =>
      engine.probeAction(action as "UP"),
    );
    const after = engine.getSnapshot();
    expect(probes.every(Boolean)).toBe(true);
    expect(after.physical).toEqual(before.physical);
    expect(after.selfModel).toEqual(before.selfModel);
    expect(after.metaModel.observations).toBe(before.metaModel.observations);
    expect(engine.getSeries().length).toBe(seriesLength);
    expect(engine.getSnapshot().tick).toBe(before.tick);
  });

  it("learns a first-order energy estimate that beats raw sensing", () => {
    const engine = run(11, 300);
    const metrics = engine.getSnapshot().metrics;
    expect(metrics.selfEnergyMae).toBeLessThan(metrics.rawEnergyMae);
    expect(metrics.rawEnergyMae).toBeGreaterThan(1);
  });

  it("trains the learned meta-model on observable errors only", () => {
    const engine = run(12, 300);
    const meta = engine.getSnapshot().metaModel;
    expect(meta.observations).toBeGreaterThan(100);
    expect(meta.calibrationBins.length).toBeGreaterThan(3);
    expect(meta.toleranceWeights.length).toBe(meta.featureLabels.length);
    expect(engine.getSnapshot().metrics.metaBrier).toBeGreaterThan(0);
  });

  it("degrades self-estimation when self learning is frozen", () => {
    const learned = run(13, 150);
    const frozen = run(13, 150, { selfLearning: false });
    expect(frozen.getSnapshot().metrics.selfEnergyMae).toBeGreaterThan(
      learned.getSnapshot().metrics.selfEnergyMae,
    );
  });

  it("responds to an injected physical shift without erasing determinism", () => {
    const engine = run(14, 100);
    const before = engine.getSnapshot().physical.effectiveCost;
    engine.triggerShift("physical");
    expect(engine.getSnapshot().shift).toBe("physical");
    for (let i = 0; i < 20; i++) engine.step();
    expect(engine.getSnapshot().physical.effectiveCost).not.toBe(before);
  });
});
