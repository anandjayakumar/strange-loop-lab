import type { Action, MemoryStats, OutcomeSignal } from "../../types";

export interface MemoryEntry {
  tick: number;
  action: Action;
  outcome: OutcomeSignal;
  /** Compact copy of the observation that preceded the action. */
  observation: { x: number; y: number; local: Int8Array };
  sensedEnergy: number;
  sensedEnergyDelta: number;
  selfPredictedDelta: number;
  selfPredictedSuccess: number;
  worldPredictedSuccess: number;
  selfEnergyError: number | null;
  selfSuccessError: number | null;
  worldSuccessError: number;
  target: { x: number; y: number };
}

const VISIT_CACHE_LIMIT = 260;

/**
 * Bounded rolling history. Nothing here is a hidden ground-truth channel: every
 * entry was received through perception or proprioception.
 */
export class Memory {
  readonly capacity: number;
  private entries: MemoryEntry[] = [];
  private visits = new Map<string, number>();

  constructor(capacity = 160) {
    this.capacity = capacity;
  }

  push(entry: MemoryEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.capacity) this.entries.shift();
    const key = `${entry.target.x},${entry.target.y}`;
    this.visits.set(key, (this.visits.get(key) ?? 0) + 1);
    if (this.visits.size > VISIT_CACHE_LIMIT) {
      // Drop the oldest insertion. Map preserves insertion order.
      const oldest = this.visits.keys().next().value;
      if (oldest !== undefined) this.visits.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.length;
  }

  get all(): readonly MemoryEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries = [];
    this.visits.clear();
  }

  /** Mean absolute gap between predicted and realised success, 0..1. */
  calibrationError(window = 24): number {
    const recent = this.entries.slice(-window).filter((e) => e.action !== "REST");
    if (recent.length < 4) return 0.2;
    let predicted = 0;
    let actual = 0;
    for (const entry of recent) {
      predicted += entry.selfPredictedSuccess;
      actual += entry.outcome.moved ? 1 : 0;
    }
    return Math.min(1, Math.abs(predicted / recent.length - actual / recent.length) * 2);
  }

  stats(target: { x: number; y: number }, window = 12): MemoryStats {
    const recent = this.entries.slice(-window);
    let success = 0;
    let slip = 0;
    let blocked = 0;
    let rest = 0;
    let energyDelta = 0;
    for (const entry of recent) {
      if (entry.outcome.moved) success++;
      if (entry.outcome.slipped) slip++;
      if (entry.outcome.blocked) blocked++;
      if (entry.action === "REST") rest++;
      energyDelta += entry.sensedEnergyDelta;
    }
    const n = Math.max(1, recent.length);
    const visits = this.visits.get(`${target.x},${target.y}`) ?? 0;
    return {
      recentSuccess: success / n,
      recentSlip: slip / n,
      recentBlocked: blocked / n,
      recentRest: rest / n,
      novelty: 1 / (1 + visits),
      visits,
      meanEnergyDelta: energyDelta / n,
    };
  }
}
