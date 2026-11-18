import { ArrowLeftRight, Info, Pause, Play } from "lucide-react";
import { MODE_META, type EngineSnapshot } from "../simulation/types";
import { cn } from "../lib/cn";
import { TICK_LABEL } from "../ui/format";

interface TopBarProps {
  snapshot: EngineSnapshot;
  running: boolean;
  onAbout: () => void;
  onCompare: () => void;
  onToggleRunning: () => void;
}

export function TopBar({ snapshot, running, onAbout, onCompare, onToggleRunning }: TopBarProps) {
  const status = !snapshot.alive ? "terminated" : running ? "running" : "paused";
  const mode = MODE_META[snapshot.mode];
  return (
    <header className="relative border-b border-lab-line/80">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative grid h-10 w-10 shrink-0 place-items-center">
            <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-12" aria-hidden="true">
              <circle cx="20" cy="20" r="13" fill="none" stroke="#2c3138" strokeWidth="1.2" />
              <path
                d="M20 7 a13 13 0 1 1 -9.19 22.19"
                fill="none"
                stroke="#f0a35e"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M9.9 30.1 A13 13 0 0 1 7 20"
                fill="none"
                stroke="#5fd0e3"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <circle cx="20" cy="20" r="2.6" fill="#5cdb95" />
              <path d="M17.5 7.2 L20 4.8 L22.5 7.2" fill="none" stroke="#f0a35e" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="truncate font-serif text-[26px] leading-none tracking-[-0.01em] text-lab-text">
                Strange Loop
              </h1>
              <span className="rounded border border-lab-line bg-lab-raise px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-lab-amber/90">
                Lab
              </span>
            </div>
            <p className="mt-1 truncate font-mono text-[9px] tracking-[0.02em] text-lab-faint">
              self-reference · tangled hierarchy · a model of the modeler
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-lab-line bg-lab-panel px-2.5 py-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                status === "running"
                  ? "bg-lab-green glow-dot"
                  : status === "paused"
                    ? "bg-lab-amber"
                    : "bg-lab-red",
              )}
              style={status === "running" ? { animation: "soft-pulse 1.6s ease-in-out infinite" } : undefined}
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-lab-muted">
              {status}
            </span>
            <span className="h-3 w-px bg-lab-line" />
            <span className="font-mono text-[9px] tabular-nums text-lab-faint">
              {TICK_LABEL(snapshot.tick)}
            </span>
          </div>

          <div
            className="hidden items-center gap-2 rounded-md border px-2.5 py-1.5 sm:flex"
            style={{
              borderColor: `${mode.accent}35`,
              background: `${mode.accent}0d`,
            }}
          >
            <span
              className="grid h-4 w-4 place-items-center rounded-sm font-mono text-[9px]"
              style={{ background: `${mode.accent}22`, color: mode.accent }}
            >
              {snapshot.mode}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-lab-muted">
              {mode.short}
            </span>
          </div>

          <div className="hidden items-center gap-1.5 rounded-md border border-lab-line bg-lab-panel px-2.5 py-1.5 lg:flex">
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-lab-faint">
              seed
            </span>
            <span className="font-mono text-[9px] tabular-nums text-lab-muted">{snapshot.seed}</span>
          </div>

          <button
            className="btn h-8 px-2.5"
            onClick={onToggleRunning}
            aria-label={running ? "Pause simulation" : "Resume simulation"}
            title={running ? "Pause (space)" : "Run (space)"}
          >
            {running ? <Pause size={13} /> : <Play size={13} />}
            <span className="hidden xl:inline">{running ? "Pause" : "Run"}</span>
          </button>

          <button className="btn h-8 px-2.5" onClick={onCompare} title="Compare all three modes on this seed">
            <ArrowLeftRight size={13} />
            <span className="hidden xl:inline">Compare</span>
          </button>

          <button className="icon-btn" onClick={onAbout} aria-label="About this experiment" title="About">
            <Info size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
