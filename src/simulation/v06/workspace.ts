import { clamp } from "../math";
import { V06 } from "./config";
import type {
  AttributionKind,
  ModuleId,
  ModuleProposal,
  PrecisionPlan,
  WorkspaceState,
} from "./types";
import { MODULE_IDS } from "./types";

export interface IgniteOptions {
  bottleneck: boolean;
  broadcastEnabled: boolean;
  previousFrame: ModuleId | null;
  quality: [number, number, number];
  allocation: PrecisionPlan;
  attribution: AttributionKind;
  /** Preserve the cross-tick winner unless another module clearly beats it. */
  hysteresis?: number;
  /** False for the flat blackboard: no selective plasticity routing. */
  routing?: boolean;
}

export interface IgnitionResult {
  state: WorkspaceState;
  integrated: number[];
}

function precisionFor(
  base: PrecisionPlan,
  frame: ModuleId,
  quality: [number, number, number],
): PrecisionPlan {
  const plan = { ...base };
  if (frame === "somatic") {
    plan.energy += 0.12;
    plan.strain += 0.1;
  } else if (frame === "meta") {
    plan.prior += 0.12;
    plan.effort += 0.08;
  } else if (frame === "epistemic") {
    plan.epistemic += 0.16;
    plan.prior -= 0.04;
  } else {
    plan.prior += 0.04;
  }
  // Coherence is the quality-space axis most tied to cross-channel agreement;
  // when it is low, effort/consistency monitoring earns precision.
  plan.effort += 0.08 * (1 - clamp(quality[2], 0, 1));
  const total = plan.energy + plan.strain + plan.effort + plan.prior + plan.epistemic;
  return {
    energy: clamp(plan.energy / total, 0.02, 0.7),
    strain: clamp(plan.strain / total, 0.02, 0.6),
    effort: clamp(plan.effort / total, 0.02, 0.5),
    prior: clamp(plan.prior / total, 0.05, 0.75),
    epistemic: clamp(plan.epistemic / total, 0.02, 0.6),
  };
}

function learningGains(frame: ModuleId, attribution: AttributionKind): Record<ModuleId, number> {
  const gains: Record<ModuleId, number> = {
    world: 1,
    somatic: 1,
    meta: 1,
    epistemic: 1,
  };
  gains[frame] = 1.35;
  for (const id of MODULE_IDS) if (id !== frame) gains[id] = 0.78;
  // HOT-3 routing: do not let a corrupted sensory channel rewrite the
  // first-order model that depends on it.
  if (attribution === "energy_sensor" || attribution === "fatigue_sensor") {
    gains.somatic = Math.min(gains.somatic, 0.55);
    gains.meta = Math.max(gains.meta, 1.15);
  } else if (attribution === "shared") {
    gains.somatic = Math.min(gains.somatic, 0.7);
    gains.world = Math.min(gains.world, 0.85);
  } else if (attribution === "physical") {
    gains.world = Math.max(gains.world, 1.2);
    gains.somatic = Math.max(gains.somatic, 1.1);
  }
  return gains;
}

/**
 * GWT-2/3: capacity-limited competition, winner-take-all ignition and global
 * broadcast.
 *
 * The workspace sees four proposals and a salience vector. With the bottleneck
 * on, one coalition ignites and the others leak a small, fixed share; the
 * ignited frame then determines the broadcast (action bias, precision plan and
 * per-module learning gains). With the bottleneck off, every module writes at
 * once and the "frame" is only a diagnostic label.
 */
export function ignite(
  proposals: readonly ModuleProposal[],
  options: IgniteOptions,
): IgnitionResult {
  const salience: Record<ModuleId, number> = {
    world: 0,
    somatic: 0,
    meta: 0,
    epistemic: 0,
  };
  for (const proposal of proposals) salience[proposal.module] = proposal.salience;

  let frame: ModuleId = proposals[0]?.module ?? "world";
  let bestScore = -Infinity;
  for (const proposal of proposals) {
    const bonus =
      options.previousFrame === proposal.module && options.bottleneck
        ? (options.hysteresis ?? V06.hysteresis)
        : 0;
    const score = proposal.salience + bonus;
    if (score > bestScore) {
      bestScore = score;
      frame = proposal.module;
    }
  }

  const weights: Record<ModuleId, number> = {
    world: 0,
    somatic: 0,
    meta: 0,
    epistemic: 0,
  };
  if (options.bottleneck) {
    const leak = V06.capacityLeak;
    const others = proposals.filter((p) => p.module !== frame).length || 1;
    weights[frame] = 1 - leak * others;
    for (const proposal of proposals) {
      if (proposal.module !== frame) weights[proposal.module] = leak;
    }
  } else {
    for (const proposal of proposals) weights[proposal.module] = 1 / Math.max(1, proposals.length);
  }

  const integrated = [0, 0, 0, 0, 0];
  for (const proposal of proposals) {
    const w = weights[proposal.module];
    for (let i = 0; i < integrated.length; i++) integrated[i] += w * (proposal.utilities[i] ?? 0);
  }

  const winner = proposals.find((p) => p.module === frame) ?? proposals[0];
  const sortedScores = Object.values(salience).sort((a, b) => b - a);
  const ignition = clamp(
    (sortedScores[0] - (sortedScores[1] ?? 0)) / Math.max(1e-6, sortedScores[0]),
    0,
    1,
  );

  const broadcast = [0, 0, 0, 0, 0];
  let precision: PrecisionPlan = {
    energy: 0.2,
    strain: 0.2,
    effort: 0.2,
    prior: 0.2,
    epistemic: 0.2,
  };
  let learning: Record<ModuleId, number> = {
    world: 1,
    somatic: 1,
    meta: 1,
    epistemic: 1,
  };

  if (options.broadcastEnabled && options.bottleneck && winner) {
    // The ignited frame's preferred action receives a bounded bias; its
    // runner-up receives less. This is a broadcast, not a veto: other modules
    // can still win the final integrated utilities.
    const order = winner.utilities
      .map((u, i) => ({ u, i }))
      .sort((a, b) => b.u - a.u);
    broadcast[order[0].i] += V06.broadcastGain;
    if (order[1]) broadcast[order[1].i] += 0.35;
    precision = precisionFor(options.allocation, frame, options.quality);
    learning = learningGains(frame, options.attribution);
  }
  if (options.routing === false) {
    learning = { world: 1, somatic: 1, meta: 1, epistemic: 1 };
  }

  return {
    state: {
      frame,
      goal: winner?.goal ?? "hold station",
      hypothesis: winner?.hypothesis ?? "",
      weights,
      salience,
      broadcast,
      precision,
      learningGains: learning,
      quality: options.quality,
      ignition,
      bottleneck: options.bottleneck,
      broadcastEnabled: options.broadcastEnabled,
    },
    integrated,
  };
}
