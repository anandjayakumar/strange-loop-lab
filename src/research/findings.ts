export type VersionKey = "v0" | "v02" | "v03" | "v04" | "v05" | "v06";

export type Tone = "good" | "warn" | "bad" | "neutral";

export interface Cell {
  text: string;
  tone: Tone;
  note?: string;
}

export interface Discovery {
  id: string;
  index: number;
  title: string;
  version: VersionKey;
  plain: string;
  stats: string;
  evidence: string;
  tone: Tone;
}

export const VERSION_LABEL: Record<VersionKey, string> = {
  v0: "V0.1",
  v02: "V0.2",
  v03: "V0.3",
  v04: "V0.4",
  v05: "V0.5",
  v06: "V0.6",
};

export const VERSION_COLOR: Record<VersionKey, string> = {
  v0: "#b23f24",
  v02: "#634070",
  v03: "#26467e",
  v04: "#1d5c67",
  v05: "#39643f",
  v06: "#1d5c67",
};

export const DISCOVERIES: Discovery[] = [
  {
    id: "cliffs",
    index: 1,
    title: "Self-modeling only matters when life has cliffs",
    version: "v02",
    plain:
      "In the forgiving V0.1 world, an agent that never learns anything about itself survives and forages about as well as one that does — its hand-set priors are good enough. Put the same agent near a metabolic cliff, where small prediction errors kill, and the learned self-model becomes decisive. A model of the self is only worth its cost when being wrong is expensive.",
    stats:
      "V0.1: frozen-self 64.6 resources vs learned 61.0 (paired −3.5, p = 0.057); frozen-world 76.6 vs learned 62.9; no-world 28.2 vs learned 61.7 (p < 0.001). Under V0.2 harsh dynamics: frozen-self 22.4 vs learned 32.4 (+10.0 versus frozen), 100/100 survival in both. The sign of the self-model's value reverses between the two worlds.",
    evidence:
      "The V0.1 ablation shows self-modeling is behaviourally inert in a benign world and only changes survival under cliff pressure. The V0.2 result reverses V0.1's sign.",
    tone: "good",
  },
  {
    id: "vulnerability",
    index: 2,
    title: "First-order self-reference creates psychological vulnerability",
    version: "v03",
    plain:
      "A self-model is not free. Once the agent trusts its own prediction that rough terrain is catastrophically expensive, it stops going there, and because it never goes there it never learns it was wrong. An agent with no causal self-model cannot develop that phobia — but it also cannot plan.",
    stats:
      "V0.3 decoupled trap: an agent carrying the false belief (rough cost 25 vs true 2.2) collected 0.0 resources and made 0/100 rough-terrain visits. The L1 ablation (self-prediction removed from action selection) escaped 86–91% of traps and collected 48.7–52.7 resources — while losing 11–12 resources under a physical regime shift. The loop is load-bearing in opposite directions for different tasks.",
    evidence:
      "V0.3 report §8.3: every link is load-bearing for at least one capability; L1 is load-bearing for shift performance, not for trap escape.",
    tone: "warn",
  },
  {
    id: "curiosity",
    index: 3,
    title: "Second-order epistemic curiosity breaks self-fulfilling fear traps",
    version: "v05",
    plain:
      "If the only reason to test a feared place is the food you expect to find there, fear always wins: the expected meal is smaller than the imagined cost. Adding a value for information — and letting the agent rest up when it is too weak to run the test — makes the diagnostic trip worth taking. The agent deliberately probes the terrain it has been avoiding, discovers the true cost, and returns to foraging.",
    stats:
      "V0.3-V0.5 trap benchmark: pragmatic 0/100 escape (0.0 resources); uncertainty bonus 0/100; decision-VoI 66/100 with 65.1 resources; V0.5 plateau preparation 74/100 (74%) with 78.1 resources and 0 deaths; random 93/100 with 44.1 resources and 1 death. VoI vs pragmatic +78.14 [69.29, 87.10], dz 1.69, p < 0.001; VoI vs random +34.03 resources [24.01, 43.69], dz 0.68, p < 0.001.",
    evidence:
      "Random exploration also escapes by luck — the brief's expectation that it would fail is not supported — but it is markedly less resource-efficient.",
    tone: "good",
  },
  {
    id: "doubt",
    index: 4,
    title: "Raw self-doubt hurts; risk-sensitive caution saves",
    version: "v03",
    plain:
      "Simply turning down the self-model's influence when the meta-model is unsure sounds prudent, but it made V0.2 forage less and die more: the agent ignored its own warning lights exactly when they mattered. What worked was more surgical — correct the known bias, become pessimistic only near the cliff, and keep probing when far from it.",
    stats:
      "V0.2: meta-on 32.4 vs meta-off 39.3, a −6.84 paired resource deficit. V0.3: meta-on beat meta-off in all eight regimes, +12.34 to +28.82 resources, dz 0.45–1.13, all p < 0.001; severe-prior survival 100/100 vs 93/100. V0.5 preserved the effect: +13.75 to +28.37, all p < 0.001.",
    evidence:
      "V0.3 report §4; V0.5 report §3. The pessimistic cliff term itself was resource-neutral versus naive scaling; the gain comes from using meta signals at all.",
    tone: "good",
  },
  {
    id: "supersensory",
    index: 5,
    title: "Super-sensory state estimation learned from scratch",
    version: "v02",
    plain:
      "With no designer priors, the agent learns to estimate its own energy better than the noisy sensor it is given. It does this by combining the sensor with a forward model of what its actions should have cost — the same trick a brain uses to stabilise perception.",
    stats:
      "V0.2/V0.3 uninformed-prior runs: energy MAE 1.67–1.68 versus raw interoception 1.92 across docile, standard and harsh regimes. Later versions trade some of this away for illusion absorption (V0.4 2.74; V0.5 2.04).",
    evidence:
      "V0.2 report §3; V0.3 report §3; V0.4 report §8.",
    tone: "good",
  },
  {
    id: "attribution",
    index: 6,
    title:
      'Diagnosing "am I broken?" vs "are my senses lying?" requires action-conditioned contrasts',
    version: "v03",
    plain:
      "On a single step, a real change in the world and a glitch in a sensor look identical. Separating them requires comparing what happens when the agent moves with what happens when it rests: a physical shift shows up in movement, a sensor fault shows up in both. V0.2 had no such contrast and blamed almost everything on the fatigue sensor.",
    stats:
      "V0.2 single-step attribution: physical 1/100, energy sensor 0/100, fatigue sensor 86/100, shared 0/100. V0.3 MOVE/REST temporal attribution: macro-F1 0.604, energy 88/100, shared 89/100, physical 63/100, fatigue 63/100. V0.5 recovered to 0.577 at 100 seeds after the precision trade-off; a 20-seed pilot with the milder gate reached 0.764.",
    evidence:
      "V0.3 report §5; V0.5 report §4. The confusable pair is physical vs fatigue, because a physical shift is absorbed by the self-model within ~10 ticks while sensor variance persists.",
    tone: "warn",
  },
  {
    id: "residual",
    index: 7,
    title: "Fast low-dimensional metacognition beats heavy online regressors",
    version: "v03",
    plain:
      "A big contextual model fitted online cannot beat a one-number running average early in the game: it has too many parameters and too little data. The fix was architectural — keep the running average as a floor and add a small, automatically shrunk contextual correction on top.",
    stats:
      "V0.2 rolling BSS −0.12 and latent AUROC 0.47. V0.3 residual meta-model: rolling BSS +0.016 … +0.024 in every condition (p < 0.001 vs the baseline-only ablation) and latent persistent-failure AUROC 0.679–0.797 (V0.2: 0.471). V0.5: BSS 0.027 [0.025, 0.028], AUROC 0.785 [0.773, 0.797] standard and 0.683–0.810 across shifts.",
    evidence:
      "V0.3 report §3; V0.4 report §4 (multi-step directional target); V0.5 report §3.",
    tone: "good",
  },
  {
    id: "world",
    index: 8,
    title: "Skill-gating prevents bad early advice",
    version: "v03",
    plain:
      "A learned world model was worse than no world model at all in V0.2: early in training its predictions are noise, and acting on noise costs food. The fix is to let the model speak only to the extent that it has demonstrated skill, so it starts as a neutral prior and earns influence.",
    stats:
      "V0.2: neutral no-world 40.5 vs learned 32.4, a paired -8.11 [-13.17, -3.25] deficit. V0.3: learned - neutral +7.64 [3.64, 11.36], dz 0.38, p < 0.001; learned - frozen +7.64 [3.72, 11.59], p = 0.001. V0.4 lost the advantage (-0.26, p = 1.0) after the precision filter changed the trajectory; V0.5 recovered +4.72 [0.77, 8.68], dz 0.22, p = 0.027 at 100 seeds.",
    evidence:
      "V0.3 report §7; V0.4 report §8; V0.5 report §3. Under skill gating an un-updated model is behaviourally identical to no model, so 'frozen' and 'no-world' coincide.",
    tone: "warn",
  },
  {
    id: "ast",
    index: 9,
    title: "Attention schema (AST-1) releases post-glitch perseveration",
    version: "v04",
    plain:
      "After a sensor glitch ends, a precision filter can stay stuck distrusting the sensor — perseveration. Giving the agent a small model of its own attention allocation lets it notice 'I am still in high-prior mode although the disagreement is gone' and release the suppression.",
    stats:
      "V0.4 10-tick +12 glitch at tick 300: post-glitch recovery gain 0.237 (AST-on) vs 0.181 (AST-off), Δ 0.056 [0.042, 0.072], dz 1.13, p < 0.001; post-glitch energy MAE 3.54 vs 4.11. V0.5 preserves the direction with a smaller effect under selective gating.",
    evidence:
      "V0.4 report §7; V0.5 report §3. AST-off disables only the recovery release; the rest of the filter is unchanged.",
    tone: "good",
  },
  {
    id: "trilemma",
    index: 10,
    title: "The illusion–tracking–diagnostic trilemma (a no-free-lunch theorem)",
    version: "v05",
    plain:
      "Making the agent absorb a one-tick sensory lie requires it to trust its prior more than its senses. That same setting makes it slower to track real changes and blinds the module that diagnoses sensor faults. V0.5 showed the three cannot all be maximised at once with a single gain: every attempt to buy back tracking or attribution gave back absorption.",
    stats:
      "V0.3 → V0.4: absorption ≈ 0 → 0.830 [0.811, 0.848], but stationary MAE 1.68 → 2.74 (raw sensing 1.93) and attribution macro-F1 0.604 → 0.515. V0.5 selective gating: absorption 0.79 (pilot), MAE 2.04, attribution 0.577 (100 seeds); a milder gate reached attribution 0.764 at the cost of lower absorption. No configuration met all three targets simultaneously.",
    evidence:
      "V0.4 report §9; V0.5 report §3–§4. This is the project's clearest negative theoretical result.",
    tone: "bad",
  },
  {
    id: "bottleneck",
    index: 6,
    title: "A capacity-limited workspace prevents policy thrashing",
    version: "v06",
    plain:
      "When four specialist modules can all write to the same blackboard at once, small disagreements turn into action flapping. Forcing them to compete for one capacity-limited workspace, and broadcasting only the winner, keeps the policy coherent under simultaneous sensory and metabolic conflict.",
    stats:
      "V0.6 compound conflict, 100 paired seeds: action switching 0.051 with the bottleneck vs 0.356 without it (difference −0.304 [−0.344, −0.266], dz −1.53, Holm p = 0.0025); goal coherence 0.915 vs 0.666 (+0.249 [0.229, 0.269], dz 2.53). The flat blackboard is statistically indistinguishable from the no-bottleneck ablation, and it forages more (41.51 vs 32.35 resources).",
    evidence:
      "V0.6 report §5.2; the effect is specific to the competition, not to the number of modules.",
    tone: "good",
  },
  {
    id: "fork",
    index: 7,
    title: "A probe is only worth paying for if the future self can use it",
    version: "v06",
    plain:
      "Under a pessimistic prior, stepping onto the feared terrain looks like a large immediate loss. The agent only pays it when its rollout simulates the belief change the probe would produce — the future uncertainty drop and the decisions that become available afterwards. A planner that simulates only physical state, at the same horizon and compute budget, does not.",
    stats:
      "V0.6 epistemic fork, 100 paired seeds: 94% of intact runs probe vs 1% without cognitive self-simulation (dz 3.63, p = 0.0020); 84% [77, 91] solve the fork vs 1%. Physical MPC probes 2% and solves 1%; the reactive control probes 4% and solves 4%. Removing HOT probes 100% and solves 90%, but the first probe is much later (182 vs 24 ticks). The full architecture is one point below the 85% target; the 95% CI includes it.",
    evidence:
      "V0.6 report §5.4. This is the clearest capability dissociation in the project.",
    tone: "good",
  },
  {
    id: "routing",
    index: 8,
    title: "Second-order monitoring protects the model it monitors",
    version: "v06",
    plain:
      "When a sensory channel starts lying, a first-order learner that keeps trusting it rewrites its body model around the lie. A higher-order monitor that attributes the discrepancy to the channel can turn down plasticity exactly where the corruption enters, while leaving the accurate modules free to learn.",
    stats:
      "V0.6 sensor-disruption suite, 100 seeds: the somatic learning gain during corruption is 0.774 [0.747, 0.799] with HOT and 1.00 without it; first-order energy MAE is lower with HOT. Attribution macro-F1 is 0.502 vs 0.000, with recall physical 0.90, energy 0.63, fatigue 0.63, shared 0.39. Shadow AUROC remains below 0.75 on every shift.",
    evidence:
      "V0.6 report §5.3. The monitor protects the model it monitors; attribution is weak for shared degradation (0.44) even though routing succeeds.",
    tone: "good",
  },
  {
    id: "rpt-load-bearing",
    index: 9,
    title: "Within-tick recurrence is what absorbs the lie",
    version: "v06",
    plain:
      "A single feedforward pass is deliberately soft under cross-channel conflict. Three recurrent passes let the workspace prior and the corroborating somatic channels re-weight the energy channel, so a one-tick spike is absorbed while sustained real change is still tracked.",
    stats:
      "V0.6 ambiguous-glitch suite, 100 seeds: absorption 0.814 [0.782, 0.842] with K=3 vs 0.290 [0.258, 0.324] with K=1 (+0.524 [0.482, 0.567], dz 2.38, Holm p = 0.0020); stationary MAE 1.431 vs 1.446 (full better by 0.015, dz −0.30, p = 0.0030). Against matched feedforward, full wins MAE (−0.022, dz −0.43, p = 0.0005) but not absorption (+0.014, p = 0.558).",
    evidence:
      "V0.6 report Table A. The earlier null result was caused by K=1 already receiving the hard outlier clamp; the revised soft K=1 pass removes that pre-emption.",
    tone: "good",
  },
];

export interface MatrixRow {
  metric: string;
  values: Record<VersionKey, Cell>;
}

export const MATRIX: MatrixRow[] = [
  {
    metric: "Priors",
    values: {
      v0: { text: "Designer-set", tone: "neutral" },
      v02: { text: "Randomized, uninformed", tone: "good" },
      v03: { text: "Uninformed / severe", tone: "good" },
      v04: { text: "Uninformed / severe", tone: "good" },
      v05: { text: "Uninformed / severe", tone: "good" },
      v06: { text: "Uninformed / severe", tone: "good" },
    },
  },
  {
    metric: "Stationary energy MAE (raw 1.92)",
    values: {
      v0: { text: "0.67 (frozen 0.64)", tone: "neutral", note: "hand-set priors" },
      v02: { text: "1.67", tone: "good" },
      v03: { text: "1.68", tone: "good" },
      v04: { text: "2.74", tone: "bad", note: "illusion cost" },
      v05: { text: "2.04", tone: "warn" },
      v06: { text: "1.431", tone: "good" },
    },
  },
  {
    metric: "Self-model value (Δ resources vs frozen/off)",
    values: {
      v0: { text: "−3.5 (n.s.)", tone: "bad" },
      v02: { text: "+10.0", tone: "good" },
      v03: { text: "+17.4", tone: "good" },
      v04: { text: "+14.7", tone: "good" },
      v05: { text: "+15.8", tone: "good" },
      v06: { text: "—", tone: "neutral", note: "not re-run" },
    },
  },
  {
    metric: "World-model value (Δ resources vs no-world)",
    values: {
      v0: { text: "+33.5", tone: "good" },
      v02: { text: "−8.11 (paradox)", tone: "bad" },
      v03: { text: "+7.64", tone: "good" },
      v04: { text: "−0.26 (n.s.)", tone: "bad" },
      v05: { text: "+4.72 (p = 0.027)", tone: "good" },
      v06: { text: "—", tone: "neutral", note: "not re-run" },
    },
  },
  {
    metric: "Meta rolling BSS",
    values: {
      v0: { text: "—", tone: "neutral" },
      v02: { text: "−0.12", tone: "bad" },
      v03: { text: "+0.016…+0.024", tone: "good" },
      v04: { text: "+0.018…+0.027", tone: "good" },
      v05: { text: "0.027", tone: "good" },
      v06: { text: "−0.003", tone: "bad", note: "rolling BSS" },
    },
  },
  {
    metric: "Latent failure AUROC",
    values: {
      v0: { text: "—", tone: "neutral" },
      v02: { text: "0.47", tone: "bad" },
      v03: { text: "0.679–0.797", tone: "good" },
      v04: { text: "0.680–0.813", tone: "good" },
      v05: { text: "0.683–0.810", tone: "good" },
      v06: { text: "0.43–0.59", tone: "bad" },
    },
  },
  {
    metric: "Meta-control Δ (meta-on − meta-off)",
    values: {
      v0: { text: "—", tone: "neutral" },
      v02: { text: "−6.84", tone: "bad" },
      v03: { text: "+12.3…+28.8", tone: "good" },
      v04: { text: "+15.4", tone: "good" },
      v05: { text: "+13.8…+28.4", tone: "good" },
      v06: { text: "—", tone: "neutral", note: "replaced by routing" },
    },
  },
  {
    metric: "4-way attribution macro-F1",
    values: {
      v0: { text: "—", tone: "neutral" },
      v02: { text: "0.25 (1/100 physical)", tone: "bad" },
      v03: { text: "0.604", tone: "good" },
      v04: { text: "0.515", tone: "bad" },
      v05: { text: "0.577", tone: "warn" },
      v06: { text: "0.502", tone: "warn" },
    },
  },
  {
    metric: "Trap escape (pragmatic / random / VoI)",
    values: {
      v0: { text: "—", tone: "neutral" },
      v02: { text: "0 / — / 0", tone: "bad" },
      v03: { text: "0 / 86 / 66", tone: "good" },
      v04: { text: "0 / 86 / 65", tone: "good" },
      v05: { text: "0 / 93 / 74 (100 seeds)", tone: "warn" },
      v06: { text: "fork 84% solved (94% probed)", tone: "warn" },
    },
  },
  {
    metric: "PP-1 pulse absorption",
    values: {
      v0: { text: "—", tone: "neutral" },
      v02: { text: "—", tone: "neutral" },
      v03: { text: "≈ 0", tone: "bad" },
      v04: { text: "0.830", tone: "good" },
      v05: { text: "0.79 (pilot)", tone: "warn" },
      v06: { text: "0.814", tone: "good" },
    },
  },
  {
    metric: "AST-1 post-glitch recovery (dz)",
    values: {
      v0: { text: "—", tone: "neutral" },
      v02: { text: "—", tone: "neutral" },
      v03: { text: "—", tone: "neutral" },
      v04: { text: "1.13 (p < 0.001)", tone: "good" },
      v05: { text: "direction preserved", tone: "warn" },
      v06: { text: "19 vs 256 ticks (dz −4.86)", tone: "good" },
    },
  },
];

export interface StatRow {
  label: string;
  value: string;
  note?: string;
  tone?: Tone;
}

export interface VersionDetail {
  key: VersionKey;
  name: string;
  tagline: string;
  hypothesis: string;
  changes: string[];
  equations: { label: string; body: string }[];
  flow: string[];
  stats: StatRow[];
  successes: string[];
  failures: string[];
  verdict: string;
  launchMode: string;
}

export const VERSIONS: VersionDetail[] = [
  {
    key: "v0",
    name: "V0.1 — the deterministic self-reference laboratory",
    tagline: "Does a self-model change behaviour at all?",
    flow: ["sensors", "self-model", "meta trust", "action"],
    hypothesis:
      "A minimal agent with a visible self-model and meta-model can be built deterministically, and switching either feedback edge should causally change estimates, decisions and survival.",
    changes: [
      "Three modes A/B/C with hand-set priors and switchable feedback edges.",
      "Deterministic seeded dynamics, micro-stepping and shadow probes.",
      "Energy, fatigue and a world model with online prediction errors.",
    ],
    equations: [
      { label: "Mode C trust update", body: "τ ← τ + α (r − τ),  r = 1[|error| ≤ tol]" },
      { label: "Decision utility", body: "U(a) = w_E ΔÊ(a) − w_F ΔF̂(a) + w_C p̂_collect(a)" },
      { label: "Feedback edge", body: "self-model output → action only if the edge is enabled" },
    ],
    stats: [
      { label: "Resources (learned self)", value: "61.0" },
      { label: "Resources (frozen self)", value: "64.6", note: "p = 0.057", tone: "bad" },
      { label: "Resources (learned world)", value: "61.7" },
      { label: "Resources (no world)", value: "28.2", note: "p < 0.001", tone: "bad" },
      { label: "Self-state accuracy (frozen)", value: "0.09", tone: "bad" },
    ],
    successes: [
      "Deterministic, inspectable feedback loops with causal ablations.",
      "World learning clearly improves foraging (61.7 vs 28.2).",
    ],
    failures: [
      "Self-modeling was behaviourally inert in the benign world: frozen-self 64.6 vs learned 61.0 (p = 0.057).",
      "Frozen-world (76.6) beat learned-world (62.9) — hand priors were good enough.",
      "Hand-set priors meant the result said more about the designer than the agent.",
    ],
    verdict: "A clean instrument, but not yet evidence for self-modeling. The next step had to remove designer priors and add cliffs.",
    launchMode: "A/B/C modes, self and world toggles",
  },
  {
    key: "v02",
    name: "V0.2 — uninformed priors, hard regimes and learned meta-cognition",
    tagline: "Does self-modeling pay when priors are removed and the world bites?",
    flow: ["random priors", "adaptive filter", "learned meta", "VoI action"],
    hypothesis:
      "With randomized uninformed priors and a metabolic cliff, a learned self-model should beat a frozen one, and a learned meta-model should calibrate its own reliability.",
    changes: [
      "Randomized prior regimes (uninformed and severe); no designer-tuned constants.",
      "Multi-channel sensing (energy, strain, effort) and regime shifts.",
      "Learned meta-model with trust, uncertainty and calibration bins.",
      "Epistemic exploration (VoI) and isolated shadow probes.",
    ],
    equations: [
      { label: "Adaptive state filter", body: "x̂ ← x̂ + K (y − x̂),  K adaptive on innovation and prior weight" },
      { label: "Meta trust", body: "p(tol) ← σ(w · φ(context)),  φ = recent error, bias, volatility" },
      { label: "VoI utility", body: "U(a) = pragmatic(a) + λ · uncertainty(a)" },
    ],
    stats: [
      { label: "Resources", value: "32.4", tone: "good" },
      { label: "Energy MAE", value: "1.67", note: "raw 1.92", tone: "good" },
      { label: "Frozen-self resources", value: "22.4", note: "+25.83 [21.86, 29.84]", tone: "good" },
      { label: "Meta Brier / BSS", value: "0.199 / +0.133" },
      { label: "Rolling BSS", value: "−0.12", tone: "bad" },
      { label: "Latent AUROC", value: "0.47", tone: "bad" },
      { label: "Meta-on vs off", value: "−6.84", tone: "bad" },
      { label: "Attribution physical / energy / fatigue / shared", value: "1 / 0 / 86 / 0 per 100", tone: "bad" },
    ],
    successes: [
      "Uninformed priors learn effectively; self-modeling now beats frozen by 10 resources.",
      "Calibration against a constant baseline is strong (ECE 0.041, BSS +0.133).",
      "Shadow-probe isolation validates counterfactual measurement.",
    ],
    failures: [
      "Lost to a 1-parameter rolling baseline (BSS −0.12); latent AUROC 0.47.",
      "Meta-feedback hurt foraging and energy (−6.84, −8.98).",
      "Pessimistic traps dissolved for the wrong reason: moving anywhere supplied corrective evidence.",
      "Single-step attribution collapsed to fatigue-sensor (86/100).",
      "Neutral no-world out-foraged the learned world.",
    ],
    verdict: "Five negative results defined the V0.3 agenda: residual meta-modeling, risk-sensitive control, decoupled traps, temporal attribution, and skill-gated world models.",
    launchMode: "uninformed priors · VoI · regime shifts",
  },
  {
    key: "v03",
    name: "V0.3 — the second-order loop",
    tagline: "Can the meta-model beat its own baseline and make control better?",
    flow: ["residual meta", "risk control", "MOVE/REST attribution", "skill-gated world"],
    hypothesis:
      "A residual meta-model with a rolling floor, risk-sensitive control, action-conditioned attribution and a decoupled epistemic trap can resolve all five V0.2 failures at once.",
    changes: [
      "Residual meta-model: rolling base + shrunk contextual residual + persistent-failure head.",
      "Risk-sensitive control: bias correction, pessimistic cliff bound, attribution-routed plasticity.",
      "MOVE/REST temporal attribution with excess-over-baseline features.",
      "Rough-terrain metabolism as a context-decoupled trap; decision VoI with stake scaling.",
      "Skill-gated world-model integration (√skill blend).",
    ],
    equations: [
      { label: "Residual meta", body: "p = p_base + w · (p_ctx − p_base),  w ← hedge on squared loss" },
      { label: "Risk-sensitive value", body: "ŷ* = ŷ + b̂ − k·ê (near cliff);  ŷ + b̂ + 0.1·ê otherwise" },
      { label: "VoI stake", body: "info = uncertainty · (0.5 + max(0, −ŷ)·value)" },
      { label: "World blend", body: "p_eff = p_neutral + √skill · (p_learned − p_neutral)" },
    ],
    stats: [
      { label: "Resources", value: "42.1", note: "V0.2: 32.4", tone: "good" },
      { label: "Energy MAE", value: "1.68" },
      { label: "Rolling BSS", value: "+0.016…+0.024", note: "p < 0.001", tone: "good" },
      { label: "Latent AUROC", value: "0.679–0.797", tone: "good" },
      { label: "Meta-on vs off", value: "+12.3…+28.8", note: "p < 0.001", tone: "good" },
      { label: "Attribution macro-F1", value: "0.604", tone: "warn" },
      { label: "Trap escape", value: "66/100", note: "65.1 resources, 0 deaths", tone: "good" },
      { label: "Learned world − neutral", value: "+7.64", note: "p < 0.001", tone: "good" },
      { label: "PP-1 absorption", value: "≈ 0", tone: "bad" },
    ],
    successes: [
      "All five V0.2 negative results were reversed or substantially improved.",
      "Meta-control became strongly beneficial in every regime.",
      "Decoupled trap made epistemic probing necessary and effective.",
    ],
    failures: [
      "No top-down illusion: the filter followed the sensor.",
      "Attribution still confused physical and fatigue shifts (63/100 each).",
      "Breaking L1 raised trap escape — self-reference is what creates the vulnerability.",
      "Frozen world became identical to no-world under skill gating.",
    ],
    verdict: "The strongest overall version. It set the Pareto frontier that V0.4 and V0.5 would trade against.",
    launchMode: "standard · VoI · trap and shift controls",
  },
  {
    key: "v04",
    name: "V0.4 — precision-gated illusions and the attention schema",
    tagline: "Can the agent model its own precision allocation?",
    flow: ["precision gating", "AST-1 schema", "preparation", "action"],
    hypothesis:
      "Inverse-weighting sensory precision by cross-channel disagreement produces top-down absorption of single-channel glitches, and an attention schema that models its own precision state can release perseveration after the glitch ends.",
    changes: [
      "Precision-weighted predictive coding: K = π_sensor/(π_prior + π_sensor).",
      "Slow sensor-distrust state and AST-1 recovery release.",
      "Multi-step directional meta target (signed persistent bias).",
      "Epistemic preparation (rest-to-probe) and strain-to-outcome consistency.",
    ],
    equations: [
      { label: "Precision gain", body: "K = π_s / (π_p + π_s)" },
      { label: "Prior precision", body: "π_p ∝ e^(−1.6·p_fail) · e^(−2.6·disagreement_ema) · familiarity" },
      { label: "Sensor precision", body: "π_s ∝ e^(−4·instant_disagreement) · (1 + 3.2·recovery)" },
      { label: "Absorption", body: "A = 1 − |x̂_post(δ) − x̂_post(0)| / |δ|" },
    ],
    stats: [
      { label: "PP-1 1-tick absorption", value: "0.830 [0.811, 0.848]", tone: "good" },
      { label: "Sustained-shift residual absorption", value: "0.371" },
      { label: "Stationary MAE", value: "2.74", note: "raw 1.92", tone: "bad" },
      { label: "Attribution macro-F1", value: "0.515", tone: "bad" },
      { label: "AST recovery gain", value: "0.237 vs 0.181", note: "dz 1.13, p < 0.001", tone: "good" },
      { label: "Post-glitch MAE", value: "3.54 vs 4.11", tone: "good" },
      { label: "Trap escape", value: "65/100", tone: "warn" },
      { label: "Learned world − neutral", value: "−0.26 (n.s.)", tone: "bad" },
      { label: "Meta-on vs off", value: "+15.4", note: "p < 0.001", tone: "good" },
    ],
    successes: [
      "First causal demonstration of the PP-1 illusion in the project.",
      "AST-1 ablation is clean and statistically strong.",
      "Meta-control and failure AUROC preserved.",
    ],
    failures: [
      "Illusion cost tracking: MAE 2.74, worse than raw sensing.",
      "Attribution lost diagnostic signal (0.515) because innovations were absorbed.",
      "Preparation helped only 1/100 seeds because resting plateaued below the false prior's demand.",
      "Learned-world advantage disappeared.",
    ],
    verdict: "Two theoretical milestones bought at a measured cost. The cost defined the V0.5 unification target.",
    launchMode: "standard · PP-1 pulse · AST toggle",
  },
  {
    key: "v05",
    name: "V0.5 — the unification attempt",
    tagline: "Can absorption, tracking, attribution, probing and world value coexist?",
    flow: ["selective gating", "pre-attribution", "plateau probe", "action"],
    hypothesis:
      "Selective transient gating, pre-absorption attribution, evidence-discounted safety and a fatigue-conditional failure regime can recover V0.3's accuracy while keeping V0.4's capabilities.",
    changes: [
      "Suppression engages only on a genuine single-channel outlier (|innovation| > max(5, 2σ)).",
      "Attribution reads pre-absorption innovations with strain-to-outcome consistency.",
      "Evidence-discounted probe gate plus rest-plateau release.",
      "Unverified-context VoI boost (×2.2).",
      "Fatigue-conditional misspecification scenario (cost surge only above fatigue 0.55).",
    ],
    equations: [
      { label: "Selective gain", body: "K = K_adaptive · suppression,  suppression = 1 unless outlier" },
      { label: "Discounted probe gate", body: "E + max(ŷ_rough, −5) ≥ floor,  floor = 6 (or 4 after plateau)" },
      { label: "Conditional cost", body: "c(a) = c₀(a) · 3.0 if fatigue > 0.55 (post-shift)" },
    ],
    stats: [
      { label: "Stationary MAE", value: "2.04", note: "raw 1.92", tone: "warn" },
      { label: "PP-1 absorption", value: "0.79 (pilot)", tone: "warn" },
      { label: "Attribution macro-F1", value: "0.577", tone: "warn" },
      { label: "Trap escape", value: "74/100 (74%)", note: "78.1 resources, 0 deaths", tone: "good" },
      { label: "Meta-on vs off", value: "+13.8…+28.4", note: "p ≤ 0.001", tone: "good" },
      { label: "Learned world − neutral", value: "+4.72 (p = 0.027)", tone: "good" },
      { label: "Rolling BSS / AUROC", value: "0.027 / 0.683–0.810", tone: "good" },
    ],
    successes: [
      "Recovered most of V0.3's tracking, attribution and trap resources.",
      "Preserved meta-control and the failure-head metrics.",
      "Explicitly demonstrated the three-way trade-off rather than hiding it.",
    ],
    failures: [
      "No simultaneous Pareto improvement: absorption, MAE and attribution remain coupled.",
      "Contextual meta transfer did not appear in the conditional regime.",
      "Learned-world advantage recovered to +4.72 resources (p = 0.027), still far below V0.3.",
      "Trap escape reached 74/100, not the 90% target.",
    ],
    verdict: "The honest endpoint: the architecture is unified in code, but the measured objectives are not jointly maximisable with one precision gain.",
    launchMode: "standard · selective gating · conditional regime",
  },
  {
    key: "v06",
    name: "V0.6 — the unified cognitive architecture",
    tagline: "Are the self-referential mechanisms causally necessary for cognition?",
    flow: ["4 modules", "GWT ignition", "broadcast", "HOT", "AE-2 rollout", "action"],
    hypothesis:
      "A capacity-limited workspace, global broadcast, higher-order monitoring, an attention schema and bounded recursive self-simulation each carry a cognitive capability that survives ablation and matched-compute adversarial controls.",
    changes: [
      "Four specialist modules (world, somatic, meta-attribution, epistemic) with independent salience.",
      "Capacity-limited winner-take-all ignition and a global broadcast back to perception and learning.",
      "Three sequential query passes and a four-step cognitive rollout that predicts future belief and mode.",
      "HOT-1…4: reliability, off-policy shadow calibration, four-way attribution, 3D quality space.",
      "AST-1 precision allocation, selective plasticity routing, and four adversarial controls.",
    ],
    equations: [
      { label: "Workspace ignition", body: "w_m ∝ softmax(salience_m),  frame = argmax(salience + hysteresis)" },
      { label: "Broadcast", body: "u(a) ← Σ_m w_m u_m(a) + 1.25·[a = action(frame)]" },
      { label: "Cognitive rollout", body: "V = Σ_k γ^k [physical_k + 2·stake·Δu_k·(H−k)]" },
      { label: "Quality space", body: "q = (viability, certainty, coherence), smoothed at 0.72" },
    ],
    stats: [
      { label: "Fork probe (full / no-AE)", value: "94% / 1%", note: "dz 3.63, p = 0.0020", tone: "good" },
      { label: "Fork solved", value: "84% [77, 91]", note: "MPC 1%, reactive 4%", tone: "good" },
      { label: "Conflict thrash (full / no-bottleneck)", value: "0.051 / 0.356", note: "dz -1.53", tone: "good" },
      { label: "Goal coherence", value: "0.915 vs 0.666", tone: "good" },
      { label: "Post-conflict recovery", value: "19 vs 256 ticks", note: "dz -4.86", tone: "good" },
      { label: "4-way attribution macro-F1", value: "0.502", note: "no-HOT 0.000; shared 0.39", tone: "warn" },
      { label: "Somatic routing during sensor fault", value: "0.774 [0.747, 0.799]", note: "no-HOT 1.00", tone: "good" },
      { label: "Reliability AUROC (energy / shared)", value: "0.59 / 0.58", note: "target 0.75 - fail", tone: "bad" },
      { label: "PP-1 absorption (RPT / no-RPT)", value: "0.814 / 0.290", note: "p = 0.0020", tone: "good" },
      { label: "Stationary MAE", value: "1.431", note: "feedforward 1.453", tone: "good" },
    ],
    successes: [
      "Capacity competition, broadcast, HOT, AST and AE-2 each show a double dissociation.",
      "The epistemic fork is solved by cognitive self-simulation but not by physical MPC.",
      "HOT routing preserves first-order accuracy under sensor corruption.",
      "RPT is load-bearing: K=3 absorption 0.814 vs 0.290 at K=1.",
      "The epistemic fork is solved on 84% of runs vs 1% without AE-2.",
    ],
    failures: [
      "HOT-2 shadow AUROC remains below 0.75 on every shift (self 0.46, energy 0.59, fatigue 0.43, shared 0.58).",
      "4-way attribution macro-F1 is 0.502; shared recall is 0.39.",
      "The fork solve rate is 84%, one point below the 85% target.",
      "AST recovery gain is 0.036, below the +0.04 target, although recovery latency is 19 vs 256 ticks.",
      "Flat and reactive controls out-forage the architecture in standard shift, conflict and Gen3.",
    ],
    verdict:
      "A genuine double dissociation with one residual bottleneck: workspace competition, broadcast, recurrence, AST and cognitive rollout are load-bearing; HOT calibration and shared attribution are not yet at target, and the architecture remains a stronger instrument than a forager.",
    launchMode: "four modules · workspace · HOT · cognitive rollout",
  },
];

export interface FrameworkRow {
  framework: string;
  indicator: string;
  mechanism: string;
  evidence: string;
  tone: Tone;
}

export const FRAMEWORKS: FrameworkRow[] = [
  {
    framework: "Hofstadter (GEB)",
    indicator: "Strange loop: M₁ → action → evidence → M₁ ↔ M₂",
    mechanism:
      "First-order self-model feeds action selection; the meta-model reads its errors and feeds back bias, precision and plasticity.",
    evidence:
      "Five-link ablation: L2 (action→evidence) killed survival (0–1%), L3 froze the self-model at 29 MAE, L5 removed trap escape entirely, L1 and L4 cost resources under shifts.",
    tone: "good",
  },
  {
    framework: "Predictive processing",
    indicator: "PP-1: precision-weighted priors vs sensory error",
    mechanism:
      "Posterior gain is a precision ratio; a single-channel outlier collapses sensor precision while sustained cross-channel disagreement erodes prior precision.",
    evidence:
      "1-tick absorption 0.830 in V0.4 (gain 0.20) with sustained-shift residual absorption 0.371. V0.5 keeps absorption 0.79 at lower tracking cost.",
    tone: "good",
  },
  {
    framework: "Higher-order theories",
    indicator: "HOT-2 / HOT-3: second-order reliability monitoring",
    mechanism:
      "Persistent-failure head and risk-sensitive control estimate whether the first-order model is reliable now, and condition action on that estimate.",
    evidence:
      "Residual meta BSS +0.016…+0.027 and latent AUROC 0.679–0.810; meta-on beats meta-off by +12.3…+28.4 resources (p < 0.001).",
    tone: "good",
  },
  {
    framework: "Agency & embodiment",
    indicator: "AE-1 / AE-2: action-conditioned contingency and cliff management",
    mechanism:
      "MOVE vs REST contrasts isolate causes; metabolic cliffs make prediction errors lethal, which is what gives self-modeling its value.",
    evidence:
      "V0.1 frozen-self ≈ learned in a benign world; V0.2 harsh +25.8 resources with learning. Attribution from 1/100 to 0.604 macro-F1.",
    tone: "good",
  },
  {
    framework: "Attention schema theory",
    indicator: "AST-1: modelling one's own precision allocation",
    mechanism:
      "A predictor of the agent's precision weights classifies attentional mode and releases prior suppression when perseveration is detected.",
    evidence:
      "Post-glitch recovery 0.237 vs 0.181, dz 1.13, p < 0.001; MAE 3.54 vs 4.11.",
    tone: "good",
  },
  {
    framework: "Methodological guardrails",
    indicator: "Minimal implementation, shadow probes, Goodhart checks",
    mechanism:
      "Every mechanism calls the same function the UI uses; counterfactual shadow probes are isolated from agent state; meta gains are tested on unoptimised system outcomes.",
    evidence:
      "Shadow probes leave physical/self/meta state untouched; Goodhart check found no transfer from local meta loss to resources (Δ −0.84, p = 1.0), reported as a negative result.",
    tone: "warn",
  },
];

export interface LoopLink {
  id: string;
  label: string;
  mechanism: string;
  breakEffect: string;
}

export const LOOP_LINKS: LoopLink[] = [
  {
    id: "L1",
    label: "M₁ → action",
    mechanism: "Self-prediction enters selection with a risk-sensitive value.",
    breakEffect: "Trap escape rises (86–91%), but shift resources fall by ~11–12: the trap exists because the self-model is believed.",
  },
  {
    id: "L2",
    label: "action → evidence",
    mechanism: "Acting produces proprioceptive evidence (energy, strain, effort).",
    breakEffect: "Survival collapses to 0–1%; the agent cannot learn or correct.",
  },
  {
    id: "L3",
    label: "evidence → M₁",
    mechanism: "Outcome errors update the first-order self-model.",
    breakEffect: "Self-model freezes at ~29 MAE; trap escape falls to 0%.",
  },
  {
    id: "L4",
    label: "M₁ → M₂",
    mechanism: "The meta-model trains on the self-model's persistent errors.",
    breakEffect: "Trap escape falls to ~61% and resources drop by ~20; second-order learning is lost.",
  },
  {
    id: "L5",
    label: "M₂ → control",
    mechanism: "Meta bias, uncertainty and precision modulate action and learning.",
    breakEffect: "Trap escape falls to 0%; probing is no longer worth it.",
  },
];

export interface Guardrail {
  title: string;
  body: string;
}

export const GUARDRAILS: Guardrail[] = [
  {
    title: "Escape the minimal-implementation trap",
    body: "Each version adds exactly one causal mechanism and keeps every prior switchable. No mechanism is credited unless its ablation changes behaviour.",
  },
  {
    title: "Counterfactual shadow-probe isolation",
    body: "Forced-action probes clone the world and physical state and never touch agent memory, self-model, meta-model or world model. Determinism is verified by replaying identical seeds.",
  },
  {
    title: "Goodhart transfer checks",
    body: "Local meta losses are compared against unoptimised system outcomes (survival, resources, post-shift MAE). A calibration gain with no behavioural transfer is reported as a negative result, not a success.",
  },
  {
    title: "No consciousness claims",
    body: "Self-model, meta-model and attention schema are predictors and controllers. Every measurement is behavioural or statistical; nothing here is evidence of subjective experience.",
  },
];
