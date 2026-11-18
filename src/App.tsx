import { useEffect, useState } from "react";
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
import { SiteHeader, type SiteView } from "./components/SiteHeader";
import { VersionHero } from "./components/VersionHero";
import { useSimulation } from "./ui/useSimulation";
import { V02Lab } from "./v02/V02Lab";
import { V03Lab } from "./v03/V03Lab";
import { V04Lab } from "./v04/V04Lab";
import { V05Lab } from "./v05/V05Lab";
import { ResearchPage } from "./research/ResearchPage";
import { MODE_META } from "./simulation/types";

export default function App() {
  const controller = useSimulation();
  const [view, setView] = useState<SiteView>("v0");
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

  const navigate = (next: SiteView) => setView(next);

  if (view === "v02") {
    return <V02Lab onNavigate={navigate} />;
  }

  if (view === "v03") {
    return <V03Lab onNavigate={navigate} />;
  }

  if (view === "v04") {
    return <V04Lab onNavigate={navigate} />;
  }

  if (view === "v05") {
    return <V05Lab onNavigate={navigate} />;
  }

  if (view === "research") {
    return (
      <ResearchPage
        onBack={() => setView("v0")}
        onNavigate={navigate}
        onOpenVersion={(version) => setView(version === "v0" ? "v0" : version)}
      />
    );
  }

  const mode = MODE_META[snapshot.mode];
  const status = !snapshot.alive ? "terminated" : running ? "running" : "paused";

  return (
    <div className="relative min-h-screen">
      <SiteHeader active="v0" onNavigate={navigate} />

      <main className="relative z-10 mx-auto max-w-[1560px] px-5 pb-2 sm:px-8">
        <VersionHero
          id="hero"
          label="V0.1"
          edition="first-order self-modelling"
          headline={
            <>
              An agent that
              <br />
              <span className="italic text-lab-amber">models itself</span>
              <span className="text-lab-line2">.</span>
            </>
          }
          lede="A deterministic organism in a 30 × 30 world, learning what its own body costs, predicts and can bear. Every feedback edge is visible, switchable and measurable — the interface is the experiment, not a summary of it."
          tick={snapshot.tick}
          energy={snapshot.physical.energy}
          status={status}
          condition={`${snapshot.mode} · ${mode.short}`}
          seed={snapshot.seed}
          detail={`${snapshot.physical.resourcesCollected} resources · ${snapshot.physical.distance} moves`}
          onResearch={() => setView("research")}
          onLatest={() => setView("v05")}
        />

        <div className="rule-double" />

        <div id="controls" className="py-4">
          <ControlDeck controller={controller} onCompare={() => setCompareOpen(true)} />
        </div>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div id="environment" className="lg:col-span-7">
            <EnvironmentPanel engine={engine} snapshot={snapshot} />
            <p className="figure-caption mt-2.5 px-0.5">
              Fig. 01 — The world. Obstacles in graphite, resources in moss, the agent in vermilion
              with its sensor footprint dashed. Hover any cell to read its type.
            </p>
          </div>
          <div id="architecture" className="space-y-5 lg:col-span-5">
            <ArchitecturePanel snapshot={snapshot} />
            <div id="internal-state">
              <InternalStatePanel snapshot={snapshot} />
            </div>
          </div>
        </section>

        <section id="metrics" className="mt-5">
          <MetricsPanel snapshot={snapshot} series={series} />
        </section>

        <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div id="self-model">
            <SelfModelPanel snapshot={snapshot} />
          </div>
          <div id="event-log">
            <EventLogPanel events={events} />
          </div>
          <div id="reference">
            <ReferencePanel snapshot={snapshot} />
          </div>
        </section>

        <footer id="about" className="mt-12 border-t border-lab-text/85 pt-5">
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
