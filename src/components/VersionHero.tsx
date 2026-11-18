import type { ReactNode } from "react";
import { ArrowRight, BookOpen } from "lucide-react";

interface VersionHeroProps {
  id: string;
  label: string;
  edition: string;
  headline: ReactNode;
  lede: string;
  tick: number;
  energy: number;
  status: string;
  condition: string;
  seed: number;
  detail: string;
  onResearch: () => void;
  onLatest?: () => void;
}

export function VersionHero({
  id,
  label,
  edition,
  headline,
  lede,
  tick,
  energy,
  status,
  condition,
  seed,
  detail,
  onResearch,
  onLatest,
}: VersionHeroProps) {
  return (
    <section
      id={id}
      className="grid grid-cols-1 gap-x-12 gap-y-8 pb-8 pt-10 lg:grid-cols-12 lg:pt-12"
    >
      <div className="lg:col-span-8">
        <div className="kicker">
          {label} · {edition}
        </div>
        <h2 className="display mt-4 text-[42px] sm:text-[58px] xl:text-[68px]">{headline}</h2>
        <p className="mt-6 max-w-[58ch] text-[14.5px] leading-[1.7] text-lab-muted">{lede}</p>
        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <button className="btn btn-primary h-9 px-4" onClick={onResearch}>
            <BookOpen size={12} />
            Research &amp; findings
          </button>
          {onLatest ? (
            <button className="btn h-9 px-4" onClick={onLatest}>
              View latest · V0.5
              <ArrowRight size={12} />
            </button>
          ) : null}
          <span className="ml-1 hidden font-serif text-[13px] italic text-lab-faint sm:inline">
            five architectures, one question
          </span>
        </div>
      </div>

      <aside id={`${id}-telemetry`} className="lg:col-span-4">
        <div className="inset p-5">
          <div className="flex items-baseline justify-between">
            <span className="label">live telemetry</span>
            <span className="font-serif text-[12px] italic text-lab-faint">seed {seed}</span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3 border-b border-lab-line pb-4">
            <div>
              <div className="num text-[40px] leading-none text-lab-text">{tick}</div>
              <div className="label mt-2">ticks survived</div>
            </div>
            <div className="text-right">
              <div className="num text-[17px] leading-none text-lab-green">{energy.toFixed(1)}</div>
              <div className="label mt-2">energy</div>
            </div>
          </div>
          <dl className="mt-3 space-y-2">
            {[
              ["condition", condition],
              ["state", status],
              ["detail", detail],
            ].map(([key, value]) => (
              <div key={key} className="flex items-baseline justify-between gap-3">
                <dt className="label">{key}</dt>
                <dd className="num text-[10.5px] text-lab-text">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </section>
  );
}
