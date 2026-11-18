import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SEED } from "../simulation/config";
import { SimulationEngine } from "../simulation/experiments/engine";
import { normaliseSeed } from "../simulation/rng";
import type {
  EngineSnapshot,
  EngineOptions,
  Mode,
  SeriesPoint,
  SimEvent,
} from "../simulation/types";

export interface LabSettings {
  seed: number;
  mode: Mode;
  speed: number;
  selfFeedback: boolean;
  metaFeedback: boolean;
  plasticity: boolean;
  priorWeighting: boolean;
}

type ToggleKey = "selfFeedback" | "metaFeedback" | "plasticity" | "priorWeighting";

export const DEFAULT_SETTINGS: LabSettings = {
  seed: DEFAULT_SEED,
  mode: "C",
  speed: 10,
  selfFeedback: true,
  metaFeedback: true,
  plasticity: true,
  priorWeighting: true,
};

function createEngine(settings: LabSettings): SimulationEngine {
  return new SimulationEngine({
    seed: settings.seed,
    mode: settings.mode,
    selfFeedback: settings.selfFeedback,
    metaFeedback: settings.metaFeedback,
    plasticity: settings.plasticity,
    priorWeighting: settings.priorWeighting,
  });
}

export function useSimulation(initial: Partial<LabSettings> = {}) {
  const [settings, setSettings] = useState<LabSettings>({
    ...DEFAULT_SETTINGS,
    ...initial,
  });
  const settingsRef = useRef(settings);
  const [engine, setEngine] = useState<SimulationEngine>(() => createEngine(settings));
  const engineRef = useRef(engine);
  const [snapshot, setSnapshot] = useState<EngineSnapshot>(() => engine.getSnapshot());
  const [series, setSeries] = useState<readonly SeriesPoint[]>([]);
  const [events, setEvents] = useState<readonly SimEvent[]>([]);
  const [running, setRunningState] = useState(false);
  const runningRef = useRef(false);

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

  const swapEngine = useCallback((next: SimulationEngine) => {
    engineRef.current = next;
    setEngine(next);
    setSnapshot(next.getSnapshot());
    setSeries([...next.getSeries()]);
    setEvents([...next.getEvents()]);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    swapEngine(createEngine(settingsRef.current));
  }, [setRunning, swapEngine]);

  const changeMode = useCallback(
    (mode: Mode) => {
      const next = { ...settingsRef.current, mode };
      settingsRef.current = next;
      setSettings(next);
      setRunning(false);
      swapEngine(createEngine(next));
    },
    [setRunning, swapEngine],
  );

  const changeSeed = useCallback(
    (seed: number) => {
      const normalised = normaliseSeed(seed);
      const next = { ...settingsRef.current, seed: normalised };
      settingsRef.current = next;
      setSettings(next);
      setRunning(false);
      swapEngine(createEngine(next));
    },
    [setRunning, swapEngine],
  );

  const changeSpeed = useCallback((speed: number) => {
    const next = { ...settingsRef.current, speed };
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const toggle = useCallback(
    (key: ToggleKey) => {
      const next = { ...settingsRef.current, [key]: !settingsRef.current[key] };
      settingsRef.current = next;
      setSettings(next);
      engineRef.current.setOptions({ [key]: next[key] } as Partial<EngineOptions>);
      publish();
    },
    [publish],
  );

  const step = useCallback(() => {
    setRunning(false);
    engineRef.current.step();
    publish();
  }, [publish, setRunning]);

  const microStep = useCallback(() => {
    setRunning(false);
    engineRef.current.advancePhase();
    publish();
  }, [publish, setRunning]);

  const resetModels = useCallback(() => {
    engineRef.current.resetAgentModels();
    publish();
  }, [publish]);

  const toggleRunning = useCallback(() => {
    const current = engineRef.current;
    if (!current.physical.alive) return;
    setRunning(!runningRef.current);
  }, [setRunning]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastPublish = 0;
    let accumulator = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      const current = engineRef.current;
      if (runningRef.current && current.physical.alive) {
        accumulator += dt * settingsRef.current.speed;
        let guard = 0;
        while (accumulator >= 1 && guard < 90) {
          current.step();
          accumulator -= 1;
          guard++;
          if (!current.physical.alive) break;
        }
        if (!current.physical.alive) {
          accumulator = 0;
          runningRef.current = false;
          setRunningState(false);
        }
      } else {
        accumulator = 0;
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
    actions: {
      toggleRunning,
      step,
      microStep,
      reset,
      changeMode,
      changeSeed,
      changeSpeed,
      toggle,
      resetModels,
    },
  };
}

export type LabController = ReturnType<typeof useSimulation>;
