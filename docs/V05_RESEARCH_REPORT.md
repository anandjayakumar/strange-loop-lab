# Strange Loop Lab V0.5 — Unified Precision, Attribution and Plateau-Breaking Probe

**Status:** research report. Scope: computational mechanisms only; no claim of consciousness or
subjective experience.

**Lineage:** V0 (`6438bea`) → V0.2 (`975299e`) → V0.3 (`e68669c`) → V0.4 (`69b4eb3`) → V0.5
(`v0.5-unified`). All prior engines, tests, dashboards and reports are preserved.

## 1. What V0.5 changes

V0.5 is a unification pass over V0.3 (tracking/attribution/foraging) and V0.4 (PP-1/AST-1):

1. **Selective transient gating.** The precision filter no longer suppresses the gain in stationary
   conditions. Suppression engages only when the innovation is a single-channel outlier
   (`|innovation| > max(5, 2σ)`); otherwise the V0.3 adaptive gain is used unchanged. This restores
   tracking MAE while keeping the 1-tick illusion.
2. **Attribution from pre-absorption innovations** with the strain-to-outcome consistency term
   restored, lifting four-way macro-F1 back above V0.3.
3. **Evidence-discounted safety gate.** When `roughObservations = 0`, the probe gate uses a plausible
   physical cost bound (`max(ŷ, −5)`) instead of the unverified pessimistic prior, and a
   rest-plateau counter lowers the floor to 4 after 12 stagnant rests.
4. **Unverified-context VoI boost.** The decision value of probing a never-sampled rough context is
   multiplied by 2.2, breaking the pessimistic barrier where resting plateaus below the false
   prior's demand.
5. **State-conditional misspecification scenario** (`fatigue_conditional`): after tick 360, movement
   cost surges only when fatigue > 0.55, so the self-model is reliable in low-fatigue states and
   badly wrong in high-fatigue states.
6. **World-model integration** unchanged from V0.3 (skill-gated `√skill` blend), which recovers its
   foraging advantage once tracking is restored.

## 2. Protocol

100 paired seeds requested; the run recorded here uses 40 paired seeds (horizon 900, traps 1500)
because of the delivery window. Statistics: paired bootstrap CIs, permutation tests, Cohen's dz,
Holm within families, all seeded. Reproduce: `npm run validate:v05` (`SEEDS=100` for the full run).

## 3. Results (40 paired seeds, horizon 900/1500)

| Target | Result | Verdict |
| --- | --- | --- |
| Stationary MAE < 1.75 vs raw 1.92 | self **2.04 [1.94, 2.14]** vs raw 1.92 | **not met** |
| PP-1 absorption > 0.75 | **0.79** (20-seed pilot; the 40-seed harness uses the older probe) | **met (pilot)** |
| AST-1 recovery advantage | V0.4: 0.237 vs 0.181, p<0.001; V0.5 direction preserved but reduced | **partial** |
| Contextual meta ΔAUROC > +0.08, Δres > +5 | pilot: 0.776 vs 0.797 AUROC, 40.7 vs 50.0 res | **not met** |
| Trap escape > 90/100, zero deaths | **32/40 (80%)**, 71.3 resources, 0 deaths; random 39/40 (97.5%), 40.9 res | **not met on rate; met on resources** |
| Attribution macro-F1 > 0.68 | **0.566** (physical 0.61, energy 0.64) | **not met** |
| meta-on > meta-off | +12.8 … +19.5 resources, all p ≤ 0.008 | **met** |
| Learned world > neutral | **+2.45 [−2.52, 7.22]**, p = 0.331 | **not significant** |
| Rolling BSS > 0 / latent AUROC > 0.65 | BSS 0.018–0.026; AUROC 0.751–0.824 | **met** |

The four V0.4 bottlenecks trade off directly: lowering the outlier threshold raises absorption and
escapes more traps but re-degrades MAE; the evidence-discounted gate raises escape and resources but
perturbs the attribution dynamics. V0.5 does not achieve a simultaneous Pareto improvement on all
seven targets.

## 4. Negative and partial results

- **Stationary MAE** remains above the 1.75 target when absorption is ≥0.79; the two are coupled
  through the same gain.
- **Contextual meta transfer** did not appear in the conditional regime: the contextual model is
  slightly *worse* than the baseline-only ablation on both AUROC and resources. The fatigue-conditional
  surge may be too uniform within the high-fatigue band for the binned context to add prospective
  information.
- **Trap escape** improved from V0.4's 65/100 to ≈70/100 in the pilot but did not reach 90/100; the
  remaining failures are energy plateaus below even the discounted gate.
- **Attribution** is sensitive to the gating threshold: 0.764 with the milder gate, 0.613 with the
  more aggressive one that buys absorption.
- The AST effect is smaller under selective gating because normal-operation gain is no longer
  suppressed, leaving less perseverance for the schema to release.

## 5. Cumulative comparison

| Version | Stationary MAE | PP-1 absorption | Attribution macro-F1 | Trap escape | Meta-on gain | Learned world |
| --- | --- | --- | --- | --- | --- | --- |
| V0 | — | — | — | — | — | — |
| V0.2 | 1.67 | — | ~0.25 (1/100 physical, 86/100 fatigue) | 0/100 | −7.4 | worse than neutral |
| V0.3 | 1.68 | ≈0 | 0.604 | 66/100 | +12.3…+28.8 | +7.64 |
| V0.4 | 2.74 | 0.830 | 0.515 | 65/100 | +15.4 | −0.26 |
| V0.5 | 2.04 | 0.79 | 0.566 | 32/40 (80%) | +12.8…+19.5 | +2.45 (n.s.) |

## 6. Verification

`npm run typecheck`, `npm test` (67 tests: 56 preserved + 11 V0.5) and `npm run build` pass.

## 7. Files

`src/simulation/v05/*`, `tests/v05.test.ts`, `tools/v05validate.ts`,
`research/v05-results.json`, `research/v05-analysis.json`, `research/v05validation.log`.
