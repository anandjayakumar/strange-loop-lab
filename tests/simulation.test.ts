import { describe, expect, it } from "vitest";
import { SimulationEngine, PHASES } from "../src/simulation/experiments/engine";
import { ComparisonRunner } from "../src/simulation/experiments/comparison";
import { World } from "../src/simulation/environment/world";
import { Rng, streamSeed } from "../src/simulation/rng";
import { klDivergence, softmax } from "../src/simulation/math";
import { ACTIONS, MODES } from "../src/simulation/types";

function run(seed: number, mode: "A" | "B" | "C", steps: number, options = {}) {
  const engine = new SimulationEngine({ seed, mode, recordEvents: false, ...options });
  for (let i = 0; i < steps && engine.physical.alive; i++) engine.step();
  return engine;
}

describe("seeded randomness", () => {
  it("is reproducible and stream-separated", () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    const valuesA = Array.from({ length: 20 }, () => a.next());
    const valuesB = Array.from({ length: 20 }, () => b.next());
    expect(valuesA).toEqual(valuesB);
    expect(new Rng(1235).next()).not.toEqual(valuesA[0]);
    expect(streamSeed(99, "world")).not.toEqual(streamSeed(99, "policy"));
  });
});

describe("world generation", () => {
  it("is deterministic for a seed and differs across seeds", () => {
    const a = new World(20261117);
    const b = new World(20261117);
    const c = new World(20261118);
    expect(Array.from(a.renderCells(0))).toEqual(Array.from(b.renderCells(0)));
    expect(a.start).toEqual(b.start);
    expect(Array.from(a.renderCells(0))).not.toEqual(Array.from(c.renderCells(0)));
    expect(a.resourceCount).toBeGreaterThan(25);
    expect(a.resourceCount).toBeLessThan(120);
  });

  it("regrows collected resources on a seed-scheduled window", () => {
    const world = new World(4242);
    let found: { x: number; y: number } | null = null;
    for (let y = 0; y < world.height && !found; y++) {
      for (let x = 0; x < world.width && !found; x++) {
        if (world.isResourcePresent(x, y, 0)) found = { x, y };
      }
    }
    expect(found).not.toBeNull();
    if (!found) return;
    expect(world.collect(found.x, found.y, 0)).toBe(true);
    expect(world.isResourcePresent(found.x, found.y, 0)).toBe(false);
    let regrewAt = -1;
    for (let t = 1; t < 140; t++) {
      if (world.isResourcePresent(found.x, found.y, t)) {
        regrewAt = t;
        break;
      }
    }
    expect(regrewAt).toBeGreaterThan(0);
    expect(regrewAt).toBeLessThan(140);
  });
});

describe("deterministic engine", () => {
  it("produces identical trajectories for the same seed and mode", () => {
    const a = run(777, "C", 350);
    const b = run(777, "C", 350);
    const snapA = a.getSnapshot();
    const snapB = b.getSnapshot();
    expect(snapA.tick).toBe(snapB.tick);
    expect(snapA.physical).toEqual(snapB.physical);
    expect(snapA.sensedEnergy).toBe(snapB.sensedEnergy);
    expect(snapA.metrics.metaCalibration).toBe(snapB.metrics.metaCalibration);
    expect(a.getSeries().length).toBe(b.getSeries().length);
    const lastA = a.getSeries()[a.getSeries().length - 1];
    const lastB = b.getSeries()[b.getSeries().length - 1];
    expect(lastA).toEqual(lastB);
  });

  it("keeps environments identical across modes for one seed", () => {
    const engines = MODES.map(
      (mode) => new SimulationEngine({ seed: 5150, mode, recordEvents: false }),
    );
    const cells = engines.map((e) => Array.from(e.getRenderState().cells));
    expect(cells[1]).toEqual(cells[0]);
    expect(cells[2]).toEqual(cells[0]);
  });

  it("makes micro-stepping equivalent to full steps", () => {
    const stepped = new SimulationEngine({ seed: 8080, mode: "B", recordEvents: false });
    const micro = new SimulationEngine({ seed: 8080, mode: "B", recordEvents: false });
    const ticks = 120;
    for (let i = 0; i < ticks; i++) stepped.step();
    for (let i = 0; i < ticks * PHASES.length; i++) micro.advancePhase();
    const a = stepped.getSnapshot();
    const b = micro.getSnapshot();
    expect(b.tick).toBe(ticks);
    expect(b.physical).toEqual(a.physical);
    expect(b.selfModel?.energyEstimate).toBeCloseTo(a.selfModel?.energyEstimate ?? 0, 8);
    expect(b.selfModel?.movementCost).toBeCloseTo(a.selfModel?.movementCost ?? 0, 8);
    expect(micro.getSeries().length).toBe(stepped.getSeries().length);
  });
});

describe("models and level crossing", () => {
  it("has no self-model in Mode A and no meta-model in Mode B", () => {
    const a = run(11, "A", 40);
    expect(a.getSnapshot().selfModel).toBeNull();
    expect(a.getSnapshot().metaModel).toBeNull();
    expect(a.getSnapshot().selection?.selfInfluence).toBe(0);
    const b = run(11, "B", 40);
    expect(b.getSnapshot().selfModel).not.toBeNull();
    expect(b.getSnapshot().metaModel).toBeNull();
  });

  it("learns a self-model that diverges from instrumentation and is corrected", () => {
    const engine = run(20261117, "C", 240);
    const series = engine.getSeries();
    const errors = series
      .map((p) =>
        p.energyEstimate === null ? null : Math.abs(p.energyEstimate - p.energy),
      )
      .filter((v): v is number => v !== null);
    expect(errors.length).toBeGreaterThan(200);
    expect(Math.max(...errors)).toBeGreaterThan(4);
    expect(Math.min(...errors)).toBeLessThan(3);
    const snapshot = engine.getSnapshot();
    expect(snapshot.selfModel?.energyEstimate).toBeGreaterThan(0);
    expect(snapshot.selfModel?.movementCost).toBeGreaterThan(0);
  });

  it("lets the self-model causally change action selection", () => {
    const engine = run(20261117, "B", 500);
    const series = engine.getSeries();
    const influences = series.map((p) => p.selfInfluence);
    expect(Math.max(...influences)).toBeGreaterThan(0.01);
    const snapshot = engine.getSnapshot();
    expect(snapshot.selection).not.toBeNull();
    expect(snapshot.selection?.selfInfluence).toBe(1);
    if (snapshot.selection) {
      const kl = klDivergence(
        snapshot.selection.probabilities,
        snapshot.selection.probabilitiesWithoutSelf,
      );
      expect(kl).toBeGreaterThan(0.01);
    }
  });

  it("closes the loop in Mode C: trust, plasticity and prior weighting all move", () => {
    const engine = run(20261117, "C", 600);
    const series = engine.getSeries();
    const trust = series.map((p) => p.metaTrust).filter((v): v is number => v !== null);
    expect(trust.length).toBeGreaterThan(500);
    expect(Math.min(...trust)).toBeLessThan(0.7);
    expect(Math.max(...trust)).toBeGreaterThan(0.35);
    const learningRates = series.map((p) => p.learningRate);
    expect(Math.min(...learningRates)).toBeLessThan(0.085);
    expect(Math.max(...learningRates)).toBeGreaterThan(0.095);
    const priors = series.map((p) => p.priorWeight);
    expect(Math.max(...priors)).toBeGreaterThan(0.55);
    expect(Math.min(...priors)).toBeLessThan(0.65);
    const snapshot = engine.getSnapshot();
    expect(snapshot.metaModel?.calibration).toBeGreaterThan(-1.01);
    expect(snapshot.metaModel?.calibration).toBeLessThan(1.01);
  });

  it("removes self-model influence when feedback is disabled", () => {
    const engine = run(31, "C", 160, { selfFeedback: false });
    const snapshot = engine.getSnapshot();
    expect(snapshot.selection?.selfInfluence).toBe(0);
    expect(snapshot.metrics.selfInfluence).toBe(0);
    const series = engine.getSeries();
    expect(Math.max(...series.map((p) => p.selfInfluence))).toBe(0);
  });

  it("freezes learning-rate modulation when meta feedback is off", () => {
    const engine = run(31, "C", 200, { metaFeedback: false });
    const rates = engine.getSeries().map((p) => p.learningRate);
    expect(new Set(rates.map((r) => r.toFixed(8))).size).toBe(1);
    expect(rates[0]).toBeCloseTo(0.09, 6);
    expect(engine.getSeries().every((p) => Math.abs(p.priorWeight - 0.5) < 1e-9)).toBe(true);
  });

  it("exports readable parameters for every action", () => {
    const engine = run(5, "C", 30);
    const world = engine.getSnapshot().worldModel;
    expect(world.successByAction.UP).toHaveLength(world.weightLabels.length);
    for (const action of ACTIONS) {
      expect(world.successByAction[action]).toHaveLength(4);
      expect(world.collectByAction[action]).toHaveLength(4);
      expect(world.collisionByAction[action]).toHaveLength(5);
    }
  });
});

describe("research ablations and instrumentation", () => {
  it("applies an experimental self-model prior without touching the default", () => {
    const normal = new SimulationEngine({ seed: 1, mode: "C", recordEvents: false });
    const corrupted = new SimulationEngine({
      seed: 1,
      mode: "C",
      recordEvents: false,
      research: { initialSelfModel: { movementCost: 8 } },
    });
    expect(normal.getSnapshot().selfModel?.movementCost).toBeCloseTo(1.35, 8);
    expect(corrupted.getSnapshot().selfModel?.movementCost).toBeCloseTo(8, 8);
  });

  it("leaves a frozen self-model at its prior instead of learning", () => {
    const learned = new SimulationEngine({
      seed: 7,
      mode: "C",
      recordEvents: false,
      research: { initialSelfModel: { movementCost: 8 } },
    });
    const frozen = new SimulationEngine({
      seed: 7,
      mode: "C",
      recordEvents: false,
      research: { selfLearning: false, initialSelfModel: { movementCost: 8 } },
    });
    for (let i = 0; i < 120; i++) {
      learned.step();
      frozen.step();
    }
    expect(frozen.getSnapshot().selfModel?.movementCost).toBeCloseTo(8, 8);
    expect(learned.getSnapshot().selfModel?.movementCost).not.toBeCloseTo(8, 2);
    const frozenError = frozen.getSeries().at(-1)?.selfStateError ?? 0;
    const learnedError = learned.getSeries().at(-1)?.selfStateError ?? 0;
    expect(frozenError).toBeGreaterThan(learnedError);
  });

  it("replaces world predictions with a neutral baseline when the world model is ablated", () => {
    const engine = new SimulationEngine({
      seed: 9,
      mode: "C",
      recordEvents: false,
      research: { worldModelEnabled: false },
    });
    engine.step();
    const actions = engine.getSnapshot().predictions.filter((p) => p.action !== "REST");
    expect(actions.length).toBe(4);
    for (const prediction of actions) {
      expect(prediction.world.pSuccess).toBeCloseTo(0.5, 8);
      expect(prediction.world.pCollect).toBeCloseTo(0.05, 8);
      expect(prediction.world.pCollision).toBeCloseTo(0.2, 8);
    }
  });

  it("measures counterfactual decision influence without changing the sampled action", () => {
    const engine = new SimulationEngine({ seed: 20261117, mode: "B", recordEvents: false });
    for (let i = 0; i < 180; i++) engine.step();
    const selection = engine.getSnapshot().selection;
    expect(selection).not.toBeNull();
    if (selection) {
      expect(selection.policyTv).toBeGreaterThan(0);
      expect(selection.counterfactualAction).toBeDefined();
      const changedCount = engine
        .getSeries()
        .filter((point) => point.decisionChanged).length;
      expect(changedCount).toBeGreaterThan(0);
    }
    const noFeedback = new SimulationEngine({
      seed: 20261117,
      mode: "B",
      recordEvents: false,
      selfFeedback: false,
    });
    for (let i = 0; i < 30; i++) noFeedback.step();
    expect(noFeedback.getSnapshot().selection?.policyTv).toBe(0);
    expect(noFeedback.getSeries().every((p) => !p.decisionChanged)).toBe(true);
  });

  it("keeps research-mode runs deterministic", () => {
    const a = new SimulationEngine({
      seed: 444,
      mode: "C",
      recordEvents: false,
      research: { initialSelfModel: { movementCost: 8 }, worldLearning: false },
    });
    const b = new SimulationEngine({
      seed: 444,
      mode: "C",
      recordEvents: false,
      research: { initialSelfModel: { movementCost: 8 }, worldLearning: false },
    });
    for (let i = 0; i < 200; i++) {
      a.step();
      b.step();
    }
    expect(a.getSnapshot().physical).toEqual(b.getSnapshot().physical);
    expect(a.getSnapshot().selfModel?.movementCost).toBe(
      b.getSnapshot().selfModel?.movementCost,
    );
    expect(a.getSeries()).toEqual(b.getSeries());
  });
});

describe("comparison runner", () => {
  it("runs all modes on the same seed and produces comparable summaries", () => {
    const runner = new ComparisonRunner(20261117, 240);
    runner.start();
    while (!runner.progress().completed) runner.advance(40);
    const summaries = runner.summaries();
    expect(summaries.A.survived).toBeGreaterThan(0);
    expect(summaries.B.survived).toBeGreaterThan(0);
    expect(summaries.C.survived).toBeGreaterThan(0);
    expect(summaries.A.selfAccuracy).toBeNull();
    expect(summaries.B.selfAccuracy).not.toBeNull();
    expect(summaries.C.meanTrust).not.toBeNull();
    const series = runner.series();
    expect(series.A.length).toBeGreaterThan(0);
    expect(series.B.length).toBeGreaterThan(0);
    expect(series.C.length).toBeGreaterThan(0);
  });
});

describe("utility maths", () => {
  it("keeps softmax normalised and KL non-negative", () => {
    const p = softmax([1, 2, 3], 0.7);
    const q = softmax([0, 0, 0], 0.7);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(klDivergence(p, q)).toBeGreaterThan(0);
  });
});
