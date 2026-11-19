import { useCallback, useEffect, useRef, useState } from "react";
import { V06Engine } from "../simulation/v06/engine";
import type {
  Ablation,
  ControlKind,
  Difficulty,
  DisruptionKind,
  PriorRegime,
  V06Scenario,
  V06SeriesPoint,
  V06Snapshot,
} from "../simulation/v06/types";

export interface V06Settings {
  seed: number;
  difficulty: Difficulty;
  priorRegime: PriorRegime;
  scenario: V06Scenario;
  control: ControlKind;
  ablation: Ablation;
  lambda: number;
  speed: number;
  beliefTrap: "none" | "pessimistic_cost";
  disruption: DisruptionKind;
}

const DEFAULTS: V06Settings = {
  seed: 20261119,
  difficulty: "standard",
  priorRegime: "uninformed",
  scenario: "stable",
  control: "full",
  ablation: "none",
  lambda: 0.45,
  speed: 8,
  beliefTrap: "none",
  disruption: "energy_sensor",
};

function create(settings: V06Settings): V06Engine {
  return new V06Engine({
    seed: settings.seed,
    difficulty: settings.difficulty,
    priorRegime: settings.priorRegime,
    scenario: settings.scenario,
    control: settings.control,
    ablation: settings.ablation,
    lambda: settings.lambda,
    beliefTrap: settings.beliefTrap,
    disruption: settings.disruption,
    recordEvents: true,
    historyLimit: 1800,
  });
}

export function useV06Simulation() {
  const [settings, setSettings] = useState<V06Settings>(DEFAULTS);
  const settingsRef = useRef(settings);
  const [engine, setEngine] = useState<V06Engine>(() => create(settings));
  const engineRef = useRef(engine);
  const [snapshot, setSnapshot] = useState<V06Snapshot>(() => engine.getSnapshot());
  const [series, setSeries] = useState<readonly V06SeriesPoint[]>([]);
  const [events, setEvents] = useState<V06Snapshot["events"]>([]);
  const [running, setRunningState] = useState(false);
  const runningRef = useRef(false);
  const [flash, setFlash] = useState<string | null>(null);

  const setRunning = useCallback((value: boolean) => {
    runningRef.current = value;
    setRunningState(value);
  }, []);

  const publish = useCallback(() => {
    const current = engineRef.current;
    setSnapshot(current.getSnapshot());
    setSeries([...current.getSeries()]);
    setEvents([...current.getEvents()]);
  }, []);

  const swap = useCallback((next: V06Engine) => {
    engineRef.current = next;
    setEngine(next);
    setSnapshot(next.getSnapshot());
    setSeries([...next.getSeries()]);
    setEvents([...next.getEvents()]);
  }, []);

  const resetWith = useCallback(
    (patch: Partial<V06Settings>) => {
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      setSettings(next);
      setRunning(false);
      swap(create(next));
    },
    [setRunning, swap],
  );

  const reset = useCallback(() => resetWith({}), [resetWith]);

  const setSpeed = useCallback((speed: number) => {
    const next = { ...settingsRef.current, speed };
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const toggleRunning = useCallback(() => {
    if (!engineRef.current.physical.alive) return;
    setRunning(!runningRef.current);
  }, [setRunning]);

  const step = useCallback(() => {
    setRunning(false);
    engineRef.current.step();
    publish();
  }, [publish, setRunning]);

  const phase = useCallback(() => {
    setRunning(false);
    engineRef.current.advancePhase();
    publish();
  }, [publish, setRunning]);

  const triggerDisruption = useCallback(
    (kind: DisruptionKind) => {
      engineRef.current.triggerDisruption(kind);
      setFlash(`Injected ${kind.replace("_", " ")} disruption`);
      publish();
    },
    [publish],
  );

  const injectTrap = useCallback(() => {
    engineRef.current.injectBeliefTrap("pessimistic_cost");
    setFlash("Injected pessimistic rough-cost prior (25)");
    publish();
  }, [publish]);

  const injectPulse = useCallback(() => {
    engineRef.current.injectPulse(13, 0.3, 1);
    setFlash("Injected ambiguous multi-channel pulse");
    publish();
  }, [publish]);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 2400);
    return () => window.clearTimeout(id);
  }, [flash]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastPublish = 0;
    let acc = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      const current = engineRef.current;
      if (runningRef.current && current.physical.alive) {
        acc += dt * settingsRef.current.speed;
        let guard = 0;
        while (acc >= 1 && guard < 90) {
          current.step();
          acc -= 1;
          guard++;
          if (!current.physical.alive) break;
        }
        if (!current.physical.alive) {
          runningRef.current = false;
          setRunningState(false);
        }
      } else {
        acc = 0;
      }
      if (now - lastPublish > 90) {
        const latest = engineRef.current;
        setSnapshot(latest.getSnapshot());
        setSeries([...latest.getSeries()]);
        setEvents([...latest.getEvents()]);
        lastPublish = now;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return {
    engine,
    snapshot,
    series,
    events,
    settings,
    running,
    flash,
    actions: {
      toggleRunning,
      step,
      phase,
      reset,
      setSpeed,
      resetWith,
      triggerDisruption,
      injectTrap,
      injectPulse,
    },
  };
}

export type V06Controller = ReturnType<typeof useV06Simulation>;
