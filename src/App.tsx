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
import { V02Lab } from "./v02/V02Lab";
import { V03Lab } from "./v03/V03Lab";
import { V04Lab } from "./v04/V04Lab";
import { V05Lab } from "./v05/V05Lab";
import { ResearchPage } from "./research/ResearchPage";

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
        onOpenVersion={(version) =>
          setView(version === "v0" ? "v0" : version)
        }
      />
    );
  }

  return (
    <div className="min-h-screen">
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

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 sm:px-6">
        <ControlDeck controller={controller} onCompare={() => setCompareOpen(true)} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5 xl:col-span-4">
            <EnvironmentPanel engine={engine} snapshot={snapshot} />
          </div>
          <div className="lg:col-span-7 xl:col-span-8">
            <ArchitecturePanel snapshot={snapshot} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5 xl:col-span-4">
            <InternalStatePanel snapshot={snapshot} />
          </div>
          <div className="lg:col-span-7 xl:col-span-8">
            <MetricsPanel snapshot={snapshot} series={series} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
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
