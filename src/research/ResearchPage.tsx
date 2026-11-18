import { useMemo, useState } from "react";
import {
  BookOpen,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
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
  good: "#86c9a3",
  warn: "#e2a765",
  bad: "#d97c73",
  neutral: "#a5a29c",
};

const SECTIONS = [
  { id: "thesis", label: "Thesis" },
  { id: "discoveries", label: "10 discoveries" },
  { id: "matrix", label: "Evolution matrix" },
  { id: "versions", label: "Deep dives" },
  { id: "frameworks", label: "Theory map" },
];

function VersionBadge({ version }: { version: VersionKey }) {
  return (
    <span
      className="inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]"
      style={{
        color: VERSION_COLOR[version],
        borderColor: `${VERSION_COLOR[version]}55`,
        background: `${VERSION_COLOR[version]}14`,
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
      className="btn btn-primary h-8 px-2.5"
      onClick={() => onOpenVersion(version)}
      title={`Open ${VERSION_LABEL[version]} in the simulator`}
    >
      <FlaskConical size={12} />
      {label ?? `Launch ${VERSION_LABEL[version]}`}
    </button>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 border-b border-lab-line/70 pb-3">
      <div>
        <h2 className="font-serif text-[26px] font-light leading-tight tracking-[-0.02em] text-lab-text sm:text-[30px]">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2 max-w-[70ch] text-[12px] leading-[1.7] text-lab-muted">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ResearchPage({
  onOpenVersion,
  onBack,
}: {
  onOpenVersion: (version: VersionKey) => void;
  onBack: () => void;
}) {
  const [layers, setLayers] = useState<Layers>("plain");
  const [activeVersion, setActiveVersion] = useState<VersionKey>("v03");

  const version = useMemo(
    () => VERSIONS.find((v) => v.key === activeVersion) ?? VERSIONS[2],
    [activeVersion],
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-lab-line bg-lab-bg">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost h-8 px-2" onClick={onBack} title="Back to the lab">
              ← Lab
            </button>
            <div>
              <div className="label">Strange Loop Lab · research</div>
              <div className="font-serif text-[15px] leading-tight text-lab-text">
                Research &amp; Findings
              </div>
            </div>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-lab-faint transition-colors hover:bg-lab-raise hover:text-lab-text"
              >
                {section.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {VERSIONS.map((v) => (
              <button
                key={v.key}
                className="flex h-7 items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-lab-faint transition-colors hover:text-lab-muted"
                onClick={() => onOpenVersion(v.key)}
                title={`Open ${VERSION_LABEL[v.key]}`}
              >
                <span
                  className="h-1 w-1 rounded-full"
                  style={{ background: VERSION_COLOR[v.key] }}
                />
                {VERSION_LABEL[v.key]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 pb-16 pt-6">
        {/* ---------------------------------------------------------------- thesis */}
        <section id="thesis" className="scroll-mt-24">
          <div className="panel overflow-hidden">
            <div className="border-b border-lab-line/70 bg-lab-raise/20 px-5 py-8 sm:px-10 sm:py-12">
              <h1 className="max-w-[24ch] font-serif text-[38px] font-light leading-[1.02] tracking-[-0.03em] text-lab-text sm:text-[56px]">
                Can a system learn a model of itself — and of its own reliability?
              </h1>
              <p className="mt-5 max-w-[66ch] text-[13.5px] leading-[1.75] text-lab-muted">
                Strange Loop Lab is a deterministic computational laboratory inspired by
                Hofstadter&rsquo;s strange loop and by the indicator-property programme for
                consciousness science. Across five versions it asks one question: if an agent learns
                a model of its own body, then a second-order model of when that first model can be
                trusted, do those models <em className="text-lab-text/90">causally</em> change what
                it does, what it learns, and whether it survives?
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-lab-faint">
                <span>100 paired seeds</span>
                <span className="h-3 w-px bg-lab-line" />
                <span>deterministic</span>
                <span className="h-3 w-px bg-lab-line" />
                <span>seeded statistics</span>
                <span className="h-3 w-px bg-lab-line" />
                <span className="text-lab-green/80">computational, not phenomenal</span>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-lab-line/70 md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="p-5 sm:p-7">
                <div className="label mb-2 text-lab-green">what was demonstrated</div>
                <ul className="space-y-2 text-[12px] leading-relaxed text-lab-muted">
                  {[
                    "First-order self-modeling learned from randomized, uninformed priors — no designer-tuned constants.",
                    "Risk-sensitive second-order control that beats both meta-off and naive meta-scaling.",
                    "Four-way causal failure attribution from action-conditioned MOVE/REST contrasts.",
                    "Escape from self-fulfilling belief traps via decision-value-of-information probing.",
                    "Attention-schema recovery from post-glitch precision perseveration (AST-1).",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-lab-green" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-5 sm:p-7">
                <div className="label mb-2 text-lab-red">what was not demonstrated</div>
                <ul className="space-y-2 text-[12px] leading-relaxed text-lab-muted">
                  {[
                    "Consciousness, sentience or subjective experience of any kind.",
                    "A free-lunch Pareto improvement: top-down illusion absorption has a measured cost to tracking and attribution.",
                    "A contextual meta-model that transfers to survival when the failure is uniform (the Goodhart gap).",
                    "Universal trap escape: V0.5 reached 80% because some agents hit a genuine energy plateau.",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-lab-red" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-lab-line/70 px-5 py-4 text-[10px] leading-relaxed text-lab-faint sm:px-7">
              The central finding is a trade-off, not a triumph: once an agent trusts a prior enough
              to absorb a sensory lie, it is slower to track the truth and harder to diagnose. The
              project&apos;s value is that all three sides of that trilemma are measured rather than
              argued.
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- discoveries */}
        <section id="discoveries" className="mt-14 scroll-mt-24">
          <SectionHeading
            title="Ten discoveries across five versions"
            subtitle="Each card carries a plain-English account and the exact statistical record behind it. Toggle the reading layer; the evidence line is always the audit trail."
          />
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="label mr-1">reading layer</span>
            <div className="inline-flex rounded-md border border-lab-line p-0.5">
              {(
                [
                  ["plain", "Plain English"],
                  ["stats", "Statistical proof"],
                  ["both", "Both"],
                ] as [Layers, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setLayers(key)}
                  className={
                    "rounded px-2.5 py-1 font-mono text-[9px] tracking-[0.06em] transition-colors " +
                    (layers === key
                      ? "bg-lab-raise text-lab-text"
                      : "text-lab-faint hover:text-lab-muted")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
            {DISCOVERIES.map((discovery) => (
              <DiscoveryCard key={discovery.id} discovery={discovery} layers={layers} />
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- matrix */}
        <section id="matrix" className="mt-14 scroll-mt-24">
          <SectionHeading
            title="Master cross-version matrix"
            subtitle="Standardised metrics across V0 → V0.5. Green marks a validated breakthrough, amber a partial result or trade-off, red a negative result or regression."
          />
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[9px] text-lab-faint">
            {(["good", "warn", "bad", "neutral"] as Tone[]).map((tone) => (
              <span key={tone} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: TONE_COLOR[tone] }}
                />
                {tone === "good"
                  ? "validated"
                  : tone === "warn"
                    ? "partial / trade-off"
                    : tone === "bad"
                      ? "negative / regression"
                      : "baseline"}
              </span>
            ))}
          </div>
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-lab-line">
                  <th className="sticky left-0 z-10 bg-lab-panel px-3 py-2.5 text-left font-mono text-[9px] uppercase tracking-[0.12em] text-lab-faint">
                    Metric
                  </th>
                  {VERSIONS.map((v) => (
                    <th key={v.key} className="px-3 py-2.5 text-center">
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.12em]"
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
                  <tr key={row.metric} className="border-b border-lab-line/50 last:border-0">
                    <th className="sticky left-0 z-10 bg-lab-panel px-3 py-2 text-left text-[10px] font-normal leading-snug text-lab-muted">
                      {row.metric}
                    </th>
                    {VERSIONS.map((v) => {
                      const cell = row.values[v.key];
                      return (
                        <td key={v.key} className="px-2 py-2 text-center">
                          <span
                            className="inline-flex flex-col items-center px-1.5 py-1 font-mono text-[9.5px] leading-tight"
                            style={{ color: TONE_COLOR[cell.tone] }}
                            title={cell.note}
                          >
                            {cell.text}
                            {cell.note ? (
                              <span className="mt-0.5 text-[8px] text-lab-faint">{cell.note}</span>
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
          <p className="mt-2 text-[9px] leading-relaxed text-lab-faint">
            Values are from each version&apos;s report. V0.5 figures are from the 40-seed run unless
            marked pilot. &ldquo;—&rdquo; means the mechanism did not exist in that version.
          </p>
        </section>

        {/* ---------------------------------------------------------------- versions */}
        <section id="versions" className="mt-14 scroll-mt-24">
          <SectionHeading
            title="Version by version"
            subtitle="What was introduced, the equations that define it, the full ablation record, and what failed — leading into the next version."
          />
          <div className="mb-5 flex flex-wrap gap-5 border-b border-lab-line/60">
            {VERSIONS.map((v) => (
              <button
                key={v.key}
                onClick={() => setActiveVersion(v.key)}
                className={
                  "relative shrink-0 pb-2.5 pt-1 font-mono text-[10px] tracking-[0.14em] transition-colors " +
                  (activeVersion === v.key
                    ? "text-lab-text"
                    : "text-lab-faint hover:text-lab-muted")
                }
              >
                {VERSION_LABEL[v.key]}
                <span
                  className="absolute inset-x-0 bottom-0 h-px"
                  style={{
                    background:
                      activeVersion === v.key ? VERSION_COLOR[v.key] : "transparent",
                  }}
                />
              </button>
            ))}
          </div>

          <article className="panel overflow-hidden">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-lab-line/70 bg-lab-raise/30 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <VersionBadge version={version.key} />
                  <span className="label">{version.launchMode}</span>
                </div>
                <h3 className="mt-1.5 font-serif text-2xl leading-tight text-lab-text">
                  {version.name}
                </h3>
                <p className="mt-1 text-[11px] italic text-lab-muted">{version.tagline}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {version.flow.map((step, i) => (
                    <span key={step} className="flex items-center gap-1">
                      <span className="rounded border border-lab-line/70 bg-lab-bg/50 px-1.5 py-0.5 font-mono text-[8.5px] text-lab-muted">
                        {step}
                      </span>
                      {i < version.flow.length - 1 ? (
                        <span className="text-lab-faint">→</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
              <LaunchButton version={version.key} onOpenVersion={onOpenVersion} />
            </header>

            <div className="grid grid-cols-1 gap-0 lg:grid-cols-12">
              <div className="border-b border-lab-line/60 p-5 lg:col-span-7 lg:border-b-0 lg:border-r">
                <div className="label mb-1.5">hypothesis</div>
                <p className="text-[12px] leading-relaxed text-lab-muted">{version.hypothesis}</p>

                <div className="label mb-1.5 mt-4">architectural changes</div>
                <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-lab-muted">
                  {version.changes.map((change) => (
                    <li key={change} className="flex gap-2">
                      <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-lab-amber" />
                      {change}
                    </li>
                  ))}
                </ul>

                <div className="label mb-1.5 mt-4">key equations</div>
                <div className="space-y-1.5">
                  {version.equations.map((eq) => (
                    <div
                      key={eq.label}
                      className="rounded border border-lab-line/70 bg-lab-bg/40 px-2.5 py-2"
                    >
                      <div className="label mb-1">{eq.label}</div>
                      <code className="block overflow-x-auto whitespace-pre font-mono text-[10.5px] text-lab-text/90">
                        {eq.body}
                      </code>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 lg:col-span-5">
                <div className="label mb-2">ablation record</div>
                <div className="divide-y divide-lab-line/50 rounded border border-lab-line/70">
                  {version.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-baseline justify-between gap-3 px-2.5 py-1.5"
                    >
                      <span className="text-[10.5px] leading-snug text-lab-muted">{stat.label}</span>
                      <span
                        className="shrink-0 text-right font-mono text-[10.5px] tabular-nums"
                        style={{ color: stat.tone ? TONE_COLOR[stat.tone] : "#eeedea" }}
                      >
                        {stat.value}
                        {stat.note ? (
                          <span className="ml-1 block text-[8px] text-lab-faint">{stat.note}</span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <div>
                    <div className="label mb-1 text-lab-green">succeeded</div>
                    <ul className="space-y-1 text-[10.5px] leading-relaxed text-lab-muted">
                      {version.successes.map((s) => (
                        <li key={s} className="flex gap-1.5">
                          <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-lab-green" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="label mb-1 text-lab-red">failed</div>
                    <ul className="space-y-1 text-[10.5px] leading-relaxed text-lab-muted">
                      {version.failures.map((f) => (
                        <li key={f} className="flex gap-1.5">
                          <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-lab-red" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-lab-line/70 bg-lab-bg/40 px-5 py-3">
              <p className="max-w-[80ch] text-[10px] leading-relaxed text-lab-faint">
                <span className="text-lab-muted">Verdict.</span> {version.verdict}
              </p>
              <LaunchButton
                version={version.key}
                onOpenVersion={onOpenVersion}
                label={`Reproduce ${VERSION_LABEL[version.key]}`}
              />
            </footer>
          </article>
        </section>

        {/* ---------------------------------------------------------------- frameworks */}
        <section id="frameworks" className="mt-14 scroll-mt-24">
          <SectionHeading
            title="Theory map: Hofstadter and the indicator programme"
            subtitle="How the implemented mechanisms map onto cognitive-science frameworks — and where the mapping stops. Every row is a computational mechanism, not a claim about experience."
          />

          <div className="panel mb-3 overflow-hidden">
            <div className="border-b border-lab-line/70 px-4 py-3">
              <div className="label">the five-link strange loop</div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-lab-muted">
                M₁ is the first-order self-model; M₂ is the second-order reliability model. Each link
                was ablated with a single switch.
              </p>
            </div>
            <div className="p-4">
              <LoopDiagram />
            </div>
            <div className="grid grid-cols-1 divide-y divide-lab-line/60 border-t border-lab-line/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              {LOOP_LINKS.map((link) => (
                <div key={link.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-lab-line bg-lab-raise px-1.5 py-0.5 font-mono text-[9px] text-lab-amber">
                      {link.id}
                    </span>
                    <span className="font-mono text-[10px] text-lab-text">{link.label}</span>
                  </div>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-lab-muted">
                    {link.mechanism}
                  </p>
                  <p className="mt-1 text-[9.5px] leading-relaxed text-lab-faint">
                    <span className="text-lab-red">broken:</span> {link.breakEffect}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
            {FRAMEWORKS.map((row) => (
              <div key={row.framework} className="border-t border-lab-line/70 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="label">{row.framework}</div>
                    <div className="mt-0.5 font-serif text-[15px] leading-tight text-lab-text">
                      {row.indicator}
                    </div>
                  </div>
                  <span
                    className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: TONE_COLOR[row.tone] }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-lab-muted">{row.mechanism}</p>
                <p className="mt-2 border-t border-lab-line/60 pt-2 text-[10px] leading-relaxed text-lab-faint">
                  <span className="text-lab-muted">evidence · </span>
                  {row.evidence}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            {GUARDRAILS.map((guardrail) => (
              <div key={guardrail.title} className="border-t border-lab-line/70 pt-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-lab-green" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-lab-text">
                    {guardrail.title}
                  </span>
                </div>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-lab-muted">
                  {guardrail.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-10 border-t border-lab-line/60 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-[92ch] text-[9.5px] leading-relaxed text-lab-faint">
              <span className="text-lab-muted">Scope.</span> Strange Loop Lab implements predictors
              and controllers. &ldquo;Self-model&rdquo;, &ldquo;meta-model&rdquo;,
              &ldquo;attention&rdquo; and &ldquo;strange loop&rdquo; are names for computational
              objects with measurable behaviour. Nothing in this page is evidence of consciousness,
              sentience or subjective experience. Reports:{" "}
              <code className="text-lab-muted">docs/RESEARCH_REPORT.md</code>,{" "}
              <code className="text-lab-muted">docs/V02_RESEARCH_REPORT.md</code>,{" "}
              <code className="text-lab-muted">docs/V03_RESEARCH_REPORT.md</code>,{" "}
              <code className="text-lab-muted">docs/V04_RESEARCH_REPORT.md</code>,{" "}
              <code className="text-lab-muted">docs/V05_RESEARCH_REPORT.md</code>,{" "}
              <code className="text-lab-muted">docs/MODEL.md</code>.
            </p>
            <button className="btn h-8 px-2.5" onClick={onBack}>
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
    <article className="group flex flex-col border-t border-lab-line/80 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="font-sans text-[11px] tabular-nums text-lab-faint">
            {String(discovery.index).padStart(2, "0")}
          </span>
          <VersionBadge version={discovery.version} />
        </div>
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: TONE_COLOR[discovery.tone] }}
          title={discovery.tone}
        />
      </div>

      <h3 className="mt-2.5 font-serif text-[18.5px] font-light leading-[1.25] tracking-[-0.01em] text-lab-text">
        {discovery.title}
      </h3>

      <div className="mt-2.5 space-y-3">
        {showPlain ? (
          <p className="text-[12px] leading-[1.7] text-lab-muted">{discovery.plain}</p>
        ) : null}
        {showStats ? (
          <p
            className="border-t border-lab-line/60 pt-2 text-[10.5px] leading-[1.7] text-lab-text/80"
            
          >
            <span className="label mr-1.5" style={{ color: TONE_COLOR[discovery.tone] }}>
              stats
            </span>
            {discovery.stats}
          </p>
        ) : null}
      </div>

      <p className="mt-auto pt-3 text-[9px] leading-relaxed text-lab-faint">
        <span className="uppercase tracking-[0.12em] text-lab-faint">audit · </span>
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
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#5b626b" />
        </marker>
        <marker id="arrowUp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#b4a2d8" />
        </marker>
      </defs>

      <g stroke="#333338" strokeWidth="1.2" fill="none" markerEnd="url(#arrow)">
        <path d="M 138 150 H 214" />
        <path d="M 306 150 H 384" />
        <path d="M 476 150 H 554" />
        <path d="M 600 122 C 560 92, 510 78, 470 70" strokeDasharray="3 5" />
      </g>
      <g stroke="#b4a2d8" strokeWidth="1" fill="none" markerEnd="url(#arrowUp)" strokeDasharray="3 4">
        <path d="M 560 45 C 470 20, 200 20, 100 45" />
        <path d="M 100 60 C 110 95, 130 118, 140 132" />
      </g>

      <text x="176" y="142" fill="#5b626b" fontSize="9" fontFamily="monospace">L1</text>
      <text x="344" y="142" fill="#5b626b" fontSize="9" fontFamily="monospace">L2</text>
      <text x="514" y="142" fill="#5b626b" fontSize="9" fontFamily="monospace">L3</text>
      <text x="540" y="90" fill="#b4a2d8" fontSize="9" fontFamily="monospace">L4</text>
      <text x="300" y="30" fill="#b4a2d8" fontSize="9" fontFamily="monospace">L5</text>

      {nodes.map((node) => (
        <g key={node.label}>
          <rect
            x={node.x - 46}
            y={node.y - 24}
            width="92"
            height="48"
            rx="6"
            fill="#151518"
            stroke={node.label === "M₂" ? "#b4a2d866" : "#333338"}
          />
          <text
            x={node.x}
            y={node.y - 3}
            textAnchor="middle"
            fill={node.label === "M₂" ? "#b4a2d8" : "#eeedea"}
            fontSize="12"
            fontFamily="monospace"
          >
            {node.label}
          </text>
          <text x={node.x} y={node.y + 12} textAnchor="middle" fill="#a5a29c" fontSize="7.5" fontFamily="monospace">
            {node.sub}
          </text>
        </g>
      ))}
    </svg>
  );
}
