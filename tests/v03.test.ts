import { describe, expect, it } from "vitest";
import { V03Engine } from "../src/simulation/v03/engine";

function run(seed = 7, steps = 80, extra: Record<string, unknown> = {}) {
  const engine = new V03Engine({
    seed,
    difficulty: "standard",
    priorRegime: "uninformed",
    explorationMode: "voi",
    scenario: "stable",
    recordEvents: false,
    historyLimit: 400,
    ...extra,
  });
  for (let i = 0; i < steps && engine.physical.alive; i++) engine.step();
  return engine;
}

describe("V0.3 second-order simulator", () => {
  it("is deterministic under identical seeds and options", () => {
    const a = run(19, 160, { priorRegime: "severe" });
    const b = run(19, 160, { priorRegime: "severe" });
    expect(a.getSnapshot().physical).toEqual(b.getSnapshot().physical);
    expect(a.getSnapshot().metrics).toEqual(b.getSnapshot().metrics);
    expect(a.getSeries()).toEqual(b.getSeries());
  });

  it("keeps V0 and V0.2 untouched and still deterministic", async () => {
    const { V02Engine } = await import("../src/simulation/v02/engine");
    const a = new V02Engine({ seed: 5, recordEvents: false, historyLimit: 100 });
    const b = new V02Engine({ seed: 5, recordEvents: false, historyLimit: 100 });
    for (let i = 0; i < 40; i++) {
      a.step();
      b.step();
    }
    expect(a.physical).toEqual(b.physical);
  });

  it("draws uninformed rough-terrain priors rather than configuring the truth", () => {
    const a = run(1, 5);
    const b = run(2, 5);
    expect(a.getSnapshot().selfModel.roughCost).not.toBe(
      b.getSnapshot().selfModel.roughCost,
    );
    expect(a.getSnapshot().selfModel.roughCost).not.toBe(
      a.getSeries()[0].roughCostTrue,
    );
  });

  it("exposes a residual meta-model with a rolling baseline and failure head", () => {
    const engine = run(12, 320);
    const snapshot = engine.getSnapshot();
    const meta = snapshot.metaModel;
    expect(meta.observations).toBeGreaterThan(100);
    expect(meta.rollingBase).toBeGreaterThan(0);
    expect(meta.residualWeight).toBeGreaterThanOrEqual(0);
    expect(meta.failureProbability).toBeGreaterThanOrEqual(0);
    expect(meta.failureProbability).toBeLessThanOrEqual(1);
    expect(meta.featureLabels.length).toBe(meta.toleranceWeights.length);
    expect(snapshot.metrics.rollingBss).toBeGreaterThan(0);
  });

  it("reports latent-failure discrimination above chance", () => {
    const engine = run(21, 500);
    const auroc = engine.getSnapshot().metrics.latentAuroc;
    expect(auroc).not.toBeNull();
    expect(auroc ?? 0).toBeGreaterThan(0.6);
  });

  it("measures rough-terrain cost and separates it from flat movement", () => {
    const engine = run(4, 400);
    expect(engine.getSeries().some((p) => p.terrainRough)).toBe(true);
    expect(engine.getSeries().some((p) => !p.terrainRough)).toBe(true);
    expect(engine.getSnapshot().selfModel.roughObservations).toBeGreaterThan(0);
  });

  it("enables epistemic probes to escape the decoupled trap where pragmatism cannot", () => {
    const trap = { beliefTrap: "pessimistic_cost" as const, lambda: 0.9 };
    const pragmatic = run(8, 700, { ...trap, explorationMode: "pragmatic" });
    const voi = run(8, 700, { ...trap, explorationMode: "voi" });
    const pragmaticRough = pragmatic.getSeries().filter((p) => p.terrainRough).length;
    const voiRough = voi.getSeries().filter((p) => p.terrainRough).length;
    expect(pragmaticRough).toBe(0);
    expect(voiRough).toBeGreaterThan(0);
    expect(voi.getSnapshot().metrics.resources).toBeGreaterThan(
      pragmatic.getSnapshot().metrics.resources,
    );
  });

  it("produces a temporal attribution with a confidence and evidence count", () => {
    const engine = run(5, 420, { scenario: "energy_sensor_shift" });
    const attribution = engine.getSnapshot().attribution;
    expect(attribution.evidenceCount).toBeGreaterThan(0);
    const total =
      attribution.physical +
      attribution.energy_sensor +
      attribution.fatigue_sensor +
      attribution.shared +
      attribution.insufficient;
    expect(total).toBeCloseTo(1, 5);
    expect(attribution.top).toBeTruthy();
  });

  it("supports a 1-tick interoceptive pulse without erasing determinism", () => {
    const a = run(9, 120);
    const b = run(9, 120);
    a.injectPulse(12, 0, 1);
    b.injectPulse(12, 0, 1);
    for (let i = 0; i < 4; i++) {
      a.step();
      b.step();
    }
    expect(a.getSeries().some((p) => p.pulseActive)).toBe(true);
    expect(a.getSnapshot().selfModel).toEqual(b.getSnapshot().selfModel);
  });

  it("degrades when the action→evidence link is broken", () => {
    const intact = run(10, 300);
    const broken = run(10, 300, { evidenceLink: false });
    expect(broken.getSnapshot().metrics.resources).toBeLessThan(
      intact.getSnapshot().metrics.resources,
    );
  });

  it("keeps shadow probes counterfactually isolated", () => {
    const engine = run(3, 140);
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
  });
});
