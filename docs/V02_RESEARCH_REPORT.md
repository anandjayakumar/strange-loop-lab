# Strange Loop Lab V0.2 — Learned Meta-Cognition & Epistemic Strange Loops

**Date:** 2026-11-18  
**Branch:** `v0.2-learned-meta`  
**Status:** V0.2 experimental research report. V0 remains intact and selectable from the V0.2
dashboard.

## Executive summary

V0.2 removes the fixed, designer-informed starting values from the self-model and world model,
adds a harsher metabolic environment, multi-channel interoception, scheduled and interactive
regime shifts, a learned meta-model trained only on observable errors, counterfactually isolated
shadow probes, and four exploration conditions. It also adds a V0.2 dashboard with a reliability
diagram, cross-channel failure-attribution readout and information/decision-value breakdown.

### Headline numbers

- **100/100** full V0.2 standard runs survived 1,000 ticks; mean resources **32.4**, mean
  energy **35.1**; self-model energy MAE **1.67** versus raw interoception **1.92**.
- **Severe randomized priors** reduced resources to **19.2** (paired difference **+13.23
  [10.34, 16.17]**, p < 0.001) while self MAE remained 1.69; priors matter, but the
  self-model still learns.
- **World-model learning** mattered: frozen world learning produced **6.6** resources versus
  **32.4** with learning (difference **+25.83 [21.86, 29.84]**, p < 0.001), reversing V0's
  frozen-world advantage.
- **Self learning and self feedback mattered for resources**: removing self learning changed
  resources by **+10.01 [6.84, 13.27]** (full minus frozen), and removing self feedback by
  **+9.38 [6.34, 12.59]**, both p < 0.001.
- **Meta feedback did not improve resources**: meta-on collected **7.42 fewer** resources than
  meta-off (95% CI [−11.92, −3.05], p = 0.007) and held less energy (difference **−8.98**,
  p < 0.001), despite the learned meta-model's lower Brier score.
- The meta-model's **Brier Skill Score** was **0.133 [0.126, 0.141]** against a constant base
  rate and ECE **0.041 [0.039, 0.042]**, with holdout Brier **0.188** and holdout ECE **0.049**.
  Against a **rolling base-rate** baseline, however, BSS was **−0.12 [−0.13, −0.12]**: the
  learned predictor was worse than a simple adaptive base rate. Its in-distribution AUROC
  against latent failure was only **0.47 [0.46, 0.49]**, while shadow-probe AUROC was **0.57**
  and severe-prior shadow AUROC **0.61**. Calibration succeeded more than discrimination; the
  complex feature model did not beat a rolling baseline.
- **Physical regime shifts** were lethal (38/100 survived); mixed shifts (19/100), while energy,
  fatigue and shared sensor shifts were survivable (100/100 each) but changed estimation.
- **Physical shift filter benchmark**: self MAE 1.61, raw 1.92, but simple EMA 1.42 and
  random-walk Kalman 1.39 — the learned filter is not always the best estimator under abrupt
  physical change.
- **Failure attribution** was weak: physical 1/100, energy sensor 0/100, fatigue sensor 86/100,
  shared 0/100. Cross-channel signatures overlapped; this is a negative result.

The strongest positives are:

- **Randomized priors still allow learning.** With uninformed randomized self/world priors, the
  learned energy estimator beat the raw sensor on average in the standard and harsh
  configurations, and the world model's online learning outperformed a frozen-prior world model
  on foraging.
- **The learned meta-model is calibrated online.** It reduced Brier score relative to its
  base-rate and rolling-rate baselines and produced a non-trivial shadow-probe AUROC. Its ECE on
  the chronological holdout was small.
- **Regime shifts create real stakes.** Physical and shared sensor shifts caused substantial
  mortality; sensor-specific shifts changed estimation and behaviour.
- **The recursive loop is causally active.** Ablating meta feedback, self feedback, self learning,
  world learning and the world model changed behaviour and/or model error; the shadow probe is
  strictly isolated.

The strongest negatives are:

- **In-distribution meta discrimination is weak.** The meta-model's AUROC against latent failure
  labels was near chance in the standard/harsh stationary conditions; its calibration is better
  than its ranking.
- **Epistemic exploration did not clearly improve long-run outcomes.** VoI versus pragmatic-only
  and uncertainty-bonus exploration produced no significant resource/survival advantage in the
  tested horizon.
- **The pessimistic belief trap was not self-sustaining** enough to produce a robust trap effect:
  movement recovered the cost estimate, and exploration did not consistently rescue a stronger
  trap.
- **Failure attribution is only partially identifiable.** Fatigue-channel shifts were recognized
  more reliably than physical or shared shifts; observable signatures overlap substantially.
- **Self-modeling still did not produce a clear survival advantage** over a frozen-self control
  in the standard stationary condition, though the frozen model had much larger state error and
  lower resource totals in harsher conditions.

These are genuine V0.2 results, including the negative ones. Nothing here is evidence of
consciousness, awareness, identity or subjective experience.

---

## 1. What changed from V0

V0 remains exactly reproducible through the original `SimulationEngine`, dashboard and
`docs/RESEARCH_REPORT.md`. V0.2 is a separate stack:

```
src/simulation/v02/
  types.ts        channel observations, dynamic state, meta contexts, snapshot types
  config.ts       difficulty, randomized-prior ranges, sensors, scenarios, exploration
  dynamics.ts     metabolic cliff, debt, collapse, slipped/blocked actions
  selfModel.ts    randomized-prior first-order estimator and predictor
  metaModel.ts    learned observable-error/tolerance predictor
  worldModel.ts   randomized-prior online logistic world model
  agent.ts        utility construction, epistemic action selection, memory
  attribution.ts  observable channel-signature diagnostic
  engine.ts       phases, shifts, shadow probes, metrics
src/v02/
  useV02Simulation.ts
  V02Lab.tsx
```

The V0.2 dashboard is reachable with the **V0.2** button in the V0 header and returns through
the **V0** button in the V0.2 header. V0.2 research options are not exposed as V0 changes.

**V0 baseline preserved.** The V0 code, tests, 27-test invariants, dashboard, `docs/MODEL.md`
and `docs/RESEARCH_REPORT.md` remain in place. The V0 audit's standard baseline was: B mean
energy 82.3, resources 61.0, self energy MAE 3.24; C mean energy 50.3, resources 62.9, self MAE
4.54. V0.2 uses a different, scarcer environment and therefore is **not** an apples-to-apples
comparison; the preserved V0 mode remains the reference when identical environment rules are
needed.

---

## 2. Architecture and equations

### 2.1 Uninformed priors

`SelfModelV02` draws its first-order coefficients from `PRIOR_RANGES` in
`src/simulation/v02/config.ts`:

- movement cost, rest gain and collection gain from broad bounded intervals;
- move-fatigue and rest-relief rates from broad intervals;
- energy sensor bias from a near-neutral interval and measurement variance from a wide interval;
- zero-centered random success/collection logits;
- zero effort-sensor bias (neutral; no hidden sensor defect is assumed).

`WorldModelV02` draws every success/collection/collision coefficient from the configured
`worldWeight` interval. No true environment parameter is used to construct either model.

Two regimes are exposed: `uninformed` and `severe`. The latter widens all ranges substantially.
This is the direct response to the V0 audit's designer-prior leakage.

### 2.2 Metabolic environment

`src/simulation/v02/dynamics.ts` adds:

```
effectiveCost = base + fatigue * fatigueSlope + energyWeight * E/Emax
                + [fatigue > cliff] * cliffExtraCost * (0.4 + fatigue)
effectiveSuccess = clamp(1 - fatigue * successSlope - cliffSlip, minSuccess, 0.995)
passiveMetabolism = difficulty.passive + metabolicDebt * 0.35
```

A move above the fatigue cliff pays a large extra cost and has a higher slip probability. At
critical energy, a collapse can add a multi-tick exhaustion state and a severe energy penalty.
Every tick adds `metabolicDebt`; a collected resource resets most of the debt. This makes both
reckless movement (cliff/ collapse) and excessive resting (debt accumulation / starvation)
consequential. Difficulty profiles differ in start energy, resource gain and density, cost, rest,
fatigue, cliff and sensor noise.

### 2.3 Multi-channel perception

`V02Observation` contains:

- a local 7×7 cell view and position (no global map);
- an **energy channel** `E + bias_E + noise_E`, with occasional stale samples;
- a **strain channel** `F + bias_F + noise_F` (fatigue cue);
- a post-action **effort channel** based on the experienced movement cost.

The channels have independent noise and bias and can be shifted independently or together.
The agent never receives the true energy, fatigue, cost, difficulty profile or shift label.

### 2.4 First-order self-model

`SelfModelV02` uses an adaptive measurement filter for energy and channel-specific updates for
cost, fatigue, rest and collection:

```
predicted = previous estimate
gain = clamp(0.30 + 0.50 * min(1, |rawChange|/5)
             + 0.08 * min(1, |innovation|/9)
             + 0.015 * log(1 + measurementVariance), 0.24, 0.90)
gain *= (1.08 - 0.15 * priorWeight)
estimate = estimate + gain * (biasCorrectedReading - estimate)
```

The measurement-dominant gain is deliberate: V0's forward model was allowed to drag the belief
away from a usable direct channel. V0.2 keeps the forward model for prediction and meta scoring
but does not let it dominate current-state correction. Cost and rest are learned from the effort
and energy channels; fatigue is tracked from the strain channel and action history; success and
collection are online logistic predictors.

### 2.5 Learned meta-model

`LearnedMetaModel` predicts, before an action:

1. `E_t = expected |predicted energy delta - observed noisy delta|`;
2. `P_t = probability that the smoothed observable error is <= tau` (`tau = 0.45`);
3. an epistemic uncertainty, a signed bias, a volatility estimate and an evidence count.

Context features (no ground truth):

- action one-hot;
- log evidence count in the current action × energy-bin × fatigue-bin cell;
- recent absolute error, recent signed bias, error volatility;
- current energy-filter innovation magnitude;
- cross-channel disagreement;
- time since rest, estimated fatigue/energy, recent slip rate;
- empirical context tolerance rate and mean error.

The error path is an online linear/Huber-style regression on features. The tolerance path is an
online logistic regression trained with Brier/log-loss scoring. A learned base tolerance rate and
an explicit shrinkage-to-base calibration layer prevent unsupported confidence in sparse
contexts. The model's uncertainty increases with residual variance and decreases with evidence.

Only executed-action outcomes update the meta-model. Its target is the smoothed **observable**
error; latent state error and regime labels never enter its training.

### 2.6 Epistemic action selection

`V02Agent.select` computes a pragmatic utility and an information value:

```
V(a) = V_pragmatic(a) + lambda * V_information(a)
```

- `pragmatic`: world collection/success/collision, novelty, self-model energy/fatigue/risk term.
- `uncertainty` mode: information value is the meta-model's uncertainty.
- `VoI` mode: information value is scaled by how much the action could alter the decision.
- `random`: a seeded random probe with probability 0.15; `pragmatic` uses λ = 0.
- Safety veto: information value is zero when predicted next energy is below 10 or predicted
  fatigue above 0.9.

The selection records the pragmatic distribution, information values, sampled action, whether it
was a random probe and a safety-block count.

### 2.7 Counterfactual isolation and shadow probes

`V02Engine.probeAction(action)` deep-copies the world and physical state, applies the forced
action with a separate shadow RNG, and returns the counterfactual outcome. It does not call
`Agent`, does not touch memory, self-model, meta-model, attribution or the real RNG streams, and
does not append to the agent's series. `tests/v02.test.ts` checks that the physical/model state
and series length are unchanged after probing all actions.

The V0.2 validation harness uses these probes only for evaluation. Shadow outcomes are never fed
back. A counterfactual-learning condition is not included; this remains a clean isolation test.

### 2.8 Failure attribution readout

`FailureAttributor` monitors signed energy innovations, strain residuals, effort residuals,
slip Brier score and sensor bias/variance. It maps normalized channel signatures to five
observable hypotheses: physical dynamics, energy sensor, fatigue sensor, shared/external and
insufficient evidence. It receives no regime labels and does not choose an intervention; the
learned meta-model is the causal reliability signal. Attribution accuracy is evaluated offline
against hidden scenario labels.

### 2.9 Evaluation isolation

All V0.2 evaluation uses the true physical state only outside the agent:

- `V02SeriesPoint` contains instrumented energy/fatigue/cost and latent error for audit;
- the engine metrics compute self/raw/fatigue/cost error and latent AUROC;
- shadow probes are evaluation-only.

The agent-facing types (`V02Observation`, `MetaContext`, `MemoryEntry`) contain no true state,
regime label or latent error.

---

## 3. Experimental design

Unless stated otherwise:

- **100 seeds**, 1–100, paired across conditions;
- **1,000 ticks** per main run;
- standard difficulty, uninformed randomized priors and VoI exploration for the baseline;
- shifts scheduled at tick 360;
- paired sign-flip randomisation tests (10,000 permutations), percentile bootstrap 95% CIs
  (2,000 resamples), Cohen's dz and Holm correction within contrast;
- shadow probes every 40 ticks for selected conditions.

Conditions:

| Key | Condition |
|---|---|
| `full` | V0.2 standard, uninformed, VoI |
| `docile` / `harsh` | difficulty stress |
| `severe` / `severe_harsh` | severe prior misspecification |
| `pragmatic` / `random` / `uncertainty` | exploration controls |
| `self_off` / `self_frozen` | first-order feedback / learning ablations |
| `meta_off` / `meta_frozen` | second-order feedback / learning ablations |
| `world_frozen` / `world_off` | world learning / world prediction ablations |
| `physical` / `energy_shift` / `fatigue_shift` / `shared_shift` / `mixed` | regime shifts |
| `trap_*` | pessimistic-cost belief trap with each exploration mode |

`tools/v02validate.ts` reproduces the results; `research/v02-results.json` contains per-seed
summaries; `research/v02-analysis.json` contains shadow records.

---

## 4. Results

> The tables below are populated from the 100-seed run. `research/v02validation.log` is the
> primary raw output.

### 4.1 Condition summary

Means over 100 seeds (1,000 ticks). Full per-seed distributions and bootstrap CIs are in
`research/v02-results.json` and `research/v02validation2.log`.

| Condition | Alive | Resources | Mean E | Self MAE | Raw MAE | Meta Brier | Meta BSS | Meta AUROC |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Full | 100/100 | 32.4 | 35.1 | 1.67 | 1.92 | 0.199 | 0.133 | 0.47 |
| Docile | 100/100 | 38.2 | 48.0 | 1.60 | 1.76 | 0.175 | 0.250 | 0.71 |
| Harsh | 100/100 | 24.4 | 29.5 | 1.96 | 2.24 | 0.146 | 0.090 | 0.45 |
| Severe priors | 100/100 | 19.2 | 31.6 | 1.69 | 1.92 | 0.198 | 0.140 | 0.49 |
| Severe · harsh | 99/100 | 14.8 | 26.3 | 1.98 | 2.24 | 0.145 | 0.090 | 0.45 |
| Self feedback off | 100/100 | 23.0 | 29.2 | 1.66 | 1.92 | 0.205 | 0.130 | 0.46 |
| Self learning off | 100/100 | 22.4 | 27.3 | 29.07 | 1.92 | 0.067 | −0.590 | 0.53 |
| Meta feedback off | 100/100 | 39.8 | 44.1 | 1.67 | 1.92 | 0.192 | 0.140 | 0.49 |
| Meta learning off | 100/100 | 32.4 | 35.1 | 1.68 | 1.92 | 0.250 | 0.000 | 0.50 |
| World learning off | 100/100 | 6.6 | 23.7 | 1.62 | 1.92 | 0.207 | 0.150 | 0.46 |
| World model off | 100/100 | 40.5 | 46.9 | 1.68 | 1.92 | 0.196 | 0.120 | 0.50 |
| Physical shift | 38/100 | 11.1 | 21.0 | 1.61 | 1.92 | 0.192 | 0.130 | 0.47 |
| Energy sensor shift | 100/100 | 29.3 | 27.8 | 5.69 | 5.83 | 0.083 | 0.270 | 0.59 |
| Fatigue sensor shift | 100/100 | 35.0 | 37.3 | 1.67 | 1.92 | 0.199 | 0.140 | 0.48 |
| Shared shift | 100/100 | 33.2 | 31.9 | 4.50 | 4.68 | 0.087 | 0.260 | 0.57 |
| Mixed shifts | 19/100 | 11.0 | 20.6 | 2.81 | 3.04 | 0.149 | 0.200 | 0.62 |
| Trap · pragmatic | 100/100 | 32.0 | 36.1 | 1.67 | 1.92 | 0.173 | 0.160 | — |
| Trap · random | 98/100 | 24.9 | 30.7 | 1.66 | 1.92 | 0.166 | 0.130 | — |
| Trap · uncertainty | 100/100 | 32.8 | 36.5 | 1.67 | 1.92 | 0.172 | 0.160 | — |
| Trap · VoI | 100/100 | 32.4 | 36.3 | 1.68 | 1.92 | 0.172 | 0.150 | — |

The **raw MAE** is the error of the latest noisy energy channel at the same sense phase; it is
not a filtered baseline. The full V0.2 self-model reduces that error by about 13% in standard
and 13% in harsh, but not under every shift.

### 4.2 Filter benchmarks

Offline baselines use the same timestamps as the instrumented state. EMA uses a fixed
alpha=0.35; the "Kalman" column is a known-noise random-walk filter with fixed gain 0.4, not a
tuned process model. These are deliberately simple baselines, not oracle-optimal.

| Condition | Learned | Raw | EMA | Kalman | Pre-shift self | Post-shift self |
|---|---:|---:|---:|---:|---:|---:|
| Full | **1.67** | 1.92 | 2.16 | 1.98 | — | — |
| Docile | **1.60** | 1.76 | 2.26 | 2.04 | — | — |
| Harsh | **1.96** | 2.24 | 2.32 | 2.16 | — | — |
| Severe | **1.69** | 1.92 | 1.77 | 1.66 | — | — |
| Physical shift | 1.61 | 1.92 | **1.42** | **1.39** | 1.67 | 1.57 |
| Energy sensor shift | **5.69** | 5.83 | 5.53 | 5.42 | 1.67 | 7.95 |
| Fatigue sensor shift | **1.67** | 1.92 | 2.16 | 1.98 | 1.67 | 1.67 |
| Shared shift | **4.50** | 4.68 | 4.43 | 4.30 | 1.67 | 6.09 |

The learned filter is competitive or best in stationary standard/harsh and sensor shifts, but a
simple EMA/Kalman is better after an abrupt **physical** shift. This is the expected case where a
learned process model is stale and a fast measurement filter wins; the report does not claim
uniform superiority.

### 4.3 Causal ablations

Differences are first condition − second condition. Positive resource/energy differences mean the
first condition has more.

| Contrast | Δ resources [95% CI] | Δ mean E [95% CI] | Δ self MAE | p (Holm) |
|---|---:|---:|---:|---:|
| Self feedback off | **+9.38** [6.34, 12.59] | +5.92 [4.41, 7.64] | +0.02 | <0.001 |
| Self learning off | **+10.01** [6.84, 13.27] | +7.84 [6.03, 9.87] | **−27.40** | <0.001 |
| Meta feedback off | **−7.42** [−11.92, −3.05] | **−8.98** [−11.42, −6.59] | −0.00 | 0.007 / <0.001 |
| Meta learning off | +0.06 [−3.82, 4.04] | −0.00 [−1.85, 1.94] | −0.01 | ns |
| World learning off | **+25.83** [21.86, 29.84] | +11.40 [9.46, 13.53] | +0.05 | <0.001 |
| World model off | **−8.11** [−13.17, −3.25] | **−11.76** [−14.40, −9.13] | −0.01 | 0.014 / <0.001 |
| Severe priors | **+13.23** [10.34, 16.17] | +3.52 [2.05, 5.00] | −0.02 | <0.001 |
| Physical shift | **+21.36** [18.23, 24.82] | **+14.11** [12.48, 15.89] | +0.06 | <0.001 |
| Energy sensor shift | +3.10 [0.67, 5.57] | +7.32 [6.08, 8.48] | **−4.02** | 0.067 / <0.001 |
| Shared shift | −0.77 [−3.60, 2.07] | +3.29 [1.65, 4.90] | **−2.83** | ns / <0.001 |

**Interpretation**

- **World learning now matters, unlike V0.** Removing it collapsed resources from 32.4 to 6.6
  and energy by 11.4. This fixes the specific V0 frozen-world-over-learned-world result. However,
  the **neutral no-world** condition (40.5 resources) is still better than the learned-world
  condition; the world model is not uniformly beneficial.
- **Self feedback and self learning each improve resource collection** by roughly 9–10 resources,
  with large paired effects. This is a stronger V0.2 result than V0, where self-model effects
  were mostly energy conservatism.
- **Meta feedback reduces resources and energy** relative to meta-off. The learned meta-model's
  causal gate is active but not performance-improving in this configuration.
- **Severe randomized priors lose ~13 resources**, showing that prior misspecification is costly
  despite eventual learning.
- **Physical shift is lethal**, with a 21-resource and 14-energy penalty and 62% mortality.
  Sensor shifts are survivable but degrade energy estimation.

### 4.4 Learned meta-model calibration and predictive value

Full V0.2 (100 seeds):

| Measure | Estimate [95% CI] |
|---|---:|
| Brier (observable tolerance) | 0.199 [0.196, 0.203] |
| Brier skill vs base rate | **0.133 [0.126, 0.141]** |
| Brier skill vs rolling-rate baseline | **−0.12 [−0.13, −0.12]** |
| ECE (in-distribution) | 0.041 [0.039, 0.042] |
| Chronological holdout Brier / ECE | 0.188 / 0.049 |
| AUROC vs latent failure | 0.471 [0.458, 0.483] |
| Shadow-probe Brier / AUROC | 0.320 / 0.57 |
| Severe-prior shadow AUROC | 0.61 |

Meta learning is causally necessary for calibration: `meta_learning off` forces Brier 0.250,
BSS 0, ECE 0.500 and AUROC 0.50. It is **not** necessary for resource outcome in this run
(0.06 resource difference), which is an important dissociation between calibration and control.

The rolling-baseline result is a caution: a simple adaptive base rate achieved a lower Brier
score than the learned feature model (negative rolling BSS). The learned model has value against
a constant base rate and provides uncertainty/evidence structure, but its feature-based
discrimination did not beat the simplest temporal baseline. This is a negative result, not
hidden by the aggregate Brier.

The engine's external predictive calibration and the meta-model's own internal calibration are
reported separately; the latter is not used as external evidence.

### 4.5 Regime shifts and failure attribution

| Condition | Alive | Δ resources vs full | Δ mean E vs full | Post-shift self MAE |
|---|---:|---:|---:|---:|
| Physical | 38/100 | −21.36 | −14.11 | 1.57 |
| Energy sensor | 100/100 | −3.10 (ns) | −7.32 | 7.95 |
| Fatigue sensor | 100/100 | +2.63 (ns) | +2.20 | 1.67 |
| Shared sensor | 100/100 | +0.77 (ns) | −3.29 | 6.09 |
| Mixed | 19/100 | — | — | — |

Attribution top-1 against hidden labels:

| Shift | Correct top attribution | 95% CI |
|---|---:|---:|
| Physical | 1/100 | 0–3% |
| Energy sensor | 0/100 | 0–0% |
| Fatigue sensor | 86/100 | 79–92% |
| Shared | 0/100 | 0–0% |

The fatigue-channel shift is recognizable. Physical and shared shifts produce overlapping
innovations (especially strain residual changes), so the observable signature is not identifiable
with this diagnostic. This is an explicit negative result and a concrete example of observational
indistinguishability; no hard-coded intervention is applied.

### 4.6 Belief traps and exploration

Exploration condition means (standard, 1,000 ticks):

| Condition | Alive | Resources | Mean E | Meta Brier |
|---|---:|---:|---:|---:|
| Pragmatic only | 100/100 | 32.4 | 34.6 | 0.198 |
| Random | 97/100 | 24.0 | 30.3 | 0.198 |
| Uncertainty bonus | 100/100 | 33.2 | 35.6 | 0.197 |
| VoI | 100/100 | 32.4 | 35.1 | 0.199 |

- **VoI vs pragmatic**: Δ resources **+0.04 [−3.34, 3.40]**, Δ energy +0.54; no detectable
  benefit.
- **VoI vs random**: +8.44 resources [4.57, 12.23], p < 0.001; random exploration is harmful.
- **VoI vs uncertainty**: −0.75 resources [−3.91, 2.47], ns; the decision-value refinement did
  not improve outcomes over a pure uncertainty bonus.
- **Pessimistic trap**: all four modes survived 100/100 except random 98/100; resources ranged
  24.9–32.8 and VoI did not rescue the trap. The cost estimate was corrected by movement (first
  revision within a few ticks), so the trap was not self-sustaining. This is a negative result.

### 4.7 Shadow probes

The harness took **12,500 forced-action shadow observations** for full, severe and meta-off, and
11,525 for physical shift; every probe left the real agent, memory and RNG streams unchanged
(verified in tests). Off-policy results were weaker than in-distribution:

| Condition | Shadow probes | Brier | AUROC |
|---|---:|---:|---:|
| Full | 12,500 | 0.320 | 0.57 |
| Severe priors | 12,500 | 0.314 | 0.61 |
| Meta off | 12,500 | 0.324 | 0.59 |
| Physical shift | 11,525 | 0.327 | 0.54 |
| Energy sensor shift | 12,500 | 0.283 | 0.57 |

Off-policy shadow scoring is the more honest estimate of the meta-model's practical reliability,
because it does not inherit the natural policy's action-selection bias. It is moderate, not
strong.

---

## 5. Answers to the ten research questions

1. **Useful self-representations without designer-informed priors?**  
   **Yes, with qualifications.** With uninformed randomized priors the learned energy estimate
   beat raw sensing in standard (1.67 vs 1.92), harsh (1.96 vs 2.24) and docile (1.60 vs 1.76)
   configurations. Severe priors still learned (1.69 vs 1.92) but lost resources (19.2 vs 32.4).
   Freezing self learning raised self MAE to 29.07 and reduced resources to 22.4, so the learning
   is doing work. The qualification is that self-modeling is not the only useful component:
   world-model learning was also essential (frozen: 6.6 resources), and the world-off neutral
   condition collected more resources than full. The self-model is useful, not sufficient.

2. **Distinguish model error from sensor noise using cross-channel cues?**  
   **Partially, and not generally.** Channel-specific shifts changed self error in expected ways:
   energy-sensor shift (5.69 self MAE vs 5.83 raw), shared shift (4.50 vs 4.68), with meta BSS
   0.27/0.26 and AUROC 0.59/0.57, compared with 0.13/0.47 in stationary full. A fatigue-sensor
   shift left energy error unchanged but increased fatigue error (0.20 vs 0.15). However the
   attribution readout identified only 86/100 fatigue shifts and 0–1/100 physical, energy or
   shared shifts. The cross-channel signatures overlap; the system can often detect *that*
   reliability changed but not reliably *which* channel caused it.

3. **Learn when its own self-model is unreliable?**  
   **Calibration against a constant base rate, but not against a rolling baseline; ranked
   discrimination is weak.** Meta learning achieved Brier 0.199, BSS 0.133 and ECE 0.041, versus
   a fixed meta-model at Brier 0.250, BSS 0 and ECE 0.500. Chronological holdout was Brier 0.188
   and ECE 0.049. However, its BSS against a rolling base-rate predictor was **−0.12**, and the
   in-distribution AUROC against latent failure was 0.471, essentially chance; shadow-probe AUROC
   was 0.57 (0.61 under severe priors). It learns the average reliability and uncertainty, not a
   strong context-specific failure ranking in the standard stationary condition, and the learned
   feature model does not beat the rolling baseline.

4. **Recognize insufficient evidence?**  
   **Structurally yes, empirically only partially demonstrated.** The meta-model maintains
   per-action/context evidence counts, shrinks tolerance probability and influence toward 0.5
   when evidence is sparse, and raises epistemic uncertainty. It does not interpret missing
   observations as unreliability. The V0.2 run verifies the evidence/uncertainty machinery, but
   the experiment was not designed to measure a separate "I do not know" decision; a dedicated
   sparse-context holdout is still needed.

5. **Beliefs influence the evidence subsequently received?**  
   **Not demonstrated as a stable trap.** The pessimistic initial cost/rest belief was corrected
   by movement evidence within a few ticks; the trap conditions were essentially indistinguishable
   from full (resources 32.0–32.8 for pragmatic/uncertainty/VoI). Random exploration made outcomes
   worse (24.9 resources, 98/100 alive), not better. To create a real epistemic trap, the action
   that would supply corrective evidence must be suppressed; the current direct resource and
   safety terms prevent that.

6. **Escape self-reinforcing epistemic traps?**  
   **Not demonstrated.** The initial pessimistic trap did not remain self-reinforcing, so there
   was nothing to escape. The stronger negative result is that random exploration hurt outcomes
   and neither uncertainty nor VoI exploration rescued the weak trap. A stronger trap and a
   longer horizon are required.

7. **Does decision-relevant epistemic exploration improve long-term decision quality?**  
   **No detectable improvement in this environment.** VoI versus pragmatic-only changed resources
   by +0.04 [−3.34, 3.40] and energy by +0.54; VoI versus uncertainty changed resources by −0.75
   [−3.91, 2.47], ns. VoI did outperform random exploration (+8.44 resources), which mostly
   shows that random probing is harmful.

8. **Does the second-order model improve outcomes over simpler uncertainty-driven exploration?**  
   **It improves calibration, not task outcomes.** The learned meta-model reduced Brier/ECE
   relative to a fixed meta-model and produced a modest shadow AUROC; however, meta feedback
   **reduced** resources by 7.42 [3.05, 11.92] and energy by 8.98 relative to meta-off, and VoI
   showed no resource advantage over a pure uncertainty bonus. The second-order model is
   measurable and causally active, but not a demonstrated performance advantage.

9. **Does the recursive feedback cycle produce capabilities that disappear when broken?**  
   **Yes for certain capabilities, with caveats.** Removing self feedback reduced resources by
   9.38 and self learning reduced resources by 10.01; freezing world learning collapsed resources
   by 25.83. Removing meta learning removed calibration entirely (BSS 0, ECE 0.500). However,
   removing meta feedback improved resources and energy, so the cycle is not uniformly beneficial.
   The operational capabilities are real; the value claim is mixed.

10. **Are these results robust across environmental configurations?**  
    **Partially.** The learned filter beat raw sensing across docile/standard/harsh and the
    severe-prior condition; meta AUROC ranged 0.45–0.71 across difficulty and 0.57–0.62 under
    sensor/mixed shifts; physical and mixed shifts were lethal (38% and 19% survival), while
    sensor shifts were survivable. The effects depend on difficulty, shift type and horizon, and
    the V0.2 suite is not a general benchmark. Robustness beyond these configurations is not
    established.

---

## 6. Limitations and negative results

- The learned meta-model's ranking discrimination in stationary conditions was weak; calibration
  is not the same as predictive discrimination. It beat a constant base rate but **not a rolling
  base-rate baseline** (BSS −0.12).
- The simple offline EMA and random-walk Kalman baselines are not tuned to the true process model;
  an oracle with the true dynamics would be stronger. The learned filter still lost to EMA/Kalman
  after the physical shift.
- The pessimistic-cost trap was largely corrected by subsequent movement; a stronger trap needs
  to remove the action's corrective evidence, which is itself an architectural intervention.
- Exploration conditions showed no clear resource/survival advantage at the tested horizon; VoI
  was no better than a pure uncertainty bonus.
- **Meta feedback reduced resources and energy relative to meta-off**, despite improving
  calibration. The second-order loop is not a demonstrated performance advantage.
- A neutral no-world condition collected more resources than the learned-world condition, even
  though learned world learning beat frozen world learning. World-model utility remains
  configuration-dependent.
- Attribution is diagnostic and not a learned classifier; physical/shared signatures overlap
  strongly. It is not used to choose an intervention.
- Severe randomized priors lost about 13 resources; learning mitigates but does not erase prior
  misspecification.
- V0.2 is a simulation, not a consciousness claim.

---

## 7. Reproduction

```bash
cd strange-loop
npm run typecheck
npm test
SEEDS=100 HORIZON=1000 SHADOW=1 npx tsx tools/v02validate.ts
```

V0 baseline: `docs/RESEARCH_REPORT.md`, `tools/validate.ts`, and the V0 dashboard remain
available. V0.2 does not rewrite V0 behavior; the research configuration is opt-in.

---

## 8. Explicit scope

These results concern computational estimation, calibration, control and epistemic exploration.
The words "self-model", "meta-model", "belief" and "trust" refer to implemented numerical
variables, not subjective states. V0.2 does not demonstrate consciousness, awareness, identity,
emotion, understanding or experience.
