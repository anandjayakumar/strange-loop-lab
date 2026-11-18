import { useEffect, useState, type ReactNode } from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { MODES, MODE_META, type Mode } from "../simulation/types";
import { useComparison } from "../ui/useComparison";
import { cn } from "../lib/cn";
import { fmt, pct, seriesValues } from "../ui/format";
import { Plot } from "./ui/Plot";

const MODE_COLOR: Record<Mode, string> = {
  A: "#8b929b",
  B: "#5fd0e3",
  C: "#b49cff",
};

export function ComparisonView({ seed, onClose }: { seed: number; onClose: () => void }) {
  const [horizon, setHorizon] = useState(900);
  const comparison = useComparison(seed, horizon, true);
  const { progress, running, summaries, series } = comparison;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const energySeries = MODES.map((mode) => ({
    key: mode,
    label: `Mode ${mode}`,
    color: MODE_COLOR[mode],
    values: seriesValues(series[mode], "energy"),
    width: mode === "C" ? 1.6 : 1.2,
  }));
  const survivalSeries = MODES.map((mode) => ({
    key: mode,
    label: `Mode ${mode}`,
    color: MODE_COLOR[mode],
    values: series[mode].map((point) => (point.alive ? 1 : 0)),
  }));
  const worldSeries = MODES.map((mode) => ({
    key: mode,
    label: `Mode ${mode}`,
    color: MODE_COLOR[mode],
    values: seriesValues(series[mode], "worldAccuracy"),
  }));
  const selfSeries = (["B", "C"] as Mode[]).map((mode) => ({
    key: mode,
    label: `Mode ${mode} self`,
    color: MODE_COLOR[mode],
    values: seriesValues(series[mode], "selfStateAccuracy"),
  }));
  const trustSeries = [
    {
      key: "trust",
      label: "Mode C meta trust",
      color: MODE_COLOR.C,
      values: seriesValues(series.C, "metaTrust"),
      fill: true,
    },
    {
      key: "prior",
      label: "prior weight",
      color: "#f0a35e",
      values: seriesValues(series.C, "priorWeight"),
      dashed: true,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
        className="panel mx-auto w-full max-w-6xl animate-fade-up"
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-lab-line px-5 py-4">
          <div>
            <div className="mono-label text-lab-amber">Head-to-head · background runs</div>
            <h2 id="compare-title" className="mt-0.5 font-serif text-2xl text-lab-text">
              Same seed, three conditions
            </h2>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="chip">
              seed <span className="text-lab-text">{seed}</span>
            </span>
            <label className="chip gap-1.5">
              horizon
              <select
                value={horizon}
                onChange={(event) => setHorizon(Number(event.target.value))}
                className="bg-transparent font-mono text-[9px] text-lab-text outline-none"
                aria-label="Comparison horizon in ticks"
              >
                {[300, 600, 900, 1500].map((value) => (
                  <option key={value} value={value} className="bg-lab-panel">
                    {value} ticks
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn h-8"
              onClick={
                progress.completed
                  ? () => comparison.restart(seed, horizon)
                  : running
                    ? comparison.pause
                    : comparison.resume
              }
            >
              {progress.completed ? (
                <RotateCcw size={12} />
              ) : running ? (
                <Pause size={12} />
              ) : (
                <Play size={12} />
              )}
              {progress.completed ? "Run again" : running ? "Pause" : "Resume"}
            </button>
            <button className="btn h-8" onClick={() => comparison.restart(seed, horizon)}>
              <RotateCcw size={12} />
              Restart
            </button>
            <button className="icon-btn" onClick={onClose} aria-label="Close comparison">
              <X size={14} />
            </button>
          </div>
        </header>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-lab-faint">
              {progress.completed
                ? "all runs complete"
                : running
                  ? "background engines advancing"
                  : "paused"}
            </span>
            <span className="font-mono text-[9px] tabular-nums text-lab-muted">
              {progress.ticksDone} / {progress.horizon} ticks
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-lab-raise">
            <div
              className="h-full rounded-full bg-lab-amber transition-[width] duration-150"
              style={{ width: `${(progress.ticksDone / progress.horizon) * 100}%` }}
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-md border border-lab-line/70">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-lab-line/70 bg-lab-raise/40 font-mono text-[8px] uppercase tracking-[0.1em] text-lab-faint">
                  <th className="px-3 py-2 font-normal">condition</th>
                  <th className="px-2 py-2 font-normal">status</th>
                  <th className="px-2 py-2 text-right font-normal">survived</th>
                  <th className="px-2 py-2 text-right font-normal">resources</th>
                  <th className="px-2 py-2 text-right font-normal">mean E</th>
                  <th className="px-2 py-2 text-right font-normal">world</th>
                  <th className="px-2 py-2 text-right font-normal">self</th>
                  <th className="px-2 py-2 text-right font-normal">trust</th>
                  <th className="px-2 py-2 text-right font-normal">KL</th>
                  <th className="px-3 py-2 text-right font-normal">dominant</th>
                </tr>
              </thead>
              <tbody>
                {MODES.map((mode) => {
                  const summary = summaries[mode];
                  const meta = MODE_META[mode];
                  return (
                    <tr key={mode} className="border-b border-lab-line/40 last:border-0">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="grid h-5 w-5 place-items-center rounded border font-mono text-[10px]"
                            style={{
                              color: MODE_COLOR[mode],
                              borderColor: `${MODE_COLOR[mode]}45`,
                              background: `${MODE_COLOR[mode]}12`,
                            }}
                          >
                            {mode}
                          </span>
                          <div>
                            <div className="text-[11px] text-lab-text">{meta.name}</div>
                            <div className="font-mono text-[7.5px] text-lab-faint">{meta.short}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <span
                          className={cn(
                            "font-mono text-[8px] uppercase tracking-[0.08em]",
                            summary.alive ? "text-lab-green" : "text-lab-red",
                          )}
                        >
                          {summary.alive ? "alive" : `died t${summary.deathTick ?? "?"}`}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-[10px] tabular-nums text-lab-text">
                        {summary.survived}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-[10px] tabular-nums text-lab-muted">
                        {summary.resources}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-[10px] tabular-nums text-lab-muted">
                        {summary.meanEnergy.toFixed(1)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-[10px] tabular-nums text-lab-muted">
                        {pct(summary.worldAccuracy)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-[10px] tabular-nums" style={{ color: summary.selfAccuracy === null ? undefined : "#5fd0e3" }}>
                        {pct(summary.selfAccuracy)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-[10px] tabular-nums text-lab-muted">
                        {fmt(summary.meanTrust)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-[10px] tabular-nums text-lab-muted">
                        {summary.selfInfluence.toFixed(3)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[9px] text-lab-faint">
                        {summary.dominantAction ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <ChartBox title="energy · instrumented">
              <Plot
                series={energySeries}
                min={0}
                max={100}
                formatValue={(v) => v.toFixed(0)}
                ariaLabel="Energy over time for all three modes"
                emptyLabel="Starting comparison"
                legendNote="same seed"
              />
            </ChartBox>
            <ChartBox title="survival status">
              <Plot
                series={survivalSeries}
                min={0}
                max={1}
                tickCount={2}
                formatValue={(v) => (v === 1 ? "alive" : v === 0 ? "dead" : "")}
                ariaLabel="Survival status over time for all three modes"
                emptyLabel="Starting comparison"
              />
            </ChartBox>
            <ChartBox title="world-model accuracy">
              <Plot
                series={worldSeries}
                min={0}
                max={1}
                formatValue={(v) => `${Math.round(v * 100)}`}
                ariaLabel="World-model accuracy for all three modes"
                emptyLabel="Starting comparison"
              />
            </ChartBox>
            <ChartBox title="self-model accuracy">
              {selfSeries.some((s) => s.values.some((v) => v !== null)) ? (
                <Plot
                  series={selfSeries}
                  min={0}
                  max={1}
                  formatValue={(v) => `${Math.round(v * 100)}`}
                  ariaLabel="Self-model state accuracy for Modes B and C"
                  emptyLabel="Starting comparison"
                />
              ) : (
                <div className="grid h-[140px] place-items-center font-mono text-[9px] uppercase tracking-[0.12em] text-lab-faint">
                  Mode A has no self-model
                </div>
              )}
            </ChartBox>
            <ChartBox title="level crossing · Mode C" className="md:col-span-2">
              <Plot
                series={trustSeries}
                min={0}
                max={1}
                formatValue={(v) => v.toFixed(1)}
                ariaLabel="Meta-model trust and prior weight for Mode C"
                emptyLabel="Starting comparison"
              />
            </ChartBox>
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-lab-line/60 pt-3">
            <p className="max-w-[70ch] text-[9px] leading-relaxed text-lab-faint">
              Each condition runs in its own deterministic engine with the same seed, obstacle
              field, resource schedule and initial energy. Trajectories diverge only because their
              policies differ. Self-model accuracy is measured against instrumented state; Mode A
              has no self-estimate to score.
            </p>
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-lab-faint">
              run id {seed}-{horizon}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartBox({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-lab-line/60 bg-lab-raise/20 p-2.5",
        className,
      )}
    >
      <div className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-lab-faint">
        {title}
      </div>
      {children}
    </div>
  );
}
