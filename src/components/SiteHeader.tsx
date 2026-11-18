import { BookOpen, FileText, FlaskConical, Home } from "lucide-react";
import { cn } from "../lib/cn";
import { hrefFor } from "../lib/router";

export type SiteView =
  | "v0"
  | "v02"
  | "v03"
  | "v04"
  | "v05"
  | "research"
  | "findings"
  | "paper"
  | "home";

interface SiteHeaderProps {
  active: SiteView;
  onNavigate: (view: SiteView | string) => void;
  /** The home page uses an editorial dark surface. */
  dark?: boolean;
}

const NAV = [
  {
    key: "home",
    href: "/",
    label: "Overview",
    title: "The accessible story",
    icon: Home,
  },
  {
    key: "research",
    href: "/research",
    label: "Research",
    title: "The interactive simulation lab",
    icon: FlaskConical,
  },
  {
    key: "findings",
    href: "/findings",
    label: "Findings",
    title: "Cross-version scientific results",
    icon: BookOpen,
  },
  {
    key: "paper",
    href: "/paper",
    label: "Paper",
    title: "The formal manuscript",
    icon: FileText,
  },
] as const;

const activeKey = (view: SiteView) =>
  view === "home"
    ? "home"
    : view === "findings"
      ? "findings"
      : view === "paper"
        ? "paper"
        : "research";

export function SiteHeader({ active, onNavigate, dark = false }: SiteHeaderProps) {
  const current = activeKey(active);
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-md",
        dark
          ? "border-white/15 bg-[#0d0c0a]/95 text-[#f2eee4]"
          : "border-lab-text/85 bg-lab-bg/95",
      )}
    >
      <div className="mx-auto max-w-[1560px] px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 pb-3 pt-4">
          <div className="min-w-0">
            <div
              className={cn(
                "font-sans text-[9px] font-medium uppercase tracking-[0.28em]",
                dark ? "text-[#e0a267]" : "text-lab-amber",
              )}
            >
              Computational laboratory · issue 01
            </div>
            <a
              href={hrefFor("/")}
              className="mt-1 flex items-baseline gap-3 text-left"
              aria-label="Strange Loop Lab, home"
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                onNavigate("home");
              }}
            >
              <span
                className={cn(
                  "display text-[27px] sm:text-[32px]",
                  dark ? "text-[#f6f1e6]" : "",
                )}
              >
                Strange Loop Lab
              </span>
              <span
                className={cn(
                  "hidden font-serif text-[13px] italic sm:inline",
                  dark ? "text-[#a89d8a]" : "text-lab-faint",
                )}
              >
                a model of a model of a model
              </span>
            </a>
          </div>

          <nav aria-label="Sections" className="flex flex-wrap items-center gap-x-1 gap-y-1 pb-0.5">
            {NAV.map((item, index) => {
              const isActive = item.key === current;
              const Icon = item.icon;
              return (
                <a
                  key={item.key}
                  href={hrefFor(item.href)}
                  title={item.title}
                  aria-current={isActive ? "page" : undefined}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    onNavigate(item.key);
                  }}
                  className={cn(
                    "group relative flex items-center gap-1.5 px-3 py-2 font-sans text-[10px] font-medium uppercase tracking-[0.16em] transition-colors",
                    dark
                      ? isActive
                        ? "text-[#f6f1e6]"
                        : "text-[#b7ac99] hover:text-[#e0a267]"
                      : isActive
                        ? "text-lab-text"
                        : "text-lab-faint hover:text-lab-amber",
                  )}
                >
                  <span
                    className={cn(
                      "num text-[8px]",
                      dark ? "text-[#7f7563]" : "text-lab-line2",
                    )}
                  >
                    0{index + 1}
                  </span>
                  <Icon size={11} />
                  {item.label}
                  <span
                    className={cn(
                      "absolute inset-x-2 bottom-0 h-px transition-colors",
                      isActive
                        ? dark
                          ? "bg-[#e0a267]"
                          : "bg-lab-amber"
                        : "bg-transparent group-hover:bg-lab-line2",
                    )}
                  />
                </a>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
