import { ArrowUpRight, BookOpen } from "lucide-react";
import { cn } from "../lib/cn";

export type SiteView = "v0" | "v02" | "v03" | "v04" | "v05" | "research";

interface SiteHeaderProps {
  active: SiteView;
  onNavigate: (view: SiteView) => void;
}

const NAV = [
  { key: "v0", label: "V0.1", title: "V0.1 — first-order self-modelling" },
  { key: "v02", label: "V0.2", title: "V0.2 — uninformed priors and learned meta-cognition" },
  { key: "v03", label: "V0.3", title: "V0.3 — residual meta-model and the decoupled trap" },
  { key: "v04", label: "V0.4", title: "V0.4 — precision gating and the attention schema" },
  { key: "v05", label: "V0.5", title: "V0.5 — the unification attempt" },
] as const;

export function SiteHeader({ active, onNavigate }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-lab-text/85 bg-lab-bg/95 backdrop-blur-md">
      <div className="mx-auto max-w-[1560px] px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 pb-3 pt-4">
          <div className="min-w-0">
            <div className="font-sans text-[9px] font-medium uppercase tracking-[0.28em] text-lab-amber">
              Computational laboratory · issue 01
            </div>
            <button
              className="mt-1 flex items-baseline gap-3 text-left"
              onClick={() => onNavigate("v0")}
              aria-label="Strange Loop Lab, home"
            >
              <span className="display text-[27px] sm:text-[32px]">Strange Loop Lab</span>
              <span className="hidden font-serif text-[13px] italic text-lab-faint sm:inline">
                a model of a model of a model
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pb-1">
            <span className="font-sans text-[9px] font-medium uppercase tracking-[0.18em] text-lab-faint">
              deterministic · seeded · no account
            </span>
            <button
              onClick={() => onNavigate("research")}
              className={cn(
                "flex items-center gap-1.5 font-sans text-[10px] font-medium uppercase tracking-[0.18em] transition-colors",
                active === "research" ? "text-lab-text" : "text-lab-amber hover:opacity-70",
              )}
            >
              <BookOpen size={11} />
              Research
              <ArrowUpRight size={11} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-6 border-t border-lab-line py-1.5">
          <nav className="scroll-thin flex items-center gap-5 overflow-x-auto" aria-label="Versions">
            {NAV.map((item) => {
              const isActive = item.key === active;
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  disabled={isActive}
                  title={item.title}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative shrink-0 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.18em] transition-colors",
                    isActive
                      ? "cursor-default text-lab-text"
                      : "text-lab-faint hover:text-lab-amber",
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "absolute inset-x-0 bottom-0 h-px transition-colors",
                      isActive ? "bg-lab-amber" : "bg-transparent group-hover:bg-lab-line2",
                    )}
                  />
                </button>
              );
            })}
          </nav>

          <span className="hidden shrink-0 font-serif text-[12px] italic text-lab-faint md:inline">
            five architectures, one question
          </span>
        </div>
      </div>
    </header>
  );
}
