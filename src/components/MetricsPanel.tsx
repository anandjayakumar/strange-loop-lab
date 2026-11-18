import type { ReactNode } from "react";
import { ACTION_COLORS, SELECTION } from "../simulation/config";
import { ACTIONS, type Action, type EngineSnapshot, type SeriesPoint } from "../simulation/types";
import { cn } from "../lib/cn";
import { fmt, pct, seriesValues } from "../ui/format";
import { Panel } from "./ui/Panel";
import { Plot } from "./ui/Plot";
import { Stat } from "./ui/Primitives";

interface MetricsPanelProps {
  snapshot: EngineSnapshot;
  series: readonly SeriesPoint[];
}

export function MetricsPanel({ snapshot, series }: MetricsPanelProps) {
  const metrics = snapshot.metrics;
  const self = snapshot.selfModel;
  const meta = snapshot.metaModel;
  const hasData = series.length > 0;

  const energyActual = seriesValues(series, "energy");
  const energyEstimate = seriesValues(series, "energyEstimate");
  const worldAcc = seriesValues(series, "worldAccuracy");
  const selfAcc = seriesValues(series, "selfStateAccuracy");
  const selfForward = seriesValues(series, "selfPredictionAccuracy");
  const trust = seriesValues(series, "metaTrust");
  const prior = seriesValues(series, "priorWeight");
  const learning = seriesValues(series, "learningRate");
  const influence = seriesValues(series, "selfInfluence");
  const baseRate = series.map(() => 0.09);

  const dominant = (Object.entries(snapshot.actionMix) as [Action, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0];

  return (
    <Panel
      index="05"
      title="Measurements"
      subtitle="Accuracy, policy influence and level-crossing traces"
      right={
        <span className="chip">
          window <span className="text-lab-text">60</span>
        </span>
      }
      bodyClassName="px-4 pb-5 pt-5"
    >
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="survival"
          value={`${snapshot.tick}`}
          sub={`${snapshot.physical.resourcesCollected} resources · ${snapshot.physical.distance} moves`}
          color="#17130d"
        />
        <Stat
          label="energy"
          value={snapshot.physical.energy.toFixed(1)}
          sub={`mean ${fmt(metrics.meanEnergy, 1)} · fatigue ${snapshot.physical.fatigue.toFixed(2)}`}
          color="#39643f"
        />
        <Stat
          label="world accuracy"
          value={hasData ? pct(metrics.worldAccuracy) : "—"}
          sub={`1 − Brier · ${snapshot.worldModel.learnRate.toFixed(3)} lr`}
          color="#26467e"
        />
        <Stat
          label="self accuracy"
          value={pct(metrics.selfStateAccuracy)}
          sub={self ? `forward ${pct(metrics.selfPredictionAccuracy)}` : "no self-model"}
          color="#1d5c67"
        />
        <Stat
          label="self influence"
          value={hasData ? fmt(metrics.selfInfluence, 3) : "—"}
          sub="KL(with ‖ without self)"
          color="#b23f24"
        />
        <Stat
          label="meta calibration"
          value={fmt(metrics.metaCalibration, 2)}
          sub={meta ? `trust ${fmt(meta.trust)}` : "Mode C only"}
          color="#634070"
        />
      </div>

      <div className="mt-7 grid grid-cols-1 gap-x-7 gap-y-6 md:grid-cols-2">
        <ChartCard title="energy · actual vs belief">
          <Plot
            series={[
              { key: "energy", label: "instrumented", color: "#39643f", values: energyActual, fill: true },
              { key: "estimate", label: "self belief", color: "#1d5c67", values: energyEstimate, dashed: true },
            ]}
            min={0}
            max={100}
            formatValue={(v) => v.toFixed(0)}
            ariaLabel="Energy over time, instrumented against self-model estimate"
            emptyLabel="Run to sample"
          />
        </ChartCard>

        <ChartCard title="prediction accuracy">
          <Plot
            series={[
              { key: "world", label: "world model", color: "#26467e", values: worldAcc, fill: true },
              {
                key: "self",
                label: "self state",
                color: "#1d5c67",
                values: self ? selfAcc : selfAcc.map(() => null),
              },
              {
                key: "self-forward",
                label: "self forward",
                color: "#1d5c67",
                values: self ? selfForward : selfForward.map(() => null),
                dashed: true,
              },
            ]}
            min={0}
            max={1}
            formatValue={(v) => `${Math.round(v * 100)}`}
            ariaLabel="World-model and self-model accuracy over time"
            emptyLabel="Run to sample"
          />
        </ChartCard>

        <ChartCard title="level crossing · trust vs prior">
          <Plot
            series={[
              { key: "trust", label: "meta trust", color: "#634070", values: trust, fill: true },
              { key: "prior", label: "prior weight", color: "#b23f24", values: prior, dashed: true },
            ]}
            min={0}
            max={1}
            formatValue={(v) => v.toFixed(1)}
            ariaLabel="Meta-model trust and prior weight over time"
            emptyLabel="Mode C only"
          />
        </ChartCard>

        <ChartCard title="plasticity · learning rate">
          <Plot
            series={[
              {
                key: "lr",
                label: "effective",
                color: "#634070",
                values: self ? learning : learning.map(() => null),
                fill: true,
              },
              { key: "base", label: "base", color: "#a89e8d", values: baseRate, dashed: true },
            ]}
            min={0}
            max={0.24}
            formatValue={(v) => v.toFixed(2)}
            ariaLabel="Self-model learning rate over time"
            emptyLabel="No self-model"
          />
        </ChartCard>

        <ChartCard title="self-model influence · KL">
          <Plot
            series={[
              {
                key: "kl",
                label: "KL nats",
                color: "#b23f24",
                values: self ? influence : influence.map(() => null),
                fill: true,
              },
            ]}
            min={0}
            formatValue={(v) => v.toFixed(2)}
            ariaLabel="Kullback-Leibler divergence between policy with and without self-model influence"
            emptyLabel="No influence in Mode A"
          />
          <div className="mt-1.5 flex items-center justify-between font-sans text-[9px] text-lab-faint">
            <span>adaptation JS {fmt(metrics.adaptation, 3)}</span>
            <span className={metrics.adaptation > 0.18 ? "text-lab-amber" : ""}>
              {metrics.adaptation > 0.18 ? "shift detected" : "stable"}
            </span>
          </div>
        </ChartCard>

        <div className="border-t border-lab-line pt-2.5">
          <div className="flex items-center justify-between">
            <span className="mono-label">action distribution</span>
            <span className="font-mono text-[8px] text-lab-faint">
              H {fmt(metrics.actionEntropy, 2)}
            </span>
          </div>
          <div className="mt-2.5 flex h-2 overflow-hidden rounded-sm bg-lab-raise">
            {ACTIONS.map((action) => (
              <div
                key={action}
                style={{
                  width: `${snapshot.actionMix[action] * 100}%`,
                  background: ACTION_COLORS[action],
                  opacity: action === "REST" ? 0.45 : 0.9,
                }}
                title={`${action} ${pct(snapshot.actionMix[action])}`}
              />
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-5 gap-1">
            {ACTIONS.map((action) => (
              <div key={action} className="text-center">
                <div className="font-mono text-[8px] text-lab-faint">{action.slice(0, 2)}</div>
                <div
                  className="font-mono text-[9px] tabular-nums"
                  style={{ color: ACTION_COLORS[action] }}
                >
                  {pct(snapshot.actionMix[action])}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-lab-line pt-1.5 font-sans text-[9px] text-lab-faint">
            <span>
              dominant{" "}
              <span className="text-lab-muted">{dominant[0]}</span>
            </span>
            <span>temperature {SELECTION.temperature.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-lab-line pt-2.5 font-sans text-[9px] text-lab-faint">
        <span>
          mean trust <span className="text-lab-muted">{fmt(metrics.meanTrust)}</span>
        </span>
        <span>
          mean LR{" "}
          <span className="text-lab-muted">
            {self && hasData ? metrics.meanLearningRate.toFixed(3) : "—"}
          </span>
        </span>
        <span>
          mean prior{" "}
          <span className="text-lab-muted">
            {self && hasData ? fmt(metrics.meanPriorWeight) : "—"}
          </span>
        </span>
        <span>
          self-confidence <span className="text-lab-muted">{self ? fmt(self.confidence) : "—"}</span>
        </span>
        <span className="ml-auto">
          {series.length} ticks retained · accuracy measured against instrumented state
        </span>
      </div>
    </Panel>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-lab-line pt-2.5">
      <div className={cn("mb-2 font-sans text-[9px] font-medium uppercase tracking-[0.16em] text-lab-muted")}>
        {title}
      </div>
      {children}
    </div>
  );
}
