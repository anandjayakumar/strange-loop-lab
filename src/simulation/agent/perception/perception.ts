import { WORLD } from "../../config";
import type { World } from "../../environment/world";
import {
  ACTION_DELTAS,
  ACTIONS,
  type Action,
  type ActionFeatures,
  type Observation,
  type OutcomeSignal,
  type PerceptionRecord,
  type PhysicalState,
} from "../../types";

/** Build the agent's strictly local, interoceptively noisy observation. */
export function createObservation(
  world: World,
  state: PhysicalState,
  tick: number,
  sensedEnergy: number,
  lastOutcome: OutcomeSignal | null,
): Observation {
  const radius = WORLD.sensorRadius;
  return {
    tick,
    x: state.x,
    y: state.y,
    radius,
    local: world.localView(state.x, state.y, radius, tick),
    sensedEnergy,
    lastOutcome,
  };
}

function cellAtLocal(obs: Observation, dx: number, dy: number): number {
  const size = obs.radius * 2 + 1;
  const lx = dx + obs.radius;
  const ly = dy + obs.radius;
  if (lx < 0 || ly < 0 || lx >= size || ly >= size) return -1;
  return obs.local[ly * size + lx];
}

function scanDirection(
  obs: Observation,
  action: Action,
): { resourceDistance: number; obstacleDistance: number } {
  if (action === "REST") return { resourceDistance: Infinity, obstacleDistance: Infinity };
  const delta = ACTION_DELTAS[action];
  let resourceDistance = Infinity;
  let obstacleDistance = Infinity;
  for (let step = 1; step <= obs.radius; step++) {
    const cell = cellAtLocal(obs, delta.x * step, delta.y * step);
    if (cell === -1) {
      if (obstacleDistance === Infinity) obstacleDistance = step;
      break;
    }
    if (cell === 2 && resourceDistance === Infinity) resourceDistance = step;
    if (cell === 1 && obstacleDistance === Infinity) obstacleDistance = step;
  }
  return { resourceDistance, obstacleDistance };
}

export function localDensity(obs: Observation): { obstacles: number; resources: number; cells: number } {
  let obstacles = 0;
  let resources = 0;
  let cells = 0;
  for (const cell of obs.local) {
    if (cell === -1) continue;
    cells++;
    if (cell === 1) obstacles++;
    if (cell === 2) resources++;
  }
  return { obstacles, resources, cells: Math.max(1, cells) };
}

/** Turn a 7x7 observation into per-action features. No global map access. */
export function perceive(obs: Observation): PerceptionRecord {
  const density = localDensity(obs);
  const obstacleDensity = density.obstacles / density.cells;
  const resourceDensity = density.resources / density.cells;

  let nearestResource = Infinity;
  let nearestObstacle = Infinity;
  const size = obs.radius * 2 + 1;
  for (let ly = 0; ly < size; ly++) {
    for (let lx = 0; lx < size; lx++) {
      const cell = obs.local[ly * size + lx];
      if (cell !== 2 && cell !== 1) continue;
      const dx = lx - obs.radius;
      const dy = ly - obs.radius;
      const distance = Math.abs(dx) + Math.abs(dy);
      if (cell === 2) nearestResource = Math.min(nearestResource, distance);
      else nearestObstacle = Math.min(nearestObstacle, distance);
    }
  }

  const features = {} as Record<Action, ActionFeatures>;
  for (const action of ACTIONS) {
    let targetX = obs.x;
    let targetY = obs.y;
    if (action !== "REST") {
      const delta = ACTION_DELTAS[action];
      targetX += delta.x;
      targetY += delta.y;
    }
    const targetType = action === "REST" ? 0 : cellAtLocal(obs, targetX - obs.x, targetY - obs.y);
    const scan = scanDirection(obs, action);
    features[action] = {
      action,
      target: { x: targetX, y: targetY },
      targetInBounds: targetType !== -1,
      targetType: targetType as ActionFeatures["targetType"],
      obstacleAtTarget: targetType === 1 ? 1 : 0,
      resourceAtTarget: targetType === 2 ? 1 : 0,
      boundary: targetType === -1 ? 1 : 0,
      localObstacleDensity: obstacleDensity,
      localResourceDensity: resourceDensity,
      directionResourceSignal:
        scan.resourceDistance === Infinity ? 0 : 1 / scan.resourceDistance,
      directionObstacleSignal:
        scan.obstacleDistance === Infinity ? 0 : 1 / scan.obstacleDistance,
      nearestResourceDistance:
        action === "REST" ? Infinity : scan.resourceDistance,
      nearestObstacleDistance:
        action === "REST" ? Infinity : scan.obstacleDistance,
    };
  }

  return {
    observation: obs,
    features,
    localResourceCount: density.resources,
    localObstacleCount: density.obstacles,
    nearestResourceDistance: nearestResource,
    nearestObstacleDistance: nearestObstacle,
  };
}
