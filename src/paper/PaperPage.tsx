import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Download, FileText, FlaskConical } from "lucide-react";
import { renderMarkdown } from "../lib/markdown";

type Tab = "manuscript" | "figures" | "references";

const FIGURES = [
  {
    id: "fig1_architecture_loop",
    title: "The five-link strange loop",
    caption:
      "First-order loop L1–L3 and second-order loop L4–L5, with the four operational mechanisms measured in later versions.",
  },
  {
    id: "fig2_cross_version_progression",
    title: "Cross-version progression",
    caption:
      "Meta-control gain, latent-failure AUROC and stationary MAE across V0.2–V0.5, with 95% intervals from the per-seed JSON.",
  },
  {
    id: "fig3_epistemic_trap_escape",
    title: "Epistemic trap escape",
    caption:
      "Escape rate, resources and deaths in the decoupled trap. Pragmatic maximisation never samples the feared terrain.",
  },
  {
    id: "fig4_trilemma_pareto",
    title: "The illusion–tracking–diagnostic trilemma",
    caption:
      "PP-1 absorption against stationary MAE, marker area encoding attribution macro-F1. Inset: AST-1 recovery.",
  },
];

export function PaperPage({ onNavigate }: { onNavigate: (target: string) => void }) {
  const [tab, setTab] = useState<Tab>("manuscript");
  const [manuscript, setManuscript] = useState<string | null>(null);
  const [references, setReferences] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/paper/MANUSCRIPT.md").then((response) => {
        if (!response.ok) throw new Error("manuscript");
        return response.text();
      }),
      fetch("/paper/references.bib").then((response) => {
        if (!response.ok) throw new Error("references");
        return response.text();
      }),
    ])
      .then(([md, bib]) => {
        if (!alive) return;
        setManuscript(md);
        setReferences(bib);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const body = manuscript ? manuscript.replace(/^# .*\n/, "") : "";

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-[1100px] px-5 pb-24 pt-12 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-lab-text pb-5">
          <div className="min-w-0">
            <div className="kicker">Formal manuscript · 2026</div>
            <h1 className="display mt-3 max-w-[34ch] text-[38px] leading-[0.98] sm:text-[52px]">
              When Self-Models <span className="italic text-lab-amber">Trap Themselves</span>
            </h1>
            <p className="mt-3 max-w-[72ch] text-[13.5px] leading-relaxed text-lab-muted">
              Epistemic probing, risk-sensitive metacognition and precision trade-offs in a white-box
              self-referential agent. Five architectures, 100 paired seeds per generation, and a
              measured Pareto trilemma.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-sans text-[9px] font-medium uppercase tracking-[0.16em] text-lab-faint">
              <span>Strange Loop Lab</span>
              <span className="h-3 w-px bg-lab-line2" />
              <span>100 paired seeds</span>
              <span className="h-3 w-px bg-lab-line2" />
              <span>computational, not phenomenal</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a className="btn h-8 px-3" href="/paper/MANUSCRIPT.md" download>
              <Download size={12} />
              Markdown
            </a>
            <a className="btn h-8 px-3" href="/paper/main.tex" download>
              <FileText size={12} />
              LaTeX
            </a>
            <a className="btn h-8 px-3" href="/paper/references.bib" download>
              BibTeX
            </a>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-full border border-lab-line2 p-0.5">
            {(
              [
                ["manuscript", "Manuscript"],
                ["figures", "Figures"],
                ["references", "References"],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={
                  "rounded-full px-3.5 py-1.5 font-sans text-[9.5px] font-medium uppercase tracking-[0.12em] transition-colors " +
                  (tab === key
                    ? "bg-lab-text text-lab-bg"
                    : "text-lab-faint hover:text-lab-text")
                }
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="btn-link"
            onClick={() => onNavigate("/findings")}
          >
            <BookOpen size={11} />
            Inspect the findings record
            <ArrowUpRight size={11} />
          </button>
        </div>

        {error ? (
          <div className="mt-10 border border-lab-red/40 bg-lab-panel px-5 py-4">
            <div className="label text-lab-red">manuscript unavailable</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-lab-muted">
              The formatted manuscript could not be loaded. Regenerate the paper assets with{" "}
              <code className="font-mono text-[11px]">npm run paper:figures</code>, which mirrors{" "}
              <code className="font-mono text-[11px]">paper/MANUSCRIPT.md</code>, the LaTeX source and
              the references into <code className="font-mono text-[11px]">public/paper/</code>.
            </p>
          </div>
        ) : null}

        {!error && tab === "manuscript" ? (
          <article className="paper-view mt-8 max-w-[82ch]">
            {manuscript ? (
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
            ) : (
              <p className="font-serif text-[15px] italic text-lab-faint">Loading the manuscript…</p>
            )}
          </article>
        ) : null}

        {!error && tab === "figures" ? (
          <div className="mt-8 space-y-10">
            {FIGURES.map((figure, index) => (
              <figure key={figure.id} id={figure.id} className="border-t border-lab-line pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="label">
                    Figure {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="label text-lab-faint">vector · svg</div>
                </div>
                <img
                  src={`/paper/figures/${figure.id}.svg`}
                  alt={figure.title}
                  className="mt-3 w-full"
                />
                <figcaption className="mt-3 max-w-[86ch] font-serif text-[12.5px] italic leading-relaxed text-lab-faint">
                  <span className="not-italic label mr-1.5">{figure.title}.</span>
                  {figure.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}

        {!error && tab === "references" ? (
          <div className="mt-8">
            <p className="max-w-[80ch] text-[12.5px] leading-relaxed text-lab-muted">
              BibTeX for every reference in the manuscript, including the indicator-property
              programme, metacognition, active inference, attention schema and the classical
              filtering and scoring literature.
            </p>
            <pre className="paper-pre mt-4">{references ?? "Loading references…"}</pre>
          </div>
        ) : null}

        <div className="mt-12 flex flex-wrap items-center gap-2.5 border-t border-lab-text pt-5">
          <button className="btn btn-primary h-9 px-4" onClick={() => onNavigate("/research")}>
            <FlaskConical size={12} />
            Open the interactive lab
          </button>
          <button className="btn h-9 px-4" onClick={() => onNavigate("/findings")}>
            Findings &amp; figures
          </button>
          <span className="font-serif text-[12px] italic text-lab-faint">
            all numbers regenerate from research/*.json
          </span>
        </div>
      </main>
    </div>
  );
}
