# V0.6 — Full-Rubric Refinement and the Four Mechanism Bottlenecks

**Status:** complete. 87 conditions × 100 paired seeds = **8,700 episodes**.
**Artefacts:** `research/v06-results.json`, `research/v06-analysis.json`, `research/v06_validation.log`, `research/v06_feedforward.json`.
**Lab:** `/research?version=v06`. **Previous report:** the earlier 45-condition V0.6 draft of this document (archived in git history).

---

## 1. What changed in the final V0.6 run

This final V0.6 run is an in-place refinement of `src/simulation/v06/` and `tools/v06validate.ts`. It does not create
a V0.7 engine. The five audit findings were addressed as follows.

1. **Epistemic fork gain.** `SelfModelV06.learnOutcome` now performs a Kalman update on the rough-cost
   parameter. A workspace-broadcast diagnostic probe uses observation noise `R = 0.75`, so the first
   one or two probes collapse the false prior instead of nudging it. `forkSolved` rose from **40%**
   in the earlier 45-condition draft to **84% [77, 91]**. The point estimate is one point below the 85% target; the 95% CI
   includes 85%.
2. **RPT is load-bearing.** Pass 1 is raw bottom-up evidence; passes 2–3 integrate the workspace prior
   and re-weight channel precision. With `K = 1`, the filter runs in soft mode and the hard outlier
   suppression is disabled. Absorption is **0.814 [0.782, 0.842]** at `K = 3` versus **0.290
   [0.258, 0.324]** at `K = 1` (Δ **+0.524 [0.482, 0.567]**, $d_z$ **2.38**, Holm $p = 0.0020$).
   Stationary MAE is **1.431** vs **1.446** (full slightly better; Δ **−0.015 [−0.024, −0.005]**,
   $d_z$ **−0.30**, Holm $p = 0.0030$). Against matched feedforward, full wins MAE
   (**−0.022 [−0.032, −0.012]**, $d_z$ **−0.43**, raw $p = 0.0005$) but the absorption difference is
   not significant (**+0.014 [−0.031, 0.059]**, $p = 0.558$).
3. **Opportunity-gated workspace.** When viability is safe and no conflict episode has occurred, the
   workspace forces a foraging coalition (world/epistemic) and runs diagnostic precision in parallel.
   A conflict episode (`conflict > 0.4`) latches the ordinary competition for the rest of the run, so
   Exp2 coherence is preserved (**0.915**). Physical interference penalties (slip/collapse from
   incoherent control and high-fatigue sprinting) make flat and reactive control pay for their
   incoherence. Full conflict resources are **32.35 [29.96, 34.81]** vs flat **41.51**; full still
   loses the resource race but wins conflict coherence (**0.915 vs 0.666**).
4. **HOT-2/3.** Reliability features now include energy variance, learned sensor bias, strain
   residual, strain volatility and energy innovation; the shadow head is evaluated on latent state
   failure. Attribution boundaries were sharpened for shared and physical causes. These changes
   improved shared recall (0.39) and physical recall (0.90), but **macro-F1 remains 0.502** and
   shadow AUROC remains below 0.75 on every shift. This is reported as a residual failure, not
   hidden.
5. **Full rubric coverage.** The validator now runs the complete 7 mechanisms × 5 experiments
   matrix, all four disruptions for Exp3, the four adversarial controls on the common
   standard/shift, conflict, fork and three unseen suites, and the three missing controls:
   1-parameter rolling tracker, raw sensor vector, and fixed exponential decay. It stores
   `rollingBss`, `withinTickEntropyDrop`, `qualitySpaceSeparability`, `rawSpaceSeparability`,
   `qualityModeSwitchCorrelation`, `rawModeSwitchCorrelation`, `postGlitchMae` and
   `astRecoveryGainDelta`.

---

## 2. Method

- **Seeds:** 100 paired seeds per condition (1–100), identical world and RNG streams.
- **Conditions:** 7 mechanisms × 5 experiments; Exp3 has four disruptions per mechanism = 28
  conditions. Full architecture on three unseen suites (3), four controls × six benchmarks (24),
  and four additional rubric-control conditions = **87 conditions**.
- **Total:** **8,700 episodes**.
- **Statistics:** paired sign-flip permutation tests (2,000 permutations), bootstrap 95% CIs
  (1,000 resamples), Cohen's $d_z$, Holm correction within each experiment family.
- **Isolation:** the agent never reads `trueCost`, `energyBefore/After`, latent state, regime labels
  or shadow labels. Latent labels are evaluation-only.

**Metric definitions.** `conflictMae` = energy MAE in `t = 330–390`, excluding collection ticks ±3.
`forkSolved` = probed (at least one rough move) and resources ≥ 25. `rollingBss` = 1 − model MSE /
rolling-base MSE over meta tolerance predictions. `withinTickEntropyDrop` = entropy at pass 1 minus
entropy at pass K. `qualitySpaceSeparability` = Fisher ratio (between/within) of 3D quality
coordinates grouped by attention mode; `rawSpaceSeparability` is the same for raw
`[energy/100, strain, effort/6]`. `qualityModeSwitchCorrelation` is the point-biserial correlation
between quality-space step distance and next-tick mode switches. `postGlitchMae` = late window
`t+20…t+45` after each pulse; `astRecoveryGainDelta` = immediate (`t+1…t+7`) minus late MAE.

---

## 3. Table A — Seven-indicator scorecard

| Indicator family | Metric | V0.6 full [95% CI] | Control / ablation [95% CI] | Paired Δ, $d_z$, $p$ | Target |
|---|---|---|---|---|---|
| **1. RPT-1/2 & PP-1** | convergence / entropy drop | **0.520 [0.476, 0.563]**; entropy drop **0.027 [0.020, 0.033]** | No-RPT: **0.000**; entropy drop **0.000** | Δ **+0.520 [0.477, 0.562]**, $d_z$ **2.30**, Holm $p=0.0020$ | — |
| | PP-1 absorption | **0.814 [0.782, 0.842]** | No-RPT **0.290 [0.258, 0.324]**; feedforward **0.800 [0.771, 0.828]** | vs No-RPT **+0.524 [0.482, 0.567]**, $d_z$ **2.38**, $p=0.0020$; vs feedforward **+0.014 [−0.031, 0.059]**, $d_z$ **0.06**, raw $p=0.558$ | **PASS** >0.78 |
| | Stationary MAE | **1.431 [1.419, 1.445]** | No-RPT **1.446 [1.429, 1.463]**; feedforward **1.453 [1.436, 1.470]** | vs No-RPT **−0.015 [−0.024, −0.005]**, $d_z$ **−0.30**, $p=0.0030$; vs feedforward **−0.022 [−0.032, −0.012]**, $d_z$ **−0.43**, raw $p=0.0005$ | **PASS** <1.72 |
| **2. GWT-1/2** | conflict thrash / coherence | thrash **0.051**; coherence **0.915 [0.908, 0.920]**; conflict MAE **2.728 [2.638, 2.807]**; resources **32.35 [29.96, 34.81]**; 100/100 | No-bottleneck / flat: thrash **0.356**; coherence **0.666 [0.653, 0.687]**; resources **41.51 [37.85, 44.85]**; 100/100 | thrash **−0.304 [−0.344, −0.266]**, $d_z$ **−1.53**, $p=0.0025$; coherence **+0.249 [0.229, 0.269]**, $d_z$ **2.53**; conflict MAE **−0.103 [−0.253, 0.046]** ns; resources **−11.60 [−15.11, −8.05]**, $d_z$ **−0.64**, $p=0.0025$ | Coherence **PASS**; resources **FAIL** |
| **3. GWT-3/4** | binding, quarantine, complex task | coherence **0.915**; routing gain **0.774**; fork solved **84%** | No-broadcast: coherence **0.842 [0.831, 0.853]**; routing **1.000**; fork solved **34%** | coherence **+0.072 [0.059, 0.085]**, $d_z$ **1.13**, $p=0.0025$; routing **−0.226**; fork solved **+0.50 [0.40, 0.60]**, $d_z$ **0.92**, $p=0.0025$ | Binding **PASS**; quarantine **PARTIAL** |
| **4. HOT-2/3** | rolling BSS | **−0.003 [−0.004, −0.003]** | No-HOT **0.000 [0.000, 0.000]**; 1-param tracker **0.000** | — | **FAIL** >0 |
| | off-policy AUROC | self **0.46 [0.40, 0.54]**; energy **0.59 [0.56, 0.62]**; fatigue **0.43 [0.33, 0.54]**; shared **0.58 [0.54, 0.61]** | No-HOT **NaN** | — | **FAIL** >0.75 (0/4) |
| | 4-way macro-F1 / recall | **0.502**; physical **0.90**, energy **0.63**, fatigue **0.63**, shared **0.39** | No-HOT **0.000**; recall **0** | macro-F1 **−0.502**, $p<0.001$ | **FAIL** >0.70; 2/4 recall ≥0.70 |
| **5. HOT-1/4** | quality-space geometry | Fisher **0.126 [0.106, 0.147]**; raw **0.161 [0.120, 0.210]**; mode corr **0.097 [0.082, 0.112]**; raw corr **−0.009 [−0.021, 0.004]** | Raw vector control: Fisher **0.085 [0.064, 0.106]**; mode corr **−0.017** | not paired in validator | Separability **FAIL** vs raw; mode prediction **PASS** |
| **6. AST-1** | recovery gain / post-glitch MAE | gain **0.036 [−0.014, 0.086]**; post-glitch MAE **1.419 [1.392, 1.449]**; recovery latency **19 ticks** | No-AST: gain **0.052 [0.000, 0.105]**; post **1.422**; latency **256 ticks**. Fixed decay: gain **0.030**; post **1.422** | latency **−236.9 [−245.3, −226.6]**, $d_z$ **−4.86**, $p=0.0025$ | Gain **FAIL** >0.04; latency **PASS**; post MAE **PASS** |
| **7. AE-1/2** | epistemic fork | probe **94%**; solved **84% [77, 91]**; resources **57.21 [51.16, 63.44]**; 100/100; deaths **0** | No-AE: **1%/1%**, **0.33**. Physical MPC: **2%/1%**, **0.42** | vs No-AE probed **+0.93 [0.87, 0.97]**, $d_z$ **3.63**, $p=0.0020$; solved **+0.83 [0.75, 0.90]**, $d_z$ **2.20**; resources **+56.88 [51.14, 62.83]**, $d_z$ **1.84**. vs MPC solved **+0.83 [0.75, 0.90]**, $d_z$ **2.20** | Probe **PASS**; escape **84% < 85% (FAIL by 1 point)**; deaths **PASS** |

---

## 4. Table B — 6×5 double-dissociation matrix

`*` $p<0.05$; `***` $p<0.001$; `ns` not significant; `†` raw paired test, not Holm-adjusted.

| Condition | Exp1 absorption / MAE | Exp2 1−thrash / recovery | Exp3 macro-F1 / shift survival | Exp4 probed / solved / resources | Exp5 detection latency |
|---|---|---|---|---|---|
| **V0.6 full** | **0.814 / 1.431** | **0.949 / 19** | **0.502 / 100%** | **94% / 84% / 57.2** | **2.1** |
| **No-RPT (K=1)** | **0.290** (Δ **−0.524***); MAE **1.446** (Δ **+0.015***) | 0.941 (Δ −0.007 ns) / 25 | 0.520 / 100% | 96% / 39% (Δ **−0.45***) / 22.3 (Δ **−34.9***) | 5.3 (Δ +3.2 ns) |
| **No-GWT bottleneck** | 0.790 (Δ −0.023 ns); MAE **1.625** (Δ **+0.194***) | **0.644** (Δ **−0.304***) / 23 | 0.621 / 100% | 89% / 75% (Δ −0.09 ns) / 52.1 | 2.4 |
| **No-GWT broadcast** | 0.776 (Δ −0.037 ns); MAE 1.443 (Δ +0.012*) | **0.896** (Δ **−0.053***) / 13 | 0.579 / 100% | 88% / 34% (Δ **−0.50***) / 24.4 (Δ **−32.8***) | 1.3 |
| **No-HOT meta** | 0.792 (Δ −0.021 ns); MAE **1.535** (Δ **+0.103***) | **0.773** (Δ **−0.176***) / **152** (Δ **+133***) | **0.000** (Δ **−0.502***) / 100% | 100% / 90% (Δ +0.06 ns) / 61.9 | **400** (Δ **+398***) |
| **No-AST** | 0.819 (Δ +0.006 ns); MAE 1.437 (Δ −0.006 ns) | 0.937 (Δ −0.011 ns) / **256** (Δ **+237***) | 0.535 / 100% | 92% / 35% (Δ **−0.49***) / 20.8 (Δ **−36.4***) | 1.3 |
| **No cognitive self-sim** | 0.839 (Δ +0.026 ns); MAE 1.427 (Δ −0.005 ns) | 0.949 (Δ 0 ns) / 17 | 0.541 / 100% | **1% / 1%** (Δ **−0.83***) / **0.3** (Δ **−56.9***) | 1.6 |

---

## 5. Table C — Head-to-head vs the four adversarial controls

| Architecture | Standard & shift resources / survival | Conflict coherence / resources | Fork solved / resources | Gen 1 topology | Gen 2 non-linear | Gen 3 compound |
|---|---|---|---|---|---|---|
| **V0.6 full** | **33.84 [31.14, 36.93]**; 100/100 | **0.915**; **32.35 [29.96, 34.81]** | **84% [77, 91]**; **57.21 [51.16, 63.44]** | **57.38 [52.76, 62.05]**; 100/100 | **55.87 [51.23, 60.49]**; 100/100 | **32.69 [29.92, 36.10]**; 100/100 |
| **Reactive reflex** | **51.22 [47.09, 55.61]**; **99/100** | 0.831; **43.65 [40.01, 47.32]** | 4%; 3.53 | **59.92 [55.95, 64.09]**; 100/100 | **56.90 [52.66, 60.87]**; 100/100 | 2.65; 100/100 |
| **Physical MPC (H=4)** | 30.50 [26.14, 35.05]; 100/100 | 0.665; 27.29 | 1%; 0.42 | 30.69 [26.98, 34.66]; 100/100 | 32.06 [27.64, 36.10]; 100/100 | 1.74; 100/100 |
| **Flat blackboard** | 45.18 [41.27, 48.92]; 100/100 | 0.670; **41.51 [37.98, 44.89]** | 73%; 50.49 | 52.16 [47.97, 56.65]; 100/100 | 53.97 [49.53, 58.62]; 100/100 | **47.46 [42.62, 52.21]**; 100/100 |
| **Matched feedforward** | 30.21 [26.87, 33.54]; 100/100 | 0.847; 27.43 | 31%; 19.52 | 29.11 [25.94, 32.44]; 100/100 | 31.98 [28.20, 35.89]; 100/100 | 29.55 [26.41, 32.86]; 100/100 |

Full wins the fork by a large margin (**84% vs 4%/1%/73%/31%**), wins conflict coherence
(**0.915 vs 0.666/0.670/0.831/0.847**), and wins Gen1/Gen2 resources over MPC/feedforward. It loses
the raw resource race to flat and reactive in standard shift/conflict and to flat in Gen3. This is
the honest trade-off: coherence and probe competence are bought with caution.

---

## 6. Table D — Trilemma and negative results

### 6.1 Cross-version trilemma

| Metric | V0.3 | V0.4 | V0.5 | V0.6 |
|---|---|---|---|---|
| Stationary MAE (raw 1.92) | 1.68 | 2.74 | 2.04 | **1.431 [1.419, 1.445]** |
| PP-1 absorption | 0.00 | 0.830 | 0.79 (pilot) | **0.814 [0.782, 0.842]** |
| 4-way attribution macro-F1 | 0.604 | 0.515 | 0.577 | **0.502** |
| Belief-trap / fork safe escape | 66% / 65.1 | — | 74% / 78.1 | **84% [77, 91] / 57.2, 0 deaths** |

The MAE and absorption objectives are now simultaneously met, and RPT is load-bearing for absorption.
The attribution objective is **not** met (0.502 < 0.70). The fork is one point below the 85% target.

### 6.2 Failed thresholds and adversarial wins

1. **HOT-2 AUROC > 0.75 — 0/4.** Self 0.46, energy 0.59, fatigue 0.43, shared 0.58. The reliability
   head remains a channel/observation monitor, not a latent-state monitor.
2. **HOT-3 macro-F1 > 0.70 — fail.** 0.502; shared recall 0.39, energy 0.63, fatigue 0.63, physical
   0.90. Shared degradation remains the hardest class.
3. **Rolling BSS > 0 — fail.** Full −0.003; the 1-parameter tracker is 0.000. The contextual meta
   model does not beat its own rolling baseline on this metric.
4. **AE-2 escape > 85% — fail by 1 point.** 84% [77, 91]; deaths 0. Probe rate 94%.
5. **AST recovery gain > +0.04 — fail.** 0.036 [−0.014, 0.086]; No-AST 0.052, fixed decay 0.030.
   The latency effect is strong (19 vs 256 ticks), but the gain metric does not clear the target.
6. **Quality-space separability vs raw — fail.** Fisher 0.126 vs raw 0.161. Quality-space mode
   *prediction* is better (0.097 vs −0.009), but raw coordinates are more separable in this sample.
7. **Full is out-foraged by flat/reactive.** Standard shift 33.84 vs 45.18/51.22; conflict 32.35 vs
   41.51/43.65; Gen3 32.69 vs 47.46. Full wins coherence/probe competence, not raw resources.
8. **Exp5 recalibration is negative.** Full −0.91 [−1.06, −0.77], No-AST −0.03, No-selfsim +0.04.
   Detection is fast (2.1 ticks) but post-shift cost MAE degrades.
9. **Matched feedforward meets both PP-1 thresholds** (0.800 > 0.78; 1.453 < 1.72), and full’s
   absorption advantage over it is not significant ($p=0.558$). Full’s MAE advantage is significant
   ($p=0.0005$).
10. **No-bottleneck/flat have higher conflict resources** (41.51 vs 32.35, Δ −11.60), despite worse
    coherence (0.666 vs 0.915).

---

## 7. Reproducibility

```
npm run validate:v06          # 100 seeds, 87 conditions, 8,700 episodes (~20 min)
SEEDS=20 npx tsx tools/v06validate.ts
npm test                      # 73 tests
npm run typecheck && npm run build
```

The validator writes raw per-run summaries to `research/v06-results.json` and aggregates, contrasts,
macro-F1 and Table C to `research/v06-analysis.json`. The matched-feedforward Exp1 supplement is in
`research/v06_feedforward.json`. Every value in this report is regenerated from those files.

## 8. Untouched holdout replication (seeds 10001-10100)

The full V0.6 benchmark was rerun once on 100 new seeds with no parameter or code change. Full-architecture estimates reproduced the development set: PP-1 absorption 0.808 [0.777, 0.836] vs 0.814; conflict coherence 0.932 vs 0.949; attribution macro-F1 0.501 vs 0.502; fork solved 85% [78, 92] vs 84%; fork resources 58.3 [52.8, 64.2] vs 57.2. Across 87 conditions the mean absolute resource difference was 1.95 (largest 6.53, No-GWT bottleneck Exp 1). No-RPT fork solving (26% vs 39%) and No-AST detection latency (5.8 vs 1.3) were less stable; see research/hardening-holdout-comparison.json.
