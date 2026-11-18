import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Download, FileText, FlaskConical } from "lucide-react";
import { renderMarkdown } from "../lib/markdown";

export function PaperPage({ onNavigate }: { onNavigate: (target: string) => void }) {
  const [manuscript, setManuscript] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/paper/MANUSCRIPT.md")
      .then((response) => {
        if (!response.ok) throw new Error("manuscript");
        return response.text();
      })
      .then((text) => {
        if (alive) setManuscript(text);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // The title lives in the page hero, and the reference list stays in the
  // downloadable manuscript and LaTeX source rather than the web view.
  const body = manuscript
    ? manuscript.replace(/^# .*\n/, "").split("\n## References")[0]
    : "";

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
              <span>100 paired seeds</span>
              <span className="h-3 w-px bg-lab-line2" />
              <span>deterministic</span>
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
          </div>
        </div>

        {error ? (
          <div className="mt-10 border border-lab-red/40 bg-lab-panel px-5 py-4">
            <div className="label text-lab-red">manuscript unavailable</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-lab-muted">
              The formatted manuscript could not be loaded. Regenerate the paper assets with{" "}
              <code className="font-mono text-[11px]">npm run paper:figures</code>, which mirrors{" "}
              <code className="font-mono text-[11px]">paper/MANUSCRIPT.md</code> and the LaTeX source
              into <code className="font-mono text-[11px]">public/paper/</code>.
            </p>
          </div>
        ) : null}

        {!error ? (
          <article className="paper-view mt-8 max-w-[82ch]">
            {manuscript ? (
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
            ) : (
              <p className="font-serif text-[15px] italic text-lab-faint">Loading the manuscript…</p>
            )}
          </article>
        ) : null}

        <div className="mt-12 flex flex-wrap items-center gap-2.5 border-t border-lab-text pt-5">
          <button className="btn btn-primary h-9 px-4" onClick={() => onNavigate("/research")}>
            <FlaskConical size={12} />
            Open the interactive lab
          </button>
          <button className="btn h-9 px-4" onClick={() => onNavigate("/findings")}>
            <BookOpen size={12} />
            Findings &amp; figures
          </button>
          <button
            className="btn-link ml-auto"
            onClick={() => onNavigate("/findings#thesis")}
          >
            Inspect the findings record
            <ArrowUpRight size={11} />
          </button>
        </div>
      </main>
    </div>
  );
}
