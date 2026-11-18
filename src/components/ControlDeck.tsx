import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  ChevronsRight,
  Copy,
  Dices,
  Eraser,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import type { LabController } from "../ui/useSimulation";
import { MODES, MODE_META, type Mode } from "../simulation/types";
import { cn } from "../lib/cn";
import { Toggle } from "./ui/Primitives";

interface ControlDeckProps {
  controller: LabController;
  onCompare: () => void;
}

export function ControlDeck({ controller, onCompare }: ControlDeckProps) {
  const { settings, snapshot, running, actions } = controller;
  const [seedDraft, setSeedDraft] = useState(String(settings.seed));
  const [copied, setCopied] = useState(false);
  const [seedError, setSeedError] = useState(false);

  useEffect(() => {
    setSeedDraft(String(settings.seed));
    setSeedError(false);
  }, [settings.seed]);

  const applySeed = () => {
    const parsed = Number(seedDraft.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSeedError(true);
      setSeedDraft(String(settings.seed));
      return;
    }
    setSeedError(false);
    if (parsed !== settings.seed) actions.changeSeed(parsed);
  };

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(String(settings.seed));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const randomSeed = () => {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    actions.changeSeed((buffer[0] % 900000000) + 100000);
  };

  const mode = settings.mode;
  const selfActive = mode !== "A";
  const metaActive = mode === "C";

  return (
    <section className="border-y border-lab-line">
      {/* transport --------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3">
        <div className="flex items-center gap-1.5">
          <button
            className="btn btn-primary h-9 min-w-[92px] px-4"
            onClick={actions.toggleRunning}
            disabled={!snapshot.alive}
            title={running ? "Pause" : "Run"}
          >
            {running ? <Pause size={13} /> : <Play size={13} />}
            {running ? "Pause" : "Run"}
          </button>
          <button
            className="btn h-9"
            onClick={actions.step}
            disabled={!snapshot.alive}
            title="Advance one full tick (→)"
          >
            <SkipForward size={13} />
            Step
          </button>
          <button
            className="btn h-9"
            onClick={actions.microStep}
            disabled={!snapshot.alive}
            title="Advance one cognitive phase (M)"
          >
            <ChevronsRight size={13} />
            Phase
          </button>
          <button className="btn h-9" onClick={actions.reset} title="Reset run (R)">
            <RotateCcw size={13} />
            Reset
          </button>
        </div>

        <div className="hidden h-6 w-px bg-lab-line2 sm:block" />

        <div className="flex items-center gap-3">
          <span className="label whitespace-nowrap">speed</span>
          <input
            type="range"
            min={1}
            max={60}
            step={1}
            value={settings.speed}
            onChange={(event) => actions.changeSpeed(Number(event.target.value))}
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-lab-line2 accent-lab-amber"
            aria-label="Simulation speed in ticks per second"
          />
          <span className="w-12 num text-[9px] text-lab-muted">{settings.speed} t/s</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="label">seed</span>
          <input
            value={seedDraft}
            onChange={(event) => {
              setSeedDraft(event.target.value);
              setSeedError(false);
            }}
            onBlur={applySeed}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            inputMode="numeric"
            aria-label="Random seed"
            className={cn(
              "field h-8 w-[96px]",
              seedError ? "border-lab-red" : "",
            )}
          />
          <button className="icon-btn" onClick={copySeed} title="Copy seed" aria-label="Copy seed">
            {copied ? <Check size={13} className="text-lab-green" /> : <Copy size={13} />}
          </button>
          <button className="icon-btn" onClick={randomSeed} title="Random seed" aria-label="Random seed">
            <Dices size={13} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <span className="label hidden xl:inline">condition</span>
          <div className="flex gap-1 rounded-full border border-lab-line2 p-0.5">
            {MODES.map((m: Mode) => {
              const meta = MODE_META[m];
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => actions.changeMode(m)}
                  title={`${meta.name} — ${meta.description}`}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full px-2.5 py-1.5 font-sans text-[9.5px] font-medium uppercase tracking-[0.1em] transition-colors",
                    active ? "text-lab-bg" : "text-lab-faint hover:text-lab-text",
                  )}
                  style={active ? { background: meta.accent } : undefined}
                >
                  {m}
                  <span className="ml-1.5 hidden sm:inline">{meta.short}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* feedback edges ---------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-dashed border-lab-line pb-2.5 pt-2">
        <span className="label mr-2">feedback edges</span>
        <Toggle
          label="Self"
          hint={selfActive ? "self-model → utilities" : "absent in A"}
          checked={selfActive && settings.selfFeedback}
          disabled={!selfActive}
          onChange={() => actions.toggle("selfFeedback")}
        />
        <Toggle
          label="Meta"
          hint={metaActive ? "trust → level crossing" : "Mode C only"}
          checked={metaActive && settings.metaFeedback}
          disabled={!metaActive}
          onChange={() => actions.toggle("metaFeedback")}
        />
        <Toggle
          label="Plasticity"
          hint={metaActive ? "trust → learning rate" : "Mode C only"}
          checked={metaActive && settings.plasticity}
          disabled={!metaActive}
          onChange={() => actions.toggle("plasticity")}
        />
        <Toggle
          label="Prior weight"
          hint={metaActive ? "trust → sensory gain" : "Mode C only"}
          checked={metaActive && settings.priorWeighting}
          disabled={!metaActive}
          onChange={() => actions.toggle("priorWeighting")}
        />
        <span className="hidden h-5 w-px bg-lab-line2 lg:block" />
        <button
          className="btn h-7 px-3"
          onClick={actions.resetModels}
          title="Reinitialise agent memory and learned models; keep the world and position"
        >
          <Eraser size={12} />
          Reset models
        </button>
        <button
          className="btn h-7 px-3"
          onClick={onCompare}
          title="Run A/B/C simultaneously on this seed"
        >
          <ArrowLeftRight size={12} />
          Compare
        </button>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[9px] font-medium uppercase tracking-[0.14em] text-lab-faint xl:inline">
            space run · → step · m phase · r reset
          </span>
          <span className="hidden h-3 w-px bg-lab-line2 sm:block" />
          <span className="num text-[9px] text-lab-muted">
            <span className="text-lab-amber">{String(snapshot.phase + 1).padStart(2, "0")}</span>
            <span className="text-lab-faint"> / 10 · {snapshot.phaseName}</span>
          </span>
        </div>
      </div>
    </section>
  );
}
