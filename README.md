# Strange Loop Lab

A deterministic, browser-based computational laboratory for observing self-reference and
level-crossing dynamics in a small digital organism.

Inspired by Douglas Hofstadter's *Gödel, Escher, Bach*, the lab asks a narrow experimental
question: **can a system learn a useful model of itself, and can that model become causally
entangled with the processes that produce it?** It does not claim that the agent is conscious.
It does not contain an LLM, a neural-network library, a pretrained model or a backend.

The repository now contains the full **V0.1–V0.6** research ladder: six opt-in engines, 281
development conditions, an untouched V0.6 holdout, and a 16-page manuscript. The interactive
laboratory is at **https://strangeloops.pages.dev**; the paper, figures and findings are
reachable from `/paper` and `/findings`.

### Current paper

> **When Self-Models Trap Themselves: Causal Ablations, Functional Dissociation, and Precision
> Trade-Offs of Consciousness Indicators in a White-Box Agent**

`paper/main.pdf` (16 pages) and `paper/arxiv/main.pdf` (14 pages). The manuscript reports
28,100 main-protocol episodes plus 800 V0.1 corruption probes, an 8,700-episode untouched V0.6
holdout, and 6,200 hardening episodes — **43,800 unique seeded episodes** in total. It documents
positive results and negative results, including weak off-policy reliability discrimination
(AUROC 0.43–0.59) and foraging advantages for flat/reactive controls.

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
requests, no persistence beyond the tab. The 100-seed validators are Node/tsx scripts and write
their artifacts to `research/`.

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

### V0.1's three experimental conditions

| Mode | Components | Question |
| --- | --- | --- |
| **A** | Senses + memory + world model | What can be learned without a self-representation? |
| **B** | A + independent self-model | Does modelling one's own dynamics change behaviour? |
| **C** | B + meta-model | Does tracking the reliability of the self-model, then feeding that back, change the system? |

All three modes share the same seed, obstacle field, resource schedule, physical rules and
initial state. They can be run simultaneously in the comparison view.

---

## Six generations

| Version | Question | Conditions × seeds | Report |
| --- | --- | --- | --- |
| V0.1 | Does a self-model change behaviour when errors are cheap? | 13 × 100 | `docs/RESEARCH_REPORT.md` |
| V0.2 | What changes when priors are uninformed and reliability is learned? | 23 × 100 | `docs/V02_RESEARCH_REPORT.md` |
| V0.3 | Residual meta-modelling, risk-sensitive control and epistemic traps | 52 × 100 | `docs/V03_RESEARCH_REPORT.md` |
| V0.4 | Precision coding, PP-1 illusions and the AST-1 attention schema | 54 × 100 | `docs/V04_RESEARCH_REPORT.md` |
| V0.5 | Unified precision/attribution/trap control and selective gating | 52 × 100 | `docs/V05_RESEARCH_REPORT.md` |
| V0.6 | Causal ablations of the integrated architecture and four adversarial controls | 87 × 100 | `docs/V06_RESEARCH_REPORT.md` |

V0.6 adds a capacity-limited workspace, global broadcast, higher-order reliability monitoring,
an attention schema, a bounded cognitive rollout and recurrent settling, each independently
ablated. The manuscript reports an **ablation-based functional dissociation** and an
**empirically observed three-way trade-off** between illusion absorption, tracking and
attribution. It also reports the limits: weak shadow AUROC, class-imbalanced attribution, and
flat/reactive foraging advantages.

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
  simulation/
    agent/ environment/ experiments/ metrics/ events/   V0.1 engine
    v02/ v03/ v04/ v05/ v06/                            later opt-in engines
  components/                 dashboard panels and SVG primitives
  research/                   findings, lab and paper views
  home/                       landing narrative
  ui/                         React hooks for simulation and comparison
tests/                        determinism, model, level-crossing and research tests
tools/                        validators, analyzers, figure and manifest generators
docs/                         research reports and the publication audit
paper/                        manuscript, arXiv source, figures and PDFs
research/                     raw per-run JSON and aggregate artifacts
public/paper/                 statically served manuscript, figures and PDF
```

The simulation engines import nothing from React. All model updates are ordinary numeric code
with inspectable coefficients.

---

## Research constraints honoured

- No identity variable, self-awareness flag, emotion or introspection script.
- No self-model access to physical energy, fatigue or effective cost.
- No opaque model: every predictor is a named EMA, filter or logistic coefficient.
- No fabricated narrative: event text is templated from measured values and thresholds.
- No recursive edge without causal effect: trust changes utilities, learning rate and belief gain.
- Exactly two meta levels.
- The self-model can be wrong, is measured against ground truth outside itself, and can recover.

## V0.1 engine status

- Agent survives and navigates under fatigue-dependent cost, success and energy weight.
- World model learns from online prediction errors.
- Self-model estimates energy from noisy/delayed interoception, diverges and corrects.
- Self-model provably changes action distributions (KL > 0; Mode B typically much larger).
- Mode C's meta-model moves trust and causally modulates learning rate and prior weight.
- A/B/C run under identical seeds, including simultaneous background runs.
- Micro-stepping, reset, model reset and per-edge toggles are implemented.
- Determinism, dynamics, micro-stepping, V0.1/V0.2/V0.3 ablations, shadow isolation and learned-meta
  invariants are covered by 73 tests.

See `docs/MODEL.md` for the equations and tunable constants.

## Scientific validation

`docs/RESEARCH_REPORT.md` contains the V0.1 audit: 100 paired seeds, 13 ablation/corruption
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

`docs/V05_RESEARCH_REPORT.md` contains the V0.5 audit: the unified precision/attribution/trap stack,
selective transient gating, the plateau-breaking probe and the non-Pareto trade-off.

`docs/V06_RESEARCH_REPORT.md` contains the V0.6 audit: the full 7×5 mechanism rubric, four
matched-compute adversarial controls, the crossed ablation matrix, the untouched holdout
replication, and the hardening experiments.

### Hardening experiments

- **V0.3 2×2 factorial** (`research/hardening-factorial.json`): residual meta-model × risk-sensitive
  bound. Neither component nor their interaction is significant in the standard or shift regime;
  the earlier meta-on gain is therefore reported as a **loop-level L5 effect**, not a component effect.
- **V0.4 9-point suppression sweep** (`research/hardening-sweep.json`): absorption rises
  0.167 → 0.931 while MAE rises 1.466 → 4.586 and macro-F1 generally declines. At the frozen
  default exponent (1.0) it reproduces V0.4 (0.828 / 2.743 / 0.515).
- **Untouched V0.6 holdout** (seeds 10001–10100, 8,700 episodes,
  `research/v06-holdout-results.json`): full-architecture absorption 0.808 vs 0.814, coherence
  0.932 vs 0.949, macro-F1 0.501 vs 0.502, fork solved 85% vs 84%. Secondary instability is
  disclosed (No-RPT fork 26% vs 39%; No-AST latency 5.8 vs 1.3 ticks).

```bash
npx tsx tools/validate.ts   # V0.1: 100 seeds × 13 conditions × 1,200 ticks + corruption cells
npx tsx tools/analyze.ts    # V0.1 tables and research/analysis.json
npx tsx tools/selfaudit.ts  # focused V0.1 self-estimate audit
npm run validate:v02        # V0.2: 100 seeds × 23 conditions × 1,000 ticks + shadow probes
npm run validate:v03        # V0.3: 100 seeds × 52 conditions × 1,000/1,600 ticks
npm run validate:v04        # V0.4: 100 seeds × 54 conditions × 1,000/1,600 ticks
npm run validate:v05        # V0.5: unified precision/attribution/trap validation
npm run validate:v06        # V0.6: full 7×5 rubric, 8,700 episodes
npm run validate:holdout    # V0.6: untouched holdout seeds 10001–10100
npm run validate:hardening  # V0.3 factorial, V0.4 sweep, holdout comparison
npm run manifest            # SHA-256 sums + dependency/runtime manifest
npm run paper:figures       # regenerate paper/figures from research/*.json
npm run paper:arxiv         # rebuild the arXiv source zip
```

Open the dashboard and use the header to switch between **V0.1, V0.2, V0.3, V0.4, V0.5** and **V0.6**. Each
version is a separate opt-in research stack; the research record, figures and manuscript are reachable
from **Findings** and **Paper**.

## Publication and reproducibility

- **Manuscript:** `paper/main.pdf` (16 pages); arXiv source `paper/arxiv/main.pdf` (14 pages) and
  `paper/arxiv/arxiv-submission.zip`.
- **Title:** *When Self-Models Trap Themselves: Causal Ablations, Functional Dissociation, and
  Precision Trade-Offs of Consciousness Indicators in a White-Box Agent*.
- **Paper page:** `/paper`; **findings:** `/findings`; **live lab:** https://strangeloops.pages.dev.

| Protocol | Cells | Seeds | Episodes |
| --- | ---: | ---: | ---: |
| V0.1–V0.6 development | 281 | 100 | 28,100 |
| V0.1 corruption probes | 8 | 100 | 800 |
| V0.6 untouched holdout | 87 | 100 | 8,700 |
| V0.3 2×2 factorial | 8 | 100 | 800 |
| V0.4 9-point sweep | 54 | 100 | 5,400 |
| **Total unique** | | | **43,800** |

- `research/SHA256SUMS.txt` and `research/MANIFEST.json` record checksums and exact runtime /
  dependency versions for all archived JSON artifacts.
- `research/HOLDOUT_MANIFEST.json` records the untouched seeds 10001–10100 and the unchanged V0.6
  engine baseline (commit `30bc9a8`).
- The repository is **private at submission**; no DOI has been minted. An archived snapshot is
  available from the author on request.
- Verification: `npm run typecheck`, `npm test` (73/73), `npm run build`, and clean LaTeX builds
  with no overfull boxes or undefined references.

## Licence

- **Code:** MIT — see [LICENSE](LICENSE).
- **Manuscript and figures:** CC BY 4.0 — see [paper/LICENSE](paper/LICENSE).
- **arXiv style file:** MIT, upstream (see `paper/arxiv/License.txt`).
