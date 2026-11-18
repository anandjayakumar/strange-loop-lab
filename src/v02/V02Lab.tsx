import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { ACTION_COLORS } from "../simulation/config";
import { V02Engine } from "../simulation/v02/engine";
import { EXPLORATION_LABELS, SCENARIO_LABELS } from "../simulation/v02/config";
import {
  ATTRIBUTION_LABELS,
  type Difficulty,
  type ExplorationMode,
  type PriorRegime,
  type Scenario,
  type V02SeriesPoint,
  type V02Snapshot,
} from "../simulation/v02/types";
import { Panel } from "../components/ui/Panel";
import { LabTransport } from "../components/LabTransport";
import { SiteHeader, type SiteView } from "../components/SiteHeader";
import { VersionHero } from "../components/VersionHero";
import { Plot } from "../components/ui/Plot";
import { Ring, Stat } from "../components/ui/Primitives";
import { cn } from "../lib/cn";
import { useV02Simulation } from "./useV02Simulation";

const TABS: { key: Difficulty; label: string }[] = [
  { key: "docile", label: "Docile" },
  { key: "standard", label: "Standard" },
  { key: "harsh", label: "Harsh" },
];

export function V02Lab({
  onNavigate,
}: {
  onNavigate: (view: SiteView) => void;
}) {
  const controller = useV02Simulation();
  const { engine, snapshot, series, events, settings, running, flash, actions } = controller;
  const [seedDraft, setSeedDraft] = useState(String(settings.seed));

  useEffect(() => setSeedDraft(String(settings.seed)), [settings.seed]);

  const applySeed = () => {
    const parsed = Number(seedDraft.replace(/[^0-9]/g, ""));
    if (parsed > 0) actions.resetWith({ seed: parsed });
  };

  return (
    <div className="min-h-screen">
      <SiteHeader active="v02" onNavigate={onNavigate} />

      <main className="mx-auto max-w-[1560px] space-y-4 px-5 py-5 sm:px-8">
        <VersionHero
          id="v02-hero"
          label="V0.2"
          edition="uninformed priors · learned meta-cognition"
          headline={<>Learned <span className="italic text-lab-amber">meta-cognition</span></>}
          lede="The first-order self-model is now learned from randomized, uninformed priors, and a second-order model tracks when its own predictions can be trusted. Watch the level crossing: trust rises when beliefs hold, and collapses when they fail."
          tick={snapshot.tick}
          energy={snapshot.physical.energy}
          status={!snapshot.alive ? "terminated" : running ? "running" : "paused"}
          condition={`${settings.difficulty} · ${settings.priorRegime}`}
          seed={settings.seed}
          detail={`${snapshot.physical.resources} resources · ${snapshot.physical.moves} moves`}
          onResearch={() => onNavigate("research")}
          onLatest={() => onNavigate("v05")}
        />
        <section id="v02-controls" className="panel">
          <LabTransport
          running={running}
          alive={snapshot.alive}
          phase={snapshot.phase}
          phaseName={snapshot.phaseName}
          onToggle={actions.toggleRunning}
          onStep={actions.step}
          onPhase={actions.phase}
          onReset={actions.reset}
        />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-lab-line/80 px-3.5 py-2.5">
            <label className="flex items-center gap-2">
              <span className="mono-label">difficulty</span>
              <select
                value={settings.difficulty}
                onChange={(event) => actions.resetWith({ difficulty: event.target.value as Difficulty })}
                className="rounded border border-lab-line bg-lab-bg px-2 py-1.5 font-mono text-[9px] text-lab-text outline-none"
              >
                {TABS.map((tab) => (
                  <option key={tab.key} value={tab.key}>{tab.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="mono-label">priors</span>
              <select
                value={settings.priorRegime}
                onChange={(event) =>
                  actions.resetWith({ priorRegime: event.target.value as PriorRegime })
                }
                className="rounded border border-lab-line bg-lab-bg px-2 py-1.5 font-mono text-[9px] text-lab-text outline-none"
              >
                <option value="uninformed">uninformed random</option>
                <option value="severe">severe misspecification</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="mono-label">scenario</span>
              <select
                value={settings.scenario}
                onChange={(event) => actions.resetWith({ scenario: event.target.value as Scenario })}
                className="rounded border border-lab-line bg-lab-bg px-2 py-1.5 font-mono text-[9px] text-lab-text outline-none"
              >
                {Object.entries(SCENARIO_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="mono-label">exploration</span>
              <select
                value={settings.explorationMode}
                onChange={(event) =>
                  actions.resetWith({ explorationMode: event.target.value as ExplorationMode })
                }
                className="rounded border border-lab-line bg-lab-bg px-2 py-1.5 font-mono text-[9px] text-lab-text outline-none"
              >
                {Object.entries(EXPLORATION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="mono-label">lambda</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.lambda}
                onChange={(event) =>
                  actions.resetWith({ lambda: Number(event.target.value) })
                }
                className="h-1 w-20 accent-lab-violet"
                aria-label="Epistemic exploration weight"
              />
              <span className="font-mono text-[9px] text-lab-muted">{settings.lambda.toFixed(2)}</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="mono-label">seed</span>
              <input
                value={seedDraft}
                onChange={(event) => setSeedDraft(event.target.value)}
                onBlur={applySeed}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="h-7 w-20 rounded border border-lab-line bg-lab-bg px-2 font-mono text-[9px] text-lab-text outline-none"
                aria-label="Seed"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="mono-label">speed</span>
              <input
                type="range"
                min={1}
                max={60}
                value={settings.speed}
                onChange={(event) => actions.setSpeed(Number(event.target.value))}
                className="h-1 w-24 accent-lab-amber"
                aria-label="Speed"
              />
              <span className="font-mono text-[9px] text-lab-muted">{settings.speed}/s</span>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-3.5 py-2">
            <span className="mono-label">interventions</span>
            {[
              ["physical", "physical shift"],
              ["energy_sensor", "energy sensor noise/bias"],
              ["fatigue_sensor", "fatigue sensor noise/bias"],
              ["shared", "shared degradation"],
            ].map(([kind, label]) => (
              <button
                key={kind}
                className="btn h-7 px-2 py-0 normal-case tracking-normal"
                onClick={() => actions.trigger(kind as "physical")}
              >
                <Zap size={11} /> {label}
              </button>
            ))}
            <button className="btn h-7 border-lab-red/30 px-2 py-0 normal-case tracking-normal text-lab-red" onClick={actions.injectTrap}>
              inject pessimistic belief
            </button>
            <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.1em] text-lab-faint">
              t={snapshot.tick} · {snapshot.phaseName} · {snapshot.shift === "none" ? "no shift" : snapshot.shift}
            </span>
            {flash ? (
              <span className="rounded border border-lab-violet/30 bg-lab-violet/10 px-2 py-1 font-mono text-[8px] text-lab-violet">
                {flash}
              </span>
            ) : null}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <V02Environment engine={engine} snapshot={snapshot} />
          </div>
          <div className="lg:col-span-5">
            <MetaPanel snapshot={snapshot} />
          </div>
          <div className="lg:col-span-3">
            <StatePanel snapshot={snapshot} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <MetricsPanel snapshot={snapshot} series={series} />
          </div>
          <div className="lg:col-span-4">
            <ExplorationPanel snapshot={snapshot} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <AttributionPanel snapshot={snapshot} />
          </div>
          <div className="lg:col-span-7">
            <EventPanel events={events} />
          </div>
        </div>
        <footer className="border-t border-lab-line/60 px-1 pb-5 pt-3 text-[9px] leading-relaxed text-lab-faint">
          V0.2 is a research instrument, not a consciousness claim. The learned meta-model predicts
          observable first-order error; latent errors, shadow outcomes and regime labels are
          evaluation-only. V0.1 remains available through the V0.1 switch.
        </footer>
      </main>
    </div>
  );
}

function V02Environment({ engine, snapshot }: { engine: V02Engine; snapshot: V02Snapshot }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const container = wrap.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.width * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.width}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < 32) return;
      last = now;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const state = engine.getRenderState();
      const size = width;
      const cell = size / 30;
      const ox = 0;
      const oy = 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, width);
      ctx.fillStyle = "#efe9dc";
      ctx.fillRect(0, 0, width, width);
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 30; x++) {
          const t = state.cells[y * 30 + x];
          if (t === 1) {
            ctx.fillStyle = "#d8cdb8";
            ctx.fillRect(ox + x * cell + 0.5, oy + y * cell + 0.5, cell - 1, cell - 1);
          } else if (t === 2) {
            ctx.save();
            ctx.shadowColor = "rgba(57,100,63,0.7)";
            ctx.shadowBlur = cell;
            ctx.fillStyle = "#39643f";
            ctx.beginPath();
            ctx.arc(ox + x * cell + cell / 2, oy + y * cell + cell / 2, Math.max(1.5, cell * 0.23), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }
      const ax = ox + state.agent.x * cell + cell / 2;
      const ay = oy + state.agent.y * cell + cell / 2;
      if (state.target && state.selectedAction !== "REST") {
        ctx.strokeStyle = "rgba(178,63,36,0.7)";
        ctx.setLineDash([2, 3]);
        ctx.strokeRect(ox + state.target.x * cell + 1, oy + state.target.y * cell + 1, cell - 2, cell - 2);
        ctx.setLineDash([]);
      }
      ctx.save();
      ctx.shadowColor = state.agent.alive ? "rgba(178,63,36,0.8)" : "rgba(159,44,27,0.8)";
      ctx.shadowBlur = cell;
      ctx.fillStyle = "#b23f24";
      ctx.beginPath();
      ctx.arc(ax, ay, Math.max(3, cell * 0.3), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = state.agent.alive ? "#b23f24" : "#9f2c1b";
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = "rgba(23,19,13,0.06)";
      ctx.strokeRect(0.5, 0.5, width - 1, width - 1);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [engine]);

  return (
    <Panel id="v02-environment" index="01" title="Environment" subtitle="V0.2 metabolic regime · local 7×7 sensing"
      right={<span className={cn("chip", snapshot.alive ? "text-lab-green" : "text-lab-red")}>{snapshot.alive ? "live" : "dead"}</span>}
      bodyClassName="p-3">
      <div ref={wrap} className="w-full overflow-hidden rounded-md border border-lab-line/80">
        <canvas ref={ref} role="img" aria-label="V0.2 grid environment" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {[
          ["position", `(${snapshot.physical.x}, ${snapshot.physical.y})`],
          ["energy", snapshot.physical.energy.toFixed(1)],
          ["fatigue", snapshot.physical.fatigue.toFixed(2)],
          ["debt", snapshot.physical.metabolicDebt.toFixed(2)],
          ["cost", snapshot.physical.effectiveCost.toFixed(2)],
          ["success", `${(snapshot.physical.effectiveSuccess * 100).toFixed(0)}%`],
          ["exhausted", `${snapshot.physical.exhaustedTicks}`],
          ["resources", `${snapshot.physical.resources}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-lab-line/60 bg-lab-raise/30 px-2 py-1">
            <div className="mono-label">{label}</div>
            <div className="font-mono text-[10px] tabular-nums text-lab-text">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[8px] text-lab-faint">
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-lab-green" /> resource</span>
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-[#d8cdb8]" /> obstacle</span>
        <span>shift: {snapshot.shift}</span>
        <span>t={snapshot.tick}</span>
      </div>
    </Panel>
  );
}

function MetaPanel({ snapshot }: { snapshot: V02Snapshot }) {
  const meta = snapshot.currentMeta;
  const m = snapshot.metaModel;
  return (
    <Panel id="v02-meta-model" index="02" title="Learned meta-model"
      subtitle="predicts observable first-order error and tolerance probability"
      right={<span className="chip text-lab-violet">online · observable targets</span>}
      bodyClassName="p-3">
      <div className="flex items-start gap-3">
        <Ring value={meta?.toleranceProbability ?? 0.5} label="p(tolerance)" color="#634070" caption={`target τ ${(0.45).toFixed(2)}`} />
        <Ring value={meta?.uncertainty ?? 1} label="uncertainty" color="#b23f24" caption="epistemic" />
        <div className="min-w-0 flex-1 space-y-1.5 self-center">
          <Row label="expected |error|" value={(meta?.expectedError ?? 0).toFixed(3)} />
          <Row label="systematic bias" value={(meta?.systematicBias ?? 0).toFixed(2)} />
          <Row label="evidence" value={`${meta?.evidenceCount ?? 0} obs · ${((meta?.evidenceWeight ?? 0) * 100).toFixed(0)}%`} />
          <Row label="learning ×" value={(meta?.learningMultiplier ?? 1).toFixed(2)} />
          <Row label="prior weight" value={(meta?.priorWeight ?? 0.5).toFixed(2)} />
        </div>
      </div>
      <ReliabilityDiagram bins={m.calibrationBins} />
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        <Stat label="Brier" value={snapshot.metrics.metaBrier.toFixed(3)} sub="held-in" />
        <Stat label="ECE" value={snapshot.metrics.metaEce.toFixed(3)} sub="calibration" />
        <Stat label="AUROC" value={snapshot.metrics.metaAuroc === null ? "—" : snapshot.metrics.metaAuroc.toFixed(2)} sub="latent labels" />
        <Stat label="tolerance" value={`${(snapshot.metrics.toleranceRate * 100).toFixed(0)}%`} sub="target rate" />
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-lab-faint">
        Targets are opaque-sample errors from <em>executed</em> actions only. Latent state error is
        never used for training; AUROC against latent failure is evaluation-only. No regime label
        is supplied.
      </p>
    </Panel>
  );
}

function ReliabilityDiagram({ bins }: { bins: V02Snapshot["metaModel"]["calibrationBins"] }) {
  const width = 320;
  const height = 150;
  const left = 28;
  const top = 8;
  const innerW = width - 40;
  const innerH = height - 28;
  return (
    <div className="mt-2 rounded border border-lab-line/60 bg-lab-raise/40 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="mono-label">reliability diagram · tolerance</span>
        <span className="font-mono text-[8px] text-lab-faint">predicted x · observed y</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <line x1={left} x2={left + innerW} y1={top + innerH} y2={top + innerH} stroke="#ded4c1" />
        <line x1={left} x2={left} y1={top} y2={top + innerH} stroke="#ded4c1" />
        <line x1={left} x2={left + innerW} y1={top + innerH} y2={top} stroke="#c6b9a0" strokeDasharray="3 4" />
        {bins.filter((b) => b.count > 0).map((bin, i) => {
          const x = left + bin.predicted * innerW;
          const y = top + (1 - bin.observed) * innerH;
          const r = 2 + Math.min(6, Math.sqrt(bin.count));
          return <circle key={i} cx={x} cy={y} r={r} fill="#634070" fillOpacity="0.8" stroke="#d7c9ff" strokeWidth="0.5" />;
        })}
        <text x={left} y={height - 4} fill="#6f6657" fontSize="7" fontFamily="JetBrains Mono, monospace">0</text>
        <text x={left + innerW - 10} y={height - 4} fill="#6f6657" fontSize="7" fontFamily="JetBrains Mono, monospace">1</text>
        <text x="3" y={top + 5} fill="#6f6657" fontSize="7" fontFamily="JetBrains Mono, monospace">1</text>
        <text x="3" y={top + innerH} fill="#6f6657" fontSize="7" fontFamily="JetBrains Mono, monospace">0</text>
      </svg>
    </div>
  );
}

function StatePanel({ snapshot }: { snapshot: V02Snapshot }) {
  const s = snapshot.selfModel;
  const obs = snapshot.observation;
  const metrics = snapshot.metrics;
  return (
    <Panel id="v02-state" index="03" title="State & self-belief"
      subtitle="instrumented truth is isolated from learning"
      right={<span className="chip">filter {metrics.selfEnergyMae.toFixed(1)}</span>}
      bodyClassName="p-3">
      <div className="overflow-hidden rounded border border-lab-line/70">
        <HeaderRow />
        <StateRow label="energy" actual={snapshot.physical.energy.toFixed(1)} estimate={s.energyEstimate.toFixed(1)} error={metrics.selfEnergyMae.toFixed(1)} />
        <StateRow label="raw sensor" actual={snapshot.physical.energy.toFixed(1)} estimate={(obs?.energyReading ?? 0).toFixed(1)} error={metrics.rawEnergyMae.toFixed(1)} />
        <StateRow label="fatigue" actual={snapshot.physical.fatigue.toFixed(2)} estimate={s.fatigue.toFixed(2)} error={metrics.fatigueMae.toFixed(2)} />
        <StateRow label="cost" actual={snapshot.physical.effectiveCost.toFixed(2)} estimate={s.movementCost.toFixed(2)} error={metrics.costMae.toFixed(2)} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="rounded border border-lab-line/60 bg-lab-raise/25 p-2">
          <div className="mono-label">sensor channels</div>
          <div className="font-mono text-[10px] text-lab-text">E {(obs?.energyReading ?? 0).toFixed(1)}</div>
          <div className="font-mono text-[10px] text-lab-text">F {(obs?.strainReading ?? 0).toFixed(3)}</div>
          <div className="font-mono text-[10px] text-lab-text">effort {obs?.lastEffortReading?.toFixed(2) ?? "—"}</div>
        </div>
        <div className="rounded border border-lab-line/60 bg-lab-raise/25 p-2">
          <div className="mono-label">sensor model</div>
          <div className="font-mono text-[9px] text-lab-muted">bias {s.energyBias.toFixed(2)}</div>
          <div className="font-mono text-[9px] text-lab-muted">noise var {s.energyNoiseVariance.toFixed(2)}</div>
          <div className="font-mono text-[9px] text-lab-muted">confidence {(s.confidence * 100).toFixed(0)}%</div>
        </div>
      </div>
      <div className="mt-2 rounded border border-lab-line/60 bg-lab-raise/20 p-2">
        <div className="mono-label">readable self coefficients</div>
        <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[8px]">
          <span className="text-lab-faint">cost</span><span className="text-right text-lab-muted">{s.movementCost.toFixed(2)}</span>
          <span className="text-lab-faint">rest</span><span className="text-right text-lab-muted">{s.restGain.toFixed(2)}</span>
          <span className="text-lab-faint">collect</span><span className="text-right text-lab-muted">{s.collectGain.toFixed(1)}</span>
          <span className="text-lab-faint">move fatigue</span><span className="text-right text-lab-muted">{s.moveFatigueRate.toFixed(3)}</span>
          <span className="text-lab-faint">rest relief</span><span className="text-right text-lab-muted">{s.restReliefRate.toFixed(3)}</span>
          <span className="text-lab-faint">innovation</span><span className="text-right text-lab-muted">{s.innovation.toFixed(2)}</span>
        </div>
      </div>
    </Panel>
  );
}

function HeaderRow() {
  return (
    <div className="grid grid-cols-[1.2fr_.8fr_.8fr_.6fr] gap-1 border-b border-lab-line/70 bg-lab-raise/40 px-2 py-1 font-mono text-[7px] uppercase tracking-[0.06em] text-lab-faint">
      <span>quantity</span><span className="text-right">truth</span><span className="text-right">belief</span><span className="text-right">|err|</span>
    </div>
  );
}
function StateRow({ label, actual, estimate, error }: { label: string; actual: string; estimate: string; error: string }) {
  return (
    <div className="grid grid-cols-[1.2fr_.8fr_.8fr_.6fr] gap-1 border-b border-lab-line/40 px-2 py-1.5 font-mono text-[9px] tabular-nums last:border-0">
      <span className="text-lab-muted">{label}</span>
      <span className="text-right text-lab-text">{actual}</span>
      <span className="text-right text-lab-cyan">{estimate}</span>
      <span className="text-right text-lab-amber">{error}</span>
    </div>
  );
}

function MetricsPanel({ snapshot, series }: { snapshot: V02Snapshot; series: readonly V02SeriesPoint[] }) {
  const values = (key: keyof V02SeriesPoint) => series.map((p) => (typeof p[key] === "number" ? (p[key] as number) : null));
  return (
    <Panel id="v02-measurements" index="04" title="V0.2 measurements"
      subtitle="estimation, reliability and exploration traces"
      right={<span className="chip">{series.length} ticks</span>}
      bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
        <Stat label="survival" value={`${snapshot.tick}`} sub={`${snapshot.physical.resources} resources`} />
        <Stat label="self MAE" value={snapshot.metrics.selfEnergyMae.toFixed(2)} sub={`raw ${snapshot.metrics.rawEnergyMae.toFixed(2)}`} color="#1d5c67" />
        <Stat label="meta Brier" value={snapshot.metrics.metaBrier.toFixed(3)} sub={`ECE ${snapshot.metrics.metaEce.toFixed(3)}`} color="#634070" />
        <Stat label="AUROC" value={snapshot.metrics.metaAuroc === null ? "—" : snapshot.metrics.metaAuroc.toFixed(2)} sub="latent failure" color="#b23f24" />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded border border-lab-line/60 bg-lab-raise/20 p-2">
          <div className="mono-label mb-1">energy · truth / learned / raw</div>
          <Plot
            series={[
              { key: "e", label: "truth", color: "#39643f", values: values("energy"), fill: true },
              { key: "est", label: "learned", color: "#1d5c67", values: values("energyEstimate"), dashed: true },
              { key: "raw", label: "raw", color: "#6f6657", values: values("rawEnergyReading") },
            ]}
            min={0}
            max={120}
            formatValue={(v) => v.toFixed(0)}
            ariaLabel="V0.2 energy, learned estimate and raw sensor"
          />
        </div>
        <div className="rounded border border-lab-line/60 bg-lab-raise/20 p-2">
          <div className="mono-label mb-1">error · learned vs raw</div>
          <Plot
            series={[
              { key: "est", label: "learned", color: "#1d5c67", values: values("energyError") },
              { key: "raw", label: "raw", color: "#6f6657", values: values("rawEnergyError"), dashed: true },
            ]}
            min={0}
            formatValue={(v) => v.toFixed(1)}
            ariaLabel="Learned and raw energy error"
          />
        </div>
        <div className="rounded border border-lab-line/60 bg-lab-raise/20 p-2">
          <div className="mono-label mb-1">meta · tolerance probability / uncertainty</div>
          <Plot
            series={[
              { key: "p", label: "p(tol)", color: "#634070", values: values("predictedTolerance") },
              { key: "u", label: "uncertainty", color: "#b23f24", values: values("predictionUncertainty"), dashed: true },
            ]}
            min={0}
            max={1}
            formatValue={(v) => v.toFixed(1)}
            ariaLabel="Meta-model tolerance probability and uncertainty"
          />
        </div>
        <div className="rounded border border-lab-line/60 bg-lab-raise/20 p-2">
          <div className="mono-label mb-1">information / decision value</div>
          <Plot
            series={[
              { key: "i", label: "information", color: "#1d5c67", values: values("infoValue") },
              { key: "v", label: "VoI", color: "#b23f24", values: values("voi"), dashed: true },
            ]}
            min={0}
            formatValue={(v) => v.toFixed(2)}
            ariaLabel="Information value and decision value of information"
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-lab-line/60 pt-2 font-mono text-[8px] text-lab-faint">
        <span>mean uncertainty <span className="text-lab-muted">{snapshot.metrics.meanUncertainty.toFixed(2)}</span></span>
        <span>mean info <span className="text-lab-muted">{snapshot.metrics.meanInfoValue.toFixed(2)}</span></span>
        <span>mean VoI <span className="text-lab-muted">{snapshot.metrics.meanVoi.toFixed(2)}</span></span>
        <span>action entropy <span className="text-lab-muted">{snapshot.metrics.actionEntropy.toFixed(2)}</span></span>
        <span>coverage <span className="text-lab-muted">{(snapshot.metrics.explorationCoverage * 100).toFixed(0)}%</span></span>
      </div>
    </Panel>
  );
}

function ExplorationPanel({ snapshot }: { snapshot: V02Snapshot }) {
  const sel = snapshot.selection;
  const maxU = sel ? Math.max(...sel.utilities) : 1;
  return (
    <Panel id="v02-epistemic" index="05" title="Epistemic control"
      subtitle="pragmatic value + λ · information value"
      right={<span className="chip text-lab-amber">{snapshot.explorationMode}</span>}
      bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-1.5">
        <Stat label="info gain" value={snapshot.metrics.infoGain.toFixed(3)} sub="uncertainty reduction" color="#1d5c67" />
        <Stat label="VoI" value={snapshot.metrics.meanVoi.toFixed(3)} sub="decision-relevant" color="#b23f24" />
      </div>
      <div className="mt-2 overflow-hidden rounded border border-lab-line/60">
        <div className="grid grid-cols-[30px_1fr_1fr_1fr] gap-1 border-b border-lab-line/60 bg-lab-raise/40 px-2 py-1 font-mono text-[7px] uppercase text-lab-faint">
          <span>act</span><span className="text-right">pragmatic</span><span className="text-right">info</span><span className="text-right">utility</span>
        </div>
        {snapshot.predictions.map((p, i) => {
          const selected = sel?.actionIndex === i;
          return (
            <div key={p.action} className={cn("grid grid-cols-[30px_1fr_1fr_1fr] gap-1 px-2 py-1 font-mono text-[8px] tabular-nums", selected ? "bg-lab-amber/[0.07] text-lab-text" : "text-lab-muted")}>
              <span style={{ color: ACTION_COLORS[p.action] }}>{p.action.slice(0, 2)}</span>
              <span className="text-right">{sel?.pragmaticUtilities[i].toFixed(2) ?? "—"}</span>
              <span className="text-right">{sel?.informationValues[i].toFixed(2) ?? "—"}</span>
              <span className="text-right">{sel?.utilities[i].toFixed(2) ?? "—"}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 rounded border border-lab-line/60 bg-lab-raise/20 p-2">
        <div className="flex items-center justify-between">
          <span className="mono-label">selected action</span>
          <span className="font-mono text-[10px] text-lab-text">{sel?.action ?? "—"}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-lab-bg">
          <div className="h-full rounded-full bg-lab-amber" style={{ width: `${sel ? Math.max(0, (sel.utilities[sel.actionIndex] / maxU) * 100) : 0}%` }} />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[8px] text-lab-faint">
          <span>{sel?.randomized ? "random probe" : "softmax"}</span>
          <span>safety blocked {sel?.safetyBlocked ?? 0}/5</span>
          <span>lambda {snapshot.lambda.toFixed(2)}</span>
        </div>
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-lab-faint">
        Exploration adds a separate epistemic term; safety constraints veto information bonuses when
        predicted energy or fatigue is critical. Random probes are a control condition, notlearned.
      </p>
    </Panel>
  );
}

function AttributionPanel({ snapshot }: { snapshot: V02Snapshot }) {
  const a = snapshot.attribution;
  const entries = [
    ["physical", a.physical],
    ["energy_sensor", a.energy_sensor],
    ["fatigue_sensor", a.fatigue_sensor],
    ["shared", a.shared],
    ["insufficient", a.insufficient],
  ] as const;
  return (
    <Panel id="v02-attribution" index="06" title="Failure attribution"
      subtitle="observable channel signatures · no regime labels"
      right={<span className="chip">{ATTRIBUTION_LABELS[a.top]}</span>}
      bodyClassName="p-3">
      <div className="space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key}>
            <div className="flex justify-between font-mono text-[8px]">
              <span className={a.top === key ? "text-lab-text" : "text-lab-muted"}>{ATTRIBUTION_LABELS[key]}</span>
              <span className="tabular-nums text-lab-faint">{(value * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-lab-raise">
              <div className="h-full rounded" style={{ width: `${value * 100}%`, background: a.top === key ? "#634070" : "#a89e8d" }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[8px]">
        <span className="text-lab-faint">confidence</span><span className="text-right text-lab-muted">{(a.confidence * 100).toFixed(0)}%</span>
        <span className="text-lab-faint">evidence</span><span className="text-right text-lab-muted">{a.evidenceCount}</span>
        <span className="text-lab-faint">energy innov.</span><span className="text-right text-lab-muted">{snapshot.channelStats.energyInnovationEma.toFixed(2)}</span>
        <span className="text-lab-faint">strain resid.</span><span className="text-right text-lab-muted">{snapshot.channelStats.strainResidualEma.toFixed(2)}</span>
        <span className="text-lab-faint">effort resid.</span><span className="text-right text-lab-muted">{snapshot.channelStats.effortResidualEma.toFixed(2)}</span>
        <span className="text-lab-faint">slip Brier</span><span className="text-right text-lab-muted">{snapshot.channelStats.slipBrierEma.toFixed(2)}</span>
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-lab-faint">
        Attribution is diagnostic only. It uses signed innovations, variance changes and slip
        calibration; it never reads the scenario label. The learned meta-model, not this readout,
        modulates the loop.
      </p>
    </Panel>
  );
}

function EventPanel({ events }: { events: V02Snapshot["events"] }) {
  const list = [...events].reverse().slice(0, 80);
  return (
    <Panel id="v02-event-log" index="07" title="Event log" subtitle="measured shifts, beliefs and model updates"
      right={<span className="chip">{events.length}</span>} bodyClassName="p-0">
      <div className="max-h-[320px] overflow-y-auto px-3 py-1 scroll-thin">
        {list.length === 0 ? (
          <div className="grid h-[160px] place-items-center font-mono text-[9px] uppercase tracking-[0.12em] text-lab-faint">no events yet</div>
        ) : (
          <ul className="divide-y divide-lab-line/40">
            {list.map((event, i) => (
              <li key={i} className="flex gap-2 py-1.5">
                <span className="font-mono text-[8px] tabular-nums text-lab-faint">t{event.tick}</span>
                <span className="mt-[4px] h-1.5 w-1.5 shrink-0 rounded-full bg-lab-violet/80" />
                <p className="text-[10px] leading-snug text-lab-muted">{event.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 font-mono text-[9px]">
      <span className="text-lab-faint">{label}</span>
      <span className="text-lab-muted">{value}</span>
    </div>
  );
}
