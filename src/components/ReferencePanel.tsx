import type { EngineSnapshot } from "../simulation/types";
import { MODE_META } from "../simulation/types";
import { Panel } from "./ui/Panel";

export function ReferencePanel({ snapshot }: { snapshot: EngineSnapshot }) {
  const mode = MODE_META[snapshot.mode];
  return (
    <Panel
      index="R"
      title="Protocol & glossary"
      subtitle="How to read the numbers; scope and limits"
      bodyClassName="p-3"
      right={<span className="chip">reproducible</span>}
    >
      <div className="rounded-md border border-lab-line/60 bg-lab-raise/25 px-2.5 py-2">
        <div className="mono-label">active condition</div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="font-mono text-[11px]" style={{ color: mode.accent }}>
            {snapshot.mode}
          </span>
          <span className="text-[11px] text-lab-text">{mode.name}</span>
        </div>
        <p className="mt-1 text-[9px] leading-relaxed text-lab-faint">{mode.description}</p>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[8px]">
          <span className="text-lab-faint">seed</span>
          <span className="text-right text-lab-muted">{snapshot.seed}</span>
          <span className="text-lab-faint">world</span>
          <span className="text-right text-lab-muted">30 × 30 grid</span>
          <span className="text-lab-faint">actions</span>
          <span className="text-right text-lab-muted">5 discrete</span>
          <span className="text-lab-faint">cognitive phases</span>
          <span className="text-right text-lab-muted">10 / tick</span>
          <span className="text-lab-faint">recursion depth</span>
          <span className="text-right text-lab-muted">2 levels</span>
          <span className="text-lab-faint">world model</span>
          <span className="text-right text-lab-muted">logistic delta rule</span>
          <span className="text-lab-faint">self-model</span>
          <span className="text-right text-lab-muted">EMA + Kalman filter</span>
        </div>
      </div>

      <div className="mt-2.5">
        <div className="mono-label mb-1.5">Measurement definitions</div>
        <div className="space-y-1.5">
          {[
            ["Self accuracy", "1 − mean |Ê − E| / 25 over a 60-tick window. Ê is the self-model's energy belief; E is instrumented."],
            ["World accuracy", "1 − mean Brier score for predicted success and resource collection on the chosen action."],
            ["Forward prediction", "1 − normalized error of the self-model's predicted energy change and success probability."],
            ["Self influence", "KL divergence between the actual action distribution and the same softmax with the self-model term removed."],
            ["Meta calibration", "Predictive Pearson r: does current meta-model trust track measured self-model accuracy 15 ticks later?"],
            ["Adaptation", "Jensen–Shannon divergence between the last 30 and the preceding 30 action choices."],
          ].map(([term, definition]) => (
            <div key={term} className="grid grid-cols-[92px_1fr] gap-2">
              <span className="font-mono text-[8px] text-lab-muted">{term}</span>
              <span className="text-[9px] leading-snug text-lab-faint">{definition}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2.5 rounded border border-lab-line/60 bg-lab-raise/20 px-2.5 py-2">
        <div className="mono-label">reproduction</div>
        <p className="mt-1 text-[9px] leading-relaxed text-lab-faint">
          The environment, interoceptive noise, slip events and softmax sampling all draw from
          separate named PRNG streams derived from the seed. Reset with the same seed and condition
          to obtain the same trajectory. Toggle changes alter future causation only; they do not
          alter the seed.
        </p>
      </div>

      <div className="mt-2 rounded border border-lab-amber/15 bg-lab-amber/[0.035] px-2.5 py-2">
        <div className="mono-label text-lab-amber/80">not a consciousness score</div>
        <p className="mt-1 text-[9px] leading-relaxed text-lab-faint">
          These are measurements of prediction, influence and calibration in a computational
          system. The lab makes no claim that the agent is aware, sentient or intelligent.
        </p>
      </div>
    </Panel>
  );
}
