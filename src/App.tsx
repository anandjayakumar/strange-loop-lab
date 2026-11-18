import { useEffect, useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { AboutDialog } from "./components/AboutDialog";
import { ArchitecturePanel } from "./components/ArchitecturePanel";
import { ComparisonView } from "./components/ComparisonView";
import { ControlDeck } from "./components/ControlDeck";
import { EnvironmentPanel } from "./components/EnvironmentPanel";
import { EventLogPanel } from "./components/EventLogPanel";
import { InternalStatePanel } from "./components/InternalStatePanel";
import { MetricsPanel } from "./components/MetricsPanel";
import { ReferencePanel } from "./components/ReferencePanel";
import { SelfModelPanel } from "./components/SelfModelPanel";
import { TopBar } from "./components/TopBar";
import { useSimulation } from "./ui/useSimulation";
import { V02Lab } from "./v02/V02Lab";
import { V03Lab } from "./v03/V03Lab";
import { V04Lab } from "./v04/V04Lab";
import { V05Lab } from "./v05/V05Lab";
import { ResearchPage } from "./research/ResearchPage";
import { MODE_META } from "./simulation/types";

export default function App() {
  const controller = useSimulation();
  const [view, setView] = useState<"v0" | "v02" | "v03" | "v04" | "v05" | "research">("v0");
  const { snapshot, series, events, running, settings, engine, actions } = controller;
  const [aboutOpen, setAboutOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const { toggleRunning, step, microStep, reset } = actions;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (view !== "v0" || aboutOpen || compareOpen) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tag === "BUTTON" ||
        tag === "A" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        toggleRunning();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step();
      } else if (event.key === "m" || event.key === "M") {
        microStep();
      } else if (event.key === "r" || event.key === "R") {
        reset();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleRunning, step, microStep, reset, aboutOpen, compareOpen, view]);

  if (view === "v02") {
    return <V02Lab onBack={() => setView("v0")} />;
  }

  if (view === "v03") {
    return <V03Lab onBack={() => setView("v0")} />;
  }

  if (view === "v04") {
    return <V04Lab onBack={() => setView("v0")} />;
  }

  if (view === "v05") {
    return <V05Lab onBack={() => setView("v0")} />;
  }

  if (view === "research") {
    return (
      <ResearchPage
        onBack={() => setView("v0")}
        onOpenVersion={(version) => setView(version === "v0" ? "v0" : version)}
      />
    );
  }

  const mode = MODE_META[snapshot.mode];

  return (
    <div className="relative min-h-screen">
      <TopBar
        snapshot={snapshot}
        running={running}
        onAbout={() => setAboutOpen(true)}
        onCompare={() => setCompareOpen(true)}
        onToggleRunning={actions.toggleRunning}
        onOpenV02={() => setView("v02")}
        onOpenV03={() => setView("v03")}
        onOpenV04={() => setView("v04")}
        onOpenV05={() => setView("v05")}
        onOpenResearch={() => setView("research")}
      />

      <main className="relative z-10 mx-auto max-w-[1560px] px-5 pb-2 sm:px-8">
        {/* ------------------------------------------------------------ hero */}
        <section className="grid grid-cols-1 gap-x-12 gap-y-8 pb-8 pt-10 lg:grid-cols-12 lg:pt-14">
          <div className="lg:col-span-8">
            <div className="kicker">V0 · first-order self-modeling</div>
            <h2 className="display mt-4 text-[46px] sm:text-[64px] xl:text-[76px]">
              An agent that
              <br />
              <span className="italic text-lab-amber">models itself</span>
              <span className="text-lab-line2">.</span>
            </h2>
            <p className="mt-6 max-w-[58ch] text-[14.5px] leading-[1.7] text-lab-muted">
              A deterministic organism in a 30 × 30 world, learning what its own body costs,
              predicts and can bear. Every feedback edge is visible, switchable and measurable — the
              interface is the experiment, not a summary of it.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <button className="btn btn-primary h-9 px-4" onClick={() => setView("research")}>
                <BookOpen size={12} />
                Research &amp; findings
              </button>
              <button className="btn h-9 px-4" onClick={() => setView("v05")}>
                Latest · V0.5
                <ArrowRight size={12} />
              </button>
              <span className="ml-1 hidden font-serif text-[13px] italic text-lab-faint sm:inline">
                five architectures, one question
              </span>
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="inset p-5">
              <div className="flex items-baseline justify-between">
                <span className="label">live telemetry</span>
                <span className="font-serif text-[12px] italic text-lab-faint">
                  seed {snapshot.seed}
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3 border-b border-lab-line pb-4">
                <div>
                  <div className="num text-[40px] leading-none text-lab-text">{snapshot.tick}</div>
                  <div className="label mt-2">ticks survived</div>
                </div>
                <div className="text-right">
                  <div className="num text-[17px] leading-none text-lab-green">
                    {snapshot.physical.energy.toFixed(1)}
                  </div>
                  <div className="label mt-2">energy</div>
                </div>
              </div>
              <dl className="mt-3 space-y-2">
                {[
                  ["condition", `${snapshot.mode} · ${mode.short}`],
                  ["state", snapshot.alive ? (running ? "running" : "paused") : "terminated"],
                  [
                    "collected",
                    `${snapshot.physical.resourcesCollected} resources · ${snapshot.physical.distance} moves`,
                  ],
                  ["samples", `${series.length} ticks retained`],
                ].map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-3">
                    <dt className="label">{key}</dt>
                    <dd className="num text-[10.5px] text-lab-text">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </section>

        <div className="rule-double" />

        {/* -------------------------------------------------------- controls */}
        <div className="py-4">
          <ControlDeck controller={controller} onCompare={() => setCompareOpen(true)} />
        </div>

        {/* ----------------------------------------------------------- stage */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <EnvironmentPanel engine={engine} snapshot={snapshot} />
            <p className="figure-caption mt-2.5 px-0.5">
              Fig. 01 — The world. Obstacles in graphite, resources in moss, the agent in vermilion
              with its sensor footprint dashed. Hover any cell to read its type.
            </p>
          </div>
          <div className="space-y-5 lg:col-span-5">
            <ArchitecturePanel snapshot={snapshot} />
            <InternalStatePanel snapshot={snapshot} />
          </div>
        </section>

        {/* ---------------------------------------------------------- record */}
        <section className="mt-5">
          <MetricsPanel snapshot={snapshot} series={series} />
        </section>

        <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <SelfModelPanel snapshot={snapshot} />
          <EventLogPanel events={events} />
          <ReferencePanel snapshot={snapshot} />
        </section>

        {/* ---------------------------------------------------------- footer */}
        <footer className="mt-12 border-t border-lab-text/85 pt-5">
          <div className="grid grid-cols-1 gap-8 pb-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="font-serif text-[19px] leading-snug text-lab-text">
                Inspired by Hofstadter&rsquo;s strange loop; built as a falsifiable instrument, not a
                theory of mind.
              </p>
              <p className="mt-3 max-w-[86ch] text-[11.5px] leading-relaxed text-lab-muted">
                Every estimate on this page is computed locally from the seeded run. This is an
                experimental simulation: it makes no claim about consciousness, sentience or
                subjective experience. The mechanisms are predictors and controllers with measurable
                behaviour.
              </p>
            </div>
            <div className="flex flex-col gap-2 lg:col-span-5 lg:items-end">
              <span className="label">
                seed <span className="num text-lab-text">{settings.seed}</span>
              </span>
              <button className="btn-link" onClick={() => setAboutOpen(true)}>
                About the project
              </button>
              <button className="btn-link" onClick={() => setCompareOpen(true)}>
                Compare all conditions
              </button>
              <span className="font-serif text-[12px] italic text-lab-faint">
                Strange Loop Lab · MMXXVI
              </span>
            </div>
          </div>
        </footer>
      </main>

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      {compareOpen ? (
        <ComparisonView seed={settings.seed} onClose={() => setCompareOpen(false)} />
      ) : null}
    </div>
  );
}
