import type { VersionId } from "../lib/router";

export interface LabVersion {
  id: VersionId;
  label: string;
  name: string;
  short: string;
  era: string;
  milestone: string;
  guide: string;
  tryThis: string[];
  findingsAnchor: string;
  color: string;
}

export const LAB_VERSIONS: LabVersion[] = [
  {
    id: "v0",
    label: "V0.1",
    name: "Baseline Control Loop",
    short: "Informed priors, docile world",
    era: "first-order self-modelling",
    milestone:
      "The instrument itself: a deterministic agent with a visible first-order self-model and a switchable second-order reliability loop. With hand-set priors and a forgiving world, freezing the self-model barely changes survival — the result that forced every later version.",
    guide:
      "Press Run or Step to advance the tick loop. Switch between conditions A, B and C on the control deck, then toggle the Self and Meta feedback edges. Open Compare to run A/B/C on the same seed. Watch whether freezing the self-model changes how much the agent forages.",
    tryThis: [
      "Run the default seed, then pause and toggle Self off.",
      "Switch to condition C and toggle Meta while the run continues.",
      "Open Compare all conditions on one seed.",
    ],
    findingsAnchor: "v0",
    color: "#b23f24",
  },
  {
    id: "v02",
    label: "V0.2",
    name: "Uninformed Priors & Metabolic Cliffs",
    short: "Random priors · multi-channel sensing",
    era: "learned meta-cognition",
    milestone:
      "Designer priors were removed and a metabolic cliff was added, so self-knowledge became a matter of survival. Multi-channel sensing and a learned meta-model let the agent estimate its own energy better than the raw sensor — but raw self-doubt still made control worse.",
    guide:
      "Start with Uninformed priors and Harsh difficulty, then inject the rough-cost trap or a one-tick interoceptive pulse. Watch the meta trust ring and the energy/raw-sensor traces. Turn Meta feedback off to reproduce the V0.2 deficit, and change the dynamics scenario to force a regime shift.",
    tryThis: [
      "Set difficulty to Harsh and compare learned vs frozen self-model.",
      "Inject the pessimistic rough-cost trap and watch escape fail.",
      "Toggle Meta feedback off and compare resources.",
    ],
    findingsAnchor: "v02",
    color: "#634070",
  },
  {
    id: "v03",
    label: "V0.3",
    name: "Residual Meta-Model & Trap Escape",
    short: "Risk-sensitive control · epistemic escape",
    era: "the second-order loop closes",
    milestone:
      "The residual meta-model beats its own rolling baseline, risk-sensitive caution turns self-doubt into survival, and action-conditioned attribution separates a sick body from lying senses. The decoupled trap shows that only a causal self-model can trap itself in a phobia — and a second-order probe can release it safely.",
    guide:
      "Use Decision-value of information as the exploration mode and inject the pessimistic rough-cost trap: pragmatic control never probes, while VoI eventually steps onto the rough terrain. Toggle the L1 (self→action) and L3 (evidence→self) links to see the weakness and the cure. Trigger a physical shift or sensor fault to test the four-way attribution.",
    tryThis: [
      "Inject the rough-cost trap with pragmatic exploration, then switch to VoI.",
      "Toggle L1 off: the phobia disappears but shift performance falls.",
      "Trigger a physical shift and a sensor fault; compare attribution.",
    ],
    findingsAnchor: "v03",
    color: "#26467e",
  },
  {
    id: "v04",
    label: "V0.4",
    name: "Precision Predictive Coding & Attention Schema",
    short: "PP-1 pulse · AST-1 schema",
    era: "precision, illusions and attention",
    milestone:
      "Precision-weighted predictive coding (PP-1) lets a confident prior absorb a one-tick sensory lie, and the attention schema (AST-1) releases the perseveration that follows. Both work — and both cost stationary tracking and diagnostic accuracy.",
    guide:
      "Inject a 1-tick interoceptive pulse and watch the PP-1 probe: absorption rises while stationary energy error gets worse. Toggle AST-1 under the attention-schema panel to see post-glitch recovery. Keep an eye on attribution macro-F1 as you change the precision gate.",
    tryThis: [
      "Inject a PP-1 pulse and measure pulse-tick absorption.",
      "Toggle AST-1 off and compare post-glitch recovery.",
      "Switch to a sustained physical shift: absorption should not save you.",
    ],
    findingsAnchor: "v04",
    color: "#1d5c67",
  },
  {
    id: "v05",
    label: "V0.5",
    name: "Unified Architecture & Plateau-Breaking VoI",
    short: "Selective gating · conditional shifts",
    era: "the unification attempt",
    milestone:
      "Selective transient gating, pre-absorption attribution, evidence-discounted safety and a rest-plateau probe are combined in one architecture. Tracking and trap resources recover, but absorption, accuracy and diagnosis remain coupled: no single gain maximises all three.",
    guide:
      "Inject the rough-cost trap and let the agent rest: the V0.5 probe lowers its safety floor after a plateau, then spends one diagnostic step and escapes. Select the Fatigue-conditional cost surge scenario to see the self-model reliable at low fatigue and wrong at high fatigue. Use the PP-1 pulse and AST-1 toggles to reproduce the remaining trade-off.",
    tryThis: [
      "Inject the trap, leave VoI on, and let the agent rest to a plateau.",
      "Run the fatigue-conditional cost-surge scenario and watch state-dependent error.",
      "Toggle selective gating or AST-1 and compare tracking, attribution and escape.",
    ],
    findingsAnchor: "v05",
    color: "#39643f",
  },
  {
    id: "v06",
    label: "V0.6",
    name: "Unified Cognitive Architecture",
    short: "Four modules · workspace · recursive self-simulation",
    era: "indicator properties under adversarial control",
    milestone:
      "Four specialist modules compete for a capacity-limited workspace; the ignited frame is broadcast back to perception, learning and the other modules, and a bounded rollout simulates the agent's own future beliefs. The result is a double dissociation: removing the bottleneck produces policy thrashing, removing broadcast degrades binding, removing HOT collapses attribution and plasticity routing, removing the attention schema abolishes post-conflict recovery, and removing cognitive self-simulation makes the epistemic fork unsolvable — while RPT itself adds nothing to single-tick absorption.",
    guide:
      "Start on Compound conflict and watch the four modules compete. Step one phase at a time: propose, ignite, query. Compare the intact run with No-GWT bottleneck and Flat blackboard (thrashing), No-AST (no recovery), and No cognitive self-simulation (no fork probe). Switch to Self-model / sensor disruption and read the four-way attribution and the somatic learning gain. The Quality space panel is the integrated HOT-4 state; the Recursive rollout panel shows the imagined future mode transitions.",
    tryThis: [
      "Run Compound conflict intact, then switch to No-GWT bottleneck and compare thrash.",
      "Inject an energy-channel disruption and watch attribution and the somatic learning gain.",
      "Switch to Epistemic fork with No cognitive self-simulation: the probe disappears.",
    ],
    findingsAnchor: "v06-indicators",
    color: "#1d5c67",
  },
];

export const labVersion = (id: VersionId) =>
  LAB_VERSIONS.find((version) => version.id === id) ?? LAB_VERSIONS[4];
