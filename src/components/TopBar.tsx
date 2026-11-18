import { ArrowLeftRight, BookOpen, Info, Pause, Play } from "lucide-react";
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
    <header className="sticky top-0 z-40 border-b border-lab-line/70 bg-lab-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <a
          className="group flex min-w-0 items-center gap-2.5"
          href="/"
          onClick={(event) => event.preventDefault()}
          aria-label="Strange Loop Lab, home"
        >
          <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden="true">
            <circle cx="16" cy="16" r="10.5" fill="none" stroke="#333338" strokeWidth="1" />
            <path
              d="M16 5.5 a10.5 10.5 0 1 1 -7.42 17.92"
              fill="none"
              stroke="#e2a765"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M7.9 24.1 A10.5 10.5 0 0 1 5.5 16"
              fill="none"
              stroke="#83b8c4"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <circle cx="16" cy="16" r="1.9" fill="#86c9a3" />
          </svg>
          <span className="flex items-baseline gap-2">
            <span className="font-serif text-[21px] leading-none tracking-[-0.02em] text-lab-text">
              Strange Loop
            </span>
            <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-lab-faint">
              Lab
            </span>
          </span>
        </a>

        <span className="mx-1 hidden h-4 w-px bg-lab-line sm:block" />

        <nav className="order-3 flex w-full items-center gap-4 overflow-x-auto pb-1 sm:order-none sm:w-auto sm:pb-0">
          {NAV.map((item) => {
            const active = item.key === "v0";
            return (
              <button
                key={item.key}
                onClick={() => open(item.key)}
                disabled={active}
                title={item.title}
                className={cn(
                  "relative shrink-0 py-1 font-mono text-[10px] tracking-[0.12em] transition-colors",
                  active
                    ? "cursor-default text-lab-text"
                    : "text-lab-faint hover:text-lab-muted",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute inset-x-0 -bottom-[9px] h-px",
                    active ? "bg-lab-amber/70" : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
          <button
            onClick={onOpenResearch}
            title="Research and findings"
            className="flex shrink-0 items-center gap-1.5 py-1 font-mono text-[10px] tracking-[0.12em] text-lab-faint transition-colors hover:text-lab-muted"
          >
            <BookOpen size={11} />
            Research
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <span className="hidden items-center gap-1.5 sm:flex">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                status === "running"
                  ? "bg-lab-green glow-dot"
                  : status === "paused"
                    ? "bg-lab-amber"
                    : "bg-lab-red",
              )}
              style={status === "running" ? { animation: "soft-pulse 2.4s ease-in-out infinite" } : undefined}
            />
            <span className="font-mono text-[9px] tracking-[0.08em] text-lab-faint">{status}</span>
            <span className="font-mono text-[9px] tabular-nums text-lab-faint/70">
              {TICK_LABEL(snapshot.tick)}
            </span>
          </span>

          <span className="hidden items-center gap-1.5 lg:flex">
            <span
              className="font-mono text-[9px] text-lab-faint"
              style={{ color: mode.accent }}
            >
              {snapshot.mode}
            </span>
            <span className="font-mono text-[9px] text-lab-faint">{mode.short}</span>
          </span>

          <span className="hidden items-center gap-1.5 xl:flex">
            <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-lab-faint/70">
              seed
            </span>
            <span className="font-mono text-[9px] tabular-nums text-lab-muted">{snapshot.seed}</span>
          </span>

          <span className="h-4 w-px bg-lab-line" />

          <button
            className={cn("btn h-8 px-2.5", running && "btn-primary")}
            onClick={onToggleRunning}
            aria-label={running ? "Pause simulation" : "Resume simulation"}
            title={running ? "Pause (space)" : "Run (space)"}
          >
            {running ? <Pause size={12} /> : <Play size={12} />}
            <span className="hidden md:inline">{running ? "Pause" : "Run"}</span>
          </button>

          <button
            className="icon-btn"
            onClick={onCompare}
            title="Compare all three modes on this seed"
            aria-label="Compare modes"
          >
            <ArrowLeftRight size={13} />
          </button>

          <button
            className="icon-btn"
            onClick={onAbout}
            aria-label="About this experiment"
            title="About"
          >
            <Info size={13} />
          </button>
        </div>
      </div>
    </header>
  );
}
