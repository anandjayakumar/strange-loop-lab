import { describe, expect, it } from "vitest";
import { AGENT } from "../src/simulation/config";
import { applyAction, createPhysicalState, effectiveMoveCost, effectiveSuccess } from "../src/simulation/environment/dynamics";
import { World } from "../src/simulation/environment/world";
import { createObservation } from "../src/simulation/agent/perception/perception";
import type { Rng } from "../src/simulation/rng";

function fixedRng(value: number): Rng {
  return { next: () => value } as unknown as Rng;
}

describe("physical dynamics", () => {
  it("raises cost and lowers success as fatigue grows", () => {
    const fresh = effectiveMoveCost(50, 0);
    const tired = effectiveMoveCost(50, 1);
    expect(tired).toBeGreaterThan(fresh);
    expect(effectiveSuccess(0)).toBeGreaterThan(effectiveSuccess(1));
    expect(effectiveSuccess(10)).toBe(AGENT.minSuccess);
  });

  it("charges a slip without moving", () => {
    const world = new World(20261117);
    const state = createPhysicalState(world.start);
    const before = { x: state.x, y: state.y, energy: state.energy, fatigue: state.fatigue };
    const cost = effectiveMoveCost(state.energy, state.fatigue);
    const outcome = applyAction(world, state, "RIGHT", 0, fixedRng(1));
    expect(outcome.slipped).toBe(true);
    expect(outcome.moved).toBe(false);
    expect(state.x).toBe(before.x);
    expect(state.y).toBe(before.y);
    expect(state.energy).toBeCloseTo(before.energy - cost * AGENT.slipEnergyFactor, 6);
    expect(state.fatigue).toBeGreaterThan(before.fatigue);
  });

  it("charges half cost against the boundary", () => {
    const world = new World(20261117);
    const state = createPhysicalState(world.start);
    state.x = 0;
    state.y = 0;
    state.fatigue = 0;
    const cost = effectiveMoveCost(state.energy, state.fatigue);
    const outcome = applyAction(world, state, "LEFT", 0, fixedRng(0));
    expect(outcome.blocked).toBe(true);
    expect(outcome.moved).toBe(false);
    expect(state.energy).toBeCloseTo(AGENT.startEnergy - cost * AGENT.blockEnergyFactor, 6);
    expect(state.blockedAttempts).toBe(1);
  });

  it("restores energy and relieves fatigue on rest", () => {
    const world = new World(20261117);
    const state = createPhysicalState(world.start);
    state.energy = 40;
    state.fatigue = 0.8;
    const outcome = applyAction(world, state, "REST", 0, fixedRng(0.99));
    expect(outcome.moved).toBe(false);
    expect(state.energy).toBeCloseTo(42.7, 6);
    expect(state.fatigue).toBeCloseTo(0.64, 6);
  });

  it("collects a resource when stepping onto it", () => {
    const world = new World(4242);
    let resource: { x: number; y: number } | null = null;
    for (let y = 0; y < world.height && !resource; y++) {
      for (let x = 0; x < world.width && !resource; x++) {
        if (!world.isResourcePresent(x, y, 0)) continue;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (world.inBounds(nx, ny) && !world.isObstacle(nx, ny)) {
            resource = { x, y };
            const state = createPhysicalState({ x: nx, y: ny });
            const before = state.energy;
            const cost = effectiveMoveCost(state.energy, state.fatigue);
            const action = dx === 1 ? "LEFT" : dx === -1 ? "RIGHT" : dy === 1 ? "UP" : "DOWN";
            const outcome = applyAction(world, state, action, 0, fixedRng(0));
            expect(outcome.collected).toBe(true);
            expect(state.energy).toBeCloseTo(
              Math.min(AGENT.maxEnergy, before - cost + AGENT.resourceGain),
              6,
            );
            expect(state.resourcesCollected).toBe(1);
            expect(world.isResourcePresent(x, y, 0)).toBe(false);
            return;
          }
        }
      }
    }
    expect(resource).not.toBeNull();
  });

  it("kills the agent when energy reaches zero", () => {
    const world = new World(20261117);
    const state = createPhysicalState(world.start);
    state.energy = 0.5;
    applyAction(world, state, "DOWN", 0, fixedRng(0));
    expect(state.alive).toBe(false);
    expect(state.energy).toBe(0);
  });

  it("never exposes true energy or fatigue in an observation", () => {
    const world = new World(20261117);
    const state = createPhysicalState(world.start);
    state.energy = 37.5;
    state.fatigue = 0.66;
    const observation = createObservation(world, state, 3, 39.1, null);
    expect("energy" in observation).toBe(false);
    expect("fatigue" in observation).toBe(false);
    expect(observation.sensedEnergy).toBe(39.1);
    expect(observation.local).toHaveLength(49);
    expect(observation.x).toBe(state.x);
    expect(observation.y).toBe(state.y);
  });
});
