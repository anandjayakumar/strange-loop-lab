import { useEffect, useRef, useState } from "react";
import { Activity, Brain, GitBranch, Target, Zap } from "lucide-react";
import { ACTION_COLORS } from "../simulation/config";
import { V06Engine } from "../simulation/v06/engine";
import { ABLATION_EFFECTS } from "../simulation/v06/config";
import {
  ABLATION_LABELS,
  CONTROL_LABELS,
  MODULE_COLORS,
  MODULE_IDS,
  MODULE_LABELS,
  SCENARIO_LABELS,
} from "../simulation/v06/types";
import type {
  Ablation,
  AttributionKind,
  ControlKind,
  Difficulty,
  DisruptionKind,
  PriorRegime,
  V06Scenario,
  V06SeriesPoint,
  V06Snapshot,
} from "../simulation/v06/types";
import { Panel } from "../components/ui/Panel";
import { LabTransport } from "../components/LabTransport";
import { VersionHero } from "../components/VersionHero";
import { Plot } from "../components/ui/Plot";
import { Meter, Ring, Stat, Toggle } from "../components/ui/Primitives";
import { cn } from "../lib/cn";
import { useV06Simulation } from "./useV06Simulation";

const ATTRIBUTION_KEYS: AttributionKind[] = [
  "physical",
  "energy_sensor",
  "fatigue_sensor",
  "shared",
  "insufficient",
];

const ATTRIBUTION_LABEL: Record<AttributionKind, string> = {
  physical: "self",
  energy_sensor: "energy",
  fatigue_sensor: "fatigue",
  shared: "shared",
  insufficient: "unknown",
};

const ATTRIBUTION_COLOR: Record<AttributionKind, string> = {
  physical: "#26467e",
  energy_sensor: "#b23f24",
  fatigue_sensor: "#634070",
  shared: "#1d5c67",
  insufficient: "#8f8574",
};

const DISRUPTIONS: { kind: DisruptionKind; label: string }[] = [
  { kind: "self", label: "self-model parameters" },
  { kind: "energy_sensor", label: "energy channel" },
  { kind: "fatigue_sensor", label: "fatigue channel" },
  { kind: "shared", label: "both channels" },
];

export function V06Lab({ onNavigate }: { onNavigate: (target: string) => void }) {
  const controller = useV06Simulation();
  const { engine, snapshot, series, events, settings, running, flash, actions } = controller;
  const [seedDraft, setSeedDraft] = useState(String(settings.seed));

  useEffect(() => setSeedDraft(String(settings.seed)), [settings.seed]);

  const applySeed = () => {
    const parsed = Number(seedDraft.replace(/[^0-9]/g, ""));
    if (parsed > 0) actions.resetWith({ seed: parsed });
  };

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-[1560px] space-y-4 px-5 py-5 sm:px-8">
        <VersionHero
          id="v06-hero"
          label="V0.6"
          edition="unified architecture · four modules · recursive self-simulation"
          headline={
            <>
              The whole loop, <span className="italic text-lab-amber">closed</span>
            </>
          }
          lede="Four specialist modules compete for a capacity-limited workspace. The winner is broadcast back to perception, learning and the other modules, while a bounded rollout simulates the agent's own future beliefs. Every mechanism is individually ablatable and every claim is tested against matched-compute controls."
          tick={snapshot.tick}
          energy={snapshot.physical.energy}
          status={!snapshot.alive ? "terminated" : running ? "running" : "paused"}
          condition={`${settings.difficulty} · ${settings.control} · ${settings.ablation}`}
          seed={settings.seed}
          detail={`${snapshot.physical.resources} resources · ${snapshot.physical.moves} moves`}
          onResearch={() => onNavigate("findings#v06-indicators")}
        />

        <section id="v06-controls" className="panel">
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
              <span className="mono-label">scenario</span>
              <select
                value={settings.scenario}
                onChange={(event) =>
                  actions.resetWith({ scenario: event.target.value as V06Scenario })
                }
                className="rounded border border-lab-line bg-lab-bg px-2 py-1.5 font-mono text-[9px] text-lab-text outline-none"
              >
                {Object.entries(SCENARIO_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="mono-label">control</span>
              <select
                value={settings.control}
                onChange={(event) =>
                  actions.resetWith({ control: event.target.value as ControlKind })
                }
                className="rounded border border-lab-line bg-lab-bg px-2 py-1.5 font-mono text-[9px] text-lab-text outline-none"
              >
                {Object.entries(CONTROL_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="mono-label">ablation</span>
              <select
                value={settings.ablation}
                onChange={(event) =>
                  actions.resetWith({ ablation: event.target.value as Ablation })
                }
                className="rounded border border-lab-line bg-lab-bg px-2 py-1.5 font-mono text-[9px] text-lab-text outline-none"
              >
                {Object.entries(ABLATION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="mono-label">difficulty</span>
              <select
                value={settings.difficulty}
                onChange={(event) =>
                  actions.resetWith({ difficulty: event.target.value as Difficulty })
                }
                className="rounded border border-lab-line bg-lab-bg px-2 py-1.5 font-mono text-[9px] text-lab-text outline-none"
              >
                <option value="docile">Docile</option>
                <option value="standard">Standard</option>
                <option value="harsh">Harsh</option>
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
              <span className="mono-label">lambda</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.lambda}
                onChange={(event) => actions.resetWith({ lambda: Number(event.target.value) })}
                className="h-1 w-20 accent-lab-blue"
                aria-label="Epistemic weight"
              />
              <span className="font-mono text-[9px] text-lab-muted">
                {settings.lambda.toFixed(2)}
              </span>
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
                className="h-7 w-24 rounded border border-lab-line bg-lab-bg px-2 font-mono text-[9px] text-lab-text outline-none"
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
            <span className="mono-label">controls</span>
            {Object.entries(CONTROL_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={cn(
                  "btn h-7 px-2 py-0 normal-case tracking-normal",
                  settings.control === key && "border-lab-text bg-lab-raise text-lab-text",
                )}
                onClick={() => actions.resetWith({ control: key as ControlKind })}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.1em] text-lab-faint">
              matched world · same seeds
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-lab-line/60 px-3.5 py-2">
            <span className="mono-label">disrupt</span>
            {DISRUPTIONS.map((item) => (
              <button
                key={item.kind}
                className="btn h-7 px-2 py-0 normal-case tracking-normal"
                onClick={() => actions.triggerDisruption(item.kind)}
              >
                <Zap size={11} /> {item.label}
              </button>
            ))}
            <button
              className="btn h-7 border-lab-red/30 px-2 py-0 normal-case tracking-normal text-lab-red"
              onClick={actions.injectTrap}
            >
              <Target size={11} /> pessimistic rough-cost prior
            </button>
            <button
              className="btn h-7 border-lab-cyan/30 px-2 py-0 normal-case tracking-normal text-lab-cyan"
              onClick={actions.injectPulse}
            >
              <Activity size={11} /> ambiguous pulse
            </button>
            <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.1em] text-lab-faint">
              t={snapshot.tick} · {snapshot.phaseName} · {snapshot.shift}
            </span>
            {flash ? (
              <span className="rounded border border-lab-blue/30 bg-lab-blue/10 px-2 py-1 font-mono text-[8px] text-lab-blue">
                {flash}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3.5 py-2">
            <span className="mono-label">architecture</span>
            <Toggle
              label="GWT bottleneck"
              hint="winner-take-all ignition"
              checked={settings.ablation !== "no_gwt_bottleneck" && settings.control !== "flat_blackboard"}
              onChange={() =>
                actions.resetWith({
                  ablation:
                    settings.ablation === "no_gwt_bottleneck" ? "none" : "no_gwt_bottleneck",
                })
              }
            />
            <Toggle
              label="broadcast"
              hint="winner → precision & learning"
              checked={settings.ablation !== "no_gwt_broadcast"}
              onChange={() =>
                actions.resetWith({
                  ablation:
                    settings.ablation === "no_gwt_broadcast" ? "none" : "no_gwt_broadcast",
                })
              }
            />
            <Toggle
              label="HOT meta"
              hint="reliability & attribution"
              checked={settings.ablation !== "no_hot_meta"}
              onChange={() =>
                actions.resetWith({
                  ablation: settings.ablation === "no_hot_meta" ? "none" : "no_hot_meta",
                })
              }
            />
            <Toggle
              label="AST schema"
              hint="precision allocation"
              checked={settings.ablation !== "no_ast"}
              onChange={() =>
                actions.resetWith({
                  ablation: settings.ablation === "no_ast" ? "none" : "no_ast",
                })
              }
            />
            <Toggle
              label="cognitive rollout"
              hint="H = 4 future beliefs"
              checked={settings.ablation !== "no_cognitive_self_sim"}
              onChange={() =>
                actions.resetWith({
                  ablation:
                    settings.ablation === "no_cognitive_self_sim"
                      ? "none"
                      : "no_cognitive_self_sim",
                })
              }
            />
            <Toggle
              label="recurrent settling"
              hint="K = 3 within-tick"
              checked={settings.ablation !== "no_rpt"}
              onChange={() =>
                actions.resetWith({
                  ablation: settings.ablation === "no_rpt" ? "none" : "no_rpt",
                })
              }
            />
            <span className="ml-auto font-mono text-[8px] text-lab-faint">
              {ABLATION_EFFECTS[settings.ablation] ?? "Intact architecture."}
            </span>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <EnvironmentPanel engine={engine} snapshot={snapshot} />
          </div>
          <div className="lg:col-span-8">
            <ModulePanel snapshot={snapshot} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <WorkspacePanel snapshot={snapshot} />
          </div>
          <div className="lg:col-span-3">
            <QueryPanel snapshot={snapshot} />
          </div>
          <div className="lg:col-span-4">
            <QualityPanel snapshot={snapshot} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <RolloutPanel snapshot={snapshot} />
          </div>
          <div className="lg:col-span-5">
            <HigherOrderPanel snapshot={snapshot} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <MetricsPanel snapshot={snapshot} series={series} />
          </div>
          <div className="lg:col-span-4">
            <EventsPanel events={events} />
          </div>
        </div>

        <footer className="border-t border-lab-line/60 px-1 pb-5 pt-3 text-[9px] leading-relaxed text-lab-faint">
          V0.6 is a research instrument, not a consciousness claim. Each module competes on an
          observable salience signal; the workspace has a hard capacity limit; the broadcast is the
          only path by which a winner can change perception, learning or a partner module. Latent
          errors, shadow probes and scenario labels remain evaluation-only and are never read by the
          agent. Ablations rebuild the same seed with one causal edge removed.
        </footer>
      </main>
    </div>
  );
}

function EnvironmentPanel({ engine, snapshot }: { engine: V06Engine; snapshot: V06Snapshot }) {
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
      const cell = width / 30;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, width);
      ctx.fillStyle = "#efe9dc";
      ctx.fillRect(0, 0, width, width);
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 30; x++) {
          const t = state.cells[y * 30 + x];
          if (t === 1) {
            ctx.fillStyle = "#d8cdb8";
            ctx.fillRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
          } else if (t === 2) {
            ctx.save();
            ctx.shadowColor = "rgba(57,100,63,0.7)";
            ctx.shadowBlur = cell;
            ctx.fillStyle = "#39643f";
            ctx.beginPath();
            ctx.arc(x * cell + cell / 2, y * cell + cell / 2, Math.max(1.5, cell * 0.23), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }
      const ax = state.agent.x * cell + cell / 2;
      const ay = state.agent.y * cell + cell / 2;
      if (state.target && state.selectedAction !== "REST") {
        ctx.strokeStyle = "rgba(178,63,36,0.7)";
        ctx.setLineDash([2, 3]);
        ctx.strokeRect(state.target.x * cell + 1, state.target.y * cell + 1, cell - 2, cell - 2);
        ctx.setLineDash([]);
      }
      ctx.save();
      ctx.shadowColor = "rgba(178,63,36,0.8)";
      ctx.shadowBlur = cell;
      ctx.fillStyle = "#b23f24";
      ctx.beginPath();
      ctx.arc(ax, ay, Math.max(3, cell * 0.3), 0, Math.PI * 2);
      ctx.fill();
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
    <Panel
      id="v06-environment"
      index="01"
      title="Environment"
      subtitle="V0.5 substrate · local 7×7 sensing"
      right={
        <span className={cn("chip", snapshot.alive ? "text-lab-green" : "text-lab-red")}>
          {snapshot.alive ? "live" : "dead"}
        </span>
      }
      bodyClassName="p-3"
    >
      <div ref={wrap} className="w-full overflow-hidden rounded-md border border-lab-line/80">
        <canvas ref={ref} role="img" aria-label="V0.6 grid environment" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {[
          ["position", `(${snapshot.physical.x}, ${snapshot.physical.y})`],
          ["energy", snapshot.physical.energy.toFixed(1)],
          ["fatigue", snapshot.physical.fatigue.toFixed(2)],
          ["resources", `${snapshot.physical.resources}`],
          ["frame", snapshot.workspace.frame],
          ["yield", snapshot.workspace.ignition.toFixed(2)],
          ["mode", snapshot.attention.mode],
          ["shift", snapshot.shift],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-lab-line/60 bg-lab-raise/30 px-2 py-1">
            <div className="mono-label">{label}</div>
            <div className="truncate font-mono text-[10px] tabular-nums text-lab-text">{value}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ModulePanel({ snapshot }: { snapshot: V06Snapshot }) {
  const proposals = snapshot.proposals;
  return (
    <Panel
      id="v06-modules"
      index="02"
      title="Four competing modules"
      subtitle="Distinct representational concerns, independent salience, one winner"
      right={<span className="chip">capacity 1 / 4</span>}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {MODULE_IDS.map((id) => {
          const proposal = proposals.find((p) => p.module === id);
          const winner = snapshot.workspace.frame === id;
          const weight = snapshot.workspace.weights[id] ?? 0;
          return (
            <article
              key={id}
              className={cn(
                "relative rounded border p-3 transition-colors",
                winner ? "border-lab-text bg-lab-panel" : "border-lab-line bg-lab-raise/20",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: MODULE_COLORS[id] }}>
                  {MODULE_LABELS[id]}
                </span>
                {winner ? <span className="chip border-lab-text px-1.5 py-0 text-[7px]">ignited</span> : null}
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="num text-[22px] leading-none text-lab-text">
                  {proposal?.action ?? "—"}
                </span>
                <span className="num text-[10px] text-lab-faint">w {weight.toFixed(2)}</span>
              </div>
              <div className="mt-2 h-[4px] overflow-hidden bg-lab-raise">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(100, (proposal?.salience ?? 0) * 100)}%`,
                    background: MODULE_COLORS[id],
                  }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between font-mono text-[8px] text-lab-faint">
                <span>salience {(proposal?.salience ?? 0).toFixed(2)}</span>
                <span>conf {(proposal?.confidence ?? 0).toFixed(2)}</span>
              </div>
              <p className="mt-2 font-serif text-[12px] italic leading-snug text-lab-muted">
                {proposal?.goal ?? "—"}
              </p>
              <p className="mt-1 font-mono text-[8px] leading-relaxed text-lab-faint">
                {proposal?.hypothesis ?? ""}
              </p>
            </article>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-lab-line pt-2 sm:grid-cols-4">
        {MODULE_IDS.map((id) => {
          const proposal = proposals.find((p) => p.module === id);
          return (
            <div key={id} className="min-w-0">
              <div className="mono-label">{MODULE_LABELS[id]} evidence</div>
              <p className="mt-1 truncate font-mono text-[8px] text-lab-faint">
                {proposal
                  ? Object.entries(proposal.evidence)
                      .slice(0, 3)
                      .map(([k, v]) => `${k} ${v.toFixed(2)}`)
                      .join(" · ")
                  : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function WorkspacePanel({ snapshot }: { snapshot: V06Snapshot }) {
  const w = snapshot.workspace;
  return (
    <Panel
      id="v06-workspace"
      index="03"
      title="Global workspace"
      subtitle="Capacity limit · winner-take-all ignition · global broadcast"
      right={<span className="num text-[11px] text-lab-amber">ignition {w.ignition.toFixed(2)}</span>}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-lab-line pb-2">
        <div className="min-w-0">
          <div className="mono-label">ignited frame</div>
          <div className="font-serif text-[19px] leading-tight text-lab-text">
            {MODULE_LABELS[w.frame]}
          </div>
          <div className="mt-0.5 truncate font-serif text-[12px] italic text-lab-faint">{w.goal}</div>
        </div>
        <span className="chip shrink-0">{w.bottleneck ? "bottleneck on" : "no bottleneck"}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <div className="mono-label">coalition weights</div>
          <div className="mt-1.5 space-y-1.5">
            {MODULE_IDS.map((id) => (
              <Meter
                key={id}
                label={MODULE_LABELS[id]}
                value={w.weights[id].toFixed(2)}
                ratio={w.weights[id]}
                color={MODULE_COLORS[id]}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="mono-label">broadcast → action bias</div>
          <div className="mt-1.5 grid grid-cols-5 gap-1">
            {(["UP", "DOWN", "LEFT", "RIGHT", "REST"] as const).map((action, index) => {
              const value = w.broadcast[index] ?? 0;
              return (
                <div key={action} className="text-center">
                  <div
                    className="mx-auto h-12 w-full rounded-sm border border-lab-line/70"
                    style={{
                      background: `linear-gradient(to top, ${ACTION_COLORS[action]} ${Math.min(100, Math.abs(value) * 60)}%, transparent 0)`,
                    }}
                    title={`${action}: ${value.toFixed(2)}`}
                  />
                  <div className="mt-1 font-mono text-[7px] text-lab-faint">{action.slice(0, 1)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-lab-line pt-2">
        <div>
          <div className="mono-label">precision plan</div>
          <div className="mt-1.5 space-y-1.5">
            {(
              [
                ["energy", w.precision.energy, "#b23f24"],
                ["strain", w.precision.strain, "#634070"],
                ["effort", w.precision.effort, "#1d5c67"],
                ["prior", w.precision.prior, "#26467e"],
                ["epistemic", w.precision.epistemic, "#39643f"],
              ] as const
            ).map(([label, value, color]) => (
              <Meter key={label} label={label} value={value.toFixed(2)} ratio={value} color={color} />
            ))}
          </div>
        </div>
        <div>
          <div className="mono-label">learning gains</div>
          <div className="mt-1.5 space-y-1.5">
            {MODULE_IDS.map((id) => (
              <Meter
                key={id}
                label={MODULE_LABELS[id]}
                value={`×${w.learningGains[id].toFixed(2)}`}
                ratio={w.learningGains[id] / 1.5}
                color={MODULE_COLORS[id]}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-lab-line pt-2 font-mono text-[8px] text-lab-faint">
        <span>broadcast {w.broadcastEnabled ? "on" : "off"}</span>
        <span>quality [{w.quality.map((v) => v.toFixed(2)).join(", ")}]</span>
      </div>
    </Panel>
  );
}

function QueryPanel({ snapshot }: { snapshot: V06Snapshot }) {
  return (
    <Panel
      id="v06-query"
      index="04"
      title="Sequential querying"
      subtitle="Micro-passes across the same workspace"
      bodyClassName="p-3"
    >
      <ol className="space-y-2">
        {snapshot.query.length === 0 ? (
          <li className="font-serif text-[12px] italic text-lab-faint">Awaiting first cycle.</li>
        ) : (
          snapshot.query.map((pass) => (
            <li key={pass.pass} className="border-l-2 pl-2.5" style={{ borderColor: MODULE_COLORS[pass.frame] }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[9px] text-lab-muted">query {pass.pass}</span>
                <span className="num text-[11px] text-lab-text">{pass.action}</span>
              </div>
              <div className="font-serif text-[12px] italic leading-snug text-lab-faint">
                {MODULE_LABELS[pass.frame]} · {pass.goal}
              </div>
              <div className="mt-0.5 font-mono text-[7.5px] text-lab-faint">
                {pass.revised ? "revised" : "confirmed"} · {pass.note}
              </div>
            </li>
          ))
        )}
      </ol>
    </Panel>
  );
}

function RolloutPanel({ snapshot }: { snapshot: V06Snapshot }) {
  const sim = snapshot.selfSim;
  return (
    <Panel
      id="v06-rollout"
      index="05"
      title="Recursive cognitive self-simulation"
      subtitle="Imagined physical state and imagined future beliefs"
      right={
        <span className="chip">
          H = {sim.horizon} · {sim.cognitive ? "cognitive" : "physical only"}
        </span>
      }
    >
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-lab-line pb-2">
        <div>
          <div className="mono-label">imagined plan</div>
          <div className="font-serif text-[15px] text-lab-text">{sim.narrative}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="mono-label">expected value</div>
          <div className="num text-[14px] text-lab-amber">{sim.expectedValue.toFixed(2)}</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse font-mono text-[9px]">
          <thead>
            <tr className="text-left text-lab-faint">
              {["t+k", "action", "energy", "fatigue", "uncertainty", "reliability", "mode", "option"].map(
                (label) => (
                  <th key={label} className="border-b border-lab-line pb-1 pr-2 font-normal">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sim.steps.map((step) => (
              <tr key={step.k} className="text-lab-muted">
                <td className="border-b border-lab-line/50 py-1 pr-2 text-lab-faint">+{step.k + 1}</td>
                <td className="border-b border-lab-line/50 py-1 pr-2 text-lab-text">{step.action}</td>
                <td className="border-b border-lab-line/50 py-1 pr-2 tabular-nums">{step.energy.toFixed(1)}</td>
                <td className="border-b border-lab-line/50 py-1 pr-2 tabular-nums">{step.fatigue.toFixed(2)}</td>
                <td className="border-b border-lab-line/50 py-1 pr-2 tabular-nums">{step.uncertainty.toFixed(2)}</td>
                <td className="border-b border-lab-line/50 py-1 pr-2 tabular-nums">{step.reliability.toFixed(2)}</td>
                <td className="border-b border-lab-line/50 py-1 pr-2">
                  <span className="rounded-sm bg-lab-raise px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em]">
                    {step.mode}
                  </span>
                </td>
                <td className="border-b border-lab-line/50 py-1 pr-2 tabular-nums">
                  {step.optionValue > 0 ? step.optionValue.toFixed(2) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 font-serif text-[11px] italic leading-snug text-lab-faint">
        The option column is the simulated value of the decisions that a resolved uncertainty would
        unlock. It is non-zero only when the rollout predicts that the future self can act better
        after the probe.
      </p>
    </Panel>
  );
}

function QualityPanel({ snapshot }: { snapshot: V06Snapshot }) {
  const points = snapshot.qualityHistory;
  const size = 240;
  const pad = 24;
  const inner = size - pad * 2;
  const project = (point: [number, number, number]) => ({
    x: pad + point[1] * inner,
    y: pad + (1 - point[0]) * inner,
  });
  const path = points
    .map((point, index) => {
      const p = project(point);
      return `${index === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");
  const current = points[points.length - 1];
  const marker = current ? project(current) : null;
  return (
    <Panel
      id="v06-quality"
      index="06"
      title="Quality space"
      subtitle="HOT-4 · viability × certainty × coherence"
      bodyClassName="p-3"
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full" role="img" aria-label="Quality-space trajectory">
        <rect x={pad} y={pad} width={inner} height={inner} fill="#faf7ef" stroke="#ded4c1" />
        {[0.25, 0.5, 0.75].map((tick) => (
          <g key={tick}>
            <line
              x1={pad + tick * inner}
              y1={pad}
              x2={pad + tick * inner}
              y2={pad + inner}
              stroke="#ece6da"
              strokeWidth="0.7"
            />
            <line
              x1={pad}
              y1={pad + tick * inner}
              x2={pad + inner}
              y2={pad + tick * inner}
              stroke="#ece6da"
              strokeWidth="0.7"
            />
          </g>
        ))}
        {path ? <path d={path} fill="none" stroke="#b23f24" strokeWidth="1.2" opacity="0.55" /> : null}
        {points.slice(-40).map((point, index) => {
          const p = project(point);
          const age = (index + 1) / Math.min(40, points.length);
          return (
            <circle
              key={`${index}-${point[1].toFixed(3)}`}
              cx={p.x}
              cy={p.y}
              r={1.6}
              fill="#39643f"
              opacity={0.15 + 0.7 * age}
            />
          );
        })}
        {marker ? <circle cx={marker.x} cy={marker.y} r={4} fill="#17130d" /> : null}
        <text x={pad + inner / 2} y={size - 5} textAnchor="middle" className="fill-[#6f6657]" fontSize="8">
          certainty →
        </text>
        <text
          x={9}
          y={pad + inner / 2}
          textAnchor="middle"
          transform={`rotate(-90 9 ${pad + inner / 2})`}
          className="fill-[#6f6657]"
          fontSize="8"
        >
          viability →
        </text>
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-lab-line pt-2">
        {[
          ["viability", current?.[0] ?? 0],
          ["certainty", current?.[1] ?? 0],
          ["coherence", current?.[2] ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <div className="mono-label">{label}</div>
            <div className="num text-[14px] text-lab-text">{Number(value).toFixed(2)}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function HigherOrderPanel({ snapshot }: { snapshot: V06Snapshot }) {
  const hot = snapshot.higherOrder;
  return (
    <Panel
      id="v06-higher-order"
      index="07"
      title="Higher-order monitor"
      subtitle="HOT-1…4 · reliability, attribution, quality"
      right={<span className="chip">{hot.shadowProbes} shadow probes</span>}
    >
      <div className="flex flex-wrap items-start gap-4">
        <Ring
          value={hot.reliability}
          label="reliability"
          color="#26467e"
          size={84}
          caption={`${(hot.reliability * 100).toFixed(0)}%`}
        />
        <div className="grid min-w-[180px] flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat label="Brier" value={hot.reliabilityBrier.toFixed(3)} sub="shadow head" />
          <Stat
            label="AUROC"
            value={hot.reliabilityAuroc === null ? "—" : hot.reliabilityAuroc.toFixed(2)}
            sub="latent failure"
          />
          <Stat label="quality Δ" value={hot.qualityVelocity.toFixed(3)} sub="trajectory speed" />
        </div>
      </div>
      <div className="mt-3 border-t border-lab-line pt-2">
        <div className="mono-label">four-way attribution</div>
        <div className="mt-1.5 space-y-1.5">
          {ATTRIBUTION_KEYS.map((key) => (
            <Meter
              key={key}
              label={ATTRIBUTION_LABEL[key]}
              value={hot.attribution[key].toFixed(2)}
              ratio={hot.attribution[key]}
              color={ATTRIBUTION_COLOR[key]}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-lab-line pt-2 font-mono text-[8px] text-lab-faint">
        <span>top: {ATTRIBUTION_LABEL[hot.attribution.top]}</span>
        <span>confidence: {hot.attribution.confidence.toFixed(2)}</span>
        <span>evidence: {hot.attribution.evidenceCount}</span>
        <span>attribution on: {hot.enabled ? "yes" : "no"}</span>
      </div>
    </Panel>
  );
}

function MetricsPanel({
  snapshot,
  series,
}: {
  snapshot: V06Snapshot;
  series: readonly V06SeriesPoint[];
}) {
  const m = snapshot.metrics;
  const recent = series.slice(-60);
  const somaticGain = recent.length
    ? recent.reduce((acc, point) => acc + point.somaticGain, 0) / recent.length
    : 0;
  return (
    <Panel id="v06-metrics" index="08" title="Instrumentation" subtitle="Observation-only metrics">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <Stat label="resources" value={`${m.resources}`} sub={`${m.distance} cells`} />
        <Stat label="self MAE" value={m.selfEnergyMae.toFixed(2)} sub={`raw ${m.rawEnergyMae.toFixed(2)}`} color="#26467e" />
        <Stat label="thrash" value={m.thrashRate.toFixed(2)} sub="action switches" color="#b23f24" />
        <Stat label="coherence" value={m.goalCoherence.toFixed(2)} sub="winner == action" color="#39643f" />
        <Stat label="convergence" value={m.settlingConvergence.toFixed(2)} sub="RPT passes" color="#634070" />
        <Stat label="somatic gain" value={somaticGain.toFixed(2)} sub="last 60 ticks" color="#1d5c67" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div>
          <div className="mono-label mb-1">energy · estimate</div>
          <Plot
            ariaLabel="Energy and estimate"
            series={[
              {
                key: "energy",
                label: "true",
                color: "#17130d",
                values: series.map((p) => p.energy),
              },
              {
                key: "estimate",
                label: "estimate",
                color: "#b23f24",
                values: series.map((p) => p.energyEstimate),
                dashed: true,
              },
              {
                key: "raw",
                label: "raw sensor",
                color: "#c6b9a0",
                values: series.map((p) => p.rawEnergyReading),
                width: 1,
              },
            ]}
            formatValue={(v) => v.toFixed(1)}
            min={0}
            max={105}
          />
        </div>
        <div>
          <div className="mono-label mb-1">reliability · uncertainty</div>
          <Plot
            ariaLabel="Reliability and uncertainty"
            series={[
              {
                key: "reliability",
                label: "reliability",
                color: "#26467e",
                values: series.map((p) => p.reliability),
              },
              {
                key: "uncertainty",
                label: "uncertainty",
                color: "#b23f24",
                values: series.map((p) => p.uncertainty),
                dashed: true,
              },
              {
                key: "convergence",
                label: "settling",
                color: "#39643f",
                values: series.map((p) => p.settlingConvergence),
                width: 1,
              },
            ]}
            formatValue={(v) => v.toFixed(2)}
            min={0}
            max={1}
          />
        </div>
      </div>
    </Panel>
  );
}

function EventsPanel({ events }: { events: V06Snapshot["events"] }) {
  return (
    <Panel
      id="v06-events"
      index="09"
      title="Event log"
      subtitle="System, glitch, conflict and belief events"
      bodyClassName="p-3"
    >
      <ol className="space-y-1.5">
        {events.length === 0 ? (
          <li className="font-serif text-[12px] italic text-lab-faint">No events yet.</li>
        ) : (
          [...events]
            .slice(-10)
            .reverse()
            .map((event, index) => (
              <li key={`${event.tick}-${index}`} className="flex gap-2 border-b border-lab-line/40 pb-1.5">
                <span className="shrink-0 font-mono text-[8px] tabular-nums text-lab-faint">
                  t{String(event.tick).padStart(4, "0")}
                </span>
                <div className="min-w-0">
                  <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-lab-amber">
                    {event.kind}
                  </div>
                  <p className="font-serif text-[11.5px] leading-snug text-lab-muted">{event.text}</p>
                </div>
              </li>
            ))
        )}
      </ol>
      <div className="mt-2 flex items-center gap-2 border-t border-lab-line pt-2 font-mono text-[8px] text-lab-faint">
        <Brain size={11} />
        <span>workspace frame {snapshotFrame(events)}</span>
        <GitBranch size={11} className="ml-auto" />
        <span>{events.length} logged</span>
      </div>
    </Panel>
  );
}

function snapshotFrame(events: V06Snapshot["events"]): string {
  const last = [...events].reverse().find((event) => event.kind === "status");
  if (!last) return "—";
  const match = last.text.match(/frame (\w+)/);
  return match ? match[1] : "—";
}
