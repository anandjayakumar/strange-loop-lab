import { mean } from "../math";
import { ACTIONS, MODES, type Action, type Mode, type SeriesPoint } from "../types";
import { SimulationEngine } from "./engine";

export interface ModeRunSummary {
  mode: Mode;
  alive: boolean;
  survived: number;
  deathTick: number | null;
  meanEnergy: number;
  minEnergy: number;
  finalEnergy: number;
  resources: number;
  distance: number;
  worldAccuracy: number;
  selfAccuracy: number | null;
  selfInfluence: number;
  meanTrust: number | null;
  dominantAction: Action | null;
  seriesLength: number;
}

export interface ComparisonProgress {
  completed: boolean;
  ticksDone: number;
  horizon: number;
  running: boolean;
}

/**
 * Runs all three modes head-to-head with the same seed, world and starting
 * state. Each engine is independent; they advance in small background batches.
 */
export class ComparisonRunner {
  readonly seed: number;
  readonly horizon: number;
  readonly engines: Record<Mode, SimulationEngine>;
  private running = false;

  constructor(seed: number, horizon = 900) {
    this.seed = seed;
    this.horizon = horizon;
    this.engines = {
      A: new SimulationEngine({ seed, mode: "A", recordEvents: false, historyLimit: horizon }),
      B: new SimulationEngine({ seed, mode: "B", recordEvents: false, historyLimit: horizon }),
      C: new SimulationEngine({ seed, mode: "C", recordEvents: false, historyLimit: horizon }),
    };
  }

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  get isRunning(): boolean {
    return this.running;
  }

  advance(batch = 12): void {
    if (!this.running) return;
    for (const mode of MODES) {
      const engine = this.engines[mode];
      if (!engine.physical.alive) continue;
      if (engine.getTick() >= this.horizon) continue;
      const target = Math.min(this.horizon, engine.getTick() + batch);
      while (engine.getTick() < target && engine.physical.alive) {
        engine.step();
      }
    }
    if (this.progress().completed) this.running = false;
  }

  progress(): ComparisonProgress {
    const ticks = MODES.map((mode) => Math.min(this.horizon, this.engines[mode].getTick()));
    const completed = MODES.every(
      (mode) => !this.engines[mode].physical.alive || this.engines[mode].getTick() >= this.horizon,
    );
    return {
      completed,
      ticksDone: Math.max(...ticks),
      horizon: this.horizon,
      running: this.running,
    };
  }

  series(): Record<Mode, readonly SeriesPoint[]> {
    return {
      A: this.engines.A.getSeries(),
      B: this.engines.B.getSeries(),
      C: this.engines.C.getSeries(),
    };
  }

  summaries(): Record<Mode, ModeRunSummary> {
    return {
      A: summarise("A", this.engines.A, this.horizon),
      B: summarise("B", this.engines.B, this.horizon),
      C: summarise("C", this.engines.C, this.horizon),
    };
  }
}

function summarise(mode: Mode, engine: SimulationEngine, horizon: number): ModeRunSummary {
  const series = engine.getSeries();
  const energies = series.map((p) => p.energy);
  const truths = series
    .map((p) => p.metaTrust)
    .filter((v): v is number => v !== null);
  const accuracies = series
    .map((p) => p.selfStateAccuracy)
    .filter((v): v is number => v !== null);
  const influences = series.map((p) => p.selfInfluence);
  const counts: Record<Action, number> = { UP: 0, DOWN: 0, LEFT: 0, RIGHT: 0, REST: 0 };
  for (const point of series) counts[point.action]++;
  let dominant: Action | null = null;
  let best = -1;
  for (const action of ACTIONS) {
    if (counts[action] > best) {
      best = counts[action];
      dominant = action;
    }
  }
  const alive = engine.physical.alive;
  return {
    mode,
    alive,
    survived: Math.min(horizon, engine.getTick()),
    deathTick: alive ? null : engine.getTick(),
    meanEnergy: mean(energies),
    minEnergy: energies.length ? Math.min(...energies) : 0,
    finalEnergy: engine.physical.energy,
    resources: engine.physical.resourcesCollected,
    distance: engine.physical.distance,
    worldAccuracy: mean(series.map((p) => p.worldAccuracy)),
    selfAccuracy: accuracies.length ? mean(accuracies) : null,
    selfInfluence: mean(influences),
    meanTrust: truths.length ? mean(truths) : null,
    dominantAction: dominant,
    seriesLength: series.length,
  };
}
