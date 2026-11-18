import { describe, expect, it } from "vitest";
import { V04Engine } from "../src/simulation/v04/engine";

function run(seed = 7, steps = 80, extra: Record<string, unknown> = {}) {
  const engine = new V04Engine({
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

describe("V0.4 precision-gated attention simulator", () => {
  it("is deterministic under identical seeds and options", () => {
    const a = run(19, 160, { priorRegime: "severe" });
    const b = run(19, 160, { priorRegime: "severe" });
    expect(a.getSnapshot().physical).toEqual(b.getSnapshot().physical);
    expect(a.getSnapshot().metrics).toEqual(b.getSnapshot().metrics);
    expect(a.getSeries()).toEqual(b.getSeries());
  });

  it("keeps V0.3 untouched and still deterministic", async () => {
    const { V03Engine } = await import("../src/simulation/v03/engine");
    const a = new V03Engine({ seed: 5, recordEvents: false, historyLimit: 100 });
    const b = new V03Engine({ seed: 5, recordEvents: false, historyLimit: 100 });
    for (let i = 0; i < 40; i++) {
      a.step();
      b.step();
    }
    expect(a.physical).toEqual(b.physical);
  });

  it("exposes a precision-weighted posterior gain", () => {
    const engine = run(4, 120);
    const self = engine.getSnapshot().selfModel;
    expect(self.precisionGain).toBeGreaterThan(0);
    expect(self.precisionGain).toBeLessThanOrEqual(1);
    expect(self.priorPrecision).toBeGreaterThan(0);
    expect(self.sensorPrecision).toBeGreaterThan(0);
  });

  it("absorbs a 1-tick isolated pulse more than half the time in aggregate", () => {
    let absorbed = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const engine = run(seed, 200);
      const before = engine.getSnapshot().selfModel.energyEstimate;
      engine.injectPulse(12, 0, 1);
      engine.step();
      const after = engine.getSnapshot().selfModel.energyEstimate;
      if (1 - Math.abs(after - before) / 12 > 0.5) absorbed++;
    }
    expect(absorbed).toBeGreaterThanOrEqual(4);
  });

  it("grows the sensor gain back under a sustained 10-tick shift", () => {
    const engine = run(6, 200);
    engine.injectPulse(12, 0, 10);
    let peak = 0;
    for (let i = 0; i < 12; i++) {
      engine.step();
      peak = Math.max(peak, engine.getSnapshot().selfModel.precisionGain);
    }
    expect(peak).toBeGreaterThan(0.35);
  });

  it("trains the failure head on multi-step directional bias", () => {
    const engine = run(12, 320);
    const meta = engine.getSnapshot().metaModel;
    expect(meta.observations).toBeGreaterThan(100);
    expect(meta.failureProbability).toBeGreaterThanOrEqual(0);
    expect(meta.failureProbability).toBeLessThanOrEqual(1);
    expect(engine.getSnapshot().metrics.rollingBss).toBeGreaterThan(0);
    expect(engine.getSnapshot().metrics.latentAuroc ?? 0).toBeGreaterThan(0.6);
  });

  it("reports an attention schema with a mode and bounded recovery", () => {
    const engine = run(3, 220);
    const attention = engine.getSnapshot().attention;
    expect(attention.enabled).toBe(true);
    expect(attention.recovery).toBeGreaterThanOrEqual(0);
    expect(attention.recovery).toBeLessThanOrEqual(1);
    expect(["monitoring", "high_prior", "defensive", "exploratory"]).toContain(
      attention.mode,
    );
    const total =
      attention.weights.energy +
      attention.weights.prior;
    expect(total).toBeGreaterThan(0);
  });

  it("releases prior suppression faster when the schema is enabled", () => {
    const recovery = (ast: boolean) => {
      const engine = run(2, 300, { attentionSchema: ast });
      engine.injectPulse(12, 0, 10);
      const gains: number[] = [];
      for (let i = 0; i < 35; i++) {
        engine.step();
        const point = engine.getSeries()[engine.getSeries().length - 1];
        if (point && i >= 10) gains.push(point.precisionGain);
      }
      return gains.reduce((a, b) => a + b, 0) / gains.length;
    };
    expect(recovery(true)).toBeGreaterThan(recovery(false));
  });

  it("exposes epistemic preparation state without changing determinism", () => {
    const engine = run(1, 300, { beliefTrap: "pessimistic_cost", lambda: 0.9 });
    const point = engine.getSeries()[0];
    expect(typeof point.preparationValue).toBe("number");
    expect(engine.getSnapshot().selection?.preparationValue).toBeGreaterThanOrEqual(0);
  });

  it("keeps the decoupled trap closed without VoI", () => {
    const engine = run(8, 600, { beliefTrap: "pessimistic_cost" });
    expect(engine.getSeries().filter((p) => p.terrainRough).length).toBe(0);
    expect(engine.getSnapshot().metrics.resources).toBe(0);
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
