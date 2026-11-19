import { describe, expect, it } from "vitest";
import { V06Engine } from "../src/simulation/v06/engine";
import type { V06Options } from "../src/simulation/v06/types";

function run(overrides: Partial<V06Options>, horizon: number) {
  const engine = new V06Engine({
    seed: 7,
    difficulty: "standard",
    priorRegime: "uninformed",
    scenario: "conflict",
    recordEvents: false,
    historyLimit: 2000,
    ...overrides,
  });
  while (engine.physical.alive && engine.getTick() < horizon) engine.step();
  return engine;
}

describe("V0.6 unified architecture", () => {
  it("is deterministic for a fixed seed and configuration", () => {
    const a = run({}, 220).getSnapshot();
    const b = run({}, 220).getSnapshot();
    expect(a.metrics.resources).toBe(b.metrics.resources);
    expect(a.metrics.ticks).toBe(b.metrics.ticks);
    expect(a.metrics.selfEnergyMae).toBeCloseTo(b.metrics.selfEnergyMae, 12);
    expect(a.workspace.frame).toBe(b.workspace.frame);
    expect(a.selfSim.bestAction).toBe(b.selfSim.bestAction);
  });

  it("ignites one frame under the bottleneck and coerces all modules without it", () => {
    const intact = run({}, 120).getSnapshot();
    const flat = run({ control: "flat_blackboard" }, 120).getSnapshot();
    expect(intact.workspace.bottleneck).toBe(true);
    const weights = Object.values(intact.workspace.weights);
    expect(Math.max(...weights)).toBeGreaterThan(0.4);
    expect(Math.min(...weights)).toBeLessThan(0.2);
    expect(flat.workspace.bottleneck).toBe(false);
    expect(new Set(Object.values(flat.workspace.weights)).size).toBe(1);
  });

  it("removes the cognitive rollout under the No-AE ablation", () => {
    const intact = run({ scenario: "epistemic_fork" }, 80).getSnapshot();
    const ablated = run(
      { scenario: "epistemic_fork", ablation: "no_cognitive_self_sim" },
      80,
    ).getSnapshot();
    expect(intact.selfSim.horizon).toBe(4);
    expect(intact.selfSim.cognitive).toBe(true);
    expect(ablated.selfSim.horizon).toBe(1);
    expect(ablated.selfSim.cognitive).toBe(false);
    expect(ablated.selfSim.epistemicValue).toBe(0);
  });

  it("gives physical MPC the same horizon without cognitive prediction", () => {
    const snapshot = run(
      { scenario: "epistemic_fork", control: "physical_mpc" },
      40,
    ).getSnapshot();
    expect(snapshot.selfSim.horizon).toBe(4);
    expect(snapshot.selfSim.cognitive).toBe(false);
    expect(snapshot.selfSim.epistemicValue).toBe(0);
    const reactive = run({ control: "reactive" }, 40).getSnapshot();
    expect(reactive.higherOrder.enabled).toBe(false);
    expect(reactive.attention.enabled).toBe(false);
  });

  it("freezes second-order attribution without HOT", () => {
    const intact = run({ scenario: "self_disruption" }, 360).getSnapshot();
    const noHot = run(
      { scenario: "self_disruption", ablation: "no_hot_meta" },
      360,
    ).getSnapshot();
    expect(intact.higherOrder.enabled).toBe(true);
    expect(noHot.higherOrder.enabled).toBe(false);
    expect(noHot.higherOrder.attribution.top).toBe("insufficient");
    expect(noHot.higherOrder.reliability).toBe(0.5);
  });

  it("does not disturb the V0.5 engine or the shared world", async () => {
    const { V05Engine } = await import("../src/simulation/v05/engine");
    const v05a = new V05Engine({ seed: 3, recordEvents: false });
    const v05b = new V05Engine({ seed: 3, recordEvents: false });
    while (v05a.getTick() < 120) v05a.step();
    while (v05b.getTick() < 120) v05b.step();
    expect(v05a.getSnapshot().metrics.resources).toBe(
      v05b.getSnapshot().metrics.resources,
    );
  });
});
