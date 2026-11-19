import { ArrowUpRight, BookOpen, ChevronDown, FlaskConical } from "lucide-react";
import { hrefFor, type VersionId } from "../lib/router";
import { cn } from "../lib/cn";
import { V0Lab } from "../v0/V0Lab";
import { V02Lab } from "../v02/V02Lab";
import { V03Lab } from "../v03/V03Lab";
import { V04Lab } from "../v04/V04Lab";
import { V05Lab } from "../v05/V05Lab";
import { V06Lab } from "../v06/V06Lab";
import { LAB_VERSIONS, labVersion } from "./versions";

function VersionNav({
  version,
  onNavigate,
}: {
  version: VersionId;
  onNavigate: (target: string) => void;
}) {
  return (
    <nav aria-label="Simulator generations" className="scroll-thin overflow-x-auto border-t border-lab-line lg:overflow-visible">
      <div className="flex w-full min-w-max flex-wrap lg:min-w-0 lg:flex-nowrap">
        {LAB_VERSIONS.map((item) => {
          const active = item.id === version;
          return (
            <a
              key={item.id}
              href={hrefFor(`/research?version=${item.id}`)}
              aria-current={active ? "page" : undefined}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                onNavigate(`/research?version=${item.id}`);
              }}
              className={cn(
                "group relative flex min-w-[158px] flex-1 flex-col gap-1 border-r border-lab-line px-3 py-3 text-left transition-colors last:border-r-0 sm:min-w-[172px] sm:px-4",
                active ? "bg-lab-panel" : "hover:bg-lab-panel/60",
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: active ? item.color : undefined }}
                >
                  {item.label}
                </span>
                {active ? (
                  <span className="chip border-lab-line2 px-1.5 py-0 text-[7.5px] text-lab-muted">
                    active
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "font-serif text-[15px] leading-tight",
                  active ? "text-lab-text" : "text-lab-muted group-hover:text-lab-text",
                )}
              >
                {item.name}
              </span>
              <span className="font-sans text-[9px] uppercase tracking-[0.08em] text-lab-faint">
                {item.short}
              </span>
              <span
                className="absolute inset-x-0 bottom-0 h-[2px]"
                style={{ background: active ? item.color : "transparent" }}
              />
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function LabGuide({
  version,
  onNavigate,
}: {
  version: VersionId;
  onNavigate: (target: string) => void;
}) {
  const meta = labVersion(version);
  return (
    <div className="px-5 pt-4 sm:px-8">
      <div className="mx-auto max-w-[1560px]">
        <details
          open
          className="group rounded-card border border-lab-line bg-lab-panel/80 shadow-plate"
        >
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <FlaskConical size={13} style={{ color: meta.color }} />
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-lab-text">
              Lab guide for {meta.label}
            </span>
            <span className="font-serif text-[13px] italic text-lab-faint">{meta.name}</span>
            <span className="ml-auto flex items-center gap-1.5 font-sans text-[9px] uppercase tracking-[0.14em] text-lab-faint">
              show / hide
              <ChevronDown
                size={13}
                className="transition-transform group-open:rotate-180"
              />
            </span>
          </summary>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-lab-line px-4 py-4 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="label">what this version represents</div>
              <p className="mt-1.5 max-w-[78ch] text-[12.5px] leading-[1.7] text-lab-muted">
                {meta.milestone}
              </p>
              <div className="label mt-4">what to click</div>
              <p className="mt-1.5 max-w-[78ch] text-[12.5px] leading-[1.7] text-lab-muted">
                {meta.guide}
              </p>
            </div>
            <div className="lg:col-span-5">
              <div className="inset p-3.5">
                <div className="label">three things to try</div>
                <ol className="mt-2 space-y-2">
                  {meta.tryThis.map((item, index) => (
                    <li
                      key={item}
                      className="flex gap-2.5 text-[11.5px] leading-relaxed text-lab-muted"
                    >
                      <span
                        className="mt-[1px] num text-[9px]"
                        style={{ color: meta.color }}
                      >
                        {index + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
                <a
                  href={hrefFor(`/findings#${meta.findingsAnchor}`)}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    onNavigate(`/findings#${meta.findingsAnchor}`);
                  }}
                  className="btn-link mt-3.5 border-t border-lab-line pt-2.5"
                >
                  <BookOpen size={11} />
                  Statistical section on Findings
                  <ArrowUpRight size={11} />
                </a>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

export function ResearchLabPage({
  version,
  onNavigate,
}: {
  version: VersionId;
  onNavigate: (target: string) => void;
}) {
  const meta = labVersion(version);
  return (
    <div className="min-h-screen">
      <div className="border-b border-lab-text bg-lab-bg/80">
        <div className="mx-auto max-w-[1560px] px-5 pt-7 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3 pb-4">
            <div>
              <div className="kicker">Interactive simulation lab · V0.1 → V0.6</div>
              <h1 className="display mt-2 text-[34px] leading-[0.98] sm:text-[44px]">
                Six generations, <span className="italic text-lab-amber">one organism</span>
              </h1>
              <p className="mt-2 max-w-[74ch] text-[13px] leading-[1.7] text-lab-muted">
                Every generation is a live, deterministic simulator. Switch versions below to
                inspect the exact mechanism that was added, ablate it, and watch what the loop does
                to survival, tracking and diagnosis.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-1">
              <span className="chip">23,900 total runs</span>
              <span className="chip">73 tests</span>
              <span className="chip">white-box</span>
              <span className="hidden font-serif text-[12px] italic text-lab-faint md:inline">
                current: {meta.label} · {meta.era}
              </span>
            </div>
          </div>
          <VersionNav version={version} onNavigate={onNavigate} />
        </div>
      </div>

      <LabGuide version={version} onNavigate={onNavigate} />

      <div key={version}>
        {version === "v0" ? <V0Lab onNavigate={onNavigate} /> : null}
        {version === "v02" ? <V02Lab onNavigate={onNavigate} /> : null}
        {version === "v03" ? <V03Lab onNavigate={onNavigate} /> : null}
        {version === "v04" ? <V04Lab onNavigate={onNavigate} /> : null}
        {version === "v05" ? <V05Lab onNavigate={onNavigate} /> : null}
        {version === "v06" ? <V06Lab onNavigate={onNavigate} /> : null}
      </div>
    </div>
  );
}
