import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";

interface LabTransportProps {
  running: boolean;
  alive: boolean;
  phase: number;
  phaseName: string;
  onToggle: () => void;
  onStep: () => void;
  onPhase: () => void;
  onReset: () => void;
}

export function LabTransport({
  running,
  alive,
  phase,
  phaseName,
  onToggle,
  onStep,
  onPhase,
  onReset,
}: LabTransportProps) {
  const status = !alive ? "terminated" : running ? "running" : "paused";
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-lab-line px-3.5 py-2.5">
      <button
        className="btn btn-primary h-9 min-w-[92px] px-4"
        onClick={onToggle}
        disabled={!alive}
        title={running ? "Pause" : "Run"}
      >
        {running ? <Pause size={13} /> : <Play size={13} />}
        {running ? "Pause" : "Run"}
      </button>
      <button className="btn h-9" onClick={onStep} disabled={!alive} title="Advance one tick">
        <SkipForward size={13} />
        Step
      </button>
      <button className="btn h-9" onClick={onPhase} disabled={!alive} title="Advance one phase">
        Phase
      </button>
      <button className="btn h-9" onClick={onReset} title="Reset run">
        <RotateCcw size={13} />
        Reset
      </button>

      <span className="ml-auto flex items-center gap-2.5">
        <span className="flex items-center gap-1.5">
          <span
            className={
              "h-1.5 w-1.5 rounded-full " +
              (status === "running"
                ? "bg-lab-green"
                : status === "paused"
                  ? "bg-lab-amber"
                  : "bg-lab-red")
            }
          />
          <span className="font-sans text-[9px] font-medium uppercase tracking-[0.14em] text-lab-muted">
            {status}
          </span>
        </span>
        <span className="h-3 w-px bg-lab-line2" />
        <span className="num text-[9px] text-lab-muted">
          <span className="text-lab-amber">{String(phase + 1).padStart(2, "0")}</span>
          <span className="text-lab-faint"> / {phaseName}</span>
        </span>
      </span>
    </div>
  );
}
