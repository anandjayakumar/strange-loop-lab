import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Activity, MapPin } from "lucide-react";
import { AGENT } from "../simulation/config";
import type { RenderState, SimulationEngine } from "../simulation/experiments/engine";
import type { EngineSnapshot } from "../simulation/types";
import { ACTION_GLYPH } from "../simulation/types";
import { cn } from "../lib/cn";
import { fmt, pct } from "../ui/format";
import { Panel } from "./ui/Panel";

interface EnvironmentPanelProps {
  engine: SimulationEngine;
  snapshot: EngineSnapshot;
}

interface HoverCell {
  x: number;
  y: number;
  type: number;
}

const CELL_NAMES: Record<number, string> = {
  [-1]: "outside",
  0: "empty",
  1: "obstacle",
  2: "resource",
};

export function EnvironmentPanel({ engine, snapshot }: EnvironmentPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RenderState | null>(null);
  const layoutRef = useRef({ cell: 1, offsetX: 0, offsetY: 0 });
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const lastTickRef = useRef(-1);
  const [hover, setHover] = useState<HoverCell | null>(null);
  const hoverRef = useRef<HoverCell | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.width * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.width}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let raf = 0;
    let lastDraw = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - lastDraw < 32) return;
      lastDraw = now;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      if (width < 2 || height < 2) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const state = engine.getRenderState();
      stateRef.current = state;
      if (state.tick < lastTickRef.current) trailRef.current = [];
      if (state.tick !== lastTickRef.current) {
        lastTickRef.current = state.tick;
        trailRef.current.push({ x: state.agent.x, y: state.agent.y });
        if (trailRef.current.length > 28) trailRef.current.shift();
      }

      const size = Math.min(width, height);
      const cell = size / 30;
      const offsetX = (width - size) / 2;
      const offsetY = (height - size) / 2;
      layoutRef.current = { cell, offsetX, offsetY };
      const px = (x: number) => offsetX + x * cell;
      const py = (y: number) => offsetY + y * cell;

      ctx.fillStyle = "#efe9dc";
      ctx.fillRect(offsetX, offsetY, size, size);

      // Grid.
      ctx.strokeStyle = "rgba(23,19,13,0.06)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 30; i++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + i * cell, offsetY);
        ctx.lineTo(offsetX + i * cell, offsetY + size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + i * cell);
        ctx.lineTo(offsetX + size, offsetY + i * cell);
        ctx.stroke();
      }

      const pulse = 0.72 + 0.28 * Math.sin(now / 640);
      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 30; x++) {
          const type = state.cells[y * 30 + x];
          if (type === 1) {
            ctx.fillStyle = "#d8cdb8";
            ctx.fillRect(px(x) + 0.5, py(y) + 0.5, cell - 1, cell - 1);
            ctx.fillStyle = "rgba(255,255,255,0.45)";
            ctx.fillRect(px(x) + 0.5, py(y) + 0.5, cell - 1, Math.max(1, cell * 0.12));
          } else if (type === 2) {
            const cx = px(x) + cell / 2;
            const cy = py(y) + cell / 2;
            const radius = Math.max(1.6, cell * 0.24);
            ctx.save();
            ctx.shadowColor = "rgba(57,100,63,0.35)";
            ctx.shadowBlur = cell * 0.8;
            ctx.fillStyle = `rgba(57,100,63,${0.5 + 0.28 * pulse})`;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.strokeStyle = "rgba(57,100,63,0.22)";
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 1.85, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // Hovered cell (read from a ref so hover moves do not restart the draw loop).
      const hover = hoverRef.current;
      if (hover) {
        ctx.fillStyle = "rgba(23,19,13,0.07)";
        ctx.fillRect(px(hover.x), py(hover.y), cell, cell);
        ctx.strokeStyle = "rgba(23,19,13,0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px(hover.x) + 0.5, py(hover.y) + 0.5, cell - 1, cell - 1);
      }

      // Trail.
      trailRef.current.forEach((point, index) => {
        const alpha = ((index + 1) / trailRef.current.length) * 0.13;
        ctx.fillStyle = `rgba(178,63,36,${alpha * 1.6})`;
        const s = cell * 0.22;
        ctx.fillRect(
          px(point.x) + cell / 2 - s / 2,
          py(point.y) + cell / 2 - s / 2,
          s,
          s,
        );
      });

      const agentX = px(state.agent.x) + cell / 2;
      const agentY = py(state.agent.y) + cell / 2;

      // Sensor footprint.
      const sensorRadius = 3.5 * cell;
      ctx.save();
      ctx.strokeStyle = "rgba(29,92,103,0.3)";
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(agentX, agentY, sensorRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Predicted target.
      if (state.target && state.selectedAction && state.selectedAction !== "REST") {
        ctx.strokeStyle = "rgba(178,63,36,0.65)";
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1;
        ctx.strokeRect(
          px(state.target.x) + 1,
          py(state.target.y) + 1,
          cell - 2,
          cell - 2,
        );
        ctx.setLineDash([]);
      }

      // Agent ring and energy arc.
      const energyRatio = Math.max(0, Math.min(1, state.agent.energy / AGENT.maxEnergy));
      ctx.save();
      ctx.lineWidth = Math.max(1.2, cell * 0.1);
      ctx.strokeStyle = "rgba(178,63,36,0.28)";
      ctx.beginPath();
      ctx.arc(agentX, agentY, cell * 0.43, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = state.agent.alive ? "#b23f24" : "#9f2c1b";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(agentX, agentY, cell * 0.43, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * energyRatio);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.shadowColor = state.agent.alive ? "rgba(178,63,36,0.45)" : "rgba(159,44,27,0.4)";
      ctx.shadowBlur = cell * 0.9;
      ctx.fillStyle = state.agent.alive ? "#b23f24" : "#9f2c1b";
      ctx.beginPath();
      ctx.arc(agentX, agentY, cell * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = state.agent.alive ? "rgba(178,63,36,0.9)" : "rgba(159,44,27,0.85)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      const glyph = state.agent.lastAction ? ACTION_GLYPH[state.agent.lastAction] : "·";
      ctx.fillStyle = "#faf7ef";
      ctx.font = `600 ${Math.max(8, cell * 0.46)}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(glyph, agentX, agentY + 0.5);

      if (!state.agent.alive) {
        ctx.strokeStyle = "rgba(250,247,239,0.95)";
        ctx.lineWidth = 2;
        const s = cell * 0.7;
        ctx.beginPath();
        ctx.moveTo(agentX - s, agentY - s);
        ctx.lineTo(agentX + s, agentY + s);
        ctx.moveTo(agentX + s, agentY - s);
        ctx.lineTo(agentX - s, agentY + s);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(23,19,13,0.18)";
      ctx.lineWidth = 1;
      ctx.strokeRect(offsetX + 0.5, offsetY + 0.5, size - 1, size - 1);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [engine]);

  const onMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { cell, offsetX, offsetY } = layoutRef.current;
    const x = Math.floor((event.clientX - rect.left - offsetX) / cell);
    const y = Math.floor((event.clientY - rect.top - offsetY) / cell);
    if (x < 0 || y < 0 || x >= 30 || y >= 30) {
      if (hoverRef.current) {
        hoverRef.current = null;
        setHover(null);
      }
      return;
    }
    const type = stateRef.current ? stateRef.current.cells[y * 30 + x] : 0;
    const current = hoverRef.current;
    if (current && current.x === x && current.y === y && current.type === type) return;
    const next = { x, y, type };
    hoverRef.current = next;
    setHover(next);
  };

  const agent = snapshot.physical;
  const panelNote = snapshot.alive ? "live" : "terminated";

  return (
    <Panel
      index="01"
      title="Environment"
      subtitle="30 × 30 · local view · resources regrow on a seed schedule"
      right={
        <span
          className={cn(
            "chip",
            snapshot.alive ? "text-lab-green" : "border-lab-red/30 text-lab-red",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              snapshot.alive ? "bg-lab-green" : "bg-lab-red",
            )}
          />
          {panelNote}
        </span>
      }
      bodyClassName="mx-auto w-full max-w-[680px] p-3"
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="chip">
          <MapPin size={10} /> ({agent.x}, {agent.y})
        </span>
        <span className="chip">
          E <span className="text-lab-text">{agent.energy.toFixed(1)}</span>
        </span>
        <span className="chip">
          F <span className="text-lab-text">{agent.fatigue.toFixed(2)}</span>
        </span>
        <span className="chip">
          {agent.lastAction ? ACTION_GLYPH[agent.lastAction] : "·"}{" "}
          <span className="text-lab-text">{agent.lastAction ?? "idle"}</span>
        </span>
        <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.12em] text-lab-faint">
          t = {snapshot.tick}
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative mx-auto w-full max-w-[640px] overflow-hidden rounded-card border border-lab-line bg-lab-bg"
      >
        <canvas
          ref={canvasRef}
          onMouseMove={onMouseMove}
          onMouseLeave={() => { hoverRef.current = null; setHover(null); }}
          role="img"
          aria-label={`Environment grid. Agent at ${agent.x}, ${agent.y}. Energy ${agent.energy.toFixed(1)}, fatigue ${agent.fatigue.toFixed(2)}.`}
          className="block w-full cursor-crosshair"
        />
        {!snapshot.alive ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/35">
            <div className="rounded border border-lab-red/40 bg-lab-panel px-4 py-2 text-center">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-lab-red">
                terminated
              </div>
              <div className="mt-1 text-[11px] text-lab-muted">
                energy exhausted at t={snapshot.tick}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {[
          ["Move cost", fmt(agent.effectiveCost, 2), "actual next step"],
          ["Success", pct(agent.effectiveSuccess), "slip-adjusted"],
          [
            "Sensed E",
            snapshot.observation ? fmt(snapshot.sensedEnergy, 1) : "—",
            snapshot.observation
              ? snapshot.staleReading
                ? "stale sample"
                : "noisy sample"
              : "awaiting sense",
          ],
          [
            "Noise",
            snapshot.observation
              ? `${snapshot.energyNoise >= 0 ? "+" : ""}${fmt(snapshot.energyNoise, 1)}`
              : "—",
            "vs instrumented",
          ],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded border border-lab-line/60 bg-lab-raise/30 px-2 py-1.5">
            <div className="mono-label">{label}</div>
            <div className="font-mono text-[11px] tabular-nums text-lab-text">{value}</div>
            <div className="truncate font-mono text-[7px] text-lab-faint">{hint}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-lab-line/60 pt-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[8px] text-lab-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-lab-green" /> resource
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[8px] text-lab-faint">
          <span className="h-1.5 w-1.5 rounded-sm bg-[#d8cdb8] ring-1 ring-lab-line2" /> obstacle
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[8px] text-lab-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-lab-amber" /> agent
        </span>
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-[8px] text-lab-faint">
          <Activity size={9} />
          {hover
            ? `(${hover.x}, ${hover.y}) · ${CELL_NAMES[hover.type] ?? "unknown"}`
            : "hover a cell to inspect"}
        </span>
      </div>
    </Panel>
  );
}
