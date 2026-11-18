import { AGENT } from "../simulation/config";
import type { EngineSnapshot } from "../simulation/types";
import { ACTION_GLYPH } from "../simulation/types";
import { cn } from "../lib/cn";
import { fmt, pct, signed } from "../ui/format";
import { Panel } from "./ui/Panel";

export function InternalStatePanel({ snapshot }: { snapshot: EngineSnapshot }) {
  const self = snapshot.selfModel;
  const physical = snapshot.physical;
  const selection = snapshot.selection;
  const selectedPrediction = selection
    ? snapshot.predictions.find((p) => p.actionIndex === selection.actionIndex)
    : undefined;
  const energyReady = Boolean(self?.initialized);

  const rows = [
    {
      key: "energy",
      label: "Energy",
      actual: physical.energy.toFixed(1),
      estimate: self && energyReady ? self.energyEstimate.toFixed(1) : "—",
      error: self && energyReady ? Math.abs(self.energyEstimate - physical.energy) : null,
      unit: "E",
      threshold: 8,
      bar: energyReady
        ? {
            actual: physical.energy / AGENT.maxEnergy,
            estimate: self ? self.energyEstimate / AGENT.maxEnergy : 0,
          }
        : undefined,
    },
    {
      key: "cost",
      label: "Movement cost",
      actual: physical.effectiveCost.toFixed(2),
      estimate: self ? self.movementCost.toFixed(2) : "—",
      error: self ? Math.abs(self.movementCost - physical.effectiveCost) : null,
      unit: "E / step",
      threshold: 0.7,
    },
    {
      key: "fatigue",
      label: "Fatigue",
      actual: physical.fatigue.toFixed(2),
      estimate: self ? self.fatigue.toFixed(2) : "—",
      error: self ? Math.abs(self.fatigue - physical.fatigue) : null,
      unit: "0–1",
      threshold: 0.22,
      bar: { actual: physical.fatigue, estimate: self ? self.fatigue : 0 },
    },
    {
      key: "success",
      label: "Success probability",
      actual: physical.effectiveSuccess.toFixed(2),
      estimate: selectedPrediction?.self ? selectedPrediction.self.pSuccess.toFixed(2) : "—",
      error:
        selectedPrediction?.self
          ? Math.abs(selectedPrediction.self.pSuccess - physical.effectiveSuccess)
          : null,
      unit: "next step",
      threshold: 0.2,
    },
    {
      key: "rest",
      label: "Rest gain",
      actual: AGENT.restGain.toFixed(2),
      estimate: self ? self.restGain.toFixed(2) : "—",
      error: self ? Math.abs(self.restGain - AGENT.restGain) : null,
      unit: "E / rest",
      threshold: 0.8,
    },
    {
      key: "collect",
      label: "Resource gain",
      actual: AGENT.resourceGain.toFixed(1),
      estimate: self ? self.collectGain.toFixed(1) : "—",
      error: self ? Math.abs(self.collectGain - AGENT.resourceGain) : null,
      unit: "E / cell",
      threshold: 4,
    },
  ];

  return (
    <Panel
      index="03"
      title="Internal state"
      subtitle="Instrumented truth beside the self-model estimate"
      right={
        <span className="chip">
          error{" "}
          <span className="text-lab-text">
            {self && energyReady
              ? `E ${Math.abs(self.energyEstimate - physical.energy).toFixed(1)}`
              : "n/a"}
          </span>
        </span>
      }
      bodyClassName="p-3"
    >
      <div className="overflow-hidden rounded-md border border-lab-line/70">
        <div className="grid grid-cols-[1.25fr_0.8fr_0.8fr_0.62fr] gap-2 border-b border-lab-line/70 bg-lab-raise/40 px-2.5 py-1.5">
          <span className="mono-label">Quantity</span>
          <span className="mono-label text-right">Actual</span>
          <span className="mono-label text-right">Estimate</span>
          <span className="mono-label text-right">|err|</span>
        </div>
        {rows.map((row) => {
          const errorColor =
            row.error === null
              ? "text-lab-faint"
              : row.error > row.threshold
                ? "text-lab-red"
                : row.error > row.threshold * 0.45
                  ? "text-lab-amber"
                  : "text-lab-green";
          return (
            <div
              key={row.key}
              className="grid grid-cols-[1.25fr_0.8fr_0.8fr_0.62fr] items-center gap-2 border-b border-lab-line/40 px-2.5 py-2 last:border-0"
            >
              <div className="min-w-0">
                <div className="truncate text-[11px] text-lab-muted">{row.label}</div>
                <div className="font-mono text-[7px] text-lab-faint">{row.unit}</div>
              </div>
              <div className="text-right font-mono text-[11px] tabular-nums text-lab-text">
                {row.actual}
              </div>
              <div
                className={cn(
                  "text-right font-mono text-[11px] tabular-nums",
                  self ? "text-lab-cyan" : "text-lab-faint",
                )}
              >
                {row.estimate}
              </div>
              <div className={cn("text-right font-mono text-[9px] tabular-nums", errorColor)}>
                {row.error === null ? "—" : row.error.toFixed(2)}
              </div>
              {row.bar ? (
                <div className="col-span-4 -mt-1 flex items-center gap-2">
                  <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-lab-raise">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-lab-muted/50"
                      style={{ width: `${Math.min(100, Math.max(0, row.bar.actual * 100))}%` }}
                    />
                    <div
                      className="absolute inset-y-[-1px] w-[2px] bg-lab-cyan"
                      style={{ left: `${Math.min(100, Math.max(0, row.bar.estimate * 100))}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 rounded-md border border-lab-cyan/15 bg-lab-cyan/[0.035] px-2.5 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-lab-cyan/80">
            interoceptive channel
          </span>
          <span className="font-mono text-[8px] text-lab-faint">E<sub>sensed</sub> = E + noise (+ lag)</span>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          <div>
            <div className="mono-label">sensed</div>
            <div className="font-mono text-[11px] tabular-nums text-lab-text">
              {snapshot.observation ? fmt(snapshot.sensedEnergy, 1) : "—"}
            </div>
          </div>
          <div>
            <div className="mono-label">noise</div>
            <div className="font-mono text-[11px] tabular-nums text-lab-muted">
              {snapshot.observation ? signed(snapshot.energyNoise, 1) : "—"}
            </div>
          </div>
          <div>
            <div className="mono-label">sample</div>
            <div
              className={cn(
                "font-mono text-[10px]",
                snapshot.staleReading ? "text-lab-amber" : "text-lab-muted",
              )}
            >
              {!snapshot.observation ? "none" : snapshot.staleReading ? "delayed" : "fresh"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="mono-label">Utility decomposition · last selection</span>
          <span className="font-mono text-[8px] text-lab-faint">
            {selection ? `${selection.action} chosen` : "no selection yet"}
          </span>
        </div>
        {selection && snapshot.predictions.length ? (
          <div className="overflow-hidden rounded-md border border-lab-line/60">
            <div className="grid grid-cols-[28px_1fr_1fr_1fr_1fr_1fr] gap-1 border-b border-lab-line/60 bg-lab-raise/30 px-2 py-1 font-mono text-[7px] uppercase tracking-[0.06em] text-lab-faint">
              <span>act</span>
              <span className="text-right">p suc</span>
              <span className="text-right">p res</span>
              <span className="text-right">self ΔE</span>
              <span className="text-right">utility</span>
              <span className="text-right">policy</span>
            </div>
            {snapshot.predictions.map((prediction) => {
              const chosen = selection.actionIndex === prediction.actionIndex;
              return (
                <div
                  key={prediction.action}
                  className={cn(
                    "grid grid-cols-[28px_1fr_1fr_1fr_1fr_1fr] gap-1 px-2 py-1 font-mono text-[9px] tabular-nums",
                    chosen ? "bg-lab-amber/[0.07] text-lab-text" : "text-lab-muted",
                  )}
                >
                  <span className={chosen ? "text-lab-amber" : "text-lab-faint"}>
                    {ACTION_GLYPH[prediction.action]} {prediction.action.slice(0, 2)}
                  </span>
                  <span className="text-right">{fmt(prediction.world.pSuccess)}</span>
                  <span className="text-right">{fmt(prediction.world.pCollect)}</span>
                  <span className="text-right">
                    {prediction.self ? signed(prediction.self.energyDelta, 1) : "—"}
                  </span>
                  <span className="text-right">{fmt(selection.utilities[prediction.actionIndex])}</span>
                  <span className="text-right">
                    {pct(selection.probabilities[prediction.actionIndex])}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded border border-dashed border-lab-line/70 px-3 py-5 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-lab-faint">
            Run one phase to generate predictions
          </div>
        )}
      </div>

      <p className="mt-2 text-[9px] leading-relaxed text-lab-faint">
        The instrumented column exists only in the laboratory. The self-model never receives it —
        all of its estimates are built from noisy interoception, proprioception, actions and
        prediction errors.
      </p>
    </Panel>
  );
}
