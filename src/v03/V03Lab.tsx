import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Target,
  Zap,
} from "lucide-react";
import { ACTION_COLORS } from "../simulation/config";
import { V03Engine } from "../simulation/v03/engine";
import { EXPLORATION_LABELS, SCENARIO_LABELS } from "../simulation/v03/config";
import {
  ATTRIBUTION_LABELS,
  type AttributionKind,
  type Difficulty,
  type ExplorationMode,
  type PriorRegime,
  type Scenario,
  type V03SeriesPoint,
  type V03Snapshot,
} from "../simulation/v03/types";
import { Panel } from "../components/ui/Panel";
import { Plot } from "../components/ui/Plot";
import { Ring, Stat, Toggle } from "../components/ui/Primitives";
import { cn } from "../lib/cn";
import { fmt } from "../ui/format";
import { useV03Simulation } from "./useV03Simulation";

const TABS: { key: Difficulty; label: string }[] = [
  { key: "docile", label: "Docile" },
  { key: "standard", label: "Standard" },
  { key: "harsh", label: "Harsh" },
];

const INTERVENTIONS: {
  kind: "physical" | "energy_sensor" | "fatigue_sensor" | "shared";
  label: string;
}[] = [
  { kind: "physical", label: "physical shift" },
  { kind: "energy_sensor", label: "energy sensor noise/bias" },
  { kind: "fatigue_sensor", label: "fatigue sensor noise/bias" },
  { kind: "shared", label: "shared degradation" },
];

const ATTRIBUTION_KEYS: AttributionKind[] = [
  "physical",
  "energy_sensor",
  "fatigue_sensor",
  "shared",
  "insufficient",
];

export function V03Lab({ onBack }: { onBack: () => void }) {
  const controller = useV03Simulation();
  const { engine, snapshot, series, events, settings, running, flash, actions } = controller;
  const [seedDraft, setSeedDraft] = useState(String(settings.seed));

  useEffect(() => setSeedDraft(String(settings.seed)), [settings.seed]);

  const applySeed = () => {
    const parsed = Number(seedDraft.replace(/[^0-9]/g, ""));
    if (parsed > 0) actions.resetWith({ seed: parsed });
  };

  const ablations = [
    {
      label: "meta feedback",
      hint: "meta → selection & rates",
      checked: settings.metaFeedback,
      onToggle: () => actions.resetWith({ metaFeedback: !settings.metaFeedback }),
    },
    {
      label: "risk control",
      hint: "error bound → risk margin",
      checked: settings.riskControl,
      onToggle: () => actions.resetWith({ riskControl: !settings.riskControl }),
    },
    {
      label: "residual meta",
      hint: "bias-aware predictions",
      checked: settings.residualMeta,
      onToggle: () => actions.resetWith({ residualMeta: !settings.residualMeta }),
    },
    {
      label: "world model",
      hint: "predict collisions & gains",
      checked: settings.worldModelEnabled,
      onToggle: () => actions.resetWith({ worldModelEnabled: !settings.worldModelEnabled }),
    },
    {
      label: "world learning",
      hint: "update world weights",
      checked: settings.worldLearning,
      onToggle: () => actions.resetWith({ worldLearning: !settings.worldLearning }),
    },
    {
      label: "self learning",
      hint: "update self-model",
      checked: settings.selfLearning,
      onToggle: () => actions.resetWith({ selfLearning: !settings.selfLearning }),
    },
    {
      label: "self feedback",
      hint: "self-model → utilities",
      checked: settings.selfFeedback,
      onToggle: () => actions.resetWith({ selfFeedback: !settings.selfFeedback }),
    },
    {
      label: "evidence link",
      hint: "fresh interoception",
      checked: settings.evidenceLink,
      onToggle: () => actions.resetWith({ evidenceLink: !settings.evidenceLink }),
    },
  ];

  return (
    <div className="min-h-screen">
      <header className="relative border-b border-lab-line/80">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-6">
          <button className="icon-btn" onClick={onBack} title="Switch to V0" aria-label="Switch to V0">
            <ArrowLeft size={14} />
          </button>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="font-serif text-[26px] leading-none text-lab-text">Strange Loop</h1>
              <span className="rounded border border-lab-blue/35 bg-lab-blue/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-lab-blue">
                V0.3
              </span>
            </div>
            <p className="mt-1 font-mono text-[9px] text-lab-faint">
              residual meta-model · temporal attribution · risk &amp; probes
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className={cn("chip", running ? "text-lab-green" : "text-lab-amber")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", running ? "bg-lab-green" : "bg-lab-amber")} />
              {!snapshot.alive ? "terminated" : running ? "running" : "paused"}
            </span>
            <span className="chip">
              seed <span className="text-lab-text">{settings.seed}</span>
            </span>
            <button className="btn h-8" onClick={actions.toggleRunning} disabled={!snapshot.alive}>
              {running ? <Pause size={13} /> : <Play size={13} />}
              {running ? "Pause" : "Run"}
            </button>
            <button className="btn h-8" onClick={actions.step} disabled={!snapshot.alive}>
              <SkipForward size={13} /> Step
            </button>
            <button className="btn h-8" onClick={actions.phase} disabled={!snapshot.alive}>
              Phase
            </button>
            <button className="btn h-8" onClick={actions.reset}>
              <RotateCcw size={13} /> Reset
            </button>
            <button className="btn h-8 border-lab-line2" onClick={onBack}>
              V0
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-3 px-3 py-3 sm:px-4">
        <section className="panel">
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
                className="h-1 w-20 accent-lab-blue"
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
          <div className="flex flex-wrap items-center gap-2 border-b border-lab-line/60 px-3.5 py-2">
            <span className="mono-label">interventions</span>
            {INTERVENTIONS.map((item) => (
              <button
                key={item.kind}
                className="btn h-7 px-2 py-0 normal-case tracking-normal"
                onClick={() => actions.trigger(item.kind)}
              >
                <Zap size={11} /> {item.label}
              </button>
            ))}
            <button
              className="btn h-7 border-lab-red/30 px-2 py-0 normal-case tracking-normal text-lab-red"
              onClick={actions.injectTrap}
            >
              <Target size={11} /> inject pessimistic rough-cost trap
            </button>
            <button
              className="btn h-7 border-lab-cyan/30 px-2 py-0 normal-case tracking-normal text-lab-cyan"
              onClick={actions.injectPulse}
            >
              <Activity size={11} /> inject 1-tick interoceptive pulse
            </button>
            <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.1em] text-lab-faint">
              t={snapshot.tick} · {snapshot.phaseName} · {snapshot.shift === "none" ? "no shift" : snapshot.shift}
            </span>
            {flash ? (
              <span className="rounded border border-lab-blue/30 bg-lab-blue/10 px-2 py-1 font-mono text-[8px] text-lab-blue">
                {flash}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3.5 py-2">
            <span className="mono-label">ablations</span>
            {ablations.map((ablation) => (
              <Toggle
                key={ablation.label}
                label={ablation.label}
                hint={ablation.hint}
                checked={ablation.checked}
                onChange={ablation.onToggle}
              />
            ))}
            <span className="hidden h-5 w-px bg-lab-line lg:block" />
            <Toggle
              label="pessimistic trap"
              hint="rough cost prior 25"
              checked={settings.beliefTrap !== "none"}
              onChange={() =>
                actions.resetWith({
                  beliefTrap: settings.beliefTrap === "none" ? "pessimistic_cost" : "none",
                })
              }
            />
            <span className="ml-auto font-mono text-[8px] text-lab-faint">
              each ablation rebuilds the run deterministically from the seed
            </span>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <V03Environment engine={engine} snapshot={snapshot} />
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
            <ResidualMetaPanel snapshot={snapshot} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <RoughTerrainPanel snapshot={snapshot} series={series} onInjectTrap={actions.injectTrap} />
          </div>
          <div className="lg:col-span-7">
            <RiskPanel snapshot={snapshot} series={series} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <ProbePanel snapshot={snapshot} series={series} onInjectPulse={actions.injectPulse} />
          </div>
          <div className="lg:col-span-7">
            <EventPanel events={events} />
          </div>
        </div>
        <footer className="border-t border-lab-line/60 px-1 pb-5 pt-3 text-[9px] leading-relaxed text-lab-faint">
          V0.3 is a research instrument, not a consciousness claim. Reliability, skill and AUROC are
          computed against observable outcomes; latent errors, shadow probes and regime labels remain
          evaluation-only. Ablation toggles rebuild the same seed without a feedback edge, so a
          difference between runs is causal, not a different random stream. V0.2 and V0 stay
          available through their switches.
        </footer>
      </main>
    </div>
  );
}

function V03Environment({ engine, snapshot }: { engine: V03Engine; snapshot: V03Snapshot }) {
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
      ctx.fillStyle = "#0a0b0c";
      ctx.fillRect(0, 0, width, width);
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 30; x++) {
          const t = state.cells[y * 30 + x];
          if (t === 1) {
            ctx.fillStyle = "#24282d";
            ctx.fillRect(ox + x * cell + 0.5, oy + y * cell + 0.5, cell - 1, cell - 1);
          } else if (t === 2) {
            ctx.save();
            ctx.shadowColor = "rgba(92,219,149,0.7)";
            ctx.shadowBlur = cell;
            ctx.fillStyle = "#5cdb95";
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
        ctx.strokeStyle = "rgba(240,163,94,0.7)";
        ctx.setLineDash([2, 3]);
        ctx.strokeRect(ox + state.target.x * cell + 1, oy + state.target.y * cell + 1, cell - 2, cell - 2);
        ctx.setLineDash([]);
      }
      ctx.save();
      ctx.shadowColor = state.agent.alive ? "rgba(240,163,94,0.8)" : "rgba(255,111,111,0.8)";
      ctx.shadowBlur = cell;
      ctx.fillStyle = "#111416";
      ctx.beginPath();
      ctx.arc(ax, ay, Math.max(3, cell * 0.3), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = state.agent.alive ? "#f0a35e" : "#ff6f6f";
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.strokeRect(0.5, 0.5, width - 1, width - 1);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [engine]);

  return (
    <Panel index="01" title="Environment" subtitle="V0.3 metabolic regime · local 7×7 sensing"
      right={<span className={cn("chip", snapshot.alive ? "text-lab-green" : "text-lab-red")}>{snapshot.alive ? "live" : "dead"}</span>}
      bodyClassName="p-3">
      <div ref={wrap} className="w-full overflow-hidden rounded-md border border-lab-line/80">
        <canvas ref={ref} role="img" aria-label="V0.3 grid environment" />
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
        <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-[#24282d]" /> obstacle</span>
        <span>shift: {snapshot.shift}</span>
        <span>trap: {snapshot.beliefTrap ?? "none"}</span>
        <span>t={snapshot.tick}</span>
      </div>
    </Panel>
  );
}

function MetaPanel({ snapshot }: { snapshot: V03Snapshot }) {
  const meta = snapshot.currentMeta;
  const m = snapshot.metaModel;
  return (
    <Panel index="02" title="Residual meta-model"
      subtitle="predicts observable error, bias and persistent failure"
      right={<span className="chip text-lab-blue">online · observable targets</span>}
      bodyClassName="p-3">
      <div className="flex items-start gap-3">
        <Ring value={meta?.toleranceProbability ?? 0.5} label="p(tolerance)" color="#7aa2ff" caption="target τ 0.45" />
        <Ring value={meta?.uncertainty ?? 1} label="uncertainty" color="#f0a35e" caption="epistemic" />
        <div className="min-w-0 flex-1 space-y-1.5 self-center">
          <Row label="expected |error|" value={(m.expectedError).toFixed(3)} />
          <Row label="error bound" value={m.errorBound.toFixed(2)} />
          <Row label="bias correction" value={signed(m.biasCorrection)} />
          <Row label="p(persistent fail)" value={m.failureProbability.toFixed(2)} />
          <Row label="evidence" value={`${m.observations} obs · ${m.evidenceCount} repeats`} />
        </div>
      </div>
      <ReliabilityDiagram bins={m.calibrationBins} />
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        <Stat label="Brier" value={snapshot.metrics.metaBrier.toFixed(3)} sub="online" />
        <Stat label="ECE" value={snapshot.metrics.metaEce.toFixed(3)} sub="calibration" />
        <Stat label="rolling BSS" value={signed(snapshot.metrics.rollingBss)} sub="vs baseline" color="#7aa2ff" />
        <Stat label="latent AUROC" value={fmt(snapshot.metrics.latentAuroc, 2)} sub="eval only" color="#f0a35e" />
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-lab-faint">
        Targets are opaque-sample errors from <em>executed</em> actions only. Bias correction and the
        rolling baseline are explicit terms, so the learned head must beat a 1-parameter tracker to
        earn positive skill. Latent failure labels are never used for training.
      </p>
    </Panel>
  );
}

function ReliabilityDiagram({ bins }: { bins: V03Snapshot["metaModel"]["calibrationBins"] }) {
  const width = 320;
  const height = 148;
  const left = 28;
  const right = 8;
  const top = 8;
  const innerW = width - left - right;
  const innerH = 96;
  const axisY = top + innerH;
  const stripTop = axisY + 14;
  const stripH = 24;
  const maxCount = Math.max(1, ...bins.map((bin) => bin.count));
  return (
    <div className="mt-2 rounded border border-lab-line/60 bg-[#0a0c0e] p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="mono-label">reliability diagram · tolerance</span>
        <span className="font-mono text-[8px] text-lab-faint">predicted x · observed y</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {[0, 0.5, 1].map((tick) => (
          <line
            key={tick}
            x1={left}
            x2={left + innerW}
            y1={top + (1 - tick) * innerH}
            y2={top + (1 - tick) * innerH}
            stroke="#1e2227"
            strokeWidth="0.7"
          />
        ))}
        <line x1={left} x2={left + innerW} y1={axisY} y2={axisY} stroke="#2c3138" />
        <line x1={left} x2={left} y1={top} y2={axisY} stroke="#2c3138" />
        <line x1={left} x2={left + innerW} y1={axisY} y2={top} stroke="#3a4048" strokeDasharray="3 4" />
        {bins.map((bin, index) => {
          const barW = innerW / bins.length;
          const barH = (bin.count / maxCount) * stripH;
          return (
            <rect
              key={`bar-${index}`}
              x={left + index * barW + 1.5}
              y={stripTop + stripH - barH}
              width={Math.max(1, barW - 3)}
              height={barH}
              rx="1"
              fill={bin.count > 0 ? "#2c3138" : "#161a1e"}
            />
          );
        })}
        {bins.filter((bin) => bin.count > 0).map((bin) => {
          const x = left + bin.predicted * innerW;
          const y = top + (1 - bin.observed) * innerH;
          const r = 2 + Math.min(5, Math.sqrt(bin.count));
          return (
            <circle
              key={`point-${bin.low}`}
              cx={x}
              cy={y}
              r={r}
              fill="#7aa2ff"
              fillOpacity="0.8"
              stroke="#c3d3ff"
              strokeWidth="0.5"
            />
          );
        })}
        <text x={left + innerW} y={stripTop - 3} textAnchor="end" fill="#5b626b" fontSize="6.5" fontFamily="JetBrains Mono, monospace">
          bin count · max {maxCount}
        </text>
        <text x={left} y={axisY + 9} fill="#5b626b" fontSize="7" fontFamily="JetBrains Mono, monospace">0</text>
        <text x={left + innerW - 10} y={axisY + 9} fill="#5b626b" fontSize="7" fontFamily="JetBrains Mono, monospace">1</text>
        <text x="3" y={top + 5} fill="#5b626b" fontSize="7" fontFamily="JetBrains Mono, monospace">1</text>
        <text x="3" y={axisY} fill="#5b626b" fontSize="7" fontFamily="JetBrains Mono, monospace">0</text>
      </svg>
    </div>
  );
}

function StatePanel({ snapshot }: { snapshot: V03Snapshot }) {
  const s = snapshot.selfModel;
  const obs = snapshot.observation;
  const metrics = snapshot.metrics;
  return (
    <Panel index="03" title="State & self-belief"
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
          <span className="text-lab-faint">rough cost</span><span className="text-right text-lab-muted">{s.roughCost.toFixed(2)}</span>
          <span className="text-lab-faint">rough obs</span><span className="text-right text-lab-muted">{s.roughObservations}</span>
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

function MetricsPanel({ snapshot, series }: { snapshot: V03Snapshot; series: readonly V03SeriesPoint[] }) {
  const values = (key: keyof V03SeriesPoint) => series.map((p) => (typeof p[key] === "number" ? (p[key] as number) : null));
  return (
    <Panel index="04" title="V0.3 measurements"
      subtitle="estimation, reliability, residual skill and exploration traces"
      right={<span className="chip">{series.length} ticks</span>}
      bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
        <Stat label="survival" value={`${snapshot.tick}`} sub={`${snapshot.physical.resources} resources`} />
        <Stat label="self MAE" value={snapshot.metrics.selfEnergyMae.toFixed(2)} sub={`raw ${snapshot.metrics.rawEnergyMae.toFixed(2)}`} color="#5fd0e3" />
        <Stat label="meta Brier" value={snapshot.metrics.metaBrier.toFixed(3)} sub={`ECE ${snapshot.metrics.metaEce.toFixed(3)}`} color="#7aa2ff" />
        <Stat label="rolling BSS" value={signed(snapshot.metrics.rollingBss)} sub={`AUROC ${fmt(snapshot.metrics.latentAuroc, 2)}`} color="#f0a35e" />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded border border-lab-line/60 bg-lab-raise/20 p-2">
          <div className="mono-label mb-1">energy · truth / learned / raw</div>
          <Plot
            series={[
              { key: "e", label: "truth", color: "#5cdb95", values: values("energy"), fill: true },
              { key: "est", label: "learned", color: "#5fd0e3", values: values("energyEstimate"), dashed: true },
              { key: "raw", label: "raw", color: "#8b929b", values: values("rawEnergyReading") },
            ]}
            min={0}
            max={120}
            formatValue={(v) => v.toFixed(0)}
            ariaLabel="V0.3 energy, learned estimate and raw sensor"
          />
          <PulseRail series={series} />
        </div>
        <div className="rounded border border-lab-line/60 bg-lab-raise/20 p-2">
          <div className="mono-label mb-1">error · learned vs raw</div>
          <Plot
            series={[
              { key: "est", label: "learned", color: "#5fd0e3", values: values("energyError") },
              { key: "raw", label: "raw", color: "#8b929b", values: values("rawEnergyError"), dashed: true },
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
              { key: "p", label: "p(tol)", color: "#7aa2ff", values: values("predictedTolerance") },
              { key: "u", label: "uncertainty", color: "#f0a35e", values: values("predictionUncertainty"), dashed: true },
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
              { key: "i", label: "information", color: "#5fd0e3", values: values("infoValue") },
              { key: "v", label: "VoI", color: "#f0a35e", values: values("voi"), dashed: true },
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
        <span>rough MAE <span className="text-lab-muted">{snapshot.metrics.roughCostMae.toFixed(2)}</span></span>
      </div>
    </Panel>
  );
}

function PulseRail({ series }: { series: readonly V03SeriesPoint[] }) {
  const recent = series.slice(-140);
  const pulses = recent.filter((point) => point.pulseActive).length;
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <span className="mono-label shrink-0">pulse</span>
      <div className="flex h-1.5 flex-1 items-stretch gap-px overflow-hidden rounded-sm bg-lab-bg">
        {recent.map((point) => (
          <span
            key={point.t}
            className={cn("flex-1", point.pulseActive ? "bg-lab-cyan" : "bg-lab-line/70")}
          />
        ))}
      </div>
      <span className="shrink-0 font-mono text-[8px] tabular-nums text-lab-faint">{pulses}</span>
    </div>
  );
}

function ExplorationPanel({ snapshot }: { snapshot: V03Snapshot }) {
  const sel = snapshot.selection;
  const maxU = sel ? Math.max(...sel.utilities) : 1;
  return (
    <Panel index="05" title="Epistemic control"
      subtitle="pragmatic value + λ · information value"
      right={<span className="chip text-lab-amber">{snapshot.explorationMode}</span>}
      bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-1.5">
        <Stat label="info gain" value={snapshot.metrics.infoGain.toFixed(3)} sub="uncertainty reduction" color="#5fd0e3" />
        <Stat label="VoI" value={snapshot.metrics.meanVoi.toFixed(3)} sub="decision-relevant" color="#f0a35e" />
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
        predicted energy or fatigue is critical. Random probes are a control condition, not learned.
      </p>
    </Panel>
  );
}

function AttributionPanel({ snapshot }: { snapshot: V03Snapshot }) {
  const a = snapshot.attribution;
  const stats = snapshot.channelStats;
  return (
    <Panel index="06" title="Temporal attribution"
      subtitle="signed innovations · temporal signatures · no regime labels"
      right={<span className="chip text-lab-blue">{ATTRIBUTION_LABELS[a.top]}</span>}
      bodyClassName="p-3">
      <div className="space-y-1.5">
        {ATTRIBUTION_KEYS.map((key) => {
          const value = a[key];
          return (
            <div key={key}>
              <div className="flex justify-between font-mono text-[8px]">
                <span className={a.top === key ? "text-lab-text" : "text-lab-muted"}>{ATTRIBUTION_LABELS[key]}</span>
                <span className="tabular-nums text-lab-faint">{(value * 100).toFixed(0)}%</span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-lab-raise">
                <div className="h-full rounded" style={{ width: `${value * 100}%`, background: a.top === key ? "#7aa2ff" : "#4b525a" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[8px]">
        <span className="text-lab-faint">confidence</span><span className="text-right text-lab-muted">{(a.confidence * 100).toFixed(0)}%</span>
        <span className="text-lab-faint">evidence</span><span className="text-right text-lab-muted">{a.evidenceCount}</span>
        <span className="text-lab-faint">energy innov.</span><span className="text-right text-lab-muted">{stats.energyInnovation.toFixed(2)}</span>
        <span className="text-lab-faint">energy innov. ema</span><span className="text-right text-lab-muted">{stats.energyInnovationEma.toFixed(2)}</span>
        <span className="text-lab-faint">energy volatility</span><span className="text-right text-lab-muted">{stats.energyInnovationVolatility.toFixed(2)}</span>
        <span className="text-lab-faint">strain residual</span><span className="text-right text-lab-muted">{stats.strainResidualEma.toFixed(2)}</span>
        <span className="text-lab-faint">effort residual</span><span className="text-right text-lab-muted">{stats.effortResidualEma.toFixed(2)}</span>
        <span className="text-lab-faint">slip Brier</span><span className="text-right text-lab-muted">{stats.slipBrierEma.toFixed(2)}</span>
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-lab-faint">
        Attribution is diagnostic only. It accumulates signed innovations, variance changes and slip
        calibration over a short temporal window; it never reads the scenario label. The learned
        meta-model, not this readout, modulates the loop.
      </p>
    </Panel>
  );
}

function ResidualMetaPanel({ snapshot }: { snapshot: V03Snapshot }) {
  const m = snapshot.metaModel;
  const metrics = snapshot.metrics;
  return (
    <Panel index="07" title="Residual meta diagnostics"
      subtitle="baseline, residual weight and persistent-failure head"
      right={<span className="chip text-lab-blue">{m.observations} targets</span>}
      bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
        <Stat label="rolling base" value={m.rollingBase.toFixed(2)} sub="1-param tracker" color="#8b929b" />
        <Stat label="residual weight" value={m.residualWeight.toFixed(2)} sub="contextual share" color="#7aa2ff" />
        <Stat label="expected |error|" value={m.expectedError.toFixed(3)} sub={`bound ${m.errorBound.toFixed(2)}`} color="#5fd0e3" />
        <Stat label="bias correction" value={signed(m.biasCorrection)} sub={`persistent ${signed(m.persistentBias)}`} color="#f0a35e" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="rounded border border-lab-line/60 bg-lab-raise/20 p-2">
          <div className="mono-label">failure head</div>
          <div className="mt-1 space-y-1 font-mono text-[8px]">
            <Row label="p(persistent fail)" value={m.failureProbability.toFixed(3)} />
            <Row label="persistent bias" value={signed(m.persistentBias)} />
            <Row label="volatility" value={m.volatility.toFixed(3)} />
            <Row label="prior weight" value={m.priorWeight.toFixed(2)} />
            <Row label="learning ×" value={m.learningMultiplier.toFixed(2)} />
          </div>
        </div>
        <div className="rounded border border-lab-line/60 bg-lab-raise/20 p-2">
          <div className="mono-label">skill vs baseline</div>
          <div className="mt-1 space-y-1 font-mono text-[8px]">
            <Row label="rolling BSS" value={signed(metrics.rollingBss, 3)} />
            <Row label="latent AUROC" value={fmt(metrics.latentAuroc, 2)} />
            <Row label="Brier" value={m.brier.toFixed(3)} />
            <Row label="log loss" value={m.logLoss.toFixed(3)} />
          </div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Stat label="tolerance rate" value={`${(metrics.toleranceRate * 100).toFixed(0)}%`} sub={`target ${(m.toleranceRate * 100).toFixed(0)}%`} />
        <Stat label="mean influence" value={metrics.meanInfluence.toFixed(2)} sub="meta → self" color="#7aa2ff" />
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-lab-faint">
        Positive BSS means the contextual/biased head beats the model's own rolling baseline on the
        same observations. Persistent-failure predictions are scored against latent failure only for
        evaluation; the online loop sees the tolerance target alone.
      </p>
    </Panel>
  );
}

function RoughTerrainPanel({
  snapshot,
  series,
  onInjectTrap,
}: {
  snapshot: V03Snapshot;
  series: readonly V03SeriesPoint[];
  onInjectTrap: () => void;
}) {
  const values = (key: keyof V03SeriesPoint) => series.map((p) => (typeof p[key] === "number" ? (p[key] as number) : null));
  const s = snapshot.selfModel;
  const roughTicks = series.filter((point) => point.terrainRough).length;
  return (
    <Panel index="08" title="Rough terrain & trap"
      subtitle="true rough cost vs learned rough prior"
      right={<span className={cn("chip", snapshot.beliefTrap ? "text-lab-red" : "text-lab-muted")}>{snapshot.beliefTrap ?? "no trap"}</span>}
      bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
        <Stat label="rough MAE" value={snapshot.metrics.roughCostMae.toFixed(2)} sub="online" color="#5fd0e3" />
        <Stat label="rough obs" value={`${s.roughObservations}`} sub="effort samples" />
        <Stat label="learned rough" value={s.roughCost.toFixed(2)} sub="energy / resource" color="#7aa2ff" />
        <Stat label="rough ticks" value={`${roughTicks}`} sub="observed terrain" />
      </div>
      <div className="mt-2 rounded border border-lab-line/60 bg-lab-raise/20 p-2">
        <div className="mono-label mb-1">rough cost · true / learned</div>
        <Plot
          series={[
            { key: "true", label: "true", color: "#5cdb95", values: values("roughCostTrue") },
            { key: "est", label: "learned", color: "#5fd0e3", values: values("roughCostEstimate"), dashed: true },
          ]}
          min={0}
          formatValue={(v) => v.toFixed(1)}
          ariaLabel="True and learned rough terrain cost"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          className="btn h-7 border-lab-red/30 px-2 py-0 normal-case tracking-normal text-lab-red"
          onClick={onInjectTrap}
        >
          <Target size={11} /> Inject pessimistic rough-cost trap
        </button>
        <span className="font-mono text-[8px] text-lab-faint">
          sets the rough prior to 25 energy and zeroes its evidence
        </span>
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-lab-faint">
        Rough/resource terrain carries a separate true movement cost. The self-model learns it from
        effort readings on resource-directed moves; the trap injects a confident, wrong prior so the
        residual meta-model has something to detect and correct.
      </p>
    </Panel>
  );
}

function RiskPanel({ snapshot, series }: { snapshot: V03Snapshot; series: readonly V03SeriesPoint[] }) {
  const values = (key: keyof V03SeriesPoint) => series.map((p) => (typeof p[key] === "number" ? (p[key] as number) : null));
  const sel = snapshot.selection;
  return (
    <Panel index="09" title="Risk & information"
      subtitle="risk margin, failure probability and decision value"
      right={<span className="chip text-lab-amber">safety blocked {sel?.safetyBlocked ?? 0}/5</span>}
      bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
        <Stat label="mean info" value={snapshot.metrics.meanInfoValue.toFixed(2)} sub="epistemic value" color="#5fd0e3" />
        <Stat label="mean VoI" value={snapshot.metrics.meanVoi.toFixed(2)} sub="decision value" color="#f0a35e" />
        <Stat label="info gain" value={snapshot.metrics.infoGain.toFixed(3)} sub="uncertainty drop" color="#7aa2ff" />
        <Stat label="safety vetoes" value={`${sel?.safetyBlocked ?? 0}`} sub="blocked actions" color="#ff6f6f" />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded border border-lab-line/60 bg-lab-raise/20 p-2">
          <div className="mono-label mb-1">risk margin · error bound</div>
          <Plot
            series={[
              { key: "risk", label: "margin", color: "#ff6f6f", values: values("riskMargin"), fill: true },
            ]}
            formatValue={(v) => v.toFixed(2)}
            legendNote=">0 safe"
            ariaLabel="Risk margin over time"
          />
        </div>
        <div className="rounded border border-lab-line/60 bg-lab-raise/20 p-2">
          <div className="mono-label mb-1">failure probability · meta</div>
          <Plot
            series={[
              { key: "fail", label: "p(fail)", color: "#7aa2ff", values: values("metaFailureProbability") },
            ]}
            min={0}
            max={1}
            formatValue={(v) => v.toFixed(2)}
            ariaLabel="Meta-model persistent failure probability over time"
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-lab-line/60 pt-2 font-mono text-[8px] text-lab-faint">
        <span>risk margin now <span className="text-lab-muted">{series.length ? series[series.length - 1].riskMargin.toFixed(2) : "—"}</span></span>
        <span>failure p now <span className="text-lab-muted">{fmt(snapshot.metaModel.failureProbability, 2)}</span></span>
        <span>mean uncertainty <span className="text-lab-muted">{snapshot.metrics.meanUncertainty.toFixed(2)}</span></span>
        <span>λ <span className="text-lab-muted">{snapshot.lambda.toFixed(2)}</span></span>
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-lab-faint">
        Risk control turns the predicted error bound into a signed margin near the energy/fatigue
        cliff; safety vetoes remove actions whose predicted state would cross it. Information value is
        reported separately so exploration and protection stay distinguishable.
      </p>
    </Panel>
  );
}

function ProbePanel({
  snapshot,
  series,
  onInjectPulse,
}: {
  snapshot: V03Snapshot;
  series: readonly V03SeriesPoint[];
  onInjectPulse: () => void;
}) {
  const pulsePoints = series.filter((point) => point.pulseActive);
  const lastPulse = pulsePoints.length ? pulsePoints[pulsePoints.length - 1].t : null;
  const meanPulseError = pulsePoints.length
    ? pulsePoints.reduce((sum, point) => sum + point.rawEnergyError, 0) / pulsePoints.length
    : null;
  const baseline = series.slice(-200).filter((point) => !point.pulseActive);
  const meanBaseError = baseline.length
    ? baseline.reduce((sum, point) => sum + point.rawEnergyError, 0) / baseline.length
    : null;
  return (
    <Panel index="10" title="PP-1 probe"
      subtitle="one ambiguous interoceptive pulse · can a prior absorb it?"
      right={<span className="chip text-lab-cyan">{pulsePoints.length} pulse ticks</span>}
      bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
        <Stat label="pulse ticks" value={`${pulsePoints.length}`} sub="flagged on chart" color="#5fd0e3" />
        <Stat label="last pulse" value={lastPulse === null ? "—" : `t${lastPulse}`} sub="tick index" />
        <Stat label="raw |err| pulse" value={fmt(meanPulseError, 1)} sub="energy channel" color="#f0a35e" />
        <Stat label="raw |err| base" value={fmt(meanBaseError, 1)} sub="last 200 ticks" color="#8b929b" />
      </div>
      <div className="mt-2 rounded border border-lab-line/60 bg-lab-raise/20 p-2">
        <div className="mono-label">current channel</div>
        <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[8px]">
          <span className="text-lab-faint">energy reading</span><span className="text-right text-lab-muted">{(snapshot.observation?.energyReading ?? 0).toFixed(1)}</span>
          <span className="text-lab-faint">self estimate</span><span className="text-right text-lab-muted">{snapshot.selfModel.energyEstimate.toFixed(1)}</span>
          <span className="text-lab-faint">strain reading</span><span className="text-right text-lab-muted">{(snapshot.observation?.strainReading ?? 0).toFixed(3)}</span>
          <span className="text-lab-faint">pulse active</span><span className="text-right text-lab-muted">{series.length && series[series.length - 1].pulseActive ? "yes" : "no"}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          className="btn h-7 border-lab-cyan/30 px-2 py-0 normal-case tracking-normal text-lab-cyan"
          onClick={onInjectPulse}
        >
          <Activity size={11} /> Inject 1-tick interoceptive pulse
        </button>
        <span className="font-mono text-[8px] text-lab-faint">energy offset +12 for 1 tick</span>
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-lab-faint">
        The pulse perturbs one energy reading and then disappears; no regime change occurred. A
        confidently wrong prior should absorb the spike, while an evidence-linked filter should show a
        bounded, short-lived innovation. Pulse ticks are marked on the energy chart.
      </p>
    </Panel>
  );
}

function EventPanel({ events }: { events: V03Snapshot["events"] }) {
  const list = [...events].reverse().slice(0, 80);
  return (
    <Panel index="11" title="Event log" subtitle="measured shifts, beliefs, probes and model updates"
      right={<span className="chip">{events.length}</span>} bodyClassName="p-0">
      <div className="max-h-[320px] overflow-y-auto px-3 py-1 scroll-thin">
        {list.length === 0 ? (
          <div className="grid h-[160px] place-items-center font-mono text-[9px] uppercase tracking-[0.12em] text-lab-faint">no events yet</div>
        ) : (
          <ul className="divide-y divide-lab-line/40">
            {list.map((event, i) => (
              <li key={i} className="flex gap-2 py-1.5">
                <span className="font-mono text-[8px] tabular-nums text-lab-faint">t{event.tick}</span>
                <span className="mt-[4px] h-1.5 w-1.5 shrink-0 rounded-full bg-lab-blue/80" />
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

function signed(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}
