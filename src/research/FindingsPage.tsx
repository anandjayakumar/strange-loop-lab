import { useState, type ReactNode } from "react";
import { ArrowUpRight, BookOpen, Download, FlaskConical, ShieldCheck } from "lucide-react";
import { hrefFor } from "../lib/router";
import {
  DISCOVERIES,
  FRAMEWORKS,
  GUARDRAILS,
  LOOP_LINKS,
  MATRIX,
  VERSION_COLOR,
  VERSION_LABEL,
  VERSIONS,
  type Discovery,
  type Tone,
  type VersionKey,
} from "./findings";

type Layers = "plain" | "stats" | "both";

const TONE_COLOR: Record<Tone, string> = {
  good: "#39643f",
  warn: "#b23f24",
  bad: "#9f2c1b",
  neutral: "#6f6657",
};

const TONE_LABEL: Record<Tone, string> = {
  good: "validated",
  warn: "partial / trade-off",
  bad: "negative / regression",
  neutral: "baseline",
};

const SECTIONS = [
  { id: "thesis", label: "Thesis", n: "00" },
  { id: "discoveries", label: "Discoveries", n: "01" },
  { id: "figures", label: "Figures", n: "02" },
  { id: "matrix", label: "Matrix", n: "03" },
  { id: "versions", label: "Deep dives", n: "04" },
  { id: "v06-indicators", label: "V0.6 results", n: "05" },
  { id: "frameworks", label: "Theory map", n: "06" },
];

const FIGURES = [
  {
    id: "fig1",
    src: "/paper/figures/fig1_architecture_loop.svg",
    title: "The five-link strange loop",
    caption:
      "Solid edges are the first-order loop L1–L3; dashed edges are the second-order reliability loop L4–L5. Every edge is a switchable ablation, and the bottom strip names the four operational mechanisms measured in later versions.",
    note: "Architecture · all versions",
  },
  {
    id: "fig2",
    src: "/paper/figures/fig2_cross_version_progression.svg",
    title: "Cross-version progression",
    caption:
      "Meta-control resource gain (meta-on minus meta-off), latent-failure AUROC, and stationary energy MAE across V0.2–V0.5. Error bars are 95% intervals from the per-seed JSON; lower MAE is better.",
    note: "Statistics · 100 paired seeds",
  },
  {
    id: "fig3",
    src: "/paper/figures/fig3_epistemic_trap_escape.svg",
    title: "Epistemic trap escape",
    caption:
      "Escape rate, mean resources and deaths in the decoupled rough-terrain trap. Pragmatic maximisation never samples the feared terrain; decision-VoI and the V0.5 plateau probe escape without mortality.",
    note: "Experiment · trap horizon",
  },
  {
    id: "fig4",
    src: "/paper/figures/fig4_trilemma_pareto.svg",
    title: "The illusion–tracking–diagnostic trilemma",
    caption:
      "PP-1 pulse absorption against stationary MAE, with marker area encoding four-way attribution macro-F1. Absorbing the illusion buys calm at a measured cost to tracking and diagnosis; no point dominates the frontier.",
    note: "Negative result · Pareto frontier",
  },
];

function VersionBadge({ version }: { version: VersionKey }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-[2px] font-sans text-[8.5px] font-medium uppercase tracking-[0.14em]"
      style={{
        color: VERSION_COLOR[version],
        borderColor: `${VERSION_COLOR[version]}66`,
        background: `${VERSION_COLOR[version]}0f`,
      }}
    >
      {VERSION_LABEL[version]}
    </span>
  );
}

function LaunchButton({
  version,
  onOpenVersion,
  label,
}: {
  version: VersionKey;
  onOpenVersion: (version: VersionKey) => void;
  label?: string;
}) {
  return (
    <button
      className="btn btn-primary h-8 px-3.5"
      onClick={() => onOpenVersion(version)}
      title={`Open ${VERSION_LABEL[version]} in the simulator`}
    >
      <FlaskConical size={12} />
      {label ?? `Open ${VERSION_LABEL[version]} in the lab`}
    </button>
  );
}

function SectionHead({
  n,
  tag,
  title,
  subtitle,
  right,
}: {
  n: string;
  tag: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-8 border-t border-lab-text pt-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="kicker">
            {n} · {tag}
          </div>
          <h2 className="display mt-2 text-[34px] sm:text-[42px]">{title}</h2>
          {subtitle ? (
            <p className="mt-3 max-w-[74ch] text-[13.5px] leading-[1.7] text-lab-muted">
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

export function FindingsPage({
  onOpenVersion,
  onBack,
  onNavigate,
}: {
  onOpenVersion: (version: VersionKey) => void;
  onBack: () => void;
  onNavigate: (view: string) => void;
}) {
  const [layers, setLayers] = useState<Layers>("plain");

  return (
    <div className="min-h-screen">
      <div className="border-b border-lab-line bg-lab-bg/95">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
          <nav className="scroll-thin flex items-center gap-6 overflow-x-auto py-2">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex shrink-0 items-baseline gap-1.5 font-sans text-[9.5px] font-medium uppercase tracking-[0.16em] text-lab-muted transition-colors hover:text-lab-amber"
              >
                <span className="num text-[8.5px] text-lab-faint">{section.n}</span>
                {section.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-[1240px] px-5 pb-20 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lab-line py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="label text-lab-amber">Findings</span>
            <span className="font-serif text-[13px] italic text-lab-faint">
              cross-version scientific record · V0.1 → V0.6
            </span>
          </div>
          <a
            href={hrefFor("/research")}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate("/research");
            }}
            className="btn-link"
          >
            <FlaskConical size={11} />
            Open the interactive lab
            <ArrowUpRight size={11} />
          </a>
        </div>

        {/* ------------------------------------------------------------- thesis */}
        <section id="thesis" className="scroll-mt-32 pb-14 pt-12 sm:pt-16">
          <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="kicker">Executive summary · what the record shows</div>
              <h1 className="display mt-4 text-[42px] leading-[0.98] sm:text-[58px] xl:text-[64px]">
                Can a system learn a model of itself — and then a model of{" "}
                <span className="italic text-lab-amber">when to trust it</span>?
              </h1>
              <p className="mt-5 max-w-[62ch] font-serif text-[19px] italic leading-snug text-lab-amber">
                The short answer: yes — but the loop that makes a self-model useful is the same loop
                that makes it hard to correct.
              </p>
              <p className="editorial-drop mt-6 max-w-[64ch] text-[14.5px] leading-[1.75] text-lab-muted">
                Strange Loop Lab is a deterministic, non-neural laboratory built around one question:
                when an agent learns a model of its own body (M₁) and then a second-order model of when
                that model can be trusted (M₂), do those models <em className="text-lab-text">causally</em>{" "}
                change what it does, what it learns and whether it survives? Across five architectures
                and 23,900 seeded runs, the answer is conditional. A self-model is behaviourally inert
                when errors are cheap, harmful when doubt is symmetric, and decisive when the agent can
                act on an asymmetric, risk-sensitive estimate of its own reliability. The same loop that
                makes the model useful — trusting it enough to act — is what makes it hard to correct.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-lab-line pt-3">
                {[
                  ["5", "architectures"],
                  ["100", "paired seeds"],
                  ["10", "findings"],
                  ["0", "consciousness claims"],
                ].map(([value, label]) => (
                  <div key={label} className="flex items-baseline gap-2">
                    <span className="display text-[26px] text-lab-amber">{value}</span>
                    <span className="label">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <aside className="lg:col-span-4">
              <div className="inset p-5">
                <div className="label">contents</div>
                <ol className="mt-3 space-y-2.5">
                  {SECTIONS.map((section) => (
                    <li key={section.id} className="flex items-baseline gap-3">
                      <a
                        href={`#${section.id}`}
                        className="group flex min-w-0 flex-1 items-baseline justify-between gap-3 border-b border-lab-line pb-2 transition-colors hover:border-lab-amber"
                      >
                        <span className="truncate font-serif text-[15px] text-lab-text group-hover:text-lab-amber">
                          {section.label}
                        </span>
                        <span className="num text-[9px] text-lab-faint">{section.n}</span>
                      </a>
                    </li>
                  ))}
                </ol>
                <p className="mt-5 border-t border-lab-line pt-3 font-serif text-[12.5px] italic leading-relaxed text-lab-faint">
                  Every headline number on this page links to its sample size, interval and
                  correction. Nothing is rounded into a stronger claim.
                </p>
              </div>
            </aside>
          </div>

          {/* Facing pages: demonstrated / not demonstrated */}
          <div className="mt-14 grid grid-cols-1 gap-x-14 gap-y-10 border-t border-lab-line pt-8 md:grid-cols-2">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="display text-[30px] leading-none text-lab-green">A.</span>
                <h2 className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-lab-green">
                  What was demonstrated
                </h2>
              </div>
              <ul className="mt-4 space-y-3">
                {[
                  "First-order self-modeling learned from randomized, uninformed priors — no designer-tuned constants.",
                  "Risk-sensitive second-order control that beats both meta-off and naive meta-scaling.",
                  "Four-way causal failure attribution from action-conditioned MOVE/REST contrasts.",
                  "Escape from self-fulfilling belief traps via decision-value-of-information probing.",
                  "Attention-schema recovery from post-glitch precision perseveration (AST-1).",
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-[13px] leading-[1.65] text-lab-muted">
                    <span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-lab-green" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex items-baseline gap-3">
                <span className="display text-[30px] leading-none text-lab-red">B.</span>
                <h2 className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-lab-red">
                  What was not demonstrated
                </h2>
              </div>
              <ul className="mt-4 space-y-3">
                {[
                  "Consciousness, sentience or subjective experience of any kind.",
                  "A free-lunch Pareto improvement: top-down illusion absorption has a measured cost to tracking and attribution.",
                  "A contextual meta-model that transfers to survival when the failure is uniform (the Goodhart gap).",
                  "Universal trap escape: V0.5 reached 80% because some agents hit a genuine energy plateau.",
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-[13px] leading-[1.65] text-lab-muted">
                    <span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-lab-red" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <blockquote className="mt-12 border-l-2 border-lab-amber pl-6">
            <p className="font-serif text-[22px] leading-[1.35] text-lab-text sm:text-[26px]">
              The central finding is a trade-off, not a triumph: once an agent trusts a prior enough
              to absorb a sensory lie, it is slower to track the truth and harder to diagnose.
            </p>
            <footer className="mt-3 label">
              the trilemma is measured, not argued
            </footer>
          </blockquote>
        </section>

        {/* -------------------------------------------------------- discoveries */}
        <section id="discoveries" className="scroll-mt-32 pt-4">
          <SectionHead
            n="01"
            tag="findings"
            title="Ten discoveries across five versions"
            subtitle="Each entry carries a plain-English account and the exact statistical record behind it. Switch the reading layer; the audit line is always the trail back to the report."
            right={
              <div className="inline-flex gap-0.5 rounded-full border border-lab-line2 p-0.5">
                {(
                  [
                    ["plain", "Plain"],
                    ["stats", "Statistics"],
                    ["both", "Both"],
                  ] as [Layers, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setLayers(key)}
                    className={
                      "rounded-full px-3 py-1 font-sans text-[9px] font-medium uppercase tracking-[0.12em] transition-colors " +
                      (layers === key
                        ? "bg-lab-text text-lab-bg"
                        : "text-lab-faint hover:text-lab-text")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          />

          <div className="grid grid-cols-1 gap-x-14 gap-y-9 lg:grid-cols-2">
            {DISCOVERIES.map((discovery) => (
              <DiscoveryCard key={discovery.id} discovery={discovery} layers={layers} />
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------- figures */}
        <section id="figures" className="mt-20 scroll-mt-32">
          <SectionHead
            n="02"
            tag="publication figures"
            title="Four figures, every value recomputed"
            subtitle="The paper's vector figures are rendered here from the same per-seed JSON used by the reports. Open any figure at full size to inspect the plotted values."
          />
          <div className="grid grid-cols-1 gap-x-12 gap-y-12 xl:grid-cols-2">
            {FIGURES.map((figure) => (
              <figure key={figure.id} id={figure.id} className="scroll-mt-32">
                <div className="overflow-hidden rounded-card border border-lab-line bg-white p-2">
                  <img
                    src={figure.src}
                    alt={`${figure.title} — ${figure.caption}`}
                    className="h-auto w-full"
                    loading="lazy"
                  />
                </div>
                <figcaption className="mt-3 border-t border-lab-line pt-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-sans text-[9px] font-medium uppercase tracking-[0.16em] text-lab-amber">
                      {figure.id} · {figure.note}
                    </span>
                    <a
                      href={figure.src}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-link"
                    >
                      <Download size={10} />
                      Open SVG
                    </a>
                  </div>
                  <div className="mt-1.5 font-serif text-[18px] leading-tight text-lab-text">
                    {figure.title}
                  </div>
                  <p className="mt-1.5 max-w-[78ch] text-[12px] leading-relaxed text-lab-muted">
                    {figure.caption}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------- matrix */}
        <section id="matrix" className="mt-20 scroll-mt-32">
          <SectionHead
            n="03"
            tag="matrix"
            title="The evolution matrix"
            subtitle="Standardised metrics across V0.1 → V0.6. Green marks a validated breakthrough, vermilion a partial result or trade-off, red a negative result or regression."
          />
          <div className="mb-4 flex flex-wrap items-center gap-5">
            {(["good", "warn", "bad", "neutral"] as Tone[]).map((tone) => (
              <span key={tone} className="inline-flex items-center gap-2 label">
                <span className="swatch" style={{ background: TONE_COLOR[tone] }} />
                {TONE_LABEL[tone]}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto border-t border-lab-text">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-lab-line">
                  <th className="sticky left-0 z-10 bg-lab-bg px-3 py-3 text-left label">
                    metric
                  </th>
                  {VERSIONS.map((v) => (
                    <th key={v.key} className="px-3 py-3 text-center">
                      <span
                        className="font-sans text-[10px] font-medium uppercase tracking-[0.16em]"
                        style={{ color: VERSION_COLOR[v.key] }}
                      >
                        {VERSION_LABEL[v.key]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row) => (
                  <tr
                    key={row.metric}
                    className="border-b border-lab-line transition-colors hover:bg-lab-panel"
                  >
                    <th className="sticky left-0 z-10 bg-lab-bg px-3 py-3 text-left text-[11.5px] font-normal leading-snug text-lab-text">
                      {row.metric}
                    </th>
                    {VERSIONS.map((v) => {
                      const cell = row.values[v.key];
                      return (
                        <td key={v.key} className="px-2 py-3 text-center">
                          <span
                            className="inline-flex flex-col items-center gap-0.5 px-1.5 num text-[10px] leading-tight"
                            style={{ color: TONE_COLOR[cell.tone] }}
                            title={cell.note}
                          >
                            {cell.text}
                            {cell.note ? (
                              <span className="font-serif text-[10px] italic text-lab-faint">
                                {cell.note}
                              </span>
                            ) : null}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-[80ch] font-serif text-[12px] italic leading-relaxed text-lab-faint">
            Values are from each version&rsquo;s report at the 100-seed protocol. V0.5 figures use the
            100-seed run unless marked pilot; V0.6 figures use the 100-seed validation (4,500
            episodes). &ldquo;—&rdquo; means the mechanism did not exist in that version.
          </p>
        </section>

        {/* ----------------------------------------------------------- versions */}
        <section id="versions" className="mt-20 scroll-mt-32">
          <SectionHead
            n="04"
            tag="chapters"
            title="Version by version"
            subtitle="What was introduced, the equations that define it, the full ablation record, and what failed — which is what led into the next version."
          />

          <div className="scroll-thin mb-6 flex gap-1 overflow-x-auto border-b border-lab-line pb-px">
            {VERSIONS.map((v) => (
              <a
                key={v.key}
                href={`#${v.key}`}
                className="relative shrink-0 px-4 pb-3 pt-2 font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-lab-faint transition-colors hover:text-lab-amber"
              >
                {VERSION_LABEL[v.key]}
                <span
                  className="absolute inset-x-3 bottom-0 h-[2px]"
                  style={{ background: VERSION_COLOR[v.key], opacity: 0.5 }}
                />
              </a>
            ))}
            <span className="ml-auto hidden shrink-0 self-center font-serif text-[12px] italic text-lab-faint md:inline">
              five deep dives · each opens its live simulator
            </span>
          </div>

          {VERSIONS.map((version) => (
          <article key={version.key} id={version.key} className="scroll-mt-28 border-t border-lab-text">
            <header className="flex flex-wrap items-start justify-between gap-4 py-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <VersionBadge version={version.key} />
                  <span className="label">{version.launchMode}</span>
                </div>
                <h3 className="display mt-2 text-[30px] leading-tight sm:text-[36px]">
                  {version.name}
                </h3>
                <p className="mt-1.5 max-w-[60ch] font-serif text-[15px] italic leading-snug text-lab-muted">
                  {version.tagline}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                  {version.flow.map((step, i) => (
                    <span key={step} className="flex items-center gap-1.5">
                      <span className="rounded-full border border-lab-line2 px-2 py-[2px] font-sans text-[9px] font-medium uppercase tracking-[0.08em] text-lab-muted">
                        {step}
                      </span>
                      {i < version.flow.length - 1 ? (
                        <span className="text-lab-line2">→</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
              <LaunchButton version={version.key} onOpenVersion={onOpenVersion} />
            </header>

            <div className="grid grid-cols-1 gap-x-12 gap-y-8 border-t border-lab-line py-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <div className="label">hypothesis</div>
                <p className="mt-2 text-[13.5px] leading-[1.7] text-lab-muted">{version.hypothesis}</p>

                <div className="label mt-6">architectural changes</div>
                <ul className="mt-2 space-y-2">
                  {version.changes.map((change) => (
                    <li key={change} className="flex gap-3 text-[12.5px] leading-[1.65] text-lab-muted">
                      <span className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-lab-amber" />
                      {change}
                    </li>
                  ))}
                </ul>

                <div className="label mt-6">key equations</div>
                <div className="mt-2 divide-y divide-lab-line border-y border-lab-line">
                  {version.equations.map((eq) => (
                    <div key={eq.label} className="py-2.5">
                      <div className="label mb-1">{eq.label}</div>
                      <code className="block overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed text-lab-text">
                        {eq.body}
                      </code>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="label">ablation record</div>
                <div className="mt-2 divide-y divide-lab-line border-y border-lab-line">
                  {version.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-baseline justify-between gap-4 py-2"
                    >
                      <span className="text-[11.5px] leading-snug text-lab-muted">{stat.label}</span>
                      <span
                        className="shrink-0 text-right num text-[11px]"
                        style={{ color: stat.tone ? TONE_COLOR[stat.tone] : "#17130d" }}
                      >
                        {stat.value}
                        {stat.note ? (
                          <span className="mt-0.5 block font-serif text-[10px] italic text-lab-faint">
                            {stat.note}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4">
                  <div>
                    <div className="label text-lab-green">succeeded</div>
                    <ul className="mt-2 space-y-1.5">
                      {version.successes.map((s) => (
                        <li key={s} className="flex gap-2.5 text-[11.5px] leading-relaxed text-lab-muted">
                          <span className="mt-[7px] h-[4px] w-[4px] shrink-0 rounded-full bg-lab-green" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="label text-lab-red">failed</div>
                    <ul className="mt-2 space-y-1.5">
                      {version.failures.map((f) => (
                        <li key={f} className="flex gap-2.5 text-[11.5px] leading-relaxed text-lab-muted">
                          <span className="mt-[7px] h-[4px] w-[4px] shrink-0 rounded-full bg-lab-red" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-4 bg-lab-panel px-5 py-4">
              <p className="max-w-[78ch] text-[12px] leading-relaxed text-lab-muted">
                <span className="label mr-2 text-lab-text">verdict</span>
                {version.verdict}
              </p>
              <LaunchButton
                version={version.key}
                onOpenVersion={onOpenVersion}
                label={`Open ${VERSION_LABEL[version.key]} in /research`}
              />
            </footer>
          </article>
          ))}
        </section>

        {/* ------------------------------------------------------------ v0.6 */}
        <section id="v06-indicators" className="mt-20 scroll-mt-32">
          <SectionHead
            n="05"
            tag="V0.6"
            title="Unified architecture: indicator properties under adversarial control"
            subtitle="Four competing modules, a capacity-limited workspace, global broadcast, a higher-order monitor, an attention schema and a bounded cognitive rollout — each independently ablated and compared with four matched-compute controls."
          />

          <div className="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="editorial-drop max-w-[64ch] text-[14px] leading-[1.75] text-lab-muted">
                V0.6 asks a different question from V0.1–V0.5. It is not another survival
                iteration. It asks whether the integrated, self-referential mechanisms are{" "}
                <em className="text-lab-text">causally necessary</em> for a set of cognitive
                capabilities, and whether those capabilities survive comparison with a reactive
                reflex, a physical-only MPC planner with the same horizon, a flat blackboard with
                no capacity limit and a matched-compute feedforward network.
              </p>
              <p className="mt-4 max-w-[64ch] text-[13.5px] leading-[1.75] text-lab-muted">
                The answer is a double dissociation, not a victory lap. The bottleneck,
                broadcast, higher-order monitor, attention schema and cognitive rollout each carry
                a capability the others do not. But the recurrent settling loop adds nothing to
                single-tick absorption, confidence calibration inverts under energy-channel
                corruption, attribution is weak for shared degradation, and the architecture
                loses to simpler controls on two of three unseen-environment suites.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <a
                  className="btn btn-primary h-9 px-4"
                  href="/research?version=v06"
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    onOpenVersion("v06");
                  }}
                >
                  Open V0.6 in the lab
                </a>
                <a className="btn h-9 px-4" href="/paper">
                  Read the manuscript
                </a>
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-lab-line bg-lab-line">
                {[
                  ["99%", "fork probes", "vs 1% without AE-2"],
                  ["0.057", "conflict thrash", "vs 0.296 without bottleneck"],
                  ["5", "ticks to recover", "vs 256 without AST"],
                  ["0.553", "4-way macro-F1", "vs 0.000 without HOT"],
                ].map(([value, label, note]) => (
                  <div key={label} className="bg-lab-panel px-4 py-4">
                    <div className="num text-[28px] leading-none text-lab-text">{value}</div>
                    <div className="mt-1.5 font-sans text-[8.5px] uppercase tracking-[0.14em] text-lab-muted">
                      {label}
                    </div>
                    <div className="mt-1 font-serif text-[11px] italic text-lab-faint">{note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 overflow-x-auto border-y border-lab-line">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-lab-line">
                  {["mechanism", "exp 1 settling", "exp 2 competition", "exp 3 meta", "exp 4 fork", "exp 5 reversal"].map(
                    (label) => (
                      <th
                        key={label}
                        className="px-3 py-2 font-sans text-[8.5px] font-medium uppercase tracking-[0.14em] text-lab-faint"
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {[
                  ["RPT (K = 3)", "0 (null)", "—", "—", "—", "—"],
                  ["GWT bottleneck", "—", "++", "—", "—", "—"],
                  ["GWT broadcast", "—", "+", "—", "—", "0"],
                  ["HOT reliability", "—", "—", "++", "+", "++"],
                  ["AST-1 schema", "+", "++", "—", "—", "—"],
                  ["AE-2 cognitive rollout", "—", "—", "—", "++", "—"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b border-lab-line/70">
                    <td className="px-3 py-2 font-serif text-[13px] text-lab-text">{row[0]}</td>
                    {row.slice(1).map((cell, index) => (
                      <td key={index} className="px-3 py-2 font-mono text-[10px] text-lab-muted">
                        <span
                          className={
                            cell === "++"
                              ? "text-lab-green"
                              : cell === "0"
                                ? "text-lab-red"
                                : ""
                          }
                        >
                          {cell}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-x-12 gap-y-6 lg:grid-cols-2">
            <div>
              <div className="label">what survived</div>
              <ul className="mt-2 space-y-2 text-[12.5px] leading-relaxed text-lab-muted">
                <li>
                  <span className="text-lab-text">Capacity competition.</span> Removing the
                  bottleneck raises action switching from 0.057 to 0.296 and drops goal coherence
                  from 0.91 to 0.68 (dz −1.33, p = 0.002). The flat blackboard is statistically
                  indistinguishable from the no-bottleneck ablation.
                </li>
                <li>
                  <span className="text-lab-text">Broadcast.</span> Removing the return path
                  degrades coherence from 0.91 to 0.86 (dz 1.21, p = 0.002) without changing the
                  winner. The broadcast is doing work beyond selection.
                </li>
                <li>
                  <span className="text-lab-text">HOT monitoring.</span> Attribution macro-F1 falls
                  from 0.553 to 0.000, somatic plasticity is no longer suppressed during sensor
                  corruption (1.00 vs 0.58–0.88), and first-order MAE rises by 0.74–1.22 (p =
                  0.002).
                </li>
                <li>
                  <span className="text-lab-text">Cognitive self-simulation.</span> The fork probe
                  rate falls from 99% to 1% and solved forks from 40% to 1% (dz 0.76). Physical MPC
                  (3%) and the reactive control (4%) also fail: modelling future physical state is
                  not enough.
                </li>
                <li>
                  <span className="text-lab-text">Attention schema.</span> Post-conflict recovery
                  takes 5 ticks with AST-1 and never happens without it (dz −44.4), and AST also
                  improves absorption by 0.03 and stationary MAE by 0.09.
                </li>
              </ul>
            </div>
            <div>
              <div className="label">what failed</div>
              <ul className="mt-2 space-y-2 text-[12.5px] leading-relaxed text-lab-muted">
                <li>
                  <span className="text-lab-text">RPT is a null result.</span> Absorption is 0.823
                  with RPT and 0.811 without it (+0.01, p = 0.224); stationary MAE is unchanged.
                  The V0.5 precision gate, not within-tick recurrence, carries the absorption.
                </li>
                <li>
                  <span className="text-lab-text">Calibration inverts under sensor corruption.</span>{" "}
                  Reliability AUROC is 0.73 for self-disruption and 0.78 for fatigue, but 0.42 for
                  energy and 0.41 for shared. Observed error and latent error dissociate when the
                  channel itself is lying.
                </li>
                <li>
                  <span className="text-lab-text">Attribution is class-imbalanced.</span> Energy
                  shifts are identified 97/100, but shared degradation only 44/100 and a self-model
                  disruption 61/100. A shared shift is statistically close to an energy shift when
                  the fatigue channel is already quiet.
                </li>
                <li>
                  <span className="text-lab-text">Generalization is mixed.</span> The architecture
                  wins the compound suite (13.9 vs 3.0–7.9 resources) but loses to reactive and flat
                  controls on unseen topology (31.8 vs 63.4 / 51.1) and non-linear dynamics (29.9
                  vs 61.5 / 53.8).
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- frameworks */}
        <section id="frameworks" className="mt-20 scroll-mt-32">
          <SectionHead
            n="06"
            tag="framework"
            title="Theory map: Hofstadter and the indicator programme"
            subtitle="How the implemented mechanisms map onto cognitive-science frameworks — and where the mapping stops. Every row is a computational mechanism, not a claim about experience."
          />

          <div className="border-y border-lab-line py-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="label">the five-link strange loop</div>
              <p className="max-w-[52ch] font-serif text-[12.5px] italic leading-snug text-lab-faint">
                M₁ is the first-order self-model; M₂ is the second-order reliability model. Each link
                was ablated with a single switch.
              </p>
            </div>
            <div className="mt-4">
              <LoopDiagram />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-14 gap-y-4 divide-y divide-lab-line border-b border-lab-line md:grid-cols-2 md:divide-y-0">
            {LOOP_LINKS.map((link) => (
              <div key={link.id} className="py-4">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-sans text-[9px] font-medium uppercase tracking-[0.16em] text-lab-amber">
                    {link.id}
                  </span>
                  <span className="font-serif text-[16px] text-lab-text">{link.label}</span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-lab-muted">{link.mechanism}</p>
                <p className="mt-1.5 font-serif text-[12px] italic leading-relaxed text-lab-faint">
                  <span className="text-lab-red">broken:</span> {link.breakEffect}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-1 gap-x-14 gap-y-8 lg:grid-cols-2">
            {FRAMEWORKS.map((row) => (
              <div key={row.framework} className="border-t border-lab-text pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="label">{row.framework}</div>
                    <div className="mt-1 font-serif text-[19px] leading-tight text-lab-text">
                      {row.indicator}
                    </div>
                  </div>
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: TONE_COLOR[row.tone] }}
                  />
                </div>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-lab-muted">{row.mechanism}</p>
                <p className="mt-2.5 border-t border-lab-line pt-2.5 font-serif text-[12px] italic leading-relaxed text-lab-faint">
                  <span className="not-italic label mr-1.5">evidence</span>
                  {row.evidence}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-1 gap-x-14 gap-y-7 sm:grid-cols-2">
            {GUARDRAILS.map((guardrail) => (
              <div key={guardrail.title} className="border-t border-lab-line pt-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={13} className="text-lab-green" />
                  <span className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-lab-text">
                    {guardrail.title}
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-lab-muted">{guardrail.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-16 border-t border-lab-text pt-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-[80ch]">
              <div className="label">scope</div>
              <p className="mt-2 text-[12px] leading-relaxed text-lab-muted">
                Strange Loop Lab implements predictors and controllers. &ldquo;Self-model&rdquo;,
                &ldquo;meta-model&rdquo;, &ldquo;attention&rdquo; and &ldquo;strange loop&rdquo; are
                names for computational objects with measurable behaviour. Nothing in this page is
                evidence of consciousness, sentience or subjective experience.
              </p>
            </div>
            <button className="btn h-8 px-3.5" onClick={onBack}>
              <BookOpen size={12} />
              Back to the lab
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

function DiscoveryCard({ discovery, layers }: { discovery: Discovery; layers: Layers }) {
  const showPlain = layers !== "stats";
  const showStats = layers !== "plain";
  return (
    <article className="group border-t border-lab-line pt-4 transition-colors hover:border-lab-amber">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="display text-[26px] leading-none text-lab-line2 transition-colors group-hover:text-lab-amber">
            {String(discovery.index).padStart(2, "0")}
          </span>
          <VersionBadge version={discovery.version} />
        </div>
        <span
          className="mt-1.5 h-[6px] w-[6px] rounded-full"
          style={{ background: TONE_COLOR[discovery.tone] }}
          title={discovery.tone}
        />
      </div>

      <h3 className="mt-3 font-serif text-[24px] leading-[1.18] tracking-[-0.01em] text-lab-text">
        {discovery.title}
      </h3>

      <div className="mt-3 space-y-3">
        {showPlain ? (
          <p className="text-[13px] leading-[1.7] text-lab-muted">{discovery.plain}</p>
        ) : null}
        {showStats ? (
          <p
            className="border-l-2 pl-3 text-[11.5px] leading-[1.7] text-lab-text"
            style={{ borderColor: TONE_COLOR[discovery.tone] }}
          >
            <span
              className="mr-1.5 font-sans text-[9px] font-medium uppercase tracking-[0.14em]"
              style={{ color: TONE_COLOR[discovery.tone] }}
            >
              stats
            </span>
            {discovery.stats}
          </p>
        ) : null}
      </div>

      <p className="mt-4 border-t border-lab-line pt-2.5 font-serif text-[11.5px] italic leading-relaxed text-lab-faint">
        <span className="mr-1.5 not-italic label">audit</span>
        {discovery.evidence}
      </p>
    </article>
  );
}

function LoopDiagram() {
  const nodes = [
    { x: 90, y: 150, label: "M₁", sub: "self-model" },
    { x: 260, y: 150, label: "action", sub: "movement / rest" },
    { x: 430, y: 150, label: "evidence", sub: "energy · strain · slip" },
    { x: 600, y: 150, label: "M₁ update", sub: "first-order learning" },
    { x: 430, y: 45, label: "M₂", sub: "reliability model" },
  ];
  return (
    <svg viewBox="0 0 700 210" className="w-full" role="img" aria-label="Five-link strange loop diagram">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#a89e8d" />
        </marker>
        <marker id="arrowUp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#634070" />
        </marker>
      </defs>

      <g stroke="#c6b9a0" strokeWidth="1.1" fill="none" markerEnd="url(#arrow)">
        <path d="M 138 150 H 214" />
        <path d="M 306 150 H 384" />
        <path d="M 476 150 H 554" />
        <path d="M 600 122 C 560 92, 510 78, 470 70" strokeDasharray="3 5" />
      </g>
      <g stroke="#634070" strokeWidth="1" fill="none" markerEnd="url(#arrowUp)" strokeDasharray="3 4">
        <path d="M 560 45 C 470 20, 200 20, 100 45" />
        <path d="M 100 60 C 110 95, 130 118, 140 132" />
      </g>

      <text x="176" y="142" fill="#6f6657" fontSize="9" fontFamily="JetBrains Mono, monospace">L1</text>
      <text x="344" y="142" fill="#6f6657" fontSize="9" fontFamily="JetBrains Mono, monospace">L2</text>
      <text x="514" y="142" fill="#6f6657" fontSize="9" fontFamily="JetBrains Mono, monospace">L3</text>
      <text x="540" y="90" fill="#634070" fontSize="9" fontFamily="JetBrains Mono, monospace">L4</text>
      <text x="300" y="30" fill="#634070" fontSize="9" fontFamily="JetBrains Mono, monospace">L5</text>

      {nodes.map((node) => (
        <g key={node.label}>
          <rect
            x={node.x - 46}
            y={node.y - 24}
            width="92"
            height="48"
            rx="3"
            fill="#faf7ef"
            stroke={node.label === "M₂" ? "#63407088" : "#ded4c1"}
          />
          <text
            x={node.x}
            y={node.y - 3}
            textAnchor="middle"
            fill={node.label === "M₂" ? "#634070" : "#17130d"}
            fontSize="12"
            fontFamily="JetBrains Mono, monospace"
          >
            {node.label}
          </text>
          <text x={node.x} y={node.y + 12} textAnchor="middle" fill="#6f6657" fontSize="7.5" fontFamily="DM Sans, sans-serif">
            {node.sub}
          </text>
        </g>
      ))}
    </svg>
  );
}
