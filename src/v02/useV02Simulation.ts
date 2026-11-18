import { useCallback, useEffect, useRef, useState } from "react";
import { V02Engine } from "../simulation/v02/engine";
import type {
  Difficulty,
  ExplorationMode,
  PriorRegime,
  Scenario,
  ShiftKind,
  V02Options,
  V02SeriesPoint,
  V02Snapshot,
} from "../simulation/v02/types";

export interface V02Settings {
  seed: number;
  difficulty: Difficulty;
  priorRegime: PriorRegime;
  scenario: Scenario;
  explorationMode: ExplorationMode;
  lambda: number;
  speed: number;
}

const DEFAULTS: V02Settings = {
  seed: 20261118,
  difficulty: "standard",
  priorRegime: "uninformed",
  scenario: "stable",
  explorationMode: "voi",
  lambda: 0.35,
  speed: 8,
};

function create(settings: V02Settings): V02Engine {
  return new V02Engine({
    seed: settings.seed,
    difficulty: settings.difficulty,
    priorRegime: settings.priorRegime,
    scenario: settings.scenario,
    explorationMode: settings.explorationMode,
    lambda: settings.lambda,
    recordEvents: true,
    historyLimit: 1800,
  });
}

export function useV02Simulation() {
  const [settings, setSettings] = useState<V02Settings>(DEFAULTS);
  const settingsRef = useRef(settings);
  const [engine, setEngine] = useState<V02Engine>(() => create(settings));
  const engineRef = useRef(engine);
  const [snapshot, setSnapshot] = useState<V02Snapshot>(() => engine.getSnapshot());
  const [series, setSeries] = useState<readonly V02SeriesPoint[]>([]);
  const [events, setEvents] = useState<V02Snapshot["events"]>([]);
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

  const swap = useCallback((next: V02Engine) => {
    engineRef.current = next;
    setEngine(next);
    setSnapshot(next.getSnapshot());
    setSeries([...next.getSeries()]);
    setEvents([...next.getEvents()]);
  }, []);

  const resetWith = useCallback(
    (patch: Partial<V02Settings>) => {
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

  const trigger = useCallback(
    (kind: Exclude<ShiftKind, "none">) => {
      engineRef.current.triggerShift(kind);
      setFlash(`Triggered ${kind.replace("_", " ")} shift`);
      publish();
    },
    [publish],
  );

  const injectTrap = useCallback(() => {
    engineRef.current.injectBeliefTrap("pessimistic_cost");
    setFlash("Injected pessimistic cost belief");
    publish();
  }, [publish]);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 2200);
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
      if (now - lastPublish > 78) {
        const current = engineRef.current;
        setSnapshot(current.getSnapshot());
        setSeries([...current.getSeries()]);
        setEvents([...current.getEvents()]);
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
    actions: { toggleRunning, step, phase, reset, setSpeed, resetWith, trigger, injectTrap },
  };
}

export type V02Controller = ReturnType<typeof useV02Simulation>;
export type { V02Options };
