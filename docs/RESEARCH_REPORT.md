# Strange Loop Lab V0.1 — Scientific Validation Report

**Date:** 2026-11-18  
**Subject:** V0.1 simulation, commit state as validated in this workspace  
**Question:** Does V0.1 demonstrate a genuine computational strange loop, or a conventional
adaptive control system with additional self-monitoring variables?

## Executive conclusion

V0.1 contains a **real, inspectable, causally active first-order self-model** and a **causally
active second-order reliability loop**. The self-model is not reading ground truth, it changes
action selection, it can be wrong, and it corrects from noisy observations. The meta-model moves
its trust signal, suppresses an unreliable self-model, and changes lower-level parameters.
The energy belief is nevertheless **worse than the raw interoceptive sample** (MAE 3.24/4.54
versus 1.92), so this is not evidence of a superior internal estimator.

However, the validation does **not** support the stronger claim that V0.1 exhibits a genuine
Hofstadter-style strange loop. The second level is a **hand-designed scalar gain scheduler**, not
a learned or calibrated model of the self-model. Its trust signal is not calibrated against
actual self-model accuracy, adds negligible predictive value, and usually detects a corrupted
self-model *after* first-order learning has already repaired it. The task outcome is not improved
by the self-model or the meta-model; a frozen self-model with hand-set priors performs about as
well on resources, and all main conditions survive the 1,200-tick horizon. Much of the useful
policy is encoded in hand-tuned priors and utility weights, not learned from experience.

**Evidence base:** 100 paired seeds (1–100), 13 conditions at 1,200 ticks, and 800 corruption
observations across four feedback configurations, with paired non-parametric tests, bootstrap
confidence intervals and effect sizes.

**Verdict:** V0.1 is best described as a **hierarchical adaptive controller with a self-monitoring
variable and a causal second-order gain loop**. It demonstrates a minimal computational
self-reference mechanism, but not an emergent strange loop in the strong sense, and not a system
whose self-model is necessary for its competence. It is also not evidence of consciousness,
awareness, or subjective experience.

---

## 1. Architecture assessment

The audit below is based on the complete implementation, `docs/MODEL.md`, and targeted runtime
tests. Function names are the authoritative citation; line numbers refer to the validated
revision.

### 1.1 Does the self-model independently estimate the agent's actual internal state?

**Partially, and unevenly.**

- **Energy belief:** `SelfModel.advanceAndCorrect()` in
  `src/simulation/agent/self-model/selfModel.ts` is a scalar Kalman-style predictor/corrector.
  It predicts the next energy from its own last intended delta and corrects with the noisy,
  sometimes stale interoceptive reading from `SimulationEngine.readInteroception()`:
  `E_sensed = clamp(E_true + N(0, 2.4), 0, 112)` with 8% stale samples
  (`src/simulation/experiments/engine.ts`, `readInteroception`).
- **Cost / rest / collection gains:** `SelfModel.learn()` updates EMAs from the sensed energy
  delta, subtracting the estimated collection gain on collection ticks. These estimates are
  real but weak: over 100 seeds and 1,200 ticks the movement-cost MAE was **1.38** in B and
  **0.75** in C; the collect-gain estimate was **13.2** in B and **20.7** in C against a true
  value of 24; rest gain was 2.78/2.93 against 2.70.
- **Fatigue:** a hand-structured latent filter in `SelfModel.learn()` and `SelfModel.predict()`
  (move +0.048, rest −0.105, slip/cost innovation terms). It tracks actual fatigue reasonably
  when the model is learning: MAE **0.13** in B, **0.21** in C; correlation **0.89/0.83**.
  When learning is frozen it does not track at all (MAE 0.67/0.64).
- **Success probability:** a logistic model on estimated fatigue, obstacle/boundary and slip
  rate. Its Brier score against realised movement was **0.28** in B and **0.21** in C. The
  self-reported forward-prediction score includes this Brier term, so it is not a pure energy
  error.
- **Energy accuracy is worse than raw interoception.** At the same sense phase, the raw noisy
  reading had a mean absolute error of **1.92** energy, while the self-model's energy belief had
  MAE **3.24** in B and **4.54** in C (max 31.05/36.34). The filter's predicted action delta and
  prior weighting add lag/bias rather than reducing noise. This is a substantial negative result:
  the self-model is independent, but not a better estimator of current energy than simply using
  the latest interoceptive sample.

**Answer:** Yes, there is an independent estimator, but it is a partial and noisy self-model,
strongest for fatigue and causal prediction, weaker for energy than the raw sensor, and weak for
movement cost, collection gain and success calibration.

### 1.2 Is there any direct or indirect leakage of ground truth into the self-model?

**No direct runtime path. Yes, material prior leakage from the designers.**

- **No direct path.** `SelfModel` never imports or receives `PhysicalState`, `StepOutcome`,
  engine metrics or UI state. It consumes only:
  - `sensedEnergy` from `Observation`;
  - the sensed delta between pre/post readings;
  - the `OutcomeSignal` (`moved`, `blocked`, `slipped`, `collected`);
  - its own predictions, memory statistics and innovation.
  This is visible in `Agent.observe()`, `Agent.learnOutcome()`, and
  `SimulationEngine.updateSelf()`.
- `Observation` contains no true energy or fatigue field
  (`src/simulation/types.ts`, `Observation`; `createObservation()` in
  `src/simulation/agent/perception/perception.ts`). The ground truth is used by the engine only
  after learning, in `computeErrors()` and instrumentation.
- **Prior leakage is the serious caveat.** The self-model starts with:
  - `movementCost = 1.35` against a true starting effective cost of **1.41**;
  - `restGain = 2.35` against true **2.70**;
  - `collectGain = 20` against true **24**;
  - fatigue update **+0.048 / −0.105** against true **+0.046 / −0.16**;
  - success-logit weights `[1.5, −2.6, −1.0, −1.4]`.

  These are not runtime ground truth, but they are strongly informative, hand-chosen beliefs
  about the agent's own dynamics. They are close enough to make the first-order model useful
  before it has learned. This violates the spirit of "do not give it predefined beliefs about
  itself" even if it does not violate the letter of "no ground-truth reads". The same caveat
  applies to the meta-model's fixed affine mappings and to the action utility weights.

- The world model also has informative priors (success bias 1.75, obstacle −3.4, boundary −5.2;
  `WorldModel.applyPriors()`), but these are environmental priors rather than self-knowledge.

**Answer:** No direct leakage; substantial *designer-prior* leakage. The corruption experiment
shows the model can recover from a wrong cost prior, but it does not remove the concern that the
prior is unusually good in the default condition.

### 1.3 Does the self-model causally influence action selection?

**Yes, strongly in B and moderately in C.**

- `Agent.select()` builds a self term from the self-model:
  `energy Delta`, predicted fatigue change, predicted success and survival horizon, then scales
  it by `influence`. In B, influence is 1; in C it is meta trust when meta feedback is enabled.
  The utilities and a seeded softmax select the action (`sampleIndex`).
- The counterfactual instrumentation samples the same uniform draw from the policy with the
  self term removed; a decision is counted as changed when the two sampled actions differ.
- **B − A (100 paired seeds):** decision-change rate **0.55 vs 0.00**; KL **1.61 vs 0.00**;
  rest fraction **0.40 vs 0.16**; mean energy **82.3 vs 46.9**. The paired effects are huge
  (dz 2.7–9.6, Holm p < 0.001).
- **C − C_self_off:** KL **0.35 vs 0.00**, decision change **0.27 vs 0.00**, mean energy
  **50.3 vs 46.9**, rest fraction **0.17 vs 0.16**; p < 0.002 after Holm.
- Turning self feedback off makes the policy bit-identical to A in the aggregate (`B_self_off`
  and `C_self_off` match A exactly), which is a useful isolation check.

**Answer:** Yes. The self term is not decorative.

### 1.4 Does the meta-model actually model the reliability of the self-model?

**It tracks a scalar proxy, but it is not a calibrated or learned reliability model.**

- `MetaModel.update()` receives a normalized error computed in `Agent.learnOutcome()`:
  `0.7 * min(1, |preview innovation| / 9) + 0.3 * calibrationError`, where calibration error is
  the gap between predicted and realised success in recent memory. It smooths this into
  `errorEMA`, maps it affinely to a trust target (`1 - 1.25 * errorEMA`), and updates trust.
- That is a **one-dimensional error monitor**, not a model that learns which conditions make the
  self-model reliable, nor one that estimates its own calibration uncertainty. The mapping
  constants (1.25, floors 0.08/0.96, update rates 0.105/0.06) are hand-set.
- It does respond to persistent unreliability: `C_frozen_self` (self learning disabled) had mean
  trust **0.10** versus **0.52** in C; during severe cost corruption trust fell from **0.72**
  to about **0.60** at detection and **0.50** after correction.
- It is poorly calibrated to actual accuracy in the adaptive regime. In C, trust–state-accuracy
  correlation was **−0.00**, ECE **0.30**, and AUC for predicting low future accuracy **0.45**
  (below chance). The engine's external predictive meta-calibration was **0.03**.
- The meta-model's own `calibration` getter is circular: it correlates trust with
  `1 - 1.8 * errorEMA`, i.e. with a deterministic transform of the same error it is tracking.
  Its internal value was **0.63**, but it is not evidence of external calibration.
- When the self-model is frozen, trust is more informative (corr **0.43**, ECE **0.08**) because
  the error is persistent and easier to track. That is a useful but narrow success.

There is exactly one meta level: `Agent` constructs `MetaModel` only for Mode C, and `MetaModel`
has no higher parent or self-model of its own. No deeper recursion exists.

**Answer:** It tracks a reliability proxy and suppresses an obviously unreliable self-model, but
it does not constitute a calibrated model of reliability in the sense required for a strong
second-order self-model.

### 1.5 Does the meta-model influence the self-model's learning or decision-making?

**Yes, causally, through three edges; only one has a material effect in this regime.**

- `Agent.effectiveLearningRate()` multiplies the self learning rate by
  `MetaModel.learningRateMultiplier = clamp(0.4 + 1.7(1 − trust), 0.35, 2.1)` when meta feedback
  and plasticity are enabled.
- `Agent.effectivePriorWeight()` reduces the Kalman gain when trust is high
  (`priorWeight = 0.35 + 0.6 trust`, gain factor `1.18 − 0.62 prior` in
  `SelfModel.advanceAndCorrect`).
- `Agent.select()` uses trust to scale the self term's influence.

Ablations (100 paired seeds, 1,200 ticks):

| Comparison (first − second) | Key effect | Holm p |
|---|---:|---:|
| C − C_meta_off | rest **−0.22**, mean energy **−32.0**, self accuracy **−0.05**, KL **−1.25** | 0.002 |
| C − C_plasticity_off | no material behavioural effect; cost MAE +0.04 only | mostly ns |
| C − C_prior_off | mean energy **−1.9**, self accuracy **−0.02**, KL **−0.02** | 0.002–0.03 |
| C − C_self_off | KL **0.35**, decision change **0.27**, mean energy **+3.4** | 0.002 |

The large C − meta-off effect is mostly the trust gate on self influence, not a better learned
self-model: meta-off fixes influence at 1 and produces the B-like high-rest, high-energy policy;
trust-gated C sits between A-like and B-like behaviour. Plasticity and prior weighting exist and
are causal, but their measured effects are negligible or slightly harmful for self-state accuracy
in this environment.

**Answer:** Yes, the loop is closed; the dominant causal edge is trust-scaled influence.

### 1.6 Can the self-model become incorrect?

**Yes, substantially.**

- With self learning disabled, the energy belief stays at its first sensed value and the cost
  stays at its prior. `B_frozen_self` self-state accuracy was **0.09** (energy MAE 38.4, max
  68.1); `C_frozen_self` was **0.06** (MAE 44.7, max 72.7). This is not a subtle drift.
- In normal B/C runs, the energy belief still produced individual errors up to **31/36** energy
  units; cost MAE was 1.38/0.75, and collection surplus was underestimated (13.2/20.7 vs 24).
- The corruption experiment starts at movement-cost errors of **1.21** (cheap prior 0.2) and
  **6.59** (expensive prior 8.0) against the true starting effective cost of 1.41.

**Answer:** Yes.

### 1.7 Can the agent detect and correct its own incorrect self-model?

**Correction: yes, reliably. Explicit detection: no; meta detection is late.**

- The self-model has no explicit "this belief is wrong" detector. It continuously updates cost,
  rest, gain, fatigue and success coefficients from noisy interoceptive differences.
- In the corruption experiment all **100/100** runs recovered in both directions, across four
  feedback configurations. The first large cost revision occurred at a median of **1–2 ticks**.
  Recovery to within a 0.5 gap of the paired unperturbed model occurred at a median of **8 ticks**
  for the cheap prior and **23–26 ticks** for the expensive prior.
- Meta trust/error detection was much later: median **118 ticks** for the cheap corruption and
  **79 ticks** for the expensive corruption; only **5%** and **43%** of runs detected the error
  before correction. The trust drop after detection was real, but it was usually a response to
  the aftermath, not the cause of recovery.
- The correction path uses only `sensedEnergyDelta`, the outcome signal and the self-model's own
  predictions; no ground truth is passed into `SelfModel.learn()`.
- A frozen self-model cannot correct; `C_frozen_self` instead drives trust to **0.10** and
  effectively suppresses the model. The meta loop can quarantine an unreliable model but cannot
  repair it.

**Answer:** The agent corrects through first-order learning. The second-order model detects
persistent unreliability and can suppress influence, but does not provide timely error detection
or correction. This is an important negative result for the "strange loop" interpretation.

### 1.8 Are there hardcoded assumptions that artificially produce the desired behaviour?

**Yes. This is the largest threat to the strong interpretation.**

- Self-model priors and filter rates are close to the true dynamics (see 1.2). Even with
  `selfLearning: false`, the self model retains enough structure to act as a conservative
  homeostatic prior.
- Self utility weights are hand-set in `src/simulation/config.ts` (`SELECTION`): collection 24,
  movement 1.1, collision −5.5, novelty 2.2, rest threshold 33, risk threshold 22, self energy
  1.25, fatigue 4.5, success 0.8, horizon 0.012. The self-model's behavioural importance is
  produced through this designed valuation, not discovered by the agent.
- The survival-horizon formula is a hand-written expression
  `E / max(0.35, cost (0.62 + 0.38 pSuccess))`, not a learned prediction.
- The meta-model is a hand-written gain scheduler: fixed error weighting, fixed trust mapping,
  fixed learning-rate multiplier, fixed prior formula.
- The reactive resting term for low sensed energy is present in every mode, including A; it is
  a hand-coded homeostatic policy, not an emergent self-model behaviour.
- Empirically, the frozen-self and frozen-world conditions show that the hand-coded priors do
  much of the work:
  - `B_frozen_self` (no self learning) still survives 99/100 and collects **64.6** resources,
    versus B's **61.0** (paired difference −3.5, p = 0.057); its self accuracy is 0.09.
  - `C_world_frozen` (no world learning) collects **76.6** resources versus C's **62.9**
    (p = 0.002); the learned world model is not necessary and is, by this outcome, harmful.
  - `A` versus `A_no_world` is the strongest positive case for a learned component: world
  predictions improve resources **61.7 vs 28.2** (p < 0.001). But that is the world model, not
  the self-model.

**Answer:** Yes, the priors and utility weights materially shape the observed "adaptive"
behaviour. V0.1's results cannot be attributed to learning from a blank slate.

### 1.9 Citation map

| Claim | File and function/equation |
|---|---|
| Local noisy observation, no global map | `agent/perception/perception.ts` `createObservation`, `perceive`; `types.ts` `Observation` |
| Interoceptive noise/lag | `experiments/engine.ts` `readInteroception`; `E_sensed = clamp(E_true + N(0,2.4), 0, 112)` |
| Self energy/Kalman belief | `agent/self-model/selfModel.ts` `advanceAndCorrect`; equations in `docs/MODEL.md` §5 |
| Self cost/rest/collect/fatigue/success updates | `agent/self-model/selfModel.ts` `learn`, `predict`, `learnSuccess`, `learnCollect` |
| Self influence on action | `agent/agent.ts` `select`; `SELECTION` in `config.ts` |
| Meta reliability tracker | `agent/meta-model/metaModel.ts` `update`; `agent/agent.ts` `learnOutcome` (metaError) |
| Meta learning/prior influence | `agent/agent.ts` `effectiveLearningRate`, `effectivePriorWeight`; `metaModel.ts` getters |
| Ground-truth instrumentation only | `experiments/engine.ts` `computeErrors`, `finaliseTick`; `metrics/metrics.ts` |
| Physical cost/success/action | `environment/dynamics.ts` `effectiveMoveCost`, `effectiveSuccess`, `applyAction` |
| Bounded memory | `agent/memory/memory.ts` `Memory.push`, `stats`, `calibrationError` |
| World model | `agent/world-model/worldModel.ts` `predict`, `learn`, `learnFromObservation` |
| Priors and utility weights | `agent/self-model/selfModel.ts` constructor; `config.ts` `SELECTION`, `AGENT`; `worldModel.ts` `applyPriors` |

---

## 2. Evidence of first-order self-reference

The minimal criterion is met: an internal model of the agent's own variables is learned from
experience and changes the agent's actions.

**Evidence**

- The self-model receives only observations, actions, outcomes and its own predictions; it has
  no `PhysicalState` parameter anywhere in its call graph.
- The model tracks fatigue reasonably (B MAE 0.13, correlation 0.89; C MAE 0.21, correlation
  0.83), but its energy belief is worse than the raw sensor (MAE 3.24/4.54 vs 1.92 at the same
  sense phase). Its value cannot be "better energy estimation"; it is behavioural and predictive,
  and the prediction of the next internal consequence is the only mechanism by which it can
  matter.
- The self-model is causally active: removing self feedback changes the sampled action on
  **55%** of B ticks and **27%** of C ticks; KL is 1.61 and 0.35, respectively.
- Self feedback has a large behavioural signature: B rests **40%** of ticks versus A's 16%,
  and keeps mean energy at **82.3** versus **46.9**; the resource totals are nearly identical
  (61.0 vs 61.7, p = 1.0).
- The alternative "no self-model" policy is exactly recovered when self feedback is disabled:
  `B_self_off` and `C_self_off` reproduce A's trajectory statistics (mean energy 46.92,
  resources 61.67, rest 0.16), confirming the ablation is clean.

**But the first-order mechanism does not improve task performance.** It changes the strategy
towards energy conservation and rest, without increasing resources or survival in this benign
environment. The first-order self-model is causally real but not demonstrably *useful* for this
task. A fixed self-model also survives and forages about as well before learning (see 1.8).

---

## 3. Evidence of second-order self-reference

The structural criterion is met: trust changes self-influence, self-learning and prior weight.
The functional criterion is only weakly met.

**What is real**

- `C_frozen_self` is the strongest evidence that the meta-model is tracking something. With a
  permanently wrong energy belief, trust falls from its ~0.72 prior to **0.10**, and the policy
  almost stops using the self term (decision-change 3%, KL 0.001). The meta-model identifies
  persistent unreliability and quarantines the model.
- During severe cost corruption, trust falls from **0.72** to **0.60** at detection and **0.50**
  after correction. It is responding to persistent prediction error.
- Trust is causally load-bearing for performance in one regime: under expensive cost corruption,
  meta-on recovers the model in a median **23 ticks** versus **32 ticks** with meta feedback off
  (paired difference −10.8 ticks, p < 0.001). The mechanism is primarily suppression of bad
  self-influence, not faster learning.
- The C − meta-off contrast is large: rest 0.17 vs 0.40, mean energy 50.3 vs 82.3, self accuracy
  0.81 vs 0.87, KL 0.35 vs 1.61. The level-crossing edge changes the system.

**What is missing for a strong strange loop**

- **No calibrated meta-model.** Trust–state-accuracy correlation ≈ 0.00; ECE 0.30; low-accuracy
  AUC 0.45; external predictive calibration 0.03. It is not a model of its own reliability in a
  measurable sense.
- **No incremental predictive value.** Trust predicts future self-state accuracy no better than
  self-confidence: mean difference **−0.03** (p < 0.001); incremental R² over confidence is
  **0.006** (p < 0.001); AUC difference **−0.01** (p = 0.003). The meta signal is essentially
  redundant with the first-order confidence signal.
- **Late detection.** Under cost corruption, meta detection is after correction in most runs
  (before correction: 5% cheap, 43% expensive). The self-model repairs itself before the meta
  level notices.
- **The learning-rate edge is inert.** C vs C_plasticity_off shows no meaningful difference in
  rest, energy, resources, self accuracy, KL or decision change; the only significant difference
  is a slightly worse cost MAE in C. "Adaptive self-model learning" does not buy anything here.
- **Prior weighting is small and slightly harmful.** C vs C_prior_off: C has 0.02 lower self-state
  accuracy and 1.9 lower energy; the prior-weight gain is causally measurable but not adaptive.
- **No normal-regime performance benefit.** C vs meta-off has no resource advantage (62.9 vs
  61.0, p = 0.475) and lower self-state accuracy. The level crossing changes behaviour toward the
  A-like policy rather than improving the self-model.

**Verdict on second order:** A real hand-designed reliability gate, not a learned meta-model.
It satisfies the minimal causal definition of a tangled hierarchy, but it does not demonstrate
the self-sustaining, self-improving loop suggested by Hofstadter.

---

## 4. Causal ablation results

**Design.** 100 independent seeds (1–100), paired across conditions; 1,200 ticks per run;
identical world generation and initial state for a given seed; 10 cognitive phases per tick.
Paired sign-flip permutation tests (10,000 permutations), percentile bootstrap 95% CIs (2,000
resamples), Cohen's dz, Holm correction within each contrast.

### 4.1 Condition summary

Mean values over 100 seeds. All main conditions were alive at 1,200 ticks; two frozen-self runs
died (99/100).

| Condition | Mean E | Resources | Rest | Self state acc | KL | Decision change | Trust |
|---|---:|---:|---:|---:|---:|---:|---:|
| A · world only | 46.9 | 61.7 | 0.16 | — | 0.00 | 0.00 | — |
| A · world off | 41.6 | 28.2 | 0.23 | — | 0.00 | 0.00 | — |
| B · self-model | 82.3 | 61.0 | 0.40 | 0.87 | 1.61 | 0.55 | — |
| B · self feedback off | 46.9 | 61.7 | 0.16 | 0.83 | 0.00 | 0.00 | — |
| B · self learning off | 44.6 | 64.6 | 0.15 | 0.09 | 0.10 | 0.20 | — |
| C · recursive | 50.3 | 62.9 | 0.17 | 0.81 | 0.35 | 0.27 | 0.52 |
| C · self feedback off | 46.9 | 61.7 | 0.16 | 0.81 | 0.00 | 0.00 | 0.51 |
| C · meta feedback off | 82.3 | 61.0 | 0.40 | 0.87 | 1.61 | 0.55 | 0.59 |
| C · plasticity off | 50.5 | 64.6 | 0.17 | 0.82 | 0.34 | 0.26 | 0.52 |
| C · prior weighting off | 52.2 | 62.7 | 0.18 | 0.83 | 0.37 | 0.28 | 0.56 |
| C · self learning off | 37.6 | 59.4 | 0.16 | 0.06 | 0.00 | 0.03 | 0.10 |
| C · world learning off | 47.2 | 76.6 | 0.12 | 0.81 | 0.53 | 0.17 | 0.51 |
| C · world model off | 71.8 | 50.0 | 0.26 | 0.83 | 0.52 | 0.50 | 0.54 |

All values are means; full medians, SDs and 95% CIs are in `research/analysis.json` and
`research/summary.json`.

**Detailed seed-level statistics** (format: mean [95% bootstrap CI] / median / SD; n = 100).

| Condition | Mean energy | Resources | Rest fraction | Self state accuracy |
|---|---|---|---|---|
| A | 46.9 [46.2, 47.6] / 46.4 / 3.8 | 61.7 [59.2, 64.2] / 61.0 / 12.5 | 0.16 [0.16, 0.17] / 0.16 / 0.03 | — |
| A · world off | 41.6 [41.1, 42.1] / 41.4 / 2.5 | 28.2 [26.8, 29.6] / 28.0 / 7.0 | 0.23 [0.22, 0.23] / 0.23 / 0.02 | — |
| B | 82.3 [81.1, 83.4] / 82.2 / 5.9 | 61.0 [58.3, 63.8] / 63.0 / 14.2 | 0.40 [0.38, 0.41] / 0.39 / 0.08 | 0.87 [0.86, 0.87] / 0.86 / 0.01 |
| B · self feedback off | 46.9 [46.2, 47.6] / 46.4 / 3.8 | 61.7 [59.2, 64.2] / 61.0 / 12.5 | 0.16 [0.16, 0.17] / 0.16 / 0.03 | 0.83 [0.83, 0.83] / 0.83 / 0.01 |
| B · self learning off | 44.6 [43.6, 45.6] / 43.8 / 5.0 | 64.6 [62.1, 67.1] / 63.0 / 13.0 | 0.15 [0.15, 0.16] / 0.16 / 0.03 | 0.09 [0.08, 0.09] / 0.08 / 0.04 |
| C | 50.3 [49.2, 51.4] / 49.8 / 5.6 | 62.9 [60.3, 65.4] / 62.0 / 12.4 | 0.17 [0.17, 0.18] / 0.17 / 0.02 | 0.81 [0.81, 0.82] / 0.81 / 0.01 |
| C · self feedback off | 46.9 [46.2, 47.6] / 46.4 / 3.8 | 61.7 [59.2, 64.2] / 61.0 / 12.5 | 0.16 [0.16, 0.17] / 0.16 / 0.03 | 0.81 [0.81, 0.81] / 0.81 / 0.01 |
| C · meta feedback off | 82.3 [81.1, 83.4] / 82.2 / 5.9 | 61.0 [58.3, 63.8] / 63.0 / 14.2 | 0.40 [0.38, 0.41] / 0.39 / 0.08 | 0.87 [0.86, 0.87] / 0.86 / 0.01 |
| C · plasticity off | 50.5 [49.4, 51.6] / 50.4 / 5.8 | 64.6 [62.2, 67.3] / 64.0 / 12.9 | 0.17 [0.16, 0.17] / 0.17 / 0.02 | 0.82 [0.81, 0.82] / 0.82 / 0.01 |
| C · prior weighting off | 52.2 [51.0, 53.4] / 52.7 / 6.0 | 62.7 [60.3, 65.3] / 62.5 / 12.9 | 0.18 [0.17, 0.18] / 0.17 / 0.02 | 0.83 [0.83, 0.84] / 0.83 / 0.01 |
| C · self learning off | 37.6 [36.7, 38.6] / 36.3 / 4.9 | 59.4 [56.8, 61.9] / 58.0 / 13.1 | 0.16 [0.15, 0.17] / 0.16 / 0.03 | 0.06 [0.05, 0.07] / 0.05 / 0.04 |
| C · world learning off | 47.2 [46.0, 48.5] / 46.4 / 6.2 | 76.6 [73.3, 79.8] / 75.0 / 16.3 | 0.12 [0.12, 0.13] / 0.13 / 0.03 | 0.81 [0.80, 0.81] / 0.81 / 0.01 |
| C · world model off | 71.8 [70.4, 73.2] / 70.9 / 7.4 | 50.0 [47.6, 52.5] / 49.5 / 12.4 | 0.26 [0.26, 0.27] / 0.25 / 0.04 | 0.83 [0.83, 0.84] / 0.83 / 0.01 |

### 4.2 Paired effects

Difference = first condition − second condition. Only representative outcomes shown; all 100
pairs use the same seed.

| Contrast | Δ mean E [95% CI] | dz (energy) | Δ resources | Δ rest | Δ self acc | Δ KL | Δ decision | Holm p (sign-flip) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B − A | +35.3 [34.2, 36.5] | 5.86 | −0.6 | +0.23 | — | +1.61 | +0.55 | <0.001 |
| B − B_self_off | +35.3 [34.2, 36.5] | 5.86 | −0.6 | +0.23 | +0.04 | +1.61 | +0.55 | <0.001 |
| B − B_frozen_self | +37.7 [36.5, 38.9] | 6.13 | −3.5 | +0.24 | +0.78 | +1.51 | +0.35 | <0.001 (resources 0.057) |
| C − B | −32.0 [−33.3, −30.6] | −4.59 | +1.9 | −0.22 | −0.05 | −1.25 | −0.28 | <0.001 (resources 0.475) |
| C − C_meta_off | −32.0 [−33.3, −30.6] | −4.59 | +1.9 | −0.22 | −0.05 | −1.25 | −0.28 | 0.002 |
| C − C_plasticity_off | −0.2 [−1.5, 0.9] | −0.04 | −1.7 | +0.00 | −0.00 | +0.01 | +0.01 | ns |
| C − C_prior_off | −1.9 [−3.1, −0.7] | −0.30 | +0.2 | −0.00 | −0.02 | −0.02 | −0.01 | 0.002–0.03 |
| C − C_self_off | +3.4 [2.2, 4.5] | 0.59 | +1.3 | +0.01 | +0.01 | +0.35 | +0.27 | 0.002 |
| C − C_frozen_self | +12.7 [11.6, 13.8] | 2.22 | +3.6 | +0.01 | +0.76 | +0.35 | +0.24 | 0.002–0.04 |
| A − A_no_world | +5.3 [4.6, 6.0] | 1.42 | +33.5 | −0.06 | — | 0.00 | 0.00 | <0.001 |
| C − C_no_world | −21.5 [−23.2, −19.8] | −2.49 | +13.0 | −0.09 | −0.02 | −0.17 | −0.23 | 0.002 |
| C − C_world_frozen | +3.1 [1.7, 4.4] | 0.44 | −13.6 | +0.05 | +0.01 | −0.18 | +0.10 | 0.002 |

**Interpretation**

- **World model** is the only component with a clear *foraging* benefit: removing it costs 33.5
  resources in A. But **world learning** is not beneficial: a frozen prior collects more
  resources than C. This suggests the world model's priors do most of the work and online
  learning may overfit stochastic outcomes.
- **Self-model** has a large behavioural effect and improves self-state accuracy, but not
  resource collection or survival. It mainly raises stored energy by increasing rest; frozen self
  still forages at least as well.
- **Meta-model** has a large effect *because it gates self influence*, but it does not improve
  resources, survival, or self-state accuracy. Its adaptive-learning edge is inert.
- **Prior weighting** slightly reduces self-state accuracy (C − prior-off = −0.02), consistent
  with trusting internal predictions over noisy observations. The effect is small.
- **C vs C_meta_off** and **C vs B** are identical because meta-off fixes influence at 1 and
  removes all three modulations; this is a useful implementation sanity check.

### 4.3 World-model score flaw

The reported "world accuracy" (1 − Brier) is **not a skill score**. A neutral, non-learned model
can score around 0.89 in these runs because collection is rare and the Brier of a constant
pCollect = 0.05 is small. The A-no-world condition therefore shows similar "world accuracy" to A
while collecting 28 resources instead of 62. The harness therefore also computes **Brier skill
scores (BSS)** against each run's base rate for movement success and collection. BSS = 0 means
"no better than predicting the base rate"; negative means worse.

| Condition | World BSS success | World BSS collect | Self BSS success | Self ΔE MAE |
|---|---:|---:|---:|---:|
| A | −0.11 | 0.40 | — | — |
| A · world off | −0.08 | −0.02 | — | — |
| B | 0.01 | 0.53 | 0.17 | 1.73 |
| B · self feedback off | −0.11 | 0.40 | 0.10 | 1.65 |
| B · self learning off | −0.13 | 0.35 | −0.17 | 2.62 |
| C | −0.11 | 0.40 | 0.08 | 1.58 |
| C · self feedback off | −0.11 | 0.40 | 0.09 | 1.69 |
| C · meta feedback off | 0.01 | 0.53 | 0.17 | 1.73 |
| C · plasticity off | −0.12 | 0.40 | 0.08 | 1.57 |
| C · prior weighting off | −0.11 | 0.40 | 0.08 | 1.56 |
| C · self learning off | −0.12 | 0.37 | −0.15 | 2.46 |
| C · world learning off | −0.24 | −0.24 | 0.06 | 1.88 |
| C · world model off | −0.09 | −0.00 | 0.35 | 1.28 |

This correction is important:

- The world model's **movement-success** predictions have essentially no skill in A/B/C (BSS
  around 0 or negative); its **collection** predictions do have skill (BSS 0.40–0.53). The
  learned model is therefore not a uniformly good model of the environment.
- **World learning** improves collection BSS substantially relative to the frozen-prior condition
  (−0.24 → 0.40), but it does **not** improve foraging performance (frozen world collects more).
  Model accuracy and control performance are decoupled here.
- Removing the world model drops both collect BSS and resources (0.40 → −0.00; 61.7 → 28.2),
  showing that these predictions—not necessarily their online updating—are useful.
- The self-model's **success** predictions have modest positive skill in B (0.17), weak skill in
  C (0.08), and negative skill when frozen. Its energy-delta MAE is 1.58–1.73 in the adaptive
  model.
- The paired BSS effects are significant: A vs A-no-world collection skill **0.40 vs −0.02**
  (p < 0.001); C vs C-world-frozen collection skill **0.40 vs −0.24** (p = 0.002); B vs
  B-frozen-self self-success skill **0.17 vs −0.17** (p = 0.002). Learning improves predictive
  skill, but, as the behavioural table shows, it does not translate into better foraging.

The same warning applies to a naive reading of self "accuracy" as a probability; it is a scaled
mean absolute error, not a calibrated probability.

---

## 5. Incorrect self-model experiment

**Configuration (research-only, not the default).** Mode C, 100 paired seeds, 600 ticks. The
self-model is initialised with a systematically wrong movement-cost belief:
**cheap = 0.2** or **expensive = 8.0** energy per attempted move, against a true starting
effective cost of 1.41. The clean paired run uses the default 1.35 prior. No ground truth is
provided to the agent; recovery is driven by noisy interoceptive deltas.

**Recovery definitions**

- *First revision:* first tick with |cost estimate − initial wrong value| > 1.
- *Correction:* first tick after which the model stays within 0.5 of the paired unperturbed
  model for 8 consecutive ticks. This removes the large sensor-noise floor from the time measure.
- *Detection:* first sustained 3-tick difference from the paired clean run in meta trust
  (< −0.04) or meta error EMA (> +0.04).

| Condition | Recovered | Correction median (ticks) | Detection median (ticks) | Detected before correction | First revision | Trust before → detection → after | Final model gap |
|---|---:|---:|---:|---:|---:|---:|---:|
| meta on / cheap | 100/100 | 8 | 118 | 5% | 2 | 0.71 → 0.59 → 0.48 | 0.17 |
| meta on / expensive | 100/100 | 23 | 79 | 43% | 1 | 0.72 → 0.60 → 0.50 | 0.28 |
| meta off / cheap | 100/100 | 7 | 601* | 5% | 2 | 0.71 → 0.61 → 0.52 | 0.24 |
| meta off / expensive | 100/100 | 32 | 24 | 57% | 1 | 0.72 → 0.60 → 0.52 | 1.15 |
| plasticity off / cheap | 100/100 | 7 | 153 | 7% | 2 | 0.71 → 0.60 → 0.50 | 0.08 |
| plasticity off / expensive | 100/100 | 22 | 69 | 43% | 1 | 0.72 → 0.61 → 0.51 | 0.16 |
| prior off / cheap | 100/100 | 8 | 601* | 5% | 2 | 0.71 → 0.62 → 0.51 | 0.10 |
| prior off / expensive | 100/100 | 23 | 68 | 43% | 1 | 0.72 → 0.62 → 0.52 | 0.25 |

\*Detection median 601 means fewer than half the runs ever crossed the detection threshold before
the 600-tick horizon; this is a censored median, not a measured 601-tick latency.

Correction-time means and 95% CIs: meta-on cheap **8.5 [7.8, 9.6]**, meta-on expensive
**25.8 [23.9, 28.1]**, meta-off cheap **7.5 [6.8, 8.4]**, meta-off expensive **36.6 [32.7, 41.0]**,
plasticity-off cheap **7.7 [6.8, 9.1]**, plasticity-off expensive **24.2 [22.4, 26.5]**,
prior-off cheap **8.5 [7.8, 9.6]**, prior-off expensive **26.2 [24.1, 28.8]**. Detection-time
CIs are wide because of censoring; see `research/analysis.json`.

**Findings**

- **Recovery does not require ground truth.** 100% of corrupt runs recover; the self-model has no
  direct access to physical cost or energy, and the recovery path is the noisy learned
  interoceptive delta.
- **First-order learning is fast; meta detection is slow.** The first cost revision is 1–2 ticks
  and correction 7–32 ticks. Meta detection is 79–118 ticks median, often after correction.
- **Meta trust does eventually fall**, from 0.72 to 0.60 at detection and ~0.50 after correction.
  It is a response to persistent error, not a timely detector.
- **Meta feedback helps only severe corruption**: expensive correction is 23 vs 32 ticks with
  meta off (p < 0.001), but cheap is 8 vs 7 (p < 0.001 in the wrong direction). Against
  plasticity-off, meta-on is 1.6 ticks slower for expensive; against prior-off it is not
  different. The benefit is therefore mostly **trust-gated suppression of bad self influence**,
  not adaptive learning or prior weighting.
- **Behaviour changes during recovery are small but visible.** With expensive corruption, the
  meta-on rest fraction was 0.006 before, 0.002 during and 0.042 after; meta-off was
  0.079/0.051/0.052. Meta-on prevents over-resting while the wrong expensive-cost belief is
  active, then returns to a more resting policy. KL during recovery was 0.012 vs 0.358 with meta
  off; decision change 2.6% vs 12.2%.
- **No deaths** in the corruption runs; recovery is not a survival phenomenon here.

**Conclusion:** The agent can correct an incorrect self-model without ground truth. The
meta-model does not reliably detect the error before the correction; it tracks the aftermath and
can quarantine an unreliable model. This supports a first-order adaptive explanation and weakens
the stronger second-order interpretation.

---

## 6. Statistical results

### 6.1 Method

- 100 seeds, 1–100, paired across conditions and corruption/control variants.
- 1,200 ticks for the 13 main conditions; 600 for the 8 corruption cells.
- Identical world generation, resource schedule and initial state per seed.
- Paired sign-flip randomisation test with 10,000 permutations; 95% percentile bootstrap CIs for
  means and paired differences (2,000 resamples); Cohen's dz for paired effect size; Holm
  correction within each planned contrast.
- Seeds are independent; the simulation is deterministic per seed, so every comparison has
  exactly 100 paired observations unless a run dies.

### 6.2 Statistical limitations

- **Survival floor:** 100/100 main runs survived to 1,200 ticks; only two frozen-self runs died.
  Survival cannot discriminate conditions, and the reported "ticks survived" difference (8–11)
  is not significant after correction. All performance conclusions concern energy/foraging
  behaviour, not survival.
- **Large samples, small meaningful differences:** with 100 seeds, tiny effects (e.g. cost MAE
  +0.04) can be statistically significant. Effect sizes and CIs are reported; p-values alone are
  not interpreted as importance.
- **Multiple comparisons:** Holm is applied within a contrast across 16 metrics. Cross-contrast
  families are not adjusted; treat the full set as exploratory rather than confirmatory.
- **Ceiling/non-stationarity:** the environment is resource-rich and the agent rarely dies, so
  the task may not require an accurate self-model. This is a design limitation, not a statistical
  one.

### 6.3 KL and behavioural influence

KL is meaningful when interpreted as a policy-distribution distance, not as a behavioural
outcome.

| Condition | Mean KL | Median KL | KL p95 | Decision change | Policy TV | r(KL, decision) |
|---|---:|---:|---:|---:|---:|---:|
| B | 1.61 | 1.53 | 3.97 | 0.55 | 0.40 | 0.85 [0.77, 0.90] |
| C | 0.35 | 0.35 | 1.45 | 0.27 | 0.16 | 0.67 [0.55, 0.77] |
| B frozen self | 0.10 | 0.10 | 0.34 | 0.20 | 0.11 | 0.94 [0.91, 0.96] |
| C frozen self | 0.001 | 0.001 | 0.002 | 0.026 | 0.012 | 0.55 [0.38, 0.70] |
| B self feedback off | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | — |
| C self feedback off | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | — |

KL is zero exactly when self feedback is off, positive in 100% of B/C runs, and correlated with
the independently sampled counterfactual decision change. It is **not** a direct measure of
performance or of "self-awareness"; it measures how much the self term reshapes the action
distribution.

Across seeds, B's mean KL also correlates with its increased rest fraction (r **0.88**), but
only weakly with its energy difference (r **0.39**) and not with resources (r **−0.10**). For C
the associations are weaker (Δrest r **0.29**, Δenergy r **−0.39**, Δresources r **−0.37**).
This is consistent with KL measuring a change in strategy, not a value improvement.

### 6.4 Confidence and meta calibration

| Measure (C) | Estimate [95% CI] |
|---|---:|
| Trust ↔ current self-state accuracy | −0.00 [−0.01, 0.01] |
| Self-confidence ↔ current accuracy | 0.30 [0.29, 0.31] |
| Trust ↔ future self-state accuracy | −0.07 [−0.08, −0.06] |
| Self-confidence ↔ future accuracy | −0.05 [−0.06, −0.04] |
| Trust ↔ future forward accuracy | 0.10 [0.09, 0.11] |
| Self-confidence ↔ future forward accuracy | 0.07 [0.06, 0.09] |
| R² confidence → future state | 0.00 [0.00, 0.01] |
| R² confidence + trust → future state | 0.01 [0.01, 0.01] |
| ECE trust | 0.30 [0.30, 0.30] |
| ECE self-confidence | 0.44 [0.44, 0.44] |
| AUC trust for low future accuracy | 0.45 [0.45, 0.46] |
| AUC self-confidence for low future accuracy | 0.46 [0.46, 0.47] |
| Engine external predictive meta-calibration | 0.03 [0.00, 0.07] |
| Meta-model's internal "calibration" | 0.63 [0.61, 0.66] |

Trust adds **0.006** R² over self-confidence (p < 0.001, but negligible), and its AUC is
**0.01 lower** than confidence (p = 0.003). The internal calibration number is circular: the
meta-model's accuracy proxy is `1 − 1.8 × errorEMA`, a deterministic function of the same error
used to update trust.

When the self-model is frozen, trust is more informative: trust ↔ state accuracy **0.43**,
ECE **0.08**. The meta level can track a static error; it does not track the adaptive model's
actual accuracy well.

### 6.5 Self-model accuracy audit

100 seeds, 1,200 ticks:

| Quantity | B | C | Frozen self (B/C) |
|---|---:|---:|---:|
| Energy MAE | 3.24 [3.18, 3.29] | 4.54 [4.51, 4.58] | 38.4 / 44.7 |
| Raw sensor MAE (same phase) | 1.92 [1.91, 1.93] | 1.92 [1.91, 1.93] | 1.93 |
| Max energy error | 31.1 | 36.3 | 68.1 / 72.7 |
| Fatigue MAE / corr | 0.13 / 0.89 | 0.21 / 0.83 | 0.67 / 0.00 |
| Rest gain estimate | 2.78 | 2.93 | 2.35 prior |
| Collect gain estimate | 13.18 | 20.73 | 20.00 prior |
| Cost MAE / bias | 1.38 / +1.19 | 0.75 / +0.35 | 0.83 / −0.81 |
| Forward Brier | 0.28 | 0.21 | 0.36 / 0.35 |
| Self success BSS | 0.17 [0.16, 0.18] | 0.08 [0.07, 0.09] | −0.17 / −0.15 |
| Self ΔE MAE | 1.73 [1.67, 1.80] | 1.58 [1.54, 1.62] | 2.62 / 2.46 |

The self-model's **fatigue** estimate is meaningful, but its **energy** belief is *less* accurate
than the raw interoceptive sample. Its **movement cost** estimate is biased and noisy, its
**collection gain** is strongly underestimated in B, and its **success probability** has only
modest skill (BSS 0.08–0.17). This is not a uniformly accurate model of the body, and it is not a
better state estimator than the sensor it is supposed to filter.

---

## 7. Limitations

1. **Hand-coded priors.** Self cost/rest/collect priors and fatigue rates are close to the true
   dynamics; utility weights and meta mappings are hand-designed. The "emergence" claim is
   therefore weak.
   - **The energy belief is not a good filter.** Its MAE is worse than the raw sensor sample
     (3.24/4.54 vs 1.92), so "self-model accuracy" should not be read as a filtering improvement.
     A raw-sensor baseline is included in the report and should be used in future comparisons.
2. **No blank-slate test.** The corruption experiment perturbs one prior but leaves the other
   self priors and the meta/utility design intact.
3. **Benign environment / survival ceiling.** All main runs survived. There is no evidence the
   self-model or meta-model is necessary for survival.
4. **One task and one horizon.** 30×30 resource foraging, 1,200 ticks, five actions, fixed
   resource and fatigue laws. Generalisation is unknown.
5. **Meta-model is not learned.** It is a scalar EMA and affine gain scheduler; calling it a
   model of reliability is generous.
6. **Calibration metrics are difficult.** The internal meta-calibration is circular; the external
   predictive calibration is noisy and window-dependent. Trust has poor absolute calibration.
7. **KL is scale-dependent.** It is correlated with decision changes but is not a performance
   metric. A policy with a sharp distribution can have a large KL without a large behavioural
   consequence.
8. **World "accuracy" was not a skill score.** The original 1 − Brier metric can reward a
   constant model. BSS is included to correct this.
9. **Self-accuracy scale.** The headline 0–1 self accuracy is `1 − mean |error|/25`, an arbitrary
   normalisation; raw errors and separate MAE/Brier values are reported.
10. **Corruption recovery metric.** Recovery is measured against the paired clean model
    trajectory, not absolute ground truth, because instantaneous cost observations are very
    noisy. Absolute cost error is also reported, but the two definitions can diverge.
11. **No formal causal graph / mediation analysis.** Ablations identify the implemented edges,
    but the system is closed-loop; effects on behaviour and learning are entangled.
12. **No consciousness claim.** Nothing here measures or claims subjective experience.

---

## 8. What has been demonstrated

- A deterministic, reproducible simulation with a self-model that is computed only from local,
  noisy observations and its own history.
- An independent self-model that is causally active but **does not outperform raw interoception**
  as an energy estimator; this is an informative negative result.
- A first-order self-model that causally changes action selection, with large, paired effect sizes
  and complete disappearance when self feedback is disabled.
- A self-model that can become badly wrong, and that recovers from a systematically wrong
  movement-cost prior without ground-truth access, in 100/100 runs.
- A second-order trust signal that responds to persistent self-model unreliability, suppresses
  an unreliable model (C_frozen_self), and improves recovery under severe cost corruption by
  gating self-influence.
- A measurement suite that separates policy influence (KL), actual decision changes, prediction
  error, calibration and behavioural adaptation, with paired seeds and confidence intervals.
- An honest negative result: the meta-model is not calibrated, additive learning-rate/prior
  modulation is negligible, and the self-model does not improve task performance in this
  environment.

## 9. What has NOT been demonstrated

- That the meta-model learns a representation of self-model reliability, rather than tracking a
  scalar error with a hand-set mapping.
- That the second-order loop improves survival, foraging, self-model accuracy or calibration in
  the normal regime.
- That the self-model is a better estimator of current internal state than the raw interoceptive
  sample; it is worse for energy, though it adds predictive variables.
- That the self-model or meta-model is necessary for the observed competence; frozen-prior
  alternatives perform comparably on resources.
- That the behaviour emerges from minimal assumptions; hand-tuned priors and utility weights
  contribute materially.
- That the system exhibits a strong Hofstadter-style strange loop, self-awareness, identity,
  emotions, intelligence or subjective experience.
- That these results generalise to other environments, horizons, reward structures or
  non-stationary dynamics.

---

## 10. Recommended next experiments

1. **Cold-start / prior-randomisation study.** Sample self priors and utility weights from broad
   distributions, or start all self coefficients at neutral values. Measure whether the loop
   still learns useful self-knowledge and whether the meta-loop adds value. Include the raw
   interoceptive sample as a baseline estimator, because V0.1's filter is worse than it.
2. **Learn the meta-model.** Replace the fixed trust mapping with an online predictor of future
   self-model error using features (fatigue, energy, action entropy, recent slips). Evaluate
   held-out calibration (Brier, ECE, AUC) against self-confidence and against the hand mapping.
3. **Make accurate self-knowledge necessary.** Use scarce energy, stronger fatigue cost, longer
   horizons, deceptive/non-stationary dynamics, or a task where over/under-estimating cost is
   fatal. Measure survival and foraging, not only energy.
4. **Persistence and magnitude of corruption.** Add slow drifts, intermittent sensor failure, and
   corrupted fatigue rates; test whether meta detection precedes correction and whether trust
   modulation actually accelerates recovery.
5. **Separate the three meta edges.** Add independent interventions that clamp trust scaling,
   learning-rate modulation and prior weighting to their baselines while keeping the others
   active; estimate mediated effects.
6. **World-model skill score and holdout evaluation.** Use Brier skill, log loss and held-out
   prediction error; test whether online learning beats frozen priors out of sample.
7. **Causal mediation / surrogate interventions.** Randomise the self term independently of the
   world term and measure action, energy and survival responses; distinguish "self-model
   influence" from "extra rest bias".
8. **Representational probes.** Test whether the self-model's internal estimates contain
   information about future outcomes beyond the observations (e.g., probe energy/fatigue/cost
   from its state).
9. **Scale and robustness.** Multiple environments, seeds, noise levels and horizons; report
   pre-registered effect sizes, not only p-values.
10. **Compare to simple baselines.** Fixed homeostatic controllers, random self-models, shuffled
    self-predictions, and meta-off policies. The current frozen-self and world-off ablations are
    a start but not a full baseline suite.

---

## Reproduction

```bash
cd strange-loop
npm run typecheck
npm test
npx tsx tools/validate.ts      # 100 seeds, 13 conditions, 1,200 ticks
npx tsx tools/analyze.ts       # writes research/analysis.json and tables
npx tsx tools/selfaudit.ts     # focused self-estimate audit
```

Raw outputs: `research/results.json`, `research/summary.json`, `research/analysis.json`.

The default dynamics, policy and UI settings were not altered for these experiments. Research
options are opt-in through `ResearchOptions` (`src/simulation/types.ts`) and the default lab uses
the original settings; the extra `SeriesPoint` fields are instrumentation only.
