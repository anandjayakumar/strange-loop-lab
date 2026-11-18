import { MODE_META, type EngineSnapshot } from "../simulation/types";
import { cn } from "../lib/cn";
import { fmt, pct } from "../ui/format";
import { Panel } from "./ui/Panel";

interface ArchitecturePanelProps {
  snapshot: EngineSnapshot;
}

const PHASE_SHORT = [
  "Sense",
  "Observe",
  "Predict",
  "Select",
  "Act",
  "Perceive",
  "Errors",
  "World",
  "Self",
  "Meta",
];

const NODE_ACTIVE: Record<number, string[]> = {
  0: ["sense", "env"],
  1: ["sense", "memory", "world"],
  2: ["world", "self", "memory"],
  3: ["select", "self", "world", "meta"],
  4: ["select", "env"],
  5: ["sense", "env", "memory"],
  6: ["memory", "world", "self"],
  7: ["world"],
  8: ["self"],
  9: ["meta"],
};

const EDGE_ACTIVE: Record<number, string[]> = {
  0: ["env-sense"],
  1: ["sense-memory", "memory-world", "env-world"],
  2: ["memory-world", "sense-self"],
  3: ["world-select", "self-select", "meta-select"],
  4: ["select-env"],
  5: ["env-sense", "sense-memory"],
  6: ["env-world", "sense-self"],
  7: ["env-world"],
  8: ["sense-self", "self-loop"],
  9: ["meta-self", "meta-select"],
};

interface NodeDef {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  value: string;
  active: boolean;
}

export function ArchitecturePanel({ snapshot }: ArchitecturePanelProps) {
  const self = snapshot.selfModel;
  const meta = snapshot.metaModel;
  const selection = snapshot.selection;
  const prediction = selection
    ? snapshot.predictions.find((p) => p.actionIndex === selection.actionIndex)
    : undefined;
  const activeNodes = NODE_ACTIVE[snapshot.phase] ?? [];
  const activeEdges = EDGE_ACTIVE[snapshot.phase] ?? [];
  const mode = MODE_META[snapshot.mode];

  let localResources = 0;
  let localObstacles = 0;
  if (snapshot.observation) {
    for (const cell of snapshot.observation.local) {
      if (cell === 2) localResources++;
      if (cell === 1) localObstacles++;
    }
  }

  const topProbability = selection ? Math.max(...selection.probabilities) : 0;
  const nodes: NodeDef[] = [
    {
      id: "sense",
      label: "Sensory field",
      x: 18,
      y: 28,
      w: 146,
      h: 68,
      color: "#17130d",
      value: snapshot.observation
        ? `${localResources} res · ${localObstacles} obs`
        : "awaiting sense",
      active: true,
    },
    {
      id: "memory",
      label: "Bounded memory",
      x: 188,
      y: 28,
      w: 140,
      h: 68,
      color: "#6f6657",
      value: `${snapshot.memorySize} steps`,
      active: true,
    },
    {
      id: "world",
      label: "World model",
      x: 352,
      y: 28,
      w: 140,
      h: 68,
      color: "#26467e",
      value: prediction
        ? `ps ${fmt(prediction.world.pSuccess)} pr ${fmt(prediction.world.pCollect)} pc ${fmt(prediction.world.pCollision)}`
        : "awaiting sample",
      active: true,
    },
    {
      id: "select",
      label: "Action selection",
      x: 606,
      y: 28,
      w: 128,
      h: 68,
      color: "#b23f24",
      value: selection
        ? `${selection.action} · pmax ${pct(topProbability)}`
        : "no policy yet",
      active: true,
    },
    {
      id: "self",
      label: "Self-model",
      x: 466,
      y: 148,
      w: 140,
      h: 66,
      color: "#1d5c67",
      value: self
        ? self.initialized
          ? `Ê ${fmt(self.energyEstimate, 1)} · c ${fmt(self.movementCost)}`
          : "awaiting first sample"
        : "absent in Mode A",
      active: Boolean(self),
    },
    {
      id: "meta",
      label: "Meta-model",
      x: 466,
      y: 258,
      w: 140,
      h: 66,
      color: "#634070",
      value: meta
        ? `t ${fmt(meta.trust)} · LR ×${fmt(
            snapshot.options.metaFeedback ? meta.learningRateMultiplier : 1,
          )}`
        : "absent in A / B",
      active: Boolean(meta),
    },
    {
      id: "env",
      label: "Environment",
      x: 166,
      y: 258,
      w: 150,
      h: 66,
      color: "#39643f",
      value: `E ${snapshot.physical.energy.toFixed(1)} · F ${snapshot.physical.fatigue.toFixed(2)}`,
      active: true,
    },
  ];

  const edges: {
    id: string;
    d: string;
    color: string;
    label: string;
    lx: number;
    ly: number;
    dashed?: boolean;
    level?: boolean;
    disabled?: boolean;
  }[] = [
    {
      id: "sense-memory",
      d: "M164 62 H188",
      color: "#6f6657",
      label: "filter",
      lx: 170,
      ly: 56,
    },
    {
      id: "memory-world",
      d: "M328 62 H352",
      color: "#26467e",
      label: "features",
      lx: 332,
      ly: 56,
    },
    {
      id: "world-select",
      d: "M492 62 H606",
      color: "#b23f24",
      label: "utilities",
      lx: 530,
      ly: 56,
    },
    {
      id: "self-select",
      d: "M606 159 H686 V96",
      color: "#1d5c67",
      label: "internal value",
      lx: 610,
      ly: 150,
      disabled: !snapshot.options.selfFeedback,
    },
    {
      id: "meta-self",
      d: "M536 258 V214",
      color: "#634070",
      label: "trust · plasticity",
      lx: 542,
      ly: 236,
      level: true,
      disabled: !meta || !snapshot.options.metaFeedback || !snapshot.options.plasticity,
    },
    {
      id: "meta-select",
      d: "M606 291 H722 V96",
      color: "#634070",
      label: "prior weight",
      lx: 638,
      ly: 284,
      level: true,
      disabled: !meta || !snapshot.options.metaFeedback || !snapshot.options.priorWeighting,
    },
    {
      id: "sense-self",
      d: "M110 96 V181 H466",
      color: "#1d5c67",
      label: "noisy interoception",
      lx: 190,
      ly: 175,
      dashed: true,
    },
    {
      id: "self-loop",
      d: "M466 170 H442 A16 16 0 1 0 442 194 H466",
      color: "#1d5c67",
      label: "self-reference",
      lx: 402,
      ly: 218,
      dashed: true,
    },
    {
      id: "select-env",
      d: "M626 96 V218 H316 V258",
      color: "#b23f24",
      label: "execute",
      lx: 560,
      ly: 212,
    },
    {
      id: "env-sense",
      d: "M166 278 H100 V96",
      color: "#39643f",
      label: "local view",
      lx: 104,
      ly: 230,
    },
    {
      id: "env-world",
      d: "M240 258 V224 H416 V96",
      color: "#26467e",
      label: "outcome + error",
      lx: 258,
      ly: 218,
      dashed: true,
    },
  ];

  return (
    <Panel
      index="02"
      title="Internal architecture"
      subtitle="Flow, active phase path and level-crossing edges"
      right={
        <span
          className="chip"
          style={{ borderColor: `${mode.accent}35`, color: mode.accent }}
        >
          {snapshot.mode} · {mode.short}
        </span>
      }
      bodyClassName="p-3"
    >
      <div className="overflow-hidden rounded-md border border-lab-line/60 bg-[#f2eee4]">
        <svg
          viewBox="0 0 748 350"
          className="h-auto w-full"
          role="img"
          aria-label="Information flow diagram from sensory field through memory and world model to action selection, with self-model and meta-model level-crossing edges"
        >
          <defs>
            <marker
              id="arch-arrow"
              viewBox="0 0 8 8"
              refX="6"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L8 4 L0 8 z" fill="#a89e8d" />
            </marker>
            <pattern id="arch-dots" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.7" fill="rgba(255,255,255,0.045)" />
            </pattern>
          </defs>
          <rect width="748" height="350" fill="url(#arch-dots)" />

          {edges.map((edge) => {
            const active = activeEdges.includes(edge.id);
            const levelOff = edge.disabled;
            return (
              <g key={edge.id} opacity={levelOff ? 0.22 : 1}>
                <path
                  d={edge.d}
                  fill="none"
                  stroke={active ? edge.color : "#ded4c1"}
                  strokeWidth={active ? 1.5 : 1}
                  strokeDasharray={edge.dashed || edge.level ? "3 4" : undefined}
                  markerEnd="url(#arch-arrow)"
                  className={active ? "flow-line" : undefined}
                  opacity={active ? 0.95 : 0.75}
                />
                <text
                  x={edge.lx}
                  y={edge.ly}
                  fill={active ? edge.color : "#a89e8d"}
                  fontSize="7.2"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="start"
                  opacity={active ? 0.95 : 0.7}
                >
                  {edge.label}
                  {edge.disabled ? " (off)" : ""}
                </text>
              </g>
            );
          })}

          {nodes.map((node) => {
            const active = activeNodes.includes(node.id);
            return (
              <g key={node.id} opacity={node.active ? 1 : 0.38}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.w}
                  height={node.h}
                  rx="5"
                  fill={active ? `${node.color}0e` : "#faf7ef"}
                  stroke={active ? `${node.color}99` : node.active ? "#ded4c1" : "#cfc3ac"}
                  strokeWidth={active ? 1.2 : 0.9}
                  strokeDasharray={node.active ? undefined : "3 3"}
                />
                {active ? (
                  <rect
                    x={node.x - 2}
                    y={node.y - 2}
                    width={node.w + 4}
                    height={node.h + 4}
                    rx="7"
                    fill="none"
                    stroke={node.color}
                    strokeOpacity="0.18"
                    strokeWidth="3"
                  />
                ) : null}
                <circle cx={node.x + 10} cy={node.y + 12} r="2.2" fill={node.color} opacity={node.active ? 1 : 0.35} />
                <text
                  x={node.x + 17}
                  y={node.y + 15.5}
                  fill={node.active ? "#17130d" : "#6f6657"}
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  letterSpacing="0.04em"
                >
                  {node.label.toUpperCase()}
                </text>
                <text
                  x={node.x + 10}
                  y={node.y + 37}
                  fill={node.active ? "#6f6657" : "#a89e8d"}
                  fontSize="8.2"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {node.value}
                </text>
                <text
                  x={node.x + 10}
                  y={node.y + 53}
                  fill={node.active ? `${node.color}cc` : "#a89e8d"}
                  fontSize="6.8"
                  fontFamily="JetBrains Mono, monospace"
                  letterSpacing="0.08em"
                >
                  {node.active ? (active ? "ACTIVE" : "IDLE") : "NOT PRESENT"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-10 gap-1">
        {PHASE_SHORT.map((phase, index) => {
          const active = snapshot.phase === index;
          const passed = index < snapshot.phase;
          return (
            <div
              key={phase}
              className={cn(
                "truncate rounded border px-1 py-1 text-center font-mono text-[7px] uppercase tracking-[0.04em] transition-colors",
                active
                  ? "border-lab-amber/50 bg-lab-amber/10 text-lab-amber"
                  : passed
                    ? "border-lab-line bg-lab-raise/50 text-lab-muted"
                    : "border-lab-line/50 bg-transparent text-lab-faint/60",
              )}
              title={`Phase ${index + 1}: ${phase}`}
            >
              {phase}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[10px] leading-snug text-lab-faint">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-lab-amber">
            {String(snapshot.phase + 1).padStart(2, "0")} / 10
          </span>{" "}
          <span className="text-lab-muted">{snapshot.phaseName}</span> — {snapshot.phaseDescription}
        </p>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-lab-faint/70">
          phase step → M
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-lab-line/60 pt-2 text-[8px] font-mono text-lab-faint">
        <span className="inline-flex items-center gap-1">
          <span className="h-px w-3 bg-lab-violet/70" /> meta → self / selection
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-px w-3 border-t border-dashed border-lab-cyan/70" /> self-reference
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-px w-3 border-t border-dashed border-lab-blue/70" /> prediction error
        </span>
        <span className="ml-auto">exactly two meta levels</span>
      </div>
    </Panel>
  );
}
