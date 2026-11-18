# Strange Loop Lab V0.4 — Precision-Gated Illusions, Preparation and the Attention Schema

**Status:** research report, 100 paired seeds, deterministic simulator.
**Scope:** computational mechanisms and measurements only. Nothing here claims consciousness,
sentience or subjective experience. "Attention" means precision weighting in a predictive filter;
"attention schema" means a predictor of the agent's own precision allocation.

**Lineage:** V0.1 (`6438bea`) → V0.2 (`975299e`) → V0.3 (`e68669c`) → V0.4 (`v0.4-attention-schema`).
V0.1, V0.2 and V0.3 engines, dashboards, tests and reports are preserved. V0.4 lives in
`src/simulation/v04` and is benchmarked against V0.3 on the same 100 seeds.

---

## 0. Results at a glance

| Target question | V0.3 | V0.4 | Verdict |
| --- | --- | --- | --- |
| PP-1 1-tick top-down absorption | ≈ 0 | **0.830 [0.811, 0.848]**; sustained-shift absorption 0.371 | **resolved** |
| Goodhart transfer (residual vs baseline) | no transfer | BSS +0.03 (p<0.001) but latent AUROC Δ −0.00 and resources Δ −0.84 (p=1.0) | **negative** |
| Trap escape: prep on vs off | 66/100 | **65/100 vs 64/100**, 67.7 vs 66.5 resources | **negative** |
| Random exploration escape | 86/100 | 86/100, 46.9 resources | unchanged |
| Attribution macro-F1 | 0.604 | **0.515** | **negative** |
| AST-on vs AST-off recovery | — | recovery gain **0.237 vs 0.181**, Δ 0.056 [0.042, 0.072], dz 1.13, p<0.001; post-glitch MAE 3.54 vs 4.11 | **resolved** |

Meta-control remains strongly beneficial: meta-on 40.1 vs meta-off 24.7 resources
(+15.40 [9.40, 21.41], dz 0.52, p<0.001).

---

## 1. What V0.4 changes

| # | V0.3 negative result | V0.4 mechanism |
| --- | --- | --- |
| 1 | absorption ≈ 0 | **Precision-weighted predictive coding**: posterior gain `K = π_sensor/(π_prior+π_sensor)`, where prior precision depends on persistent-failure probability, action familiarity and slow cross-channel disagreement, and sensor precision collapses on instantaneous cross-channel disagreement |
| 2 | local Brier ≠ latent control | **Multi-step directional target**: the failure head is trained on normalised *signed* persistent bias instead of 1-step absolute error, and the error head on a 10-tick windowed error |
| 3 | 66/100 trap escape | **Epistemic preparation**: deferred probe value is transferred to REST when the probe is blocked by the safety envelope |
| 4 | physical/fatigue confusion | **Strain-to-outcome consistency**: whether the reported strain or the internal fatigue filter better predicts the realised energy delta |
| 5 | — | **Attention schema (AST-1)**: a predictor of the agent's own precision allocation that classifies its mode and releases prior suppression after a glitch subsides |

### 1.1 Precision-gated filter (`selfModel.ts`)

`correctEnergy` computes an innovation after subtracting an expected collection jump, then:

- `instantDisagreement = max(0, |innovation|/11 − 0.25) · (0.5 + 0.5·max(0, strainDisagreement − 0.12)/0.2)`
- `disagreementEma` (τ≈10) and `sensorDistrust` (τ≈10) accumulate the slow component.
- `priorPrecision = 1.4·e^(−1.6·p_failure)·e^(−2.6·ema)·(0.7 + 0.6·familiarity)`
- `sensorPrecision = 1.6·e^(−4.0·instant)·noiseFactor·(1 + 3.2·attentionRelief)`
- `K = adaptiveGain · suppression`, where
  `suppression = 0.12 + 0.88·e^(−3.5·(instant + 2.5·distrust)) + relief`.

A one-tick glitch collapses `K` to ≈0.20 and the prior absorbs it; sustained disagreement raises
`ema` and `relief`, reopening the gain.

### 1.2 Epistemic preparation (`agent.ts`)

When a rough-terrain target carries a large decision value but its predicted next energy is below
`infoSafetyEnergy` (10) or its next fatigue exceeds 0.9, the deferred value is accumulated in
`blockedProbeValue` and added to REST's information term (`×3`). The transfer is self-limiting: once
the probe is safe, the term is zero.

### 1.3 Attention schema (`attentionSchema.ts`)

AST-1 tracks five weights (`energy`, `strain`, `prior`, `world`, `epistemic`), predicts the next
observable error with a 7-feature LMS model, classifies the mode
(`monitoring | high_prior | defensive | exploratory`), and emits a bounded `recovery` signal when it
has been in `high_prior` mode while instantaneous disagreement is below 0.08 for more than two
ticks. Recovery decays `sensorDistrust` and boosts sensor precision. AST-off disables only this
release.

---

## 2. Protocol

- 100 paired seeds, horizon 1000 (1600 for traps), shifts at tick 360 (mixed: 320/620).
- Attribution window 378–406. Statistics: paired bootstrap CIs, 10 000-permutation paired tests,
  Cohen's dz, Holm within families, seeded.
- Reproduce: `npm run validate:v04` (5400 runs, ~5 minutes). Raw: `research/v04-results.json`;
  aggregates: `research/v04-analysis.json`.
- Dashboard: `npm run dev` → **V0.4** in the header.

---

## 3. Question 1 — PP-1 precision-gated illusion

**Resolved.** A 1-tick +12 isolated energy pulse at tick 200 is absorbed:

| Measure | Value |
| --- | --- |
| 1-tick absorption `1 − |Δestimate|/δ` | **0.830 [0.811, 0.848]** |
| precision gain during the pulse | 0.20 |
| sustained 10-tick shift, residual absorption at the end | 0.371 |
| meta confidence at probe time | 0.37 |

The same filter still adapts to a sustained multi-channel shift (residual absorption falls to
0.37 as prior precision erodes). This is a precision-ratio effect, not a hand-coded "ignore spikes"
rule: the gain is the same formula in both cases.

---

## 4. Question 2 — Goodhart transfer

**Negative.** Retargeting the contextual residual to multi-step directional error produces a
calibration gain but no downstream transfer:

| Contrast (full vs baseline-only meta) | Δ [95% CI] | dz | p |
| --- | --- | --- | --- |
| meta Brier | −0.01 [−0.01, −0.00] | −0.49 | <0.001 |
| rolling BSS | +0.03 [0.02, 0.03] | 4.20 | <0.001 |
| latent AUROC | −0.00 [−0.02, 0.01] | −0.03 | 1.000 |
| resources | −0.84 [−5.33, 3.22] | −0.04 | 1.000 |

The failure head itself is strong — freezing meta learning costs +0.29 AUROC and +0.07 Brier
(p<0.001) — and rolling BSS is positive in every condition (0.018–0.027), with latent AUROC
0.680–0.813. But the *contextual residual* improves local calibration without improving latent
discrimination or survival. The Goodhart gap is narrowed, not closed.

---

## 5. Question 3 — trap escape mastery

**Negative for preparation.** The decoupled trap is still escaped by VoI, but epistemic preparation
adds essentially nothing:

| Condition | escape | resources | first rough tick | deaths |
| --- | --- | --- | --- | --- |
| pragmatic | 0/100 | 0.0 | — | 0 |
| uncertainty bonus | 0/100 | 0.0 | — | 0 |
| random | 86/100 | 46.9 | 87 | 0 |
| **VoI + preparation** | **65/100** | **67.7** | 14 | 0 |
| VoI, preparation off | 64/100 | 66.5 | — | 0 |
| VoI, meta off | 0/100 | 0.0 | — | 0 |
| V0.3 VoI (same seeds) | 0/100 | 65.1 | — | 0 |

VoI still beats pragmatic by +67.7 resources (dz 1.34, p<0.001) and random by +20.8 (dz 0.36,
p=0.002) with zero deaths. But preparation moves escape from 64 to 65 and resources from 66.5 to
67.7: within noise. Tracing shows why: the blocked-probe state is usually a genuine energy
*plateau* — in the seeds that stay trapped, resting no longer raises energy enough to clear the
safety gate, so preparation cannot manufacture a safe probe. The remaining 35/100 failures are not
patience failures but resource-availability failures.

---

## 6. Question 4 — attribution macro-F1

**Negative.** The strain-to-outcome consistency feature was implemented and exposed
(`channelStats.strainOutcomeConsistency`) but did not improve the four-way classifier. With its
score term removed to preserve the V0.3 baseline:

| Truth \ Pred | physical | energy | fatigue | shared | insufficient |
| --- | --- | --- | --- | --- | --- |
| physical | **76** | 18 | 4 | 2 | 0 |
| energy | 34 | **52** | 2 | 12 | 0 |
| fatigue | 13 | 3 | **62** | 22 | 0 |
| shared | 9 | 14 | 11 | **66** | 0 |

Macro-F1 **0.515** (physical 0.74, energy 0.56, fatigue 0.63, shared 0.63), *below* V0.3's 0.604.
The precision filter makes the energy channel's innovations less diagnostic (they are partly
absorbed), which shifts energy-sensor runs toward physical. The target of >0.75 was not reached.

---

## 7. Question 5 — attention schema ablation

**Resolved.** After a 10-tick +12 sensor glitch at tick 300, the 20-tick post-glitch precision gain
and estimation error are:

| Measure | AST-on | AST-off | Δ [95% CI] | dz | p |
| --- | --- | --- | --- | --- | --- |
| recovery gain | 0.237 | 0.181 | +0.056 [0.042, 0.072] | 1.13 | <0.001 |
| post-glitch MAE | 3.54 | 4.11 | — | — | — |

The schema's `high_prior` mode and `recovery` release are visible in the dashboard; it emits
recovery only when the disagreement that justified prior suppression has subsided, and the ablation
changes nothing else in the filter.

---

## 8. V0.4 vs V0.3 and secondary results

| Condition | V0.4 | V0.3 | Δ resources | dz | p |
| --- | --- | --- | --- | --- | --- |
| standard | 40.1 | 42.1 | −1.99 [−7.41, 3.01] | −0.08 | 0.452 |
| harsh | 26.6 | 33.8 | −7.26 [−13.97, −0.16] | −0.20 | 0.089 |
| physical shift | 36.8 | 34.6 | +2.11 [−3.09, 7.35] | 0.08 | 0.500 |
| energy shift | 41.0 | 41.2 | −0.19 | −0.01 | 0.947 |
| shared shift | 45.8 | 45.8 | +0.06 | 0.00 | 1.000 |
| trap VoI | 67.7 | 65.1 | +2.65 [−9.99, 15.37] | 0.04 | 0.699 |

Self-model MAE is worse in V0.4 (e.g. +1.06 [0.91, 1.21] standard, dz 1.36): the filter deliberately
absorbs single-channel spikes, and the MAE benchmark counts those spikes as error. Under standard
conditions V0.4 self MAE is 2.74 versus raw sensing 1.93, so the absorbing filter loses to raw
sensing on this metric; V0.4 self MAE is 2.74 versus V0.3's 1.68. This is the direct cost of the
illusion, not a tracking failure in normal regimes: the same filter tracks sustained shifts.

**Learned world vs neutral no-world lost its V0.3 advantage**: −0.26 [−3.93, 3.36], p = 1.000,
where V0.3 had +7.64 p<0.001. The precision filter changes the trajectory enough that the learned
world's skill gate no longer pays for itself. Reported as a regression.

Meta-control is preserved: full 40.1 vs meta-off 24.7 (+15.40, dz 0.52, p<0.001).

---

## 9. Negative results and limitations

1. **Goodhart transfer not fixed.** The residual improves local calibration (BSS +0.03) but not
   latent AUROC (Δ 0.00) or resources (Δ −0.84, p = 1.0).
2. **Epistemic preparation does not raise trap escape.** 65/100 vs 64/100; the trapped runs are
   energy-plateau failures, not patience failures.
3. **Attribution macro-F1 regressed to 0.515** from 0.604. The strain-to-outcome consistency feature
   is implemented but its score term was removed after a 20-seed check showed it made energy/physical
   confusion worse.
4. **Self-model MAE is worse than V0.3 and worse than raw sensing** under standard conditions
   (2.74 vs 1.93 raw) because absorption intentionally ignores single-channel evidence. The illusion
   and the state-tracking metric trade off directly.
5. **Learned world no longer beats neutral** (−0.26, p = 1.0).
6. **Random exploration still escapes more often than VoI** (86 vs 65), though with 20.8 fewer
   resources and no survival advantage.
7. The attention schema's effect is measured on a deliberately injected glitch, not on naturally
   occurring sensor failures; external validity is limited.

---

## 10. Verification

- `npm run typecheck` — clean.
- `npm test` — 56 tests (45 preserved V0.1/V0.2/V0.3 + 11 V0.4).
- `npm run build` — succeeds.
- `npm run validate:v04` — 5400 runs, ~5 minutes.

## 11. Files

- `src/simulation/v04/{types,config,dynamics,selfModel,worldModel,metaModel,attribution,attentionSchema,agent,engine}.ts`
- `src/v04/{V04Lab.tsx,useV04Simulation.ts}`, V0.4 switch in `src/App.tsx` / `src/components/TopBar.tsx`
- `tools/v04validate.ts`, `tests/v04.test.ts`
- `research/v04-results.json`, `research/v04-analysis.json`, `research/v04validation.log`
- preserved: `src/simulation/v02/*`, `src/simulation/v03/*`, `src/v02/*`, `src/v03/*`,
  `tests/v02.test.ts`, `tests/v03.test.ts`, `docs/V02_RESEARCH_REPORT.md`,
  `docs/V03_RESEARCH_REPORT.md`
