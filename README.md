# Strange Loop Lab

A deterministic, browser-based computational laboratory for observing self-reference and
level-crossing dynamics in a small digital organism.

Inspired by Douglas Hofstadter's *Gödel, Escher, Bach*, the lab asks a narrow experimental
question: **can a system learn a useful model of itself, and can that model become causally
entangled with the processes that produce it?** It does not claim that the agent is conscious.
It does not contain an LLM, a neural-network library, a pretrained model or a backend.

---

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL (Vite defaults to `http://localhost:5173`).

```bash
npm run typecheck
npm test
npm run build
```

The simulation is pure TypeScript and runs entirely in the browser. No accounts, no network
requests, no persistence beyond the tab.

`npm run typecheck` runs `tsrs` ([a Rust port of the TypeScript 7 compiler](https://github.com/oxc-project/tsrs))
with `--noEmit` against `tsconfig.json`; `npm run typecheck:tsc` runs the classic TypeScript
compiler with the same config as an escape hatch, and `npm run build` typechecks before
`vite build`.

---

## What is in the box

| Layer | Implementation |
| --- | --- |
| World | 30 × 30 grid, obstacles, seed-scheduled energy resources, empty cells |
| Agent | 5 actions: `UP`, `DOWN`, `LEFT`, `RIGHT`, `REST` |
| Senses | 7 × 7 local view, noisy interoception (σ = 2.4), 8% stale samples |
| Memory | Bounded 160-step rolling history of local observations, actions, estimates, outcomes and prediction errors |
| World model | Per-action logistic delta-rule predictors for success, collection and collision |
| Self-model | Energy Kalman filter, cost/rest/collect EMAs, fatigue filter, success and collection logits |
| Meta-model | Second-order reliability tracker that closes the loop on influence, plasticity and prior weight |
| Engine | Pure deterministic tick loop with 10 micro-steppable cognitive phases |

### Three experimental conditions

| Mode | Components | Question |
| --- | --- | --- |
| **A** | Senses + memory + world model | What can be learned without a self-representation? |
| **B** | A + independent self-model | Does modelling one's own dynamics change behaviour? |
| **C** | B + meta-model | Does tracking the reliability of the self-model, then feeding that back, change the system? |

All three modes share the same seed, obstacle field, resource schedule, physical rules and
initial state. They can be run simultaneously in the comparison view.

---

## The strange loop

Every tick executes the same causal sequence. Each phase can be advanced individually with
**Phase** (or `M`):

1. **Sense** — local world view plus a noisy (sometimes stale) energy reading.
2. **Observation update** — weak correction of world-model coefficients from what is visible.
3. **Predict** — world model predicts external outcomes; self-model predicts internal outcomes.
4. **Evaluate & select** — five utilities pass through a seeded softmax; the self term is scaled by meta trust in Mode C.
5. **Execute** — the action is applied and energy is paid.
6. **Perceive outcome** — proprioception, collision/slip signal, second interoceptive sample.
7. **Prediction errors** — predictions are compared with what happened.
8. **Update world model** — delta-rule update.
9. **Update self-model** — energy belief, costs, fatigue and success coefficients are revised.
10. **Update meta-model** — reliability is estimated; plasticity and prior weighting change.

The last step changes the next tick's learning rate, belief gain and action utilities. That is
the loop: the model of the system is inside the system that generates it.

### Level crossing

In Mode C, the meta-model's trust causally:

- scales the self-model's influence on action utilities;
- multiplies the self-model learning rate (low trust → faster learning);
- sets the prior weight used when correcting the energy belief (high trust → rely more on the internal prediction than the noisy sample).

Plasticity modulation and prior weighting each have a switch. Disabling meta feedback disables
the crossing while the meta-model continues to track reliability in open loop. Disabling self
feedback leaves the self-model learning but removes it from action selection.

---

## Dashboard

1. **Environment** — 30 × 30 Canvas grid, resources, obstacles, trail, sensor footprint, predicted target, live energy/fatigue/cost/success.
2. **Internal architecture** — SVG information-flow diagram with active phase pathways, self-reference loop and labelled level-crossing edges.
3. **Internal state** — instrumented values beside self-model estimates, errors, sensory noise/lag, and the full utility decomposition of the last action.
4. **Self-model** — confidence, meta trust, beliefs, survival horizon, learning rate, prior weight and every readable coefficient.
5. **Measurements** — sliding-window accuracy, KL influence, level-crossing traces, action distribution and adaptation.
6. **Event log** — natural-language entries produced only by measured changes and threshold crossings.
7. **Protocol & glossary** — definitions, reproduction notes and scope limits.

The comparison view runs A/B/C in the background on the current seed and overlays energy,
world accuracy, self accuracy and Mode C's trust/prior traces, with a summary table.

---

## Controls

- **Run / Pause** (`Space`), **Step** (`→`), **Phase** (`M`), **Reset** (`R`).
- Speed 1–60 ticks/s; simulation publishes UI at ~13 FPS while Canvas draws at ~30 FPS.
- Seed field with copy and randomise; identical seed → identical trajectory.
- Condition selector A/B/C.
- Toggles for self feedback, meta feedback, plasticity and prior weighting.
- **Reset models** reinitialises memory and learned coefficients while keeping the world and position.
- **Compare modes** opens the head-to-head view; horizon 300/600/900/1500 ticks.

Keyboard shortcuts are suppressed while a dialog is open and while typing in an input.

---

## Measurements

| Metric | Definition |
| --- | --- |
| Self-model accuracy | `1 − mean(|Ê − E| / 25)` over 60 ticks; `E` is instrumented |
| World accuracy | `1 − mean Brier` for success and collection on the chosen action; a raw Brier score, not a skill score. The validation harness reports Brier skill against the base rate. |
| Forward prediction accuracy | `1 − (0.6 * normalized energy-delta error + 0.4 * success Brier)` |
| Self-model influence | KL(P_actual ‖ P_counterfactual), same utilities with the self term removed |
| Meta calibration | Predictive Pearson r between trust and measured self accuracy 12 ticks later |
| Behavioural adaptation | Jensen–Shannon divergence between the last 30 and preceding 30 actions |
| Learning/prior traces | Effective self learning rate and prior weight over time |

None of these is a “consciousness score”. They measure prediction, causal influence, calibration
and behavioural change. All are computed against instrumented state outside the agent.

---

## Determinism

Every stochastic subsystem has a named PRNG stream derived from the seed:

```
world, interoception, dynamics, policy
```

The environment generator, noisy sensors, slip events and softmax sampling therefore cannot
shift one another. Resource regrowth windows are defined by per-cell period/offset drawn at
world generation, so the resource schedule does not depend on the agent's trajectory. A fixed
seed, mode and set of runtime toggles reproduces the same trajectory exactly; micro-stepping
produces the same state as full ticks (covered by tests).

---

## Project structure

```
src/
  simulation/                 pure TypeScript, no React or DOM
    environment/              world generation + physical dynamics
    agent/
      perception/             local view → per-action features
      memory/                 bounded rolling history
      world-model/            external outcome predictors
      self-model/             internal state estimators
      meta-model/             reliability and level crossing
      agent.ts                orchestration + utility construction
    experiments/              tick engine + parallel mode runner
    metrics/                  sliding windows, calibration, adaptation
    events/                   data-derived event text
    types.ts config.ts math.ts rng.ts
  components/                 dashboard panels and SVG primitives
  ui/                         React hooks for simulation and comparison
tests/                        determinism, model, level-crossing and comparison tests
tools/                        headless probes
docs/MODEL.md                 equations and constants
```

The simulation imports nothing from React. All model updates are ordinary numeric code with
inspectable coefficients.

---

## Research constraints honoured

- No identity variable, self-awareness flag, emotion or introspection script.
- No self-model access to physical energy, fatigue or effective cost.
- No opaque model: every predictor is a named EMA, filter or logistic coefficient.
- No fabricated narrative: event text is templated from measured values and thresholds.
- No recursive edge without causal effect: trust changes utilities, learning rate and belief gain.
- Exactly two meta levels.
- The self-model can be wrong, is measured against ground truth outside itself, and can recover.

## V0 status

- Agent survives and navigates under fatigue-dependent cost, success and energy weight.
- World model learns from online prediction errors.
- Self-model estimates energy from noisy/delayed interoception, diverges and corrects.
- Self-model provably changes action distributions (KL > 0; Mode B typically much larger).
- Mode C's meta-model moves trust and causally modulates learning rate and prior weight.
- A/B/C run under identical seeds, including simultaneous background runs.
- Micro-stepping, reset, model reset and per-edge toggles are implemented.
- Determinism, dynamics, micro-stepping, V0/V0.2/V0.3 ablations, shadow isolation and learned-meta
  invariants are covered by 67 tests.

See `docs/MODEL.md` for the equations and tunable constants.

## Scientific validation

`docs/RESEARCH_REPORT.md` contains the V0 audit: 100 paired seeds, 13 ablation/corruption
conditions, causal ablations, corruption recovery, confidence/meta calibration and honest
negative results. The default simulation is unchanged; research options are opt-in
(`ResearchOptions` in `src/simulation/types.ts`).

`docs/V02_RESEARCH_REPORT.md` contains the V0.2 audit: randomized priors, multi-channel sensing,
learned meta-cognitive calibration, epistemic exploration, regime shifts, isolated shadow probes
and the ten-question assessment.

`docs/V03_RESEARCH_REPORT.md` contains the V0.3 audit: residual meta-modeling against a rolling
baseline, risk-sensitive meta-control, action-conditioned temporal attribution, a context-decoupled
epistemic trap with decision-value-of-information probing, skill-gated world modeling, and the
PP-1, Goodhart and five-link intervention controls.

`docs/V04_RESEARCH_REPORT.md` contains the V0.4 audit: precision-weighted predictive coding and the
PP-1 illusion, multi-step directional meta targets, epistemic preparation, strain-to-outcome
consistency, and the AST-1 attention-schema ablation.

```bash
npx tsx tools/validate.ts   # V0: 100 seeds × 13 conditions × 1,200 ticks + corruption cells
npx tsx tools/analyze.ts    # V0 tables and research/analysis.json
npx tsx tools/selfaudit.ts  # focused V0 self-estimate audit
npm run validate:v02        # V0.2: 100 seeds × 23 conditions × 1,000 ticks + shadow probes
npm run validate:v03        # V0.3: 100 seeds × 52 conditions × 1,000/1,600 ticks
npm run validate:v04        # V0.4: 100 seeds × 54 conditions × 1,000/1,600 ticks
npm run validate:v05        # V0.5: unified precision/attribution/trap validation
```

Open the dashboard and use **V0.2** or **V0.3** in the header. V0 remains the default and fully
reproducible; V0.2 and V0.3 are separate opt-in research stacks.
