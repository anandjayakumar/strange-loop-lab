import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="panel my-auto w-full max-w-3xl animate-fade-up overflow-hidden"
      >
        <div className="flex items-start justify-between border-b border-lab-line px-6 py-5">
          <div>
            <div className="mono-label text-lab-amber">Research framing</div>
            <h2 id="about-title" className="mt-1 font-serif text-3xl text-lab-text">
              A strange loop, not a consciousness claim
            </h2>
          </div>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={14} />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5 text-[13px] leading-relaxed text-lab-muted scroll-thin">
          <p>
            <span className="text-lab-text">Strange Loop Lab</span> is a small computational
            laboratory inspired by Douglas Hofstadter's <em>Gödel, Escher, Bach</em>. It asks
            whether a system can develop an increasingly useful model of itself, and whether that
            model can become entangled with the processes that produce it.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Self-reference", "A system represents and reasons about its own states."],
              [
                "Tangled hierarchy",
                "Higher levels modulate lower-level parameters, so neither is strictly in charge.",
              ],
              [
                "Emergence",
                "Internal estimates arise from experience; none are copied from ground truth.",
              ],
            ].map(([title, text]) => (
              <div key={title} className="rounded-md border border-lab-line/80 bg-lab-raise/40 p-3">
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-lab-amber">
                  {title}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-lab-faint">{text}</p>
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-lab-text">
              Three experimental conditions
            </h3>
            <ul className="mt-2 space-y-2 text-[12px]">
              <li>
                <span className="font-mono text-lab-muted">A</span> — sensory input plus a learned
                world model. No representation of the agent itself.
              </li>
              <li>
                <span className="font-mono text-lab-cyan">B</span> — adds an independent self-model
                that estimates energy, movement cost, rest gain, fatigue and success probability
                from noisy interoception and action history.
              </li>
              <li>
                <span className="font-mono text-lab-violet">C</span> — adds a second-order
                meta-model that tracks self-model reliability and feeds back into self-model
                influence, learning rate and prior weighting.
              </li>
            </ul>
          </div>
          <div className="rounded-md border border-lab-amber/20 bg-lab-amber/[0.045] p-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-lab-amber">
              Constraints
            </div>
            <ul className="mt-2 grid gap-1.5 text-[11px] leading-relaxed text-lab-muted sm:grid-cols-2">
              <li>No LLM, neural network library, pretrained model or external API.</li>
              <li>No identity variable, self-awareness flag or hardcoded introspection.</li>
              <li>The self-model never reads physical energy or fatigue.</li>
              <li>Every feedback edge is inspectable, numeric and disableable.</li>
              <li>All randomness is seeded; identical seeds are reproducible.</li>
              <li>No metric is labelled a consciousness score.</li>
            </ul>
          </div>
          <p className="text-[12px] text-lab-faint">
            The dashboard reports model error, influence, calibration and adaptation. Those are
            measurements of a computational system, not evidence of experience. The central
            question is exploratory: what happens when a model of a system becomes part of the
            system that generates it?
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-lab-line px-6 py-4">
          <span className="font-mono text-[9px] text-lab-faint">
            V0 · deterministic browser simulation · no backend
          </span>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
