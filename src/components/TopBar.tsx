import { ArrowLeftRight, ArrowUpRight, BookOpen, Info, Pause, Play } from "lucide-react";
import { MODE_META, type EngineSnapshot } from "../simulation/types";
import { cn } from "../lib/cn";
import { TICK_LABEL } from "../ui/format";

interface TopBarProps {
  snapshot: EngineSnapshot;
  running: boolean;
  onAbout: () => void;
  onCompare: () => void;
  onToggleRunning: () => void;
  onOpenV02: () => void;
  onOpenV03: () => void;
  onOpenV04: () => void;
  onOpenV05: () => void;
  onOpenResearch: () => void;
}

const NAV = [
  { key: "v0", label: "V0", title: "V0 — deterministic self-reference laboratory" },
  { key: "v02", label: "V0.2", title: "V0.2 — uninformed priors and learned meta-cognition" },
  { key: "v03", label: "V0.3", title: "V0.3 — residual meta-model and the decoupled trap" },
  { key: "v04", label: "V0.4", title: "V0.4 — precision gating and the attention schema" },
  { key: "v05", label: "V0.5", title: "V0.5 — the unification attempt" },
] as const;

export function TopBar({
  snapshot,
  running,
  onAbout,
  onCompare,
  onToggleRunning,
  onOpenV02,
  onOpenV03,
  onOpenV04,
  onOpenV05,
  onOpenResearch,
}: TopBarProps) {
  const status = !snapshot.alive ? "terminated" : running ? "running" : "paused";
  const mode = MODE_META[snapshot.mode];

  const open = (key: (typeof NAV)[number]["key"]) => {
    if (key === "v02") onOpenV02();
    else if (key === "v03") onOpenV03();
    else if (key === "v04") onOpenV04();
    else if (key === "v05") onOpenV05();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-lab-text/85 bg-lab-bg/95 backdrop-blur-md">
      <div className="mx-auto max-w-[1560px] px-5 sm:px-8">
        {/* Masthead ------------------------------------------------------- */}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 pb-3 pt-4">
          <div className="min-w-0">
            <div className="font-sans text-[9px] font-medium uppercase tracking-[0.28em] text-lab-amber">
              Computational laboratory · issue 01
            </div>
            <h1 className="mt-1 flex items-baseline gap-3">
              <span className="display text-[27px] sm:text-[32px]">Strange Loop Lab</span>
              <span className="hidden font-serif text-[13px] italic text-lab-faint sm:inline">
                a model of a model of a model
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "h-[7px] w-[7px] rounded-full",
                  status === "running"
                    ? "bg-lab-green"
                    : status === "paused"
                      ? "bg-lab-amber"
                      : "bg-lab-red",
                )}
                style={
                  status === "running"
                    ? { animation: "soft-pulse 2.4s ease-in-out infinite" }
                    : undefined
                }
              />
              <span className="font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-lab-muted">
                {status}
              </span>
              <span className="num text-[10px] text-lab-faint">{TICK_LABEL(snapshot.tick)}</span>
            </span>

            <span className="hidden h-4 w-px bg-lab-line2 sm:block" />

            <span className="hidden items-baseline gap-1.5 sm:flex">
              <span className="label">condition</span>
              <span className="font-mono text-[10px] font-medium" style={{ color: mode.accent }}>
                {snapshot.mode} · {mode.short}
              </span>
            </span>

            <span className="hidden items-baseline gap-1.5 lg:flex">
              <span className="label">seed</span>
              <span className="num text-[10px] text-lab-muted">{snapshot.seed}</span>
            </span>

            <button
              className={cn("btn h-8 px-4", running ? "btn-primary" : "btn-primary")}
              onClick={onToggleRunning}
              aria-label={running ? "Pause simulation" : "Resume simulation"}
              title={running ? "Pause (space)" : "Run (space)"}
            >
              {running ? <Pause size={12} /> : <Play size={12} />}
              <span className="hidden md:inline">{running ? "Pause" : "Run"}</span>
            </button>
          </div>
        </div>

        {/* Nav rail ------------------------------------------------------- */}
        <div className="flex items-center justify-between gap-6 border-t border-lab-line py-1.5">
          <nav className="scroll-thin flex items-center gap-5 overflow-x-auto">
            {NAV.map((item) => {
              const active = item.key === "v0";
              return (
                <button
                  key={item.key}
                  onClick={() => open(item.key)}
                  disabled={active}
                  title={item.title}
                  className={cn(
                    "group relative shrink-0 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.18em] transition-colors",
                    active
                      ? "cursor-default text-lab-text"
                      : "text-lab-faint hover:text-lab-amber",
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "absolute inset-x-0 bottom-0 h-px transition-colors",
                      active ? "bg-lab-amber" : "bg-transparent group-hover:bg-lab-line2",
                    )}
                  />
                </button>
              );
            })}
            <span className="h-3 w-px shrink-0 bg-lab-line2" />
            <button
              onClick={onOpenResearch}
              title="Research and findings"
              className="flex shrink-0 items-center gap-1.5 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-lab-amber transition-opacity hover:opacity-70"
            >
              <BookOpen size={11} />
              Research
              <ArrowUpRight size={11} />
            </button>
          </nav>

          <div className="flex shrink-0 items-center gap-4">
            <button className="btn-link hidden sm:inline-flex" onClick={onCompare}>
              <ArrowLeftRight size={11} />
              Compare
            </button>
            <button className="btn-link hidden sm:inline-flex" onClick={onAbout}>
              <Info size={11} />
              About
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
