import { WORLD } from "../config";
import { Rng, streamSeed } from "../rng";
import type { CellType, Vec } from "../types";

interface ResourceCell {
  period: number;
  offset: number;
  lastCollected: number;
}

const EMPTY = 0;
const OBSTACLE = 1;
const RESOURCE = 2;

/**
 * Static obstacle field + seed-scheduled resource regrowth.
 * Regrowth windows are defined by the seed alone (period + offset per cell), so
 * two runs with the same seed see the same resource schedule regardless of the
 * agent's trajectory. Collecting only marks the current window as consumed.
 */
export class World {
  readonly width: number;
  readonly height: number;
  readonly start: Vec;
  private obstacles: Uint8Array;
  private resources = new Map<number, ResourceCell>();
  private resourceIndices: number[] = [];
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.width = WORLD.width;
    this.height = WORLD.height;
    this.start = { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) };
    this.obstacles = new Uint8Array(this.width * this.height);
    this.generate(seed);
  }

  idx(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isObstacle(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.obstacles[this.idx(x, y)] === 1;
  }

  private windowStart(resource: ResourceCell, tick: number): number {
    return tick - ((tick + resource.offset) % resource.period);
  }

  isResourcePresent(x: number, y: number, tick: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const cell = this.resources.get(this.idx(x, y));
    if (!cell) return false;
    if (cell.lastCollected < 0) return true;
    return this.windowStart(cell, tick) > cell.lastCollected;
  }

  cellAt(x: number, y: number, tick: number): CellType {
    if (!this.inBounds(x, y)) return -1;
    const index = this.idx(x, y);
    if (this.obstacles[index]) return OBSTACLE;
    if (this.isResourcePresent(x, y, tick)) return RESOURCE;
    return EMPTY;
  }

  collect(x: number, y: number, tick: number): boolean {
    if (!this.isResourcePresent(x, y, tick)) return false;
    const cell = this.resources.get(this.idx(x, y));
    if (!cell) return false;
    cell.lastCollected = tick;
    return true;
  }

  get resourceCount(): number {
    return this.resourceIndices.length;
  }

  presentResourceCount(tick: number): number {
    let n = 0;
    for (const index of this.resourceIndices) {
      const x = index % this.width;
      const y = Math.floor(index / this.width);
      if (this.isResourcePresent(x, y, tick)) n++;
    }
    return n;
  }

  localView(x: number, y: number, radius: number, tick: number): Int8Array {
    const size = radius * 2 + 1;
    const view = new Int8Array(size * size);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        view[(dy + radius) * size + (dx + radius)] = this.cellAt(x + dx, y + dy, tick);
      }
    }
    return view;
  }

  /** Render buffer: 0 empty, 1 obstacle, 2 resource. */
  renderCells(tick: number): Uint8Array {
    const cells = new Uint8Array(this.width * this.height);
    for (let i = 0; i < cells.length; i++) {
      cells[i] = this.obstacles[i] ? OBSTACLE : EMPTY;
    }
    for (const index of this.resourceIndices) {
      const x = index % this.width;
      const y = Math.floor(index / this.width);
      if (this.isResourcePresent(x, y, tick)) cells[index] = RESOURCE;
    }
    return cells;
  }

  private generate(seed: number): void {
    const rng = new Rng(streamSeed(seed, "world"));
    const { width, height, start } = this;

    const clearRadius = 1;
    for (let attempt = 0; attempt < 6; attempt++) {
      this.obstacles.fill(0);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const nearStart =
            Math.abs(x - start.x) <= clearRadius && Math.abs(y - start.y) <= clearRadius;
          if (nearStart) continue;
          if (rng.next() < WORLD.obstacleDensity) {
            this.obstacles[this.idx(x, y)] = 1;
          }
        }
      }
      const reachable = this.reachableCells();
      let reachableCount = 0;
      let freeCount = 0;
      for (let i = 0; i < reachable.length; i++) {
        if (reachable[i]) reachableCount++;
        if (!this.obstacles[i]) freeCount++;
      }
      if (reachableCount >= freeCount * 0.82) break;
    }

    // Guarantee a navigable ring of nearby resources.
    const ring: Vec[] = [];
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < 2 || d > 4) continue;
        const x = start.x + dx;
        const y = start.y + dy;
        if (this.inBounds(x, y)) ring.push({ x, y });
      }
    }
    // Deterministic shuffle.
    for (let i = ring.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [ring[i], ring[j]] = [ring[j], ring[i]];
    }
    for (let i = 0; i < Math.min(7, ring.length); i++) {
      const cell = ring[i];
      this.obstacles[this.idx(cell.x, cell.y)] = 0;
    }

    const reachable = this.reachableCells();
    this.resources.clear();
    this.resourceIndices = [];
    const guaranteed = new Set(ring.slice(0, 7).map((c) => this.idx(c.x, c.y)));
    for (let index = 0; index < this.obstacles.length; index++) {
      if (this.obstacles[index]) continue;
      if (!reachable[index]) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      if (x === start.x && y === start.y) continue;
      const chosen = guaranteed.has(index) || rng.next() < WORLD.resourceDensity;
      if (!chosen) continue;
      const period = 48 + rng.int(66);
      const offset = rng.int(period);
      this.resources.set(index, { period, offset, lastCollected: -1 });
      this.resourceIndices.push(index);
    }
  }

  private reachableCells(): Uint8Array {
    const seen = new Uint8Array(this.width * this.height);
    const queue: number[] = [this.idx(this.start.x, this.start.y)];
    seen[queue[0]] = 1;
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head];
      const x = index % this.width;
      const y = Math.floor(index / this.width);
      const neighbours = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (const [nx, ny] of neighbours) {
        if (!this.inBounds(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (seen[ni] || this.obstacles[ni]) continue;
        seen[ni] = 1;
        queue.push(ni);
      }
    }
    return seen;
  }
}
