# Strange Loop Lab V0.5 — Unified Precision, Attribution and Plateau-Breaking Probe

**Status:** research report. Scope: computational mechanisms only; no claim of consciousness or
subjective experience.

**Lineage:** V0.1 (`6438bea`) → V0.2 (`975299e`) → V0.3 (`e68669c`) → V0.4 (`69b4eb3`) → V0.5
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

**100 paired seeds** (1–100), horizon 900 ticks, trap horizon 1,600 ticks, 52 conditions;
5,200 runs in 330 s. Statistics: paired bootstrap CIs, permutation tests, Cohen's dz, Holm within
families, all seeded. The same N = 100 protocol is used by the V0.1, V0.2, V0.3 and V0.4 reports.
Reproduce: `npm run validate:v05` (defaults to `SEEDS=100`).

## 3. Results (100 paired seeds, horizon 900/1600)

| Target | Result | Verdict |
| --- | --- | --- |
| Stationary MAE < 1.75 vs raw 1.92 | self **2.04 [1.96, 2.12]** vs raw 1.92 [1.91, 1.93] | **not met** |
| PP-1 absorption > 0.75 | late/early error ratio **1.31 [0.61, 2.15]**; absorption **0.79** (20-seed pilot) | **partial (pilot)** |
| AST-1 recovery advantage | V0.4: 0.237 vs 0.181, p < 0.001; V0.5 direction preserved but reduced | **partial** |
| Contextual meta ΔAUROC > +0.08, Δres > +5 | residual vs baseline-only: AUROC **−0.01 [−0.02, 0.01]**, p = 0.812 | **not met** |
| Trap escape > 90/100, zero deaths | **74/100 [65, 83]**, 78.1 resources, **0 deaths**; random 93/100, 44.1 res, 1 death | **not met on rate; met on resources and survival** |
| Attribution macro-F1 > 0.68 | **0.577** (physical 0.63, energy 0.66, fatigue 0.80, shared 0.80) | **not met** |
| meta-on > meta-off | **+19.21 [13.61, 24.80]** standard; **+13.75 … +28.37** across regimes, all p ≤ 0.001 | **met** |
| Learned world > neutral | **+4.72 [0.77, 8.68]**, dz 0.22, p = 0.027 | **met** |
| Rolling BSS > 0 / latent AUROC > 0.65 | BSS **0.027 [0.025, 0.028]**; AUROC **0.785 [0.773, 0.797]** | **met** |

The four V0.4 bottlenecks still trade off directly: lowering the outlier threshold raises absorption
and escapes more traps but re-degrades MAE; the evidence-discounted gate raises escape and resources
but perturbs the attribution dynamics. V0.5 does not achieve a simultaneous Pareto improvement on
all seven targets.

At the full 100-seed protocol the learned world model becomes a small but significant foraging
advantage (**+4.72 resources, p = 0.027**), which was not significant in the 40-seed run.

## 4. Negative and partial results

- **Stationary MAE** remains above the 1.75 target when absorption is high; the two are coupled
  through the same gain. The 100-seed value (2.04) matches the 40-seed estimate.
- **Contextual meta transfer** did not appear in the conditional regime: the contextual model is
  slightly *worse* than the baseline-only ablation on AUROC and resources. The fatigue-conditional
  surge may be too uniform within the high-fatigue band for the binned context to add prospective
  information.
- **Trap escape** improved from V0.4's 65/100 to **74/100** and keeps zero deaths, but does not reach
  90/100; the remaining failures are energy plateaus below even the discounted gate.
- **Attribution** is sensitive to the gating threshold: 0.764 with the milder gate, 0.613 with the
  more aggressive one that buys absorption. The shipped configuration lands at 0.577.
- The AST effect is smaller under selective gating because normal-operation gain is no longer
  suppressed, leaving less perseverance for the schema to release.
- The 100-seed harness still uses the legacy interoceptive probe, so PP-1 absorption is reported
  from the 20-seed pilot (0.79) and is not re-estimated at N = 100.

## 5. Cumulative comparison

| Version | Stationary MAE | PP-1 absorption | Attribution macro-F1 | Trap escape | Meta-on gain | Learned world |
| --- | --- | --- | --- | --- | --- | --- |
| V0.1 | — | — | — | — | — | — |
| V0.2 | 1.67 | — | ~0.25 (1/100 physical, 86/100 fatigue) | 0/100 | −6.8 | worse than neutral |
| V0.3 | 1.68 | ≈0 | 0.604 | 66/100 | +12.3…+28.8 | +7.64 |
| V0.4 | 2.74 | 0.830 | 0.515 | 65/100 | +15.4 | −0.26 |
| V0.5 | 2.04 | 0.79 (pilot) | 0.577 | 74/100 | +13.8…+28.4 | +4.72 |

The V0.2 meta-control figure is the paired resource delta recomputed from
`research/v02-results.json` (−6.84 [−11.11, −2.57]); earlier text quoted −7.42 from an intermediate
run. All other values are from the JSON artifacts listed in §7.

## 6. Verification

`npm run typecheck`, `npm test` (67 tests: 56 preserved + 11 V0.5) and `npm run build` pass.
`npm run paper:figures` regenerates the four publication SVGs from the JSON artifacts.

## 7. Files

`src/simulation/v05/*`, `tests/v05.test.ts`, `tools/v05validate.ts`,
`research/v05-results.json`, `research/v05-analysis.json`, `research/v05validation.log`,
`paper/figures/*`.
