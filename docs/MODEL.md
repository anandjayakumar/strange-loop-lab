# Model notes

This document matches the implementation. Constants live in `src/simulation/config.ts`.

## 1. Environment

- Grid 30 × 30, agent starts at `(15, 15)`.
- Obstacle density ≈ 0.115; world generation retries if less than 82% of free cells are reachable.
- Resource cells: random placement plus a guaranteed ring at Manhattan distance 2–4 from the start.
- Each resource cell has a seed-drawn period `P ∈ [48, 113]` and offset `O ∈ [0, P)`.
  It is present at tick `t` unless it was collected during the current regrowth window:
  `present = lastCollected < windowStart(t)`, where
  `windowStart(t) = t − ((t + O) mod P)`.
  Collection therefore marks the current window consumed; the next window restores it. This
  schedule is independent of the agent's trajectory.
- Resource gain: 24 energy. Rest gain: 2.7 energy, −0.16 fatigue.
- Passive death threshold: energy ≤ 0.

## 2. Physical dynamics

Let `f ∈ [0,1]` be fatigue, `E` energy, `Emax = 100`.

```
effectiveCost(E, f) = 1.05 + 1.35 f + 0.45 (E / Emax)
effectiveSuccess(f) = clamp(1 − 0.54 f, 0.32, 0.995)
```

For a move attempt:

1. fatigue increases by 0.046 (clamped to 1);
2. a seeded uniform draw decides `slip = u > effectiveSuccess(f)`;
3. if slip: energy −= `0.65 × effectiveCost`, position unchanged;
4. else if the target is out of bounds or an obstacle: energy −= `0.5 × effectiveCost`;
5. else position moves; if the target has a resource it is collected and energy += 24;
6. energy is clamped to `[0, 100]`; death if energy ≤ 0.

Resting adds 2.7 energy and subtracts 0.16 fatigue. Energy is never visible to the agent; the
ground-truth state is instrumentation only.

## 3. Perception

The agent receives a 7 × 7 local cell view, its own position (proprioception), the last
action outcome (`moved`, `blocked`, `slipped`, `collected`) and one interoceptive reading.

```
E_sensed = clamp(E_true + N(0, 2.4), 0, 112)
```

With probability 0.08 the reading is replaced by the previous reading (delay). The noise and lag
are not disclosed to the agent as labels. Directional features count obstacles/resources within
the view; no global map is available.

## 4. World model

Five actions, each with three online logistic heads and readable coefficients. Features for
success are `[1, obstacleAhead, boundaryAhead, localObstacleDensity]`; collection uses
`[1, resourceAhead, localResourceDensity, directionalResourceSignal]`; collision adds the
directional obstacle signal. Each head is updated by the delta rule:

```
p = σ(w·x)
w_i ← w_i + η (y − p) x_i,   η = 0.055
```

Weights are clamped to ±7. A weak observation-correction pass (η = 0.012) uses visibly empty or
blocked adjacent cells as pseudo-labels. Rest is defined as an always-successful, non-collecting
action for scoring.

## 5. Self-model

The self-model receives no physical state. It maintains:

### Energy belief (scalar Kalman filter)

```
predicted = estimate + lastPredictedDelta
P ← P + 0.55
g = P / (P + 6.2)
if prior weighting: g ← g · clamp(1.18 − 0.62 w_prior, 0.35, 1.05)
estimate ← predicted + g (E_sensed − predicted)
P ← (1 − g) P + 0.15
```

`lastPredictedDelta` is the self-model's prediction for the action actually selected. In Mode C,
`w_prior = 0.35 + 0.6 trust` when prior weighting and meta feedback are enabled; otherwise it is
0.5 and does not modify the gain.

### Movement cost, rest gain, collection gain

```
cost ← cost + 0.11 η_m (observedCost − cost)
rest ← rest + 0.09 η_m (observedRestGain − rest)
collect ← collect + 0.13 η_m (observedCollectGain − collect)
```

`observedCost` is derived from the noisy interoceptive difference, subtracting the estimated
collection gain on collection ticks. η_m is 1 in Mode B; in Mode C it is the meta-model's
plasticity multiplier when meta feedback and plasticity are enabled.

### Fatigue

A latent filter driven by move/rest history, slips and cost innovations:

```
move:  f ← clamp(f + 0.048 η_m + 0.012·slip + 0.012 η_m·clip(Δcost), 0, 1)
rest:  f ← clamp(f − 0.105 η_m, 0, 1)
```

Immediately after a move, the filter consumes the slip signal. This is the estimate that can
diverge from instrumented fatigue.

### Success and collection logits

```
pSuccess = σ(w_s · [1, f, obstacleAhead + boundary, slipRate])
pCollect = σ(w_c · [1, resourceAhead, directionalResourceSignal, localResourceDensity])
```

Both are updated by the delta rule from observed outcomes at rate `0.12 η_m`.

### Predictions

```
ΔE_move     = −cost + pCollect · collectGain
ΔE_rest     = +restGain
f_next      = clamp(f + 0.048 + 0.012 slipRate, 0, 1)        (move)
            = clamp(f − 0.105, 0, 1)                          (rest)
survival    = max(0, estimate) / max(0.35, cost (0.62 + 0.38 pSuccess))
```

The self-model's reported reliability error combines normalized innovation and a slow success
calibration term; it is used by the meta-model.

**Important audit caveat:** the starting values `movementCost = 1.35`, `restGain = 2.35`,
`collectGain = 20`, the fatigue rates 0.048/−0.105, the success-logit prior, and the survival
formula are hand-chosen and close to the true dynamics. They are *designer priors*, not learned
self-knowledge. Several of the filter rates and the survival formula are fixed rather than
updated from experience. The validation report tests sensitivity by corrupting the cost prior
and by freezing self-learning, but it does not establish a blank-slate result.

## 6. Action selection and influence

For each action, the base utility is

```
base = pCollect · 24 + pSuccess · 1.1 − pCollision · 5.5 + novelty · 2.2
```

plus a reactive resting term based on the noisy sensed energy when the self term is absent. When
the self-model is active, its internal term is

```
self = (ΔE ≥ 0 ? 0.45 ΔE : 0.9 ΔE)
     − 4.5 Δf
     + 0.8 pSuccess
     + 0.012 min(survival, 80)
     − 1.7 max(0, 22 − (Ê + ΔE))          # risk penalty
```

The scaled term is `influence × self`. Mode B uses influence 1; Mode C uses meta trust when meta
feedback is enabled, otherwise 1. Utilities pass through a softmax with temperature 0.78 and a
seeded draw selects the action.

`selfInfluence` is the KL divergence between this policy and the same softmax computed with the
self term removed. It is zero in Mode A and when self feedback is disabled.

## 7. Meta-model

The meta-model observes a normalized error made of innovation error and self-model success
calibration:

```
err = 0.7 · min(1, |innovation| / 9) + 0.3 · calibrationError
errorEMA ← 0.935 errorEMA + 0.065 err
trustTarget = clamp(1 − 1.25 errorEMA, 0.08, 0.96)
trust ← trust + k (trustTarget − trust),  k = 0.105 down / 0.06 up
```

Outputs:

```
learningRateMultiplier = clamp(0.4 + 1.7 (1 − trust), 0.35, 2.1)
priorWeight            = clamp(0.35 + 0.6 trust, 0.35, 0.92)
```

When meta feedback is on: trust scales self influence, the multiplier scales self-model learning,
and prior weight reduces the Kalman gain on sensory readings. Turning plasticity off fixes the
multiplier at 1; turning prior weighting off fixes the prior at 0.5. Meta feedback off makes
influence 1 and stops both modulations while trust still updates (open loop).

This is a **hand-designed scalar reliability tracker and gain scheduler**, not a learned model of
reliability. The affine error→trust mapping, the learning-rate multiplier and the prior formula
are fixed. The validation ablation `C − C_plasticity_off` found negligible behavioural or
accuracy benefit from the adaptive learning-rate edge; the dominant causal edge is trust scaling
of self influence.

## 8. Measurements

- **Self state accuracy**: `1 − mean(|Ê − E| / 25)` over a 60-tick window. `E` is instrumented.
  This is a scaled absolute error, not a probability. The validation report compares it with the
  raw interoceptive sample at the same sense phase; V0's filtered energy belief is actually
  *worse* (MAE 3.24/4.54 vs 1.92), so self accuracy is not evidence of a good filter.
- **Self forward prediction**: engine-side comparison of predicted energy delta and success
  against instrumented outcomes: `1 − (0.6 normalized delta error + 0.4 Brier)`.
- **World accuracy**: `1 − mean 0.5 (Brier_success + Brier_collect)` on selected actions. This is
  a raw Brier-derived score, **not** a skill score: a constant low collection probability can
  score well when collections are rare. The validation harness therefore also reports **Brier
  skill scores (BSS = 1 − Brier / Brier_base)**.
- **Self influence**: KL divergence between the actual policy and the same softmax with the self
  term removed. The harness also records total-variation distance and the fraction of ticks where
  the same uniform draw selects a different action under the counterfactual policy.
- **Meta calibration**: Pearson r between trust at time `t` and self accuracy at `t + 15`;
  requires at least 100 samples, uses at most the last 160 paired samples. This is a predictive
  correlation, not a guarantee that trust is calibrated. The meta-model's internal `calibration`
  getter is circular (it correlates trust with a transform of its own error) and is not used as
  external evidence.
- **Adaptation**: JS divergence between action counts of the last 30 and previous 30 ticks.
- **Action entropy** is reported from the rolling 60-tick action mix.

## 9. Determinism streams

```
mulberry32(hash(seed : "world"))          → obstacles/resources
mulberry32(hash(seed : "interoception"))  → sensor noise and stale samples
mulberry32(hash(seed : "dynamics"))       → slip events, one draw per move
mulberry32(hash(seed : "policy"))         → softmax sampling
```

Each stream is independent, so a change in agent noise cannot alter world generation. Randomness
is only consumed in the same order for a given seed/mode/options, which makes micro-stepping and
full stepping equivalent (verified by tests).

## 10. What would count as cheating

The implementation deliberately avoids: an identity/self flag, hardcoded introspective
statements, direct ground-truth reads inside the self-model, feedback edges that do not affect
selection or lower-level parameters, and narrative events not derived from measurements.

The self-model's initial coefficients are priors, not a representation of an identity. However,
the validation report explicitly flags that several priors are close to the true dynamics and
that some structural rates do not change from experience. They are designer knowledge, even
though they are not runtime ground-truth leakage. A blank-slate or randomised-prior study is
required before claiming that the self-model is learned from experience rather than supplied by
the experimenter.

## 11. Validation instrumentation

`ResearchOptions` in `src/simulation/types.ts` supports opt-in, non-default ablations:

- `worldModelEnabled` — replace world predictions with a neutral baseline;
- `worldLearning` — freeze world-model updates;
- `selfLearning` — freeze self-model updates after initialising from the first sample;
- `initialSelfModel` — experimental starting priors (used by the corruption experiment).

The default UI does not expose these. The engine also records raw predictions, outcomes,
counterfactual actions, policy TV, decision changes, cost estimates/errors, trust/error traces and
Brier inputs in `SeriesPoint`. `tools/validate.ts`, `tools/analyze.ts` and `tools/selfaudit.ts`
reproduce the report's 100-seed experiments.
