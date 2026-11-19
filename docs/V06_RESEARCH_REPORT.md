# V0.6 — Unified Cognitive Architecture: Indicator Properties Under Adversarial Control

**Status:** complete, 100 paired seeds per condition, 4,500 episodes.
**Artefacts:** `research/v06-results.json`, `research/v06-analysis.json`, `research/v06validation.log`.
**Lab:** `/research?version=v06`. **Preceding report:** `docs/V05_RESEARCH_REPORT.md`.

---

## 0. What this report is, and what it is not

V0.6 is a **unified cognitive architecture**: four specialist modules compete for a
capacity-limited workspace, the winning coalition is broadcast back to perception, learning and
the other modules, a higher-order monitor estimates its own reliability, an attention schema
models precision allocation, and a bounded rollout simulates the agent's future physical *and
cognitive* state. The question is not whether this architecture forages better. The question is
whether the integrated, self-referential mechanisms are **causally necessary** for a set of
cognitive capabilities, and whether those capabilities survive comparison with four
matched-compute alternatives.

This report is deliberately not a consciousness claim. It evaluates computational and
structural indicator properties. Every internal variable is a measured quantity; no component
reads latent environment state, and the labels used for evaluation (true energy, true fatigue,
latent failure, regime identity) are never available to the agent.

**Headline:** the architecture shows a **double dissociation**. Removing the workspace
bottleneck causes policy thrashing; removing broadcast degrades binding; removing the
higher-order monitor collapses attribution and plasticity routing; removing the attention schema
abolishes post-conflict recovery; removing cognitive self-simulation makes the epistemic fork
unsolvable. At the same time, **within-tick recurrent settling is a null result**, reliability
calibration inverts under energy-channel corruption, attribution is weak for shared degradation,
and the architecture loses to simpler controls on two of three unseen-environment
suites.

---

## 1. Architecture

### 1.1 Four specialist modules (`GWT-1`)

Each module reads the same observable prediction table but weights it by a different concern and
returns an independent proposal (preferred action, five utilities, salience, confidence, goal,
hypothesis, evidence).

| Module | Representational domain | Dominant signal |
|---|---|---|
| `WorldModule` | external contingencies, resource gradient, collisions | `p_collect`, direction-resource signal, local novelty |
| `SomaticModule` | interoception, metabolic cliff, fatigue | predicted `ΔE`, `ΔF`, safety envelope |
| `MetaAttributionModule` | prediction residuals, first-order reliability | uncertainty-discounted cost, bias correction, diagnostic rest |
| `EpistemicModule` | novelty, missing evidence, self-fulfilling avoidance | immediate information value, unverified-rough bonus |

Module salience is computed on the **deviation from the shared pragmatic baseline**, not on the
absolute utility vector. This prevents the workspace from being captured by whichever module
merely restates the strongest prior.

### 1.2 Capacity-limited workspace (`GWT-2/3`)

With the bottleneck on:

```
score_m = salience_m + hysteresis · [m = previous frame]
frame   = argmax_m score_m
w_frame = 1 − leak · (n − 1),   w_other = leak          (leak = 0.14)
u(a)    = Σ_m w_m · u_m(a)
```

The winner emits a broadcast: an additive bias to its preferred action, a precision plan over
`{energy, strain, effort, prior, epistemic}`, and per-module learning gains. The broadcast is the
only path by which a winner can change perception, learning or a partner module. With the
bottleneck removed every module writes at once (`w_m = 1/4`); with broadcast removed the winner
still gates action but has no return path.

### 1.3 Recurrent settling (`RPT-1/2`, `PP-1`)

A four-unit recurrent sheet receives bottom-up multi-channel evidence and a top-down workspace
prior for `K = 3` passes. The engine measures convergence (how much of the first-pass change
survives), residual disagreement, and the entropy of an interpretable four-state readout. The
convergence/disagreement pair scales the V0.5 precision gain rather than replacing it:

```
K_eff = K_V05 · clamp(0.7 + 0.3·convergence − 0.5·disagreement, 0.25, 1.05)
```

This preserves the V0.5 outlier gate and makes the recurrent sheet a modulator, not a
replacement.

### 1.4 Higher-order monitor (`HOT-1…4`)

- **HOT-1/2:** a logistic reliability head over `{uncertainty, recent error, cross-channel
  disagreement, evidence, energy deficit}`. A separate shadow head is trained only on
  off-policy probes and never controls behaviour.
- **HOT-3:** four-way attribution (`self`, `energy sensor`, `fatigue sensor`, `shared`) using the
  V0.5 action-conditioned attributor.
- **HOT-4:** a three-axis quality space `q = (viability, certainty, coherence)` smoothed at 0.72.

Attribution routes plasticity: during a sensor fault the somatic gain is capped at 0.55 while
the meta module is raised to 1.15. With HOT disabled, the reliability head is frozen at 0.5 and
attribution reports `insufficient`.

### 1.5 Attention schema (`AST-1`)

`allocate()` predicts a precision plan from current uncertainty, conflict and reliability.
`update()` trains a predictor of the next observable error, classifies the mode
(`monitoring`, `high_prior`, `exploratory`, `defensive`) and emits a bounded `recovery` signal
when the prior remains over-weighted after the disagreement that justified it has subsided. The
allocation is causal: a prior-heavy allocation raises the top-down weight and discounts the
sensory gain; `recovery` releases the slow sensor-distrust state.

### 1.6 Recursive cognitive self-simulation (`AE-1/2`)

A bounded rollout (`H = 4`) predicts, for each candidate first action:

- future physical state `(Ê, F̂)`,
- future belief uncertainty `û`,
- future second-order reliability `r̂`,
- future workspace mode `Â ∈ {forage, diagnose, defend, prepare}`.

The epistemic term is the value of the decision that the information unlocks:

```
option_k = 2 · stake · (u_k − u_{k+1}) · (H − k)
```

where `stake` is the cost the decision currently carries. A probe is worth paying for only if
the simulated future self can act better afterwards. With `H = 1` or under the physical-MPC
control the option term is absent.

### 1.7 Controls

| Control | What it removes |
|---|---|
| Reactive reflex | modules, workspace, HOT, AST, rollout: direct sensor-to-utility mapping |
| Physical MPC | cognitive state prediction; same `H = 4`, physical-only tree search |
| Flat blackboard | capacity limit, winner-take-all ignition, selective routing |
| Matched feedforward | top-down broadcast and sequential revision; same passes, strictly feedforward |

---

## 2. Method

- **Seeds:** 100 paired seeds per condition (seeds 1–100), identical world and RNG streams across
  conditions.
- **Episodes:** 45 conditions × 100 seeds = **4,500 episodes**. Total project runs now 23,900.
- **Statistics:** paired permutation tests (2,000 permutations), bootstrap 95% CIs (1,000
  resamples), Cohen's `d_z`, Holm correction within each experiment family.
- **Isolation:** the agent never reads `trueCost`, `energyBefore/After`, latent fatigue error,
  regime labels or the shadow-probe labels. The compiler enforces the observable-outcome type.
- **No re-tuning:** all architecture constants were fixed before validation. The generalization
  suites reuse the same constants.

---

## 3. Experiment 1 — Ambiguous multi-channel settling (`RPT`, `PP-1`)

Glitches at `t = 120, 220, 620, 720`: one-tick energy `+13` or strain `+0.30`. Absorption is
`1 − |Δestimate| / |Δreading|` at pulse ticks; stationary MAE excludes pulse ±2 ticks.

| Condition | Absorption [95% CI] | Stationary MAE | Convergence |
|---|---|---|---|
| Intact | **0.823 [0.811, 0.835]** | **1.48** | 0.80 |
| No-RPT | 0.811 [0.798, 0.823] | 1.48 | 0.00 |
| No-AST | 0.797 [0.778, 0.813] | 1.57 | 0.80 |
| Matched feedforward | 0.806 [0.791, 0.819] | 1.64 | 0.75 |

**Contrasts (intact minus ablated):**

- No-RPT: absorption **+0.01 [0.00, 0.02]**, `d_z = 0.19`, Holm `p = 0.224`; stationary MAE
  **−0.00 [−0.03, 0.03]**. **Null.**
- Matched feedforward: absorption +0.02 [0.00, 0.03], `p = 0.053`; stationary MAE **−0.16
  [−0.21, −0.12]**, `d_z = −0.67`, `p = 0.002`.
- No-AST: absorption +0.03 [0.01, 0.04], `p = 0.006`; MAE −0.09 [−0.13, −0.06], `p = 0.002`.

**Result.** The V0.5 precision gate, not within-tick recurrence, carries single-tick absorption.
RPT is a **pre-registered negative result**. The intact architecture does beat matched
feedforward on stationary tracking, but not on absorption. The attention schema contributes a
small absorption gain and a larger tracking gain, because its precision allocation changes the
effective gain.

**Alternative explanation.** The absorption is a property of the V0.5 gate that V0.6 inherits.
The ablation is clean, but it does not isolate a new V0.6 mechanism. Reported as such.

---

## 4. Experiment 2 — Competition, binding and sequential querying (`GWT-1…4`, `AST-1`)

Compound conflict at `t = 300–344`: a physical cost surge and an energy-channel degradation
begin together; the channel is restored at 344. Window metrics are computed over `t = 300–390`.

| Condition | Thrash | Goal coherence | Binding | Recovery (ticks) |
|---|---|---|---|---|
| Intact | **0.057** | **0.91** | **0.91** | **5** |
| No bottleneck | 0.296 | 0.68 | 0.68 | 9 |
| No broadcast | 0.090 | 0.86 | 0.86 | 6 |
| No-AST | 0.065 | 0.93 | 0.93 | **256** |
| Flat blackboard | 0.296 | 0.68 | 0.68 | 9 |

**Contrasts:**

- Bottleneck: thrash **−0.24 [−0.27, −0.20]**, `d_z = −1.33`, `p = 0.002`; coherence **+0.23
  [0.21, 0.24]**, `d_z = 2.57`, `p = 0.002`; action entropy −0.59 [−0.68, −0.51].
- Broadcast: thrash −0.03 [−0.06, −0.01], `p = 0.024`; coherence **+0.05 [0.04, 0.06]**,
  `d_z = 1.21`, `p = 0.002`. The winner is unchanged; the return path still improves binding.
- AST: recovery **−250.7 [−251.7, −249.5] ticks**, `d_z = −44.4`, `p = 0.002`. No-AST has
  slightly *better* coherence (0.93 vs 0.91), so the schema buys recovery, not stability.
- Flat blackboard is statistically indistinguishable from the no-bottleneck ablation.

**Result.** Capacity competition is necessary for policy coherence under simultaneous demands.
Broadcast is necessary for binding even when the winner is held fixed. AST is necessary for
post-conflict recovery.

**Cost.** The intact architecture forages less than the no-bottleneck and flat controls in this
episode (25.1 vs 41.7 resources). Coherence is bought with caution. This is a real trade-off, not
a hidden benefit.

---

## 5. Experiment 3 — Metacognitive calibration, attribution and routing (`HOT-1…4`)

Four disruption kinds at `t = 300`: self-model parameters, energy channel, fatigue channel,
shared. Attribution window `t = 310–400`; routing is the mean somatic learning gain over the same
window.

### 5.1 Attribution

| Disruption | Intact correct | No-HOT | Reactive | Intact reliability AUROC |
|---|---|---|---|---|
| Self | 61/100 [52, 70] | 0/100 | 0/100 | 0.73 |
| Energy sensor | **97/100 [93, 100]** | 0/100 | 0/100 | 0.42 |
| Fatigue sensor | 75/100 [66, 83] | 0/100 | 0/100 | **0.78** |
| Shared | 44/100 [35, 54] | 0/100 | 0/100 | 0.41 |

Four-way macro-F1: **intact 0.553**, no-HOT 0.000, reactive 0.000.

**Result.** HOT is necessary for any attribution and for plasticity routing. The reactive control
has no second-order monitor by construction, so its zero is a manipulation check, not a
competitor result. The substantive limitation is class imbalance: attribution is reliable for the
energy channel (97/100) but weak for shared degradation (44/100) and only moderate for a
self-model disruption (61/100). A shared shift is statistically close to an energy shift when the
fatigue channel's variance is already low.

### 5.2 Reliability calibration

Reliability AUROC is strong for self (0.73) and fatigue (0.78) but **below chance** for energy
(0.42) and shared (0.41). The head is trained on observable error; under a lying channel,
observed error and latent error dissociate, so a head that correctly predicts "the observation
will be wrong" can be anti-correlated with "the hidden state estimate will be wrong". This is an
epistemic limitation of any monitor trained only on observable residuals.

### 5.3 Plasticity routing and first-order accuracy

| Disruption | Somatic gain (intact) | Somatic gain (no-HOT) | Δ self MAE (intact − no-HOT) |
|---|---|---|---|
| Self | 0.88 | 1.00 | **−1.22 [−1.38, −1.06]**, `d_z = −1.47` |
| Energy | **0.58** | 1.00 | **−0.78 [−0.89, −0.66]**, `d_z = −1.36` |
| Fatigue | 0.68 | 1.00 | **−1.02 [−1.18, −0.88]**, `d_z = −1.33` |
| Shared | 0.62 | 1.00 | **−0.74 [−0.86, −0.64]**, `d_z = −1.32` |

All routing contrasts are Holm `p = 0.002` (|`d_z`| 0.83–5.08). Meta AUROC improves by 0.05–0.23
over no-HOT. The monitor protects the model it monitors.

**Caveat.** The energy-channel Brier score is *worse* for the intact system than for the frozen
no-HOT baseline (difference −0.03), because the frozen baseline predicts a near-constant and the
dynamic head is penalised on a shifted distribution. Ranking (AUROC) improves; absolute
calibration does not. Both are reported.

---

## 6. Experiment 4 — The epistemic fork (`AE-1/2`)

The fork starts at 26 energy under a pessimistic rough-terrain prior (`roughCost = 25`,
`roughObservations = 0`). The optimal policy is **rest → probe → exploit**: the probe is only
worth its immediate expected loss if the rollout predicts that the future self can act on the
resolved belief.

| Condition | Probed | Solved | First probe | Resources |
|---|---|---|---|---|
| Intact | **99%** | **40% [31, 50]** | 11 | **23.6 [18.6, 28.7]** |
| No cognitive self-sim | 1% | 1% [0, 3] | 31 | 0.3 [0.0, 1.0] |
| Physical MPC | 3% | 3% [0, 7] | 23 | 2.0 [0.0, 4.7] |
| Reactive | 4% | 4% [1, 8] | 17 | 4.2 [0.6, 9.0] |
| No-HOT | 97% | 20% [12, 28] | **49** | 12.9 [8.2, 18.1] |

**Contrasts (intact minus control):**

- No-AE: probed **+0.98 [0.95, 1.00]**, `d_z = 6.96`, `p = 0.002`; solved +0.39 [0.29, 0.48],
  `d_z = 0.76`; resources +23.3 [18.1, 28.8].
- Physical MPC: probed +0.96 [0.92, 0.99], `d_z = 4.87`; solved +0.37 [0.27, 0.47]; resources
  +21.6 [16.5, 26.6].
- Reactive: probed +0.95 [0.90, 0.99], `d_z = 4.34`; solved +0.36 [0.27, 0.46].
- No-HOT: probed +0.02 (n.s.); solved **+0.20 [0.09, 0.31]**, `p = 0.002`; first probe
  **−36.6 ticks [−55.1, −21.8]**. HOT is not needed to probe, but it is needed to probe *early*
  and to exploit afterwards.

**Result.** The clearest capability dissociation in the project. Simulating future physical state
at the same horizon and compute budget is not sufficient; the agent must simulate the belief
change the probe would produce.

**Alternative explanation.** The option term is an architectural prior over information value.
The control that removes it is matched on horizon and action space, but not on the explicit
option-value computation. The claim is therefore about *this* architecture's causal structure,
not a universal claim that no physical planner can ever probe. A planner with an explicit
information-value term would be a stronger control and is left for future work.

---

## 7. Experiment 5 — Action–perception contingency reversal (`AE-1`)

At `t = 300` the movement-to-effort mapping is rescaled, slip probability rises, and fatigue
accumulates faster. Detection latency is the first tick after 300 at which attribution selects
`self` or `shared`.

| Condition | Detection latency | Pre-cost MAE | Post-cost MAE | Recalibration |
|---|---|---|---|---|
| Intact | **4** | 0.32 | 0.66 | **−0.35 [−0.43, −0.26]** |
| No broadcast | 2 | 0.25 | 0.76 | −0.51 [−0.60, −0.43] |
| No-HOT | **400 (never)** | 0.94 | 1.58 | −0.64 [−0.82, −0.46] |
| Matched feedforward | 5 | 0.23 | 0.67 | −0.44 [−0.52, −0.35] |

**Contrasts:** No-HOT latency +396.2 [394.2, 397.7], `d_z = 46.1`, `p = 0.002`; recalibration
+0.30 [0.11, 0.50], `p = 0.011`. Broadcast and feedforward are not significantly different from
intact on latency (`p = 0.184`, `p = 1.000`).

**Result.** HOT is necessary for detecting a changed action–outcome contingency at all. The
broadcast does not matter for this particular reversal; the monitor does. Recalibration is
negative for every condition (post-shift cost MAE is worse), because the reversal increases true
cost variance; the meaningful comparison is the *size* of the degradation, which is smaller for
the intact system.

---

## 8. Generalization to unseen environments (zero re-tuning)

| Suite | Intact | Reactive | Physical MPC | Flat | Feedforward |
|---|---|---|---|---|---|
| Unseen topology | 31.8 [28.4, 35.2] | **63.4** [59.2, 67.9] | 27.6 | 51.1 | 34.5 |
| Unseen non-linear | 29.9 [26.3, 33.8] | **61.5** [56.9, 66.0] | 31.5 | 53.8 | 31.6 |
| Unseen compound | **13.9** [11.1, 17.0] | 3.7 | 3.0 | 6.6 | 7.9 |

All conditions survive 100/100 in every suite. The architecture wins the compound suite (a
physical surge plus an energy-channel bias plus a pessimistic belief) by a wide margin, and loses
the topology and non-linear suites to the reactive and flat controls. The reactive control is a
strong forager; the architecture is a cautious instrument. This is the honest generalization
result: no uniform superiority.

---

## 9. Capability-by-mechanism matrix

`++` strong causal contribution, `+` measurable contribution, `0` no measurable contribution,
`—` not targeted.

| Mechanism | Exp 1 settling | Exp 2 competition | Exp 3 meta | Exp 4 fork | Exp 5 reversal |
|---|---|---|---|---|---|
| RPT (`K = 3`) | **0** (null) | — | — | — | — |
| GWT bottleneck | — | **++** | — | — | — |
| GWT broadcast | — | **+** | — | — | 0 |
| HOT reliability | — | — | **++** | **+** | **++** |
| AST-1 schema | **+** | **++** (recovery) | — | — | — |
| AE-2 cognitive rollout | — | — | — | **++** | — |

---

## 10. Cumulative evidence assessment (TiCS indicators)

This table is a structured judgement, not a posterior probability. Strength is graded from the
effect sizes and the adequacy of the controls.

| Indicator | Operationalisation | Key evidence | Strongest alternative explanation | Verdict |
|---|---|---|---|---|
| **RPT-1/2** | within-tick convergence and disagreement | convergence 0.80 vs 0.00; no absorption or MAE gain | the V0.5 precision gate does the work | **Implemented, not load-bearing** |
| **PP-1** | top-down absorption of a one-tick glitch | absorption 0.823; feedforward 0.806 | inherited from V0.5 | **Present, not specific to V0.6** |
| **GWT-1** | four specialist proposals | modules carry distinct evidence and goals | a single monolithic utility could mimic it | **Implemented, partially dissociated** |
| **GWT-2** | capacity-limited competition | thrash 0.057 vs 0.296; coherence 0.91 vs 0.68 | the no-bottleneck control is also less cautious | **Supported** |
| **GWT-3** | global broadcast | coherence +0.05 with the winner fixed | broadcast may only add noise-driven caution | **Supported, modest** |
| **GWT-4** | sequential querying | 3 passes, frame revisions logged | final action is close to pass-1 argmax | **Implemented, weak dissociation** |
| **HOT-1** | second-order reliability estimate used by control | reliability gates the meta module and suppresses plasticity during faults | a constant 0.5 prior could mimic the gating | **Supported** |
| **HOT-2** | calibrated off-policy shadow head | AUROC 0.73 self, 0.78 fatigue; 0.42 energy, 0.41 shared | observed-error calibration inverts under channel lies | **Partially supported** |
| **HOT-3** | four-way attribution and routing | macro-F1 0.553; routing 0.58–0.88 vs 1.00; MAE −0.74…−1.22 | attribution is weak for shared (0.44) and self (0.61) disruptions | **Routing supported; attribution mixed** |
| **HOT-4** | 3D quality space | smooth trajectory, stability index | a readout, not a controller | **Implemented, descriptive** |
| **AST-1** | model of precision allocation | recovery 5 vs 256 ticks; absorption +0.03 | recovery could be a timer | **Supported** |
| **AE-1/2** | recursive cognitive self-simulation | fork probe 99% vs 1%; solved 40% vs 1% | the option term is an architectural prior | **Strongly supported within this architecture** |

---

## 11. Negative results and failed predictions

1. **RPT is a null result.** Absorption 0.823 vs 0.811 (`p = 0.224`); stationary MAE unchanged.
   The recurrent sheet is implemented and inspectable, but the V0.5 gate dominates.
2. **Reliability calibration inverts under energy/shared corruption.** AUROC 0.42/0.41. A monitor
   trained on observable residuals cannot distinguish "the channel is lying" from "the model is
   wrong" without a separate latent-error signal.
3. **Attribution is class-imbalanced.** Energy shifts are identified 97/100, but shared degradation
   only 44/100 and a self-model disruption 61/100. The shared case is close to an energy shift when
   the fatigue channel's variance is already low.
4. **The architecture forages less in conflict.** 25.1 vs 41.7 resources without the bottleneck.
   Coherence is not free.
5. **Generalization is not uniform.** The architecture loses topology and non-linear suites to
   reactive and flat controls; it wins only the compound suite.
6. **Absolute meta calibration is worse under energy corruption** even though ranking improves
   (Brier −0.03 vs no-HOT; AUROC +0.23). Both are reported.

---

## 12. Limitations

- **Single environment family.** All suites use the same 30×30 grid, the same resource process
  and the same action set. Generalization is to perturbations of one world, not to new worlds.
- **Hand-set architecture constants.** The number of modules, the capacity leak, the rollout
  horizon and the option-value weight were fixed before validation but not derived. They are
  part of the hypothesis, not free parameters.
- **The option term is explicit.** The epistemic fork demonstrates the necessity of an
  information-value computation, not the impossibility of physical planners.
- **Attribution is behaviour-dependent.** The monitor can only attribute what the policy
  samples; a cautious policy is a poor diagnostic instrument.
- **No neural baseline.** The claim is about a transparent non-neural architecture, not about
  whether a transformer could learn the same capabilities.
- **No claim about experience.** Every indicator is functional or structural. The report does not
  assert, and the architecture does not measure, phenomenal consciousness.

---

## 13. Reproducibility

```
npm run validate:v06          # 100 seeds, 4,500 episodes, ~6 min
SEEDS=20 npx tsx tools/v06validate.ts
npm test                      # 73 tests, including V0.6 determinism and ablation checks
npm run typecheck
npm run build
```

The validator writes per-run summaries to `research/v06-results.json` and aggregates, contrasts,
macro-F1 and the capability matrix to `research/v06-analysis.json`. The stdout report is saved in
`research/v06validation.log`.

**Determinism.** The V0.6 engine uses four named RNG streams (`v06-priors`, `v06-sensors`,
`v06-dynamics`, `v06-policy`) plus a shadow-probe stream. Two runs with the same seed and
configuration are bit-identical in resources, ticks, MAE and selected action (tested).

---

## 14. One-paragraph summary

V0.6 closes the loop and then tries to break it. A capacity-limited workspace, a global
broadcast, a higher-order monitor, an attention schema and a recursive cognitive rollout each
carry a capability that disappears when the edge is cut: coherence under conflict, binding,
attribution and plasticity routing, post-conflict recovery, and the willingness to pay for a
diagnostic probe. But the recurrent settling loop adds nothing to single-tick absorption, the
reliability head inverts when the energy channel lies, attribution is weak for shared degradation,
and simpler controls out-forage the architecture in two of three unseen environments.
The result is a stronger instrument and a more honest map of what each mechanism does — not a
claim that the organism is conscious.
