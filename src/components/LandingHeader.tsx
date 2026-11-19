import { hrefFor } from "../lib/router";

const NAV = [
  { key: "home", href: "/", label: "Overview" },
  { key: "research", href: "/research", label: "Research" },
  { key: "findings", href: "/findings", label: "Findings" },
  { key: "paper", href: "/paper", label: "Paper" },
] as const;

export type HeaderView = (typeof NAV)[number]["key"];

export function LandingHeader({
  active,
  onNavigate,
}: {
  active: HeaderView;
  onNavigate: (target: string) => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#2a1d14]/15 bg-[#f8f4ec]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 sm:px-8">
        <a
          href={hrefFor("/")}
          className="font-serif text-[25px] leading-none tracking-[-0.02em] text-[#1c1915]"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onNavigate("home");
          }}
        >
          Strange Loop Lab
        </a>
        <span className="hidden h-7 w-px bg-[#2a1d14]/20 sm:block" />
        <span className="hidden max-w-none font-sans text-[8.5px] font-medium uppercase leading-[1.5] tracking-[0.18em] text-[#6d6153] md:block">
          Research on mind, models, and self-reference
        </span>
        <nav
          aria-label="Sections"
          className="flex w-full items-center justify-between gap-3 sm:ml-auto sm:w-auto sm:justify-end sm:gap-5"
        >
          {NAV.map((item) => {
            const isActive = item.key === active;
            return (
              <a
                key={item.key}
                href={hrefFor(item.href)}
                aria-current={isActive ? "page" : undefined}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  onNavigate(item.key);
                }}
                className={
                  "relative py-1 font-sans text-[11px] font-medium tracking-[0.01em] transition-colors " +
                  (isActive ? "text-[#1c1915]" : "text-[#5d5144] hover:text-[#b5532a]")
                }
              >
                {item.label}
                {isActive ? (
                  <span className="absolute inset-x-0 -bottom-1 h-[2px] bg-[#b5532a]" />
                ) : null}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
