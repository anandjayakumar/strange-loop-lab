import { useCallback, useEffect, useRef, useState } from "react";
import { ComparisonRunner } from "../simulation/experiments/comparison";

export function useComparison(seed: number, horizon: number, open: boolean) {
  const [runner, setRunner] = useState<ComparisonRunner>(
    () => new ComparisonRunner(seed, horizon),
  );
  const runnerRef = useRef(runner);
  const [running, setRunning] = useState(false);
  const [version, setVersion] = useState(0);

  const restart = useCallback(
    (nextSeed = seed, nextHorizon = horizon) => {
      const next = new ComparisonRunner(nextSeed, nextHorizon);
      next.start();
      runnerRef.current = next;
      setRunner(next);
      setRunning(true);
      setVersion((v) => v + 1);
    },
    [seed, horizon],
  );

  useEffect(() => {
    if (!open) {
      runnerRef.current.stop();
      setRunning(false);
      return;
    }
    const next = new ComparisonRunner(seed, horizon);
    next.start();
    runnerRef.current = next;
    setRunner(next);
    setRunning(true);
    setVersion((v) => v + 1);
  }, [open, seed, horizon]);

  useEffect(() => {
    if (!open || !running) return;
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      if (now - last > 55) {
        runnerRef.current.advance(10);
        setVersion((v) => v + 1);
        last = now;
        if (runnerRef.current.progress().completed) {
          setRunning(false);
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [open, running, runner]);

  const pause = useCallback(() => {
    runnerRef.current.stop();
    setRunning(false);
  }, []);

  const resume = useCallback(() => {
    if (runnerRef.current.progress().completed) {
      restart();
      return;
    }
    runnerRef.current.start();
    setRunning(true);
  }, [restart]);

  return {
    runner,
    version,
    running,
    progress: runner.progress(),
    series: runner.series(),
    summaries: runner.summaries(),
    pause,
    resume,
    restart,
  };
}
