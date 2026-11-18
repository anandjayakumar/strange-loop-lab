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
import { TopBar } from "./components/TopBar";
import { useSimulation } from "./ui/useSimulation";

export default function App() {
  const controller = useSimulation();
  const { snapshot, series, events, running, settings, engine, actions } = controller;
  const [aboutOpen, setAboutOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const { toggleRunning, step, microStep, reset } = actions;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (aboutOpen || compareOpen) return;
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
  }, [toggleRunning, step, microStep, reset, aboutOpen, compareOpen]);

  return (
    <div className="min-h-screen">
      <TopBar
        snapshot={snapshot}
        running={running}
        onAbout={() => setAboutOpen(true)}
        onCompare={() => setCompareOpen(true)}
        onToggleRunning={actions.toggleRunning}
      />

      <main className="mx-auto max-w-[1600px] space-y-3 px-3 py-3 sm:px-4">
        <ControlDeck controller={controller} onCompare={() => setCompareOpen(true)} />

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-5 xl:col-span-4">
            <EnvironmentPanel engine={engine} snapshot={snapshot} />
          </div>
          <div className="lg:col-span-7 xl:col-span-8">
            <ArchitecturePanel snapshot={snapshot} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-5 xl:col-span-4">
            <InternalStatePanel snapshot={snapshot} />
          </div>
          <div className="lg:col-span-7 xl:col-span-8">
            <MetricsPanel snapshot={snapshot} series={series} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SelfModelPanel snapshot={snapshot} />
          </div>
          <div className="lg:col-span-4">
            <EventLogPanel events={events} />
          </div>
          <div className="lg:col-span-4">
            <ReferencePanel snapshot={snapshot} />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-lab-line/60 px-1 pb-5 pt-3">
          <p className="max-w-[90ch] text-[9px] leading-relaxed text-lab-faint">
            Strange Loop Lab is inspired by ideas in Douglas Hofstadter's <em>Gödel, Escher,
            Bach</em>. It is an experimental simulation, not a theory of consciousness. Every
            estimate is computed locally and every feedback edge is visible and switchable.
          </p>
          <div className="flex items-center gap-3 font-mono text-[8px] uppercase tracking-[0.12em] text-lab-faint">
            <span>
              seed <span className="text-lab-muted">{settings.seed}</span>
            </span>
            <span className="h-3 w-px bg-lab-line" />
            <button className="transition-colors hover:text-lab-muted" onClick={() => setAboutOpen(true)}>
              about
            </button>
            <button className="transition-colors hover:text-lab-muted" onClick={() => setCompareOpen(true)}>
              compare
            </button>
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
