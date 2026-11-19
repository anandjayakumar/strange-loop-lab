export const BEGINNER_GUIDE = `*A beginner's guide to the Strange Loop Lab research*

## 1. The big question

Imagine building a small digital organism.

It has a body with energy, fatigue and movement costs. It can move around, find food, rest and even die.

It also has sensors that tell it how its body is doing. But these sensors aren't perfect. Sometimes their readings are noisy or misleading.

So the organism builds a model of itself.

Then it builds something more interesting: **a second model that monitors how reliable the first one is.**

Now consider two questions:

- What happens when an organism uses its understanding of itself to make decisions?
- What happens when that understanding is wrong?

This is the central question behind Strange Loop Lab.

The inspiration comes from Douglas Hofstadter's idea of *strange loops*: systems that develop representations of the very processes that produce them.

We wanted to take this idea beyond philosophy and build something we could actually experiment with.

Not to prove that we had created consciousness, but to investigate whether self-referential mechanisms produce measurable capabilities.

## 2. Meet the digital organism

The organism lives in a 30 × 30 grid.

It can:
- Move around and find food.
- Consume energy while moving.
- Become fatigued.
- Rest to recover.
- Die when its energy runs out.

But there's a catch.

**It cannot directly observe its own physical state.**

Instead, it receives four imperfect signals:

| Signal | What it tells the organism |
|---|---|
| Energy | How much energy it has left |
| Strain | How fatigued it is |
| Effort | How costly its last movement was |
| Slip | How difficult the terrain is |

It must learn to understand these signals and build an internal picture of its own body.

We call this its first-order model, or M1.

Then comes the second layer.

**M1 — The self-model:** What's happening inside me?

**M2 — The meta-model:** How much should I trust my understanding of what's happening inside me?

The interesting part is how these models interact.

M1 influences the organism's actions. Those actions generate new evidence. The evidence updates M1, while M2 monitors M1 and influences how it is used.

The system is no longer just modelling the world. It is modelling part of the process through which it understands and acts on the world.

That's the strange loop we're studying.

## 3. Six generations of experiments

We developed six generations of architectures. Each generation explored a new capability or addressed a problem discovered in an earlier version.

### V0.1 — Does a self-model actually matter?

Our first experiment produced a surprising result.

Even when its self-model was almost completely inaccurate, the organism survived 99 out of 100 runs in a forgiving environment.

It performed comparably to the organism with a learned self-model.

**What we learned:** Having a model of yourself isn't automatically useful. It matters when being wrong has consequences.

### V0.2 — What if the organism starts doubting itself?

We introduced M2, a model that monitors the reliability of M1.

But the first implementation made things worse.

When M2 became uncertain about M1's energy estimates, it reduced the influence of M1's warnings. The organism became less cautious about running out of energy.

Performance dropped by 6.84 resources.

**What we learned:** Monitoring your own thinking can be harmful if you act on uncertainty in the wrong way.

### V0.3 — Learning when to be cautious

We changed how the organism used uncertainty.

Instead of doubting everything equally, it became more cautious when approaching a dangerous energy limit.

In the standard experiment, the complete second-order feedback loop improved resources by 16.26 compared with the version without that feedback.

**What we learned:** It's not enough to recognise uncertainty. A system needs a useful way to respond to it.

### V0.4 — Modelling attention and internal signals

Next, the organism began modelling how much it trusted its individual sensors.

It could reduce the influence of a suspicious signal rather than immediately accepting it.

This made it much better at absorbing certain misleading signals, but it also made its internal tracking and error identification less accurate.

**What we learned:** Improving one capability can come at the cost of another.

### V0.5 — Escaping a trap created by its own beliefs

We introduced a mechanism that allows the organism to deliberately investigate beliefs it might be wrong about.

Instead of simply avoiding something it considers dangerous, it can decide that testing the belief may be worth the risk.

In the central experiment, this strategy escaped the epistemic trap in 74 out of 100 runs, with zero deaths.

**What we learned:** Sometimes a system needs to actively seek evidence that contradicts its own beliefs.

### V0.6 — Bringing the mechanisms together

Finally, we combined the mechanisms into a more integrated architecture.

It includes recurrent processing, a shared information workspace, higher-order monitoring, an attention schema, predictive processing and mechanisms for agency and embodiment.

We then removed individual components to see which capabilities were affected.

Different removals disrupted different functions, including information integration, conflict resolution, sensor attribution and recovery after internal conflicts.

**What we learned:** These mechanisms can produce distinguishable computational capabilities. But combining them doesn't automatically make the system better at everything.

## 4. The most important experiment: the epistemic trap

This is perhaps the most intuitive way to understand the entire research project.

Imagine the organism believes that rough terrain costs 25 energy per step.

In reality, it costs only 2.2.

There is food on the rough terrain, but the organism believes going there is too dangerous.

What happens?

1. It avoids the rough terrain.
2. It never discovers the food.
3. It never measures the actual movement cost.
4. Its incorrect belief is never corrected.
5. It eventually runs out of energy.

The organism's own model is preventing it from discovering that the model is wrong.

This is what we call a **self-confirming epistemic trap**.

We tested different ways of escaping it:

| Strategy | Escape rate | Resources |
|---|---:|---:|
| Ordinary decision-making | 0% | 0.0 |
| Random exploration | 93% | 44.1 |
| V0.3 decision-based probing | 66% | 65.1 |
| V0.5 plateau-based probing | 74% | 78.1 |

Random exploration escaped more often, but it was costly and included a death.

V0.5 escaped less often, but achieved substantially more resources, with zero deaths.

**The deeper idea:** An intelligent system may sometimes need to question not just what it believes, but whether its own behaviour is preventing it from finding out the truth.

## 5. What does the final architecture demonstrate?

V0.6 asks a different question.

If the organism has all these mechanisms, are they actually doing useful work?

To investigate, we systematically removed components and measured what changed. This is called *ablation testing*.

The results showed distinct functional contributions:

| Mechanism removed | Capability affected |
|---|---|
| Recurrent processing | Absorbing ambiguous information |
| Workspace bottleneck | Resolving competing information |
| Higher-order monitoring | Identifying faulty sensors |
| Attention schema | Recovering after internal conflicts |
| Agency-related mechanisms | Solving epistemic decision tasks |

One particularly interesting experiment involved an epistemic fork: a situation where the organism had to decide whether investigating its own uncertainty was worth the immediate cost.

The full V0.6 architecture solved 84% of these forks.

Here is how it compared with other architectures:

| Architecture | Forks solved |
|---|---:|
| **V0.6** | **84%** |
| Flat blackboard | 73% |
| Matched feedforward | 31% |
| Reactive reflex | 4% |
| Physical MPC planner | 1% |

The physical planner is especially interesting. Despite having the same planning horizon and action space, it rarely chose to investigate the epistemic problem.

This suggests that modelling possible future cognitive states contributes something beyond ordinary physical planning.

But V0.6 is not universally superior. The flat blackboard and reactive architectures outperform it in some foraging environments.

It has a different set of capabilities, not an across-the-board performance advantage.

## 6. What did we actually establish?

After six generations and thousands of experimental runs, the research points to several findings:

**1. Self-models are not automatically useful.**

Their value depends on whether errors in the model have meaningful consequences.

**2. Self-models can create new vulnerabilities.**

A system can become trapped by its own beliefs, especially when those beliefs influence which evidence it chooses to collect.

**3. Monitoring yourself is not the same as understanding yourself.**

A second-order model can make decisions worse if it uses uncertainty incorrectly.

**4. Different mechanisms can produce different functional capabilities.**

Removing individual mechanisms disrupts specific behaviours, suggesting that the architecture is doing more than simply accumulating complexity.

**5. There are real trade-offs.**

The final architecture performs well on some tasks but has weaknesses in sensor attribution, reliability estimation and foraging performance.

The research also has important limitations:
- The environment is small, deterministic and non-neural.
- Sensor attribution remains imperfect, with a macro-F1 score of 0.502.
- Shadow reliability AUROC remains below 0.75.
- Some experiments use smaller samples: 20 seeds for the V0.5 absorption pilot and 40 paired runs for the V0.4 attention-schema recovery experiment.
- The integrated architecture does not outperform simpler controls on every task.

The main protocol contains 28,100 runs, with 800 additional corruption probes. A separate 8,700-episode V0.6 holdout reproduces the main full-architecture results without parameter retuning.

And one distinction matters more than anything else:

**This research does not demonstrate consciousness, sentience or subjective experience.**

It demonstrates measurable computational behaviours associated with mechanisms discussed in some theories of consciousness. These are functional results, not evidence that the organism has an inner experience.

---

# The entire paper in one mental model

Think of the research as a story:

1. An organism builds a model of itself.
2. It learns to monitor that model.
3. Its understanding begins influencing its behaviour.
4. Its own beliefs can prevent it from discovering the truth.
5. It develops ways to question those beliefs.
6. Multiple mechanisms combine to produce distinct, measurable capabilities — along with new limitations.

**The central idea: A system that models itself can gain new capabilities, but it can also become trapped by its own understanding. Escaping that trap may require the system to model not just itself, but how it arrives at its understanding in the first place.**

That's what makes a strange loop worth studying.`;
