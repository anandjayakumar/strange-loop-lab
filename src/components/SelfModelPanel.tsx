import { AGENT } from "../simulation/config";
import type { Action, EngineSnapshot } from "../simulation/types";
import { cn } from "../lib/cn";
import { fmt, pct, signed } from "../ui/format";
import { Panel } from "./ui/Panel";
import { ConfidenceBar, Meter, Ring } from "./ui/Primitives";

const BASE_LR = 0.09;
const MOVING_ACTIONS: Action[] = ["UP", "DOWN", "LEFT", "RIGHT"];

export function SelfModelPanel({ snapshot }: { snapshot: EngineSnapshot }) {
  const self = snapshot.selfModel;
  const meta = snapshot.metaModel;
  const selection = snapshot.selection;
  const selectedPrediction = selection
    ? snapshot.predictions.find((p) => p.actionIndex === selection.actionIndex)
    : undefined;
  const mode = snapshot.mode;

  if (!self) {
    return (
      <Panel
        index="04"
        title="Self-model"
        subtitle="Internal estimates and readable parameters"
        right={<span className="chip text-lab-faint">absent</span>}
        bodyClassName="p-4"
      >
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-md border border-dashed border-lab-line/70 px-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-lab-line2 bg-lab-raise">
            <span className="font-serif text-2xl text-lab-faint">∅</span>
          </div>
          <h3 className="mt-3 text-[13px] text-lab-muted">No self-model in Mode A</h3>
          <p className="mt-1 max-w-[38ch] text-[11px] leading-relaxed text-lab-faint">
            This condition has sensory input, memory and a world model only. There is no estimate
            of energy, fatigue or movement cost, and therefore no internal prediction to influence
            action selection.
          </p>
          <div className="mt-4 rounded border border-lab-line/70 bg-lab-raise/40 px-3 py-2 font-mono text-[8px] uppercase tracking-[0.1em] text-lab-faint">
            switch to B or C to grow a self-model
          </div>
        </div>
      </Panel>
    );
  }

  const lrMultiplier = self.learnRate / BASE_LR;
  const energyError = self.initialized
    ? Math.abs(self.energyEstimate - snapshot.physical.energy)
    : null;
  const learnedInfluence = snapshot.metrics.selfInfluence;

  return (
    <Panel
      index="04"
      title="Self-model"
      subtitle="Beliefs, reliability and readable coefficients"
      right={
        <span
          className="chip"
          style={
            snapshot.options.selfFeedback
              ? { color: "#1d5c67", borderColor: "rgba(29,92,103,0.25)" }
              : { color: "#b23f24", borderColor: "rgba(178,63,36,0.3)" }
          }
        >
          {!snapshot.options.selfFeedback
            ? "feedback off"
            : mode === "C"
              ? "recursive"
              : "learned"}
        </span>
      }
      bodyClassName="p-3"
    >
      <div className="flex items-start justify-around gap-2 rounded-md border border-lab-line/70 bg-lab-raise/25 px-2 py-2.5">
        <Ring
          value={self.initialized ? self.confidence : 0}
          label="confidence"
          color="#1d5c67"
          caption={
            self.initialized
              ? `err ema ${fmt(self.predictionErrorEMA)}`
              : "awaiting sample"
          }
        />
        {meta ? (
          <Ring
            value={meta.trust}
            label="meta trust"
            color="#634070"
            caption={meta.enabled ? "causally active" : "tracking only"}
          />
        ) : (
          <Ring value={1} label="self influence" color="#634070" caption="fixed in Mode B" />
        )}
        <div className="min-w-0 flex-1 space-y-2 self-center">
          <ConfidenceBar
            label="self state accuracy"
            value={snapshot.metrics.selfStateAccuracy ?? 0}
            color="#39643f"
            right={pct(snapshot.metrics.selfStateAccuracy)}
          />
          <ConfidenceBar
            label="forward prediction"
            value={snapshot.metrics.selfPredictionAccuracy ?? 0}
            color="#1d5c67"
            right={pct(snapshot.metrics.selfPredictionAccuracy)}
          />
          <ConfidenceBar
            label="influence on policy"
            value={Math.min(1, learnedInfluence * 1.4)}
            color="#b23f24"
            right={`KL ${fmt(learnedInfluence, 3)}`}
          />
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {[
          [
            "energy belief",
            self.initialized ? self.energyEstimate.toFixed(1) : "—",
            energyError === null ? "awaiting first sample" : `± ${energyError.toFixed(1)} vs actual`,
          ],
          ["fatigue belief", self.fatigue.toFixed(2), `actual ${snapshot.physical.fatigue.toFixed(2)}`],
          ["movement cost", self.movementCost.toFixed(2), `slip rate ${self.slipRate.toFixed(2)}`],
          ["rest gain", self.restGain.toFixed(2), `collect ${self.collectGain.toFixed(1)}`],
          ["survival horizon", self.survivalHorizon >= 999 ? ">999" : self.survivalHorizon.toFixed(0), "estimated steps"],
          [
            "next success",
            selectedPrediction?.self ? pct(selectedPrediction.self.pSuccess) : "—",
            selectedPrediction?.self
              ? `${selectedPrediction.action} · f→${fmt(selectedPrediction.self.fatigueNext)}`
              : "no action",
          ],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded border border-lab-line/60 bg-lab-raise/30 px-2 py-1.5">
            <div className="mono-label">{label}</div>
            <div className="font-mono text-[13px] tabular-nums text-lab-text">{value}</div>
            <div className="truncate font-mono text-[7px] text-lab-faint">{sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-2.5 rounded-md border border-lab-line/70 px-2.5 py-2">
        <div className="flex items-center justify-between">
          <span className="mono-label">Level crossing</span>
          <span className="font-mono text-[8px] text-lab-faint">
            {mode === "C" ? (meta?.enabled ? "closed loop" : "open loop") : "not present"}
          </span>
        </div>
        {meta ? (
          <>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
              <Meter
                label="learning rate"
                value={`${self.learnRate.toFixed(3)} (×${lrMultiplier.toFixed(2)})`}
                ratio={lrMultiplier / 2.1}
                color="#634070"
                hint={`base ${BASE_LR.toFixed(2)}`}
              />
              <Meter
                label="prior weight"
                value={(
                  snapshot.options.metaFeedback && snapshot.options.priorWeighting
                    ? meta.priorWeight
                    : 0.5
                ).toFixed(2)}
                ratio={
                  snapshot.options.metaFeedback && snapshot.options.priorWeighting
                    ? meta.priorWeight
                    : 0.5
                }
                color="#634070"
                hint="sensory vs internal"
              />
              <Meter
                label="meta error ema"
                value={meta.errorEMA.toFixed(3)}
                ratio={meta.errorEMA}
                color="#b23f24"
                hint={`${meta.observations} updates`}
              />
              <Meter
                label="predictive r"
                value={fmt(snapshot.metrics.metaCalibration, 2)}
                ratio={((snapshot.metrics.metaCalibration ?? 0) + 1) / 2}
                color="#39643f"
                hint="trust → accuracy, 15 ticks"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.08em]",
                  meta.plasticityActive
                    ? "border-lab-violet/35 text-lab-violet"
                    : "border-lab-line text-lab-faint",
                )}
              >
                plasticity {meta.plasticityActive ? "on" : "off"}
              </span>
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.08em]",
                  meta.priorWeightingActive
                    ? "border-lab-violet/35 text-lab-violet"
                    : "border-lab-line text-lab-faint",
                )}
              >
                prior weighting {meta.priorWeightingActive ? "on" : "off"}
              </span>
              <span className="rounded border border-lab-line px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.08em] text-lab-faint">
                influence ×{(selection?.selfInfluence ?? 0).toFixed(2)}
              </span>
            </div>
          </>
        ) : (
          <p className="mt-2 text-[10px] leading-relaxed text-lab-faint">
            Mode B has no second-order model. The self-model's influence is fixed at 1 and its
            learning rate does not adapt.
          </p>
        )}
      </div>

      <div className="mt-2.5 space-y-1.5">
        <details className="group rounded border border-lab-line/60 bg-lab-raise/20">
          <summary className="flex cursor-pointer items-center justify-between px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-lab-muted">
            self-model coefficients
            <span className="text-lab-faint group-open:hidden">+</span>
          </summary>
          <div className="space-y-2 border-t border-lab-line/60 px-2.5 py-2">
            <WeightList title="success logistic" labels={self.successLabels} values={self.successWeights} />
            <WeightList title="collect logistic" labels={self.collectLabels} values={self.collectWeights} />
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[8px]">
              <span className="text-lab-faint">fatigue filter rate</span>
              <span className="text-right text-lab-muted">0.048 / move</span>
              <span className="text-lab-faint">rest recovery</span>
              <span className="text-right text-lab-muted">0.105 / rest</span>
              <span className="text-lab-faint">energy variance</span>
              <span className="text-right text-lab-muted">{fmt(self.energyVariance, 2)}</span>
              <span className="text-lab-faint">innovation</span>
              <span className="text-right text-lab-muted">{signed(self.innovation, 2)}</span>
            </div>
          </div>
        </details>

        <details className="group rounded border border-lab-line/60 bg-lab-raise/20">
          <summary className="flex cursor-pointer items-center justify-between px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-lab-muted">
            world-model weights
            <span className="text-lab-faint group-open:hidden">+</span>
          </summary>
          <div className="space-y-2 border-t border-lab-line/60 px-2.5 py-2">
            <WorldWeightTable
              title="success"
              labels={snapshot.worldModel.weightLabels}
              byAction={snapshot.worldModel.successByAction}
            />
            <WorldWeightTable
              title="collect"
              labels={snapshot.worldModel.collectLabels}
              byAction={snapshot.worldModel.collectByAction}
            />
            <WorldWeightTable
              title="collision"
              labels={snapshot.worldModel.collisionLabels}
              byAction={snapshot.worldModel.collisionByAction}
            />
          </div>
        </details>

        {meta ? (
          <details className="group rounded border border-lab-line/60 bg-lab-raise/20">
            <summary className="flex cursor-pointer items-center justify-between px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-lab-muted">
              meta-model coefficients
              <span className="text-lab-faint group-open:hidden">+</span>
            </summary>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-lab-line/60 px-2.5 py-2 font-mono text-[8px]">
              <span className="text-lab-faint">trust</span>
              <span className="text-right text-lab-muted">{meta.trust.toFixed(4)}</span>
              <span className="text-lab-faint">error ema</span>
              <span className="text-right text-lab-muted">{meta.errorEMA.toFixed(4)}</span>
              <span className="text-lab-faint">learning multiplier</span>
              <span className="text-right text-lab-muted">{meta.learningRateMultiplier.toFixed(3)}</span>
              <span className="text-lab-faint">prior weight</span>
              <span className="text-right text-lab-muted">{meta.priorWeight.toFixed(3)}</span>
              <span className="text-lab-faint">internal calibration</span>
              <span className="text-right text-lab-muted">{meta.calibration.toFixed(3)}</span>
              <span className="text-lab-faint">observations</span>
              <span className="text-right text-lab-muted">{meta.observations}</span>
            </div>
          </details>
        ) : null}
      </div>

      <p className="mt-2 text-[8px] leading-relaxed text-lab-faint">
        Energy ceiling {AGENT.maxEnergy} · every coefficient above is updated online from outcomes.
        No value is copied from ground-truth state.
      </p>
    </Panel>
  );
}

function WeightList({
  title,
  labels,
  values,
}: {
  title: string;
  labels: string[];
  values: number[];
}) {
  return (
    <div>
      <div className="mb-0.5 font-mono text-[7px] uppercase tracking-[0.1em] text-lab-faint/80">
        {title}
      </div>
      <div className="space-y-0.5">
        {labels.map((label, index) => (
          <div key={label} className="flex items-baseline justify-between gap-2 font-mono text-[8px]">
            <span className="truncate text-lab-faint">{label}</span>
            <span className="tabular-nums text-lab-muted">{fmt(values[index], 3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorldWeightTable({
  title,
  labels,
  byAction,
}: {
  title: string;
  labels: string[];
  byAction: Record<Action, number[]>;
}) {
  return (
    <div>
      <div className="mb-0.5 font-mono text-[7px] uppercase tracking-[0.1em] text-lab-faint/80">
        {title}
      </div>
      <div className="overflow-hidden rounded border border-lab-line/50">
        <div
          className="grid gap-1 bg-lab-raise/40 px-1.5 py-1 font-mono text-[7px] text-lab-faint"
          style={{ gridTemplateColumns: `32px repeat(${labels.length}, 1fr)` }}
        >
          <span>act</span>
          {labels.map((label) => (
            <span key={label} className="truncate text-right" title={label}>
              {label.split(" ")[0]}
            </span>
          ))}
        </div>
        {MOVING_ACTIONS.map((action) => (
          <div
            key={action}
            className="grid gap-1 border-t border-lab-line/30 px-1.5 py-0.5 font-mono text-[7.5px] tabular-nums text-lab-muted"
            style={{ gridTemplateColumns: `32px repeat(${labels.length}, 1fr)` }}
          >
            <span className="text-lab-faint">{action}</span>
            {byAction[action].map((value, index) => (
              <span key={index} className="text-right">
                {value.toFixed(2)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
