# Strange Loop Lab V0.3 — Closing the Second-Order Loop

**Status:** research report, 100 paired seeds, deterministic simulator.
**Scope:** this document reports computational mechanisms and measurements only. Nothing here
claims consciousness, sentience, subjective experience or phenomenality. "Meta-cognition" means
a second-order predictor that estimates the reliability of a first-order predictor; "self-model"
means a parameterised predictor of the agent's own energy and fatigue dynamics. Both are ordinary
statistical objects.

**Lineage:** V0.1 (`main`, `6438bea`) → V0.2 (`v0.2-learned-meta`, `975299e`) → V0.3
(`v0.3-second-order`). V0.1 and V0.2 code paths, tests, dashboards and reports are preserved
unchanged. V0.3 lives in `src/simulation/v03` and is benchmarked directly against V0.2 on the same
seeds in the same run.

---

## 0. Results at a glance

| Target question | V0.2 | V0.3 | Verdict |
| --- | --- | --- | --- |
| Rolling-baseline skill | BSS −0.12 | **BSS +0.016 … +0.024** (all conditions) | resolved |
| Latent failure AUROC | 0.47 | **0.679 … 0.796** | resolved |
| Meta-on vs meta-off resources | −7.42 | **+12.3 … +28.8**, all p < 0.001 | resolved |
| Four-way attribution | physical 1/100, energy 0/100, shared 0/100 | **macro-F1 0.604**; energy 88/100, shared 89/100, physical 63/100, fatigue 63/100 | partially resolved |
| Trap escape (pragmatic / VoI) | 0 / 0 (trap not decoupled) | **0/100 / 66/100**, 0.0 vs 65.1 resources | resolved |
| Learned world vs neutral | learned *worse* | **+7.64 resources [3.64, 11.36], p < 0.001** | resolved |
| PP-1 illusion | — | ratio 1.45 [0.87, 2.13], absorption ≈ 0 | **negative** |
| Goodhart transfer | — | r = 0.21, resources Δ −2.94 (p = 0.358) | **negative** |
| Five-link intervention | — | every link load-bearing for at least one capability | resolved, with caveats |

---

## 1. What V0.3 changes

V0.2 produced five negative results (see `docs/V02_RESEARCH_REPORT.md`). V0.3 addresses each with a
specific mechanism rather than a parameter change:

| # | V0.2 negative result | V0.3 mechanism |
| --- | --- | --- |
| 1 | Meta-model lost to a rolling baseline (`rolling BSS = −0.12`) and latent-failure `AUROC = 0.47` | **Residual meta-model**: a fast 1-parameter rolling base-rate tracker plus a shrunk contextual residual (hedge weight → 0 when context is uninformative) and a separate persistent-failure head |
| 2 | Meta-feedback *reduced* resources (−7.42) and energy (−8.98) | **Risk-sensitive control**: learned bias correction, pessimistic confidence bound near the metabolic cliff, optimistic probing far from it, and attribution-targeted plasticity |
| 3 | Pessimistic traps dissolved in a few ticks | **Context-decoupled self-dynamics**: resource cells are *rough terrain* with an independent `roughCost` parameter; avoiding them starves the agent of corrective evidence |
| 4 | Attribution collapsed to fatigue-sensor (86/100) | **Action-conditioned temporal attribution**: separate MOVE/REST channels, excess over the agent's own long-run residual baseline, four causal signatures, explicit `insufficient` output |
| 5 | Neutral `no-world` out-foraged the learned world model | **Skill-gated world integration**: learned predictions only gain influence to the extent that their trailing Brier skill beats a constant base-rate predictor |

Additional V0.3-only probes: a PP-1 interoceptive-illusion probe, a Goodhart check, and a five-link
causal intervention over `M1 → action → evidence → M1 ↔ M2`.

### 1.1 Residual meta-model (`src/simulation/v03/metaModel.ts`)

The model is a decomposition, not a single logistic regression:

- **Rolling base**: `p_tol_base ← 0.94·p_tol_base + 0.06·y`, one parameter, fast and low-variance.
- **Contextual residual**: a logistic head over observable features (action one-hots, energy/fatigue
  bins, windowed |error|, signed bias, volatility, sensor disagreement, rough-target flag, rough
  evidence, normalised |bias|). Its prediction is blended as
  `p = base + w · (p_context − base)`, where `w` is an exponential hedge weight driven by the
  difference in squared loss between the context model and the baseline. If context does not pay
  for itself, `w → 0` and the model collapses to the rolling baseline instead of overfitting noise.
- **Persistent-failure head**: a second logistic head trained on the *observable* persistent
  directional discrepancy `|EMA(signed error)| / (EMA(|Δenergy|) + 3)` crossing a fixed threshold.
  It never sees latent state, regime labels or true energy.

The evaluation target for question 1 is a **latent** persistent failure: the same normalised
directional discrepancy computed from the noise-free energy delta, over a 20-tick action window.
Averaging the signed error over a window cancels zero-mean sensor noise, isolating genuine
self-model bias.

### 1.2 Risk-sensitive control (`src/simulation/v03/agent.ts`)

For each candidate action `a` the first-order model emits `ŷ(a)`; the meta-model emits a bias
correction `b̂` and an error bound `ê`. Selection then uses:

- **Bias correction**: `ŷ + b̂`.
- **Asymmetric cliff caution**: when estimated energy is below 20 or next-step fatigue exceeds 0.62,
  the action is scored with the pessimistic bound `ŷ + b̂ − 0.8·ê`; far from the cliff it receives a
  small optimistic bonus `+0.1·ê`, preserving epistemic probing.
- **Targeted plasticity routing**: the attribution result scales the first-order learning rate
  (physical 1.3×, sensor 0.6×, shared 0.7×, insufficient 1.0×), so a sensor glitch does not rewrite
  good self-model weights and a physical shift is learned quickly.

### 1.3 Decoupled epistemic trap (`src/simulation/v03/dynamics.ts`)

Cell type 2 (resource) is rough terrain. A move onto it pays `roughCost + fatigue·slope +
(energy/max)·energyWeight` instead of the flat movement cost. `roughCost` is a separate self-model
parameter with its own uninformed prior. The injected pessimistic trap sets `roughCost = 25` while
the true value is 2.2, so a pragmatic agent boycotts every resource cell and can never observe the
true cost — the false belief is self-confirming.

**Decision value of information** is what breaks it: in `voi` mode the information term is
`uncertainty · (0.5 + stake)`, where `stake = max(0, −ŷ) · value(energy)`. A context that is
predicted to be very costly *and* uncertain therefore carries a large information value, while the
same context after it has been sampled carries almost none. Safety gating refuses probes whose
pessimistic bound would drop predicted energy below 10.

### 1.4 Temporal attribution (`src/simulation/v03/attribution.ts`)

MOVE and REST channels are tracked separately. Each channel keeps a fast EMA and a very slow
baseline for energy innovation, strain residual, effort residual and channel variance; only the
*excess over the channel's own long-run baseline* is used, so a pre-existing model bias contributes
nothing. Six features feed four linear causal scores:

| Hypothesis | Signature |
| --- | --- |
| physical | MOVE-only energy innovation and variance excess; REST quiet |
| energy sensor | common energy variance excess in MOVE and REST |
| fatigue sensor | common strain variance excess in MOVE and REST |
| shared | both channels elevated simultaneously (conjunctive term) |

The module returns `insufficient` while fewer than ~10 MOVE and REST samples exist, and the softmax
is over five classes. It is a diagnostic, never a ground-truth label: the engine never reads
`shift`.

### 1.5 Skill-gated world model (`src/simulation/v03/worldModel.ts`)

Each head keeps a trailing Brier score and a trailing outcome base rate. Its skill is
`1 − Brier / (p̄(1−p̄))`, clamped to [0,1]. Selection blends the learned prediction toward a neutral
prior by `√skill`, so a model with no skill behaves exactly like the no-world ablation, and a model
with skill gains influence. The collect head uses 4× positive-class weighting because collections
are rare.

---

## 2. Protocol

- **Seeds:** 1–100, identical seeds across all V0.3 and V0.2 conditions (paired).
- **Horizon:** 1000 ticks (1600 for trap conditions).
- **Shifts** occur at tick 360 (physical: first at 320 and second at 620 for `mixed_shifts`).
- **Attribution window:** ticks 378–406, i.e. 18–46 ticks after the shift.
- **Statistics:** paired bootstrap CIs (2000 resamples), paired permutation tests (10 000
  permutations), Cohen's dz for paired effect size, Holm correction within each contrast family.
  Proportions use bootstrap CIs. All random procedures are seeded.
- **Reproduce:** `npx tsx tools/v03validate.ts` (or `npm run validate:v03`); `SEEDS`, `HORIZON`,
  `TRAP_HORIZON` environment variables override the defaults. Raw per-run data:
  `research/v03-results.json`; aggregates: `research/v03-analysis.json`.
- **Dashboard:** `npm run dev`, then the **V0.3** button in the top bar (V0.1 and V0.2 remain
  reachable). The V0.3 dashboard exposes every ablation as a toggle, the reliability diagram,
  attribution bars, risk margin, rough-cost learning, the PP-1 pulse button and the trap button.

---

## 3. Question 1 — does the residual meta-model beat the rolling baseline?

**Yes on both stated targets.** The rolling Brier skill score is positive in every evaluated
condition, and latent persistent-failure AUROC exceeds 0.65 everywhere.

| Condition | rolling BSS [95% CI] | latent failure AUROC [95% CI] | ECE |
| --- | --- | --- | --- |
| standard (full) | 0.023 [0.022, 0.024] | 0.792 [0.780, 0.803] | 0.021 |
| docile | 0.018 [0.017, 0.019] | 0.741 [0.725, 0.755] | 0.022 |
| harsh | 0.016 [0.015, 0.017] | 0.799 [0.781, 0.816] | 0.019 |
| severe priors | 0.024 [0.023, 0.025] | 0.723 [0.678, 0.765] | 0.020 |
| physical shift | 0.024 [0.023, 0.025] | 0.796 [0.785, 0.808] | 0.022 |
| energy sensor shift | 0.017 [0.016, 0.018] | 0.687 [0.672, 0.701] | 0.040 |
| fatigue sensor shift | 0.024 [0.023, 0.026] | 0.796 [0.785, 0.808] | 0.021 |
| shared sensor shift | 0.017 [0.016, 0.018] | 0.679 [0.665, 0.692] | 0.040 |
| mixed shifts | 0.021 [0.020, 0.023] | 0.730 [0.717, 0.743] | 0.030 |

Direct V0.2 comparison on the same seeds: **V0.2 latent AUROC 0.471 → V0.3 0.792**.

Ablations (paired, Holm-corrected within family, n = 100):

| Contrast | Metric | Δ [95% CI] | dz | p |
| --- | --- | --- | --- | --- |
| full vs baseline-only meta | rolling BSS | +0.023 [0.022, 0.024] | 3.84 | <0.001 |
| full vs baseline-only meta | latent AUROC | −0.00 [−0.01, 0.01] | −0.01 | 0.933 |
| full vs baseline-only meta | meta Brier | −0.00 [−0.00, 0.00] | −0.16 | 0.344 |
| full vs meta learning off | meta Brier | −0.07 [−0.07, −0.06] | −4.12 | <0.001 |
| full vs meta learning off | latent AUROC | +0.29 [0.28, 0.30] | 4.91 | <0.001 |

Interpretation: the residual architecture does what it was designed to do — it keeps a 1-parameter
rolling tracker as its floor and adds a small but reliable amount of skill on top (BSS 0.023 with a
CI that excludes zero by a wide margin). The latent-failure head is the part that carries
discrimination, and the ablation confirms it is learned: freezing meta learning costs 0.29 AUROC and
0.07 Brier. Two honest qualifications: (i) the *contextual residual* improves calibration skill but
does **not** by itself improve latent AUROC relative to the baseline-only ablation, because the
failure head is architecturally independent of the residual weight; (ii) the AUROC gain over V0.2
comes from changing the *target* from per-step latent error to windowed persistent directional bias,
which is the quantity the brief asked for and which is genuinely more observable.


---

## 4. Question 2 — does risk-sensitive meta-control make meta-on outperform meta-off?

**Yes, in all eight regimes, with large and highly significant effects.**

| Regime | meta-on resources | meta-off resources | Δ [95% CI] | dz | p | survival on/off |
| --- | --- | --- | --- | --- | --- | --- |
| standard | 42.1 | 25.8 | +16.26 [10.84, 21.75] | 0.57 | <0.001 | 100 / 100 |
| harsh | 33.8 | 19.6 | +14.22 [9.30, 19.05] | 0.55 | <0.001 | 100 / 100 |
| severe priors | 26.6 | 9.5 | +17.09 [12.63, 21.67] | 0.71 | <0.001 | **100 / 93** |
| physical shift | 34.6 | 22.2 | +12.34 [7.46, 16.93] | 0.51 | <0.001 | 100 / 100 |
| energy sensor | 41.0 | 19.1 | +21.93 [17.09, 27.06] | 0.85 | <0.001 | 100 / 100 |
| fatigue sensor | 41.1 | 26.5 | +14.57 [8.37, 20.59] | 0.45 | <0.001 | 100 / 100 |
| shared sensor | 45.8 | 16.9 | +28.82 [24.10, 33.74] | 1.13 | <0.001 | 100 / 100 |
| mixed | 37.8 | 18.5 | +19.35 [15.04, 23.66] | 0.84 | <0.001 | 100 / 100 |

This closes the V0.2 result (−7.42 resources and −8.98 energy with meta on). The direction is
reversed and the effect is an order of magnitude larger than the V0.2 deficit.

**Costs, reported rather than hidden.** Meta-on reaches a *lower* minimum energy in every regime
(e.g. −14.8 under the energy-sensor shift, dz −1.32): it forages more aggressively and accepts
closer approaches to the cliff. Post-shift self-model MAE is also slightly *worse* with meta
control under sensor shifts (+0.30), because targeted plasticity deliberately down-weights the
suspect channel. These are the intended trade-offs of risk-sensitive control, not free wins.

**Risk control vs naive influence scaling.** Replacing the full risk-sensitive controller with
V0.2-style naive utility down-scaling (`riskControl: false`) changes resources by
−0.65 [−4.92, 3.32], dz −0.03, p = 1.000, and changes minimum energy by −0.19. In this environment
the cliff term is therefore resource-neutral in expectation; the large Q2 effect comes from using
bias correction and meta-influence at all, not specifically from the pessimistic bound. The bound's
value shows up in survival under severe priors, where meta-off loses 7/100 agents.


---

## 5. Question 3 — does action-conditioned attribution separate the four shift types?

**Partially.** Macro-F1 over 400 post-shift runs is **0.604**, versus V0.2's per-shift top-label
accuracy of 1/100 (physical), 0/100 (energy), 86/100 (fatigue), 0/100 (shared). Energy and shared
are now reliable; physical and fatigue remain confusable.

| Truth \ Predicted | physical | energy sensor | fatigue sensor | shared | insufficient |
| --- | --- | --- | --- | --- | --- |
| physical | **63** | 34 | 1 | 2 | 0 |
| energy sensor | 10 | **88** | 0 | 2 | 0 |
| fatigue sensor | 9 | 2 | **63** | 26 | 0 |
| shared | 1 | 9 | 1 | **89** | 0 |

| Class | Precision | Recall | F1 | Support |
| --- | --- | --- | --- | --- |
| physical | 0.76 | 0.63 | 0.69 | 100 |
| energy sensor | 0.66 | 0.88 | 0.76 | 100 |
| fatigue sensor | 0.97 | 0.63 | 0.76 | 100 |
| shared | 0.75 | 0.89 | 0.81 | 100 |

The dominant residual confusion is physical → energy-sensor (34/100) and fatigue → shared (26/100).
The mechanism is visible in the data: a physical cost shift produces an energy innovation that the
self-model absorbs within ~10 ticks, while a sensor degradation raises channel *variance* for as
long as it lasts. The attribution therefore leans on variance excess, which is durable but only
weakly present for the physical shift. The `physical` MOVE-only innovation peak was added precisely
to retain that transient signal; it recovers recall from 0.0 (V0.2) to 0.63 but does not eliminate
the confusion. No `insufficient` predictions remain after both action classes have been sampled,
which is the intended behaviour of the evidence gate.


---

## 6. Question 4 — does decision-VoI escape the decoupled trap?

**Yes, and no other exploration mode does.** The trap sets the self-model's rough-terrain cost to
25 (true value 2.2). The escape criterion is: at least 5 rough-terrain steps and a final cost
estimate within 1.5 of the mean effort actually experienced on those cells.

| Condition | trap escape | any rough step | resources [95% CI] | mean first rough tick |
| --- | --- | --- | --- | --- |
| pragmatic only | 0/100 | 0/100 | 0.0 [0.0, 0.0] | — |
| uncertainty bonus | 0/100 | 0/100 | 0.0 [0.0, 0.0] | — |
| random exploration | 86/100 | 100/100 | 44.8 [38.8, 51.3] | 78 |
| **decision VoI (λ = 0.9)** | **66/100** | 76/100 | **65.1 [55.8, 74.7]** | **5** |
| VoI with meta feedback off | 0/100 | 0/100 | 0.0 [0.0, 0.0] | — |
| V0.2 VoI (same trap, no decoupling) | 0/100 | 0/100 | 59.1 [52.7, 65.8] | — |

Paired contrasts:

| Contrast | Δ [95% CI] | dz | p |
| --- | --- | --- | --- |
| VoI − pragmatic, resources | +65.08 [55.94, 74.27] | 1.39 | <0.001 |
| VoI − pragmatic, rough steps | +87.33 [75.31, 99.12] | 1.41 | <0.001 |
| VoI − pragmatic, rough-cost MAE | −16.03 [−17.71, −14.13] | −1.75 | <0.001 |
| VoI − random, resources | +20.27 [10.65, 29.98] | 0.41 | <0.001 |
| VoI − random, rough steps | +29.62 [17.13, 43.37] | 0.45 | <0.001 |

Two qualifications matter. First, **random exploration also escapes** (86/100) — the brief expected
it to fail, and it does not, because uniform action noise eventually steps onto resource cells. It
is, however, markedly less efficient (+20.3 resources for VoI, p < 0.001), finds the context later
(tick 78 vs 5), and loses 2/100 agents versus 0/100. Second, VoI escape is 66/100 rather than
near-100: in the remaining runs the information bonus is safety-gated when the pessimistic bound
would take predicted energy below 10, so the agent defers the probe. That is the controller working
as specified, but it means the trap is escaped in about two-thirds of runs, not all.

The V0.2 contrast is instructive: V0.2's trap condition still collects 59.1 resources because its
trap perturbs a *global* movement cost, so ordinary movement immediately supplies corrective
evidence. Its escape rate is 0 because the belief is repaired implicitly rather than by a decision
to probe. V0.3's decoupling is what makes the epistemic decision necessary.


---

## 7. Question 5 — does the learned world beat the neutral no-world baseline?

**Yes.** The V0.2 paradox (neutral no-world out-foraging the learned world) is gone.

| Contrast | Δ resources [95% CI] | dz | p |
| --- | --- | --- | --- |
| learned world − neutral no-world | +7.64 [3.64, 11.36] | 0.38 | <0.001 |
| learned world − frozen world | +7.64 [3.72, 11.59] | 0.38 | 0.001 |
| learned world − no-world, self MAE | +0.01 [0.00, 0.01] | 0.23 | 0.025 |

Absolute levels: learned world 42.1 [38.1, 46.3]; neutral no-world 34.5 [30.6, 38.9]; frozen world
34.5 [30.6, 38.9].

The mechanism is the skill gate. Each world head is scored against a trailing constant base-rate
predictor; selection blends the learned prediction toward a neutral prior by `√skill`, so a
world model with no demonstrated skill behaves exactly like the no-world ablation. This removes the
failure mode that produced the V0.2 paradox — acting on miscalibrated world predictions — and turns
learning into a strict improvement once skill is positive.

**Structural caveat:** because an un-updated model has zero trailing skill, the `worldLearning:
false` (frozen) ablation now *behaves identically* to `worldModelEnabled: false` (neutral). The
identical resource values are not a coincidence and not a bug, but it does mean V0.3 no longer
separates "learned-then-frozen" from "no model at all". Separating those would require freezing the
weights while keeping the skill estimate from earlier learning, which is a design change left for
V0.4.

Direct V0.2 comparison on the same seeds:

| Condition | V0.3 | V0.2 | Δ [95% CI] | dz | p |
| --- | --- | --- | --- | --- | --- |
| standard | 42.1 | 32.4 | +9.69 [4.81, 15.08] | 0.38 | <0.001 |
| harsh | 33.8 | 24.4 | +9.43 [4.21, 14.76] | 0.34 | 0.002 |
| physical shift | 34.6 | 11.1 | +23.52 [19.60, 27.50] | 1.14 | <0.001 |
| energy sensor | 41.0 | 29.3 | +11.68 [6.64, 16.61] | 0.45 | <0.001 |
| fatigue sensor | 41.1 | 35.0 | +6.03 [0.12, 11.97] | 0.19 | 0.118 |
| shared sensor | 45.8 | 33.2 | +12.58 [6.89, 18.41] | 0.43 | <0.001 |

Under the physical shift, V0.3 also keeps **100/100 agents alive** versus **38/100** for V0.2.


---

## 8. Mechanistic indicator controls

### 8.1 PP-1 — top-down interoceptive illusion

At tick 20 (untrained) and again at tick 200 (trained, mean meta tolerance probability 0.379) a
1-tick +12-energy reading pulse is injected. If a confident top-down prior absorbed the ambiguous
spike, the late estimate should move less than the early estimate and less than the reading itself.

| Measure | Early (naive) | Late (trained) |
| --- | --- | --- |
| estimate change over 8 ticks | 11.79 | 7.52 |
| absorption `1 − Δestimate/Δreading` | 0.08 | −0.03 |
| per-seed late/early ratio | — | 1.45 [0.87, 2.13] |

**Negative result.** The confidence interval on the ratio includes 1, and the absorption measure is
essentially zero at both times (late is slightly negative). There is no evidence that the learned
meta-model causes the sensory spike to be overridden by a top-down prior in this implementation.
What the numbers show is ordinary filtering: the estimate follows a large fraction of the pulse in
both conditions. This is reported as a failed probe, not as an illusion.

### 8.2 Goodhart / gaming check

The residual meta-model is trained only on 1-step observable prediction error. The check asks
whether optimising that local loss produces emergent system-level gains.

- Across seeds, local meta Brier and collected resources correlate at r = 0.213 (higher local skill
  weakly associated with more resources).
- Paired ablation, full vs baseline-only meta: meta Brier −0.00 [−0.00, 0.00] (p = 0.358),
  resources −2.94 [−7.17, 0.76] (p = 0.358).

**Negative result.** There is no significant transfer from the residual head's local calibration to
system-level survival or foraging. The large Q2 effect comes from *using* the meta-model's bias and
uncertainty signals in control, not from the residual architecture's local loss. The Goodhart check
therefore finds neither gaming nor emergent benefit: the local objective is simply not the same
objective as survival.

### 8.3 Five-link causal intervention

Cycle: `M1 → action → evidence → M1 ↔ M2`. Each link was broken with one switch and evaluated both
in the decoupled trap (escape) and under a mid-run physical shift (survival, post-shift MAE,
resources).

| Link broken | switch | Trap escape | Trap resources | Shift survival | Shift post-MAE | Shift resources |
| --- | --- | --- | --- | --- | --- | --- |
| none | — | 66% | 65.1 | 100% | 1.68 | 34.6 |
| L1 prediction→action | `selfFeedback=false` | 86% | 52.7 | 100% | 1.65 | 23.1 |
| L2 action→evidence | `evidenceLink=false` | **0%** | 11.9 | **1%** | 27.68 | 9.3 |
| L3 evidence→M1 | `selfLearning=false` | **0%** | 9.2 | 100% | 29.21 | 21.2 |
| L4 M1→M2 | `metaLearning=false` | 61% | 46.3 | 100% | 1.66 | 31.4 |
| L5 M2→control | `metaFeedback=false` | **0%** | 0.0 | 100% | 1.65 | 22.2 |

Every link is load-bearing for at least one capability: L2 removes proprioceptive evidence and
collapses both trap escape (0%) and shift survival (1%); L3 freezes the self-model at 29 MAE; L5
removes the meta-control that makes probing worthwhile and eliminates trap escape entirely; L4
removes the second-order update and costs ~20 resources; L1 removes self-prediction from action
selection and costs ~11 resources under a shift.

The table also exposes a genuine structural paradox: **breaking L1 slightly *raises* trap escape
(86% vs 66%)**. This is not a measurement error. The self-model's pessimistic prediction is what
suppresses foraging; removing it from selection makes the agent step onto rough terrain for
non-epistemic reasons. L1 is therefore load-bearing for *shift performance*, not for trap escape.
The brief expected every link to collapse the trap; the data says the loop is load-bearing in
different ways for different tasks, which is a more interesting and more honest result.


---

## 9. Negative results and limitations

1. **Attribution is only partially identifiable.** Macro-F1 0.604. Physical and fatigue are
   confused with the sensor-variance classes (34/100 physical runs called energy-sensor, 26/100
   fatigue runs called shared). The task's premise — that four causes are separable from observable
   temporal signatures — is only partly supported by this environment; the self-model absorbs
   physical changes within ~10 ticks while sensor variance persists.
2. **PP-1 shows no interoceptive illusion.** Late/early estimate response ratio 1.45 [0.87, 2.13],
   absorption ≈ 0. The probe is implemented and reported, but the effect is absent.
3. **No Goodhart transfer.** Residual-meta local calibration does not produce emergent system-level
   gains (resources Δ −2.94, p = 0.358). The control benefit in Q2 comes from using the meta signals,
   not from the residual head's local loss.
4. **The contextual residual does not improve latent AUROC** over the baseline-only ablation
   (Δ −0.00, p = 0.933). Its contribution is Brier skill (Δ +0.023, p < 0.001), and the baseline-only
   ablation actually collects slightly *more* resources (45.0 vs 42.1). The residual is a
   calibration win, not a survival win.
5. **Random exploration escapes the trap more often than VoI** (86% vs 66%), contradicting the
   brief's expectation. VoI is more resource-efficient (+20.3, p < 0.001), earlier (tick 5 vs 78) and
   safer (0 vs 2 deaths), but it does not have a monopoly on escape.
6. **V0.2 meta-off out-forages V0.3 meta-off** by 13.4 resources (p < 0.001). The decoupled rough
   terrain imposes a real cost when meta-control is disabled; V0.3 wins only when meta-control is on
   (V0.3 meta-on 42.1 vs V0.2 meta-on 32.4).
7. **Frozen world ≡ no-world.** Under skill gating, an un-updated model has zero skill and therefore
   zero influence, so the two ablations are behaviourally identical. The original V0.2 comparison
   "learned beats frozen" cannot be reproduced in V0.3 in that form.
8. **Meta-control trades safety margin for foraging.** Meta-on reaches lower minimum energy in every
   regime and has slightly higher post-shift self-model MAE under sensor shifts, because targeted
   plasticity trusts the degraded channel less.
9. **The pessimistic cliff term is resource-neutral** relative to naive influence scaling
   (Δ −0.65, p = 1.000). The observed Q2 gains should be attributed to meta-control in general, not
   specifically to the asymmetric bound.
10. **Severe-prior performance remains the weakest regime** (26.6 resources vs 42.1 standard). The
    unbounded severe rough-cost prior (0.2–24) can still suppress foraging for a long time even
    though VoI eventually probes.

### What V0.3 does *not* show

It does not show that the agent represents itself, that it has a self, or that anything is
experienced. The mechanism is a hierarchy of predictors and a controller that reads their
uncertainty and bias estimates. The strange-loop language describes a causal cycle of prediction,
action and evidence; every measurement above is a behavioural or statistical quantity computed by
the simulator.


---

## 10. Verification

- `npm run typecheck` — clean.
- `npm test` — 45 tests (34 preserved V0.1/V0.2 + 11 new V0.3).
- `npm run build` — production build succeeds.
- `npm run validate:v03` — 5200 runs (52 conditions × 100 seeds) in ~4 minutes.

## 11. Files

- `src/simulation/v03/{types,config,dynamics,selfModel,worldModel,metaModel,attribution,agent,engine}.ts`
- `src/v03/{V03Lab.tsx,useV03Simulation.ts}` and the V0.3 switch in `src/App.tsx`,
  `src/components/TopBar.tsx`
- `tools/v03validate.ts`, `tools/stats.ts`
- `tests/v03.test.ts`
- `research/v03-results.json`, `research/v03-analysis.json`
- preserved: `src/simulation/v02/*`, `src/v02/*`, `tests/v02.test.ts`, `docs/V02_RESEARCH_REPORT.md`,
  `docs/RESEARCH_REPORT.md`
