import type { Action, SimEvent, StepOutcome } from "../types";

export type EventSink = (event: Omit<SimEvent, "id">) => void;

export function outcomeText(outcome: StepOutcome): string | null {
  const at = `(${outcome.to.x}, ${outcome.to.y})`;
  if (outcome.action === "REST") {
    if (outcome.energyGained > 0.05) {
      return `Rested at ${at}; instrumented energy +${outcome.energyGained.toFixed(2)}.`;
    }
    return null;
  }
  if (outcome.slipped) {
    return `Tried to move ${outcome.action} at ${at} but slipped; ${outcome.energySpent.toFixed(
      2,
    )} energy spent, position unchanged.`;
  }
  if (outcome.blocked) {
    return `Movement ${outcome.action} blocked at ${at}; ${outcome.energySpent.toFixed(
      2,
    )} energy spent on the attempt.`;
  }
  if (outcome.collected) {
    return `Collected a resource at ${at}; energy ${outcome.energyBefore.toFixed(
      1,
    )} → ${outcome.energyAfter.toFixed(1)}.`;
  }
  return null;
}

export function energyThresholdText(threshold: number, energy: number): string {
  return `Instrumented energy fell below ${threshold} (${energy.toFixed(1)}).`;
}

export function costRevisionText(from: number, to: number, reason: string): string {
  return `Self-model movement-cost estimate revised ${from.toFixed(2)} → ${to.toFixed(
    2,
  )} ${reason}.`;
}

export function restRevisionText(from: number, to: number): string {
  return `Self-model rest-gain estimate revised ${from.toFixed(2)} → ${to.toFixed(2)}.`;
}

export function trustText(from: number, to: number, error: number): string {
  const direction = to < from ? "reduced" : "raised";
  return `Meta-model ${direction} trust ${from.toFixed(2)} → ${to.toFixed(
    2,
  )} at self-model error ${error.toFixed(2)}.`;
}

export function plasticityText(from: number, to: number, trust: number): string {
  const direction = to > from ? "raised" : "lowered";
  return `Plasticity ${direction} self-model learning rate ×${from.toFixed(
    2,
  )} → ×${to.toFixed(2)} as trust reached ${trust.toFixed(2)}.`;
}

export function priorText(value: number, trust: number): string {
  return `Prior weighting set to ${value.toFixed(
    2,
  )}; internal predictions now override sensory correction at trust ${trust.toFixed(2)}.`;
}

export function selfErrorText(belief: number, actual: number, error: number): string {
  return `Self-model energy belief ${belief.toFixed(
    1,
  )} diverged from instrumentation ${actual.toFixed(1)} (error ${error.toFixed(1)}).`;
}

export function fatigueText(value: number, direction: "above" | "below"): string {
  return `Instrumented fatigue moved ${direction} ${value.toFixed(2)}; success probability ${
    direction === "above" ? "falling" : "recovering"
  }.`;
}

export function adaptationText(js: number, dominant: Action): string {
  return `Action distribution shifted (JS ${js.toFixed(
    2,
  )}); dominant action is now ${dominant}.`;
}

export function deathText(outcome: StepOutcome, survived: number): string {
  return `Agent died at (${outcome.to.x}, ${outcome.to.y}) after ${survived} steps; energy exhausted.`;
}

export function resetText(): string {
  return "Agent memory and learned models reset to their priors; world state preserved.";
}

export function toggleText(name: string, enabled: boolean): string {
  return `${name} ${enabled ? "enabled" : "disabled"}.`;
}
