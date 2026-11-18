import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileText,
  FlaskConical,
} from "lucide-react";
import { hrefFor } from "../lib/router";
import { ARTICLE, LESSON_CALLOUTS, READING_MINUTES, type ArticleSection, type LessonCallout } from "./article";

const STATS = [
  ["5", "Evolutionary Generations", "V0.1 – V0.5"],
  ["100", "Paired Seeds / Condition", "19,400 total runs"],
  ["67", "Automated Verification Tests", "deterministic"],
  ["WB", "White-Box Non-Neural Architecture", "0 neural parameters"],
];

function RouteButton({
  to,
  onNavigate,
  children,
  variant = "ghost",
}: {
  to: string;
  onNavigate: (target: string) => void;
  children: React.ReactNode;
  variant?: "solid" | "ghost";
}) {
  return (
    <a
      href={hrefFor(to)}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate(to);
      }}
      className={
        variant === "solid"
          ? "route-solid inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#e0a267] px-5 font-sans text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#17130d] transition-colors hover:bg-[#f0c08f]"
          : "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#ece6da]/25 px-5 font-sans text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#d8d0c1] transition-colors hover:border-[#e0a267] hover:text-[#f6f1e6]"
      }
    >
      {children}
    </a>
  );
}

function LessonCard({
  callout,
  onNavigate,
}: {
  callout: LessonCallout;
  onNavigate: (target: string) => void;
}) {
  return (
    <aside className="my-8 rounded-[4px] border border-[#e0a267]/30 bg-[#181510] p-5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="font-sans text-[8.5px] font-semibold uppercase tracking-[0.22em] text-[#e0a267]">
            Interactive lesson · measured result
          </div>
          <div className="mt-2 font-serif text-[20px] leading-tight text-[#f6f1e6]">
            {callout.metric}
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
            <span className="num text-[22px] text-[#9d9484]">{callout.from}</span>
            <ArrowRight size={15} className="text-[#e0a267]" />
            <span className="num text-[26px] text-[#f6f1e6]">{callout.to}</span>
          </div>
          <p className="mt-2 max-w-[64ch] font-serif text-[12.5px] italic leading-snug text-[#a49a88]">
            {callout.detail}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <a
            href={hrefFor(`/research?version=${callout.researchVersion}`)}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate(`/research?version=${callout.researchVersion}`);
            }}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-[#ece6da] px-3.5 font-sans text-[9px] font-semibold uppercase tracking-[0.12em] text-[#17130d] transition-colors hover:bg-[#e0a267]"
          >
            <FlaskConical size={11} />
            Run this in the lab
            <ArrowRight size={11} />
          </a>
          <a
            href={hrefFor(`/findings#${callout.findingsAnchor}`)}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate(`/findings#${callout.findingsAnchor}`);
            }}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-[#ece6da]/25 px-3.5 font-sans text-[9px] font-medium uppercase tracking-[0.12em] text-[#d8d0c1] transition-colors hover:border-[#e0a267] hover:text-[#f6f1e6]"
          >
            <BookOpen size={11} />
            See full data in findings
            <ArrowUpRight size={11} />
          </a>
        </div>
      </div>
    </aside>
  );
}

function Blocks({ section, intro = false }: { section: ArticleSection; intro?: boolean }) {
  return (
    <>
      {section.blocks.map((block, index) => {
        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={index}
              className={
                "article-list my-4 space-y-2 pl-5 " + (block.ordered ? "list-decimal" : "")
              }
            >
              {block.items?.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  dangerouslySetInnerHTML={{ __html: item }}
                  className="pl-1"
                />
              ))}
            </ListTag>
          );
        }
        return (
          <p
            key={index}
            className={index === 0 && intro ? "article-first" : undefined}
            dangerouslySetInnerHTML={{ __html: block.html ?? "" }}
          />
        );
      })}
    </>
  );
}

export function HomePage({ onNavigate }: { onNavigate: (target: string) => void }) {
  const [lead, ...rest] = ARTICLE.title.split(": ");
  const subtitle = rest.join(": ");
  const sections = ARTICLE.sections;

  return (
    <div className="editorial-dark min-h-screen bg-[#0e0d0b] text-[#ece6da]">
      <main className="mx-auto max-w-[1200px] px-5 pb-24 sm:px-8">
        {/* ------------------------------------------------------------- hero */}
        <header className="border-b border-[#ece6da]/15 pb-12 pt-14 sm:pt-20">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-sans text-[9px] font-medium uppercase tracking-[0.24em] text-[#e0a267]">
            <span>Strange Loop Lab · research narrative</span>
            <span className="h-px w-10 bg-[#e0a267]/50" />
            <span className="text-[#8f8574]">November 2026</span>
            <span className="text-[#8f8574]">≈ {READING_MINUTES} min read</span>
          </div>

          <h1 className="mt-6 max-w-[19ch] font-serif text-[44px] leading-[0.94] tracking-[-0.025em] text-[#f8f3e8] sm:text-[64px] lg:text-[76px]">
            {lead}
            <span className="text-[#e0a267]">.</span>
          </h1>

          {subtitle ? (
            <p className="mt-5 max-w-[62ch] font-serif text-[21px] leading-[1.35] text-[#c9c0b0] sm:text-[25px]">
              {subtitle}
            </p>
          ) : null}

          <p className="mt-6 max-w-[68ch] text-[13.5px] leading-[1.75] text-[#a49a88]">
            A transparent digital organism, five evolutionary generations, and a set of measured
            lessons about why a mind needs a model of itself — and why that model can become the
            trap it needs a second level to escape.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-[#ece6da]/15 bg-[#ece6da]/10 sm:grid-cols-4">
            {STATS.map(([value, label, note]) => (
              <div key={label} className="bg-[#12100c] px-4 py-4">
                <div className="font-serif text-[34px] leading-none text-[#f6f1e6]">{value}</div>
                <div className="mt-2 font-sans text-[8.5px] font-medium uppercase tracking-[0.16em] text-[#c9c0b0]">
                  {label}
                </div>
                <div className="mt-1 font-serif text-[11.5px] italic text-[#8f8574]">{note}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2.5">
            <RouteButton to="/research" onNavigate={onNavigate} variant="solid">
              <FlaskConical size={13} />
              Explore the interactive lab
              <ArrowRight size={13} />
            </RouteButton>
            <RouteButton to="/findings" onNavigate={onNavigate}>
              <BookOpen size={13} />
              Examine scientific findings
            </RouteButton>
            <RouteButton to="/paper" onNavigate={onNavigate}>
              <FileText size={13} />
              Read full manuscript
            </RouteButton>
          </div>

          <p className="mt-5 max-w-[76ch] font-serif text-[12px] italic text-[#8f8574]">
            Every number in this article comes from a seeded, deterministic run. The organism is a
            predictor–controller, not a claim about consciousness, sentience or subjective
            experience.
          </p>
        </header>

        {/* ------------------------------------------------------------ article */}
        <div className="mt-12 grid grid-cols-1 gap-x-14 lg:grid-cols-12">
          <aside className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-24">
              <div className="font-sans text-[8.5px] font-semibold uppercase tracking-[0.22em] text-[#8f8574]">
                Contents
              </div>
              <nav className="mt-3 border-t border-[#ece6da]/15">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="group flex items-baseline justify-between gap-3 border-b border-[#ece6da]/10 py-2.5 text-[12px] leading-snug text-[#a49a88] transition-colors hover:text-[#f6f1e6]"
                  >
                    <span className="font-serif text-[14px]">{section.title}</span>
                    <span className="num text-[8px] text-[#6f6759]">
                      {section.number ?? "—"}
                    </span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <article className="article-prose lg:col-span-8 lg:col-start-5">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-28 border-b border-[#ece6da]/12 pb-9 pt-9 first:pt-0 last:border-b-0"
              >
                {section.number ? (
                  <div className="mb-3 flex items-center gap-3">
                    <span className="num text-[10px] text-[#e0a267]">
                      Lesson {section.number}
                    </span>
                    <span className="h-px flex-1 bg-[#ece6da]/15" />
                    <span className="font-sans text-[8px] uppercase tracking-[0.2em] text-[#6f6759]">
                      measured lesson
                    </span>
                  </div>
                ) : (
                  <div className="mb-3 flex items-center gap-3">
                    <span className="font-sans text-[8.5px] font-semibold uppercase tracking-[0.22em] text-[#e0a267]">
                      {section.id === "introduction" ? "The question" : "Conclusion"}
                    </span>
                    <span className="h-px flex-1 bg-[#ece6da]/15" />
                  </div>
                )}

                <h2 className="font-serif text-[31px] leading-[1.08] tracking-[-0.018em] text-[#f6f1e6] sm:text-[38px]">
                  {section.title}
                </h2>

                <div className="mt-5 text-[15px] leading-[1.82] text-[#c4bbab]">
                  <Blocks section={section} intro={index === 0} />
                </div>

                {LESSON_CALLOUTS[section.id] ? (
                  <LessonCard
                    callout={LESSON_CALLOUTS[section.id]}
                    onNavigate={onNavigate}
                  />
                ) : null}
              </section>
            ))}

            <footer className="pt-10">
              <div className="font-sans text-[8.5px] font-semibold uppercase tracking-[0.22em] text-[#e0a267]">
                What did we actually build?
              </div>
              <p className="mt-3 max-w-[70ch] font-serif text-[22px] leading-[1.4] text-[#f6f1e6]">
                A falsifiable instrument for studying self-reference — not a conscious creature.
              </p>
              <p className="mt-3 max-w-[72ch] text-[13.5px] leading-[1.75] text-[#a49a88]">
                The code, the seeds and the full statistical record are open. Read the cross-version
                evidence, then run the same organism yourself and ablate the loop one edge at a time.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <RouteButton to="/research" onNavigate={onNavigate} variant="solid">
                  <FlaskConical size={13} />
                  Open the simulator
                  <ArrowRight size={13} />
                </RouteButton>
                <RouteButton to="/findings" onNavigate={onNavigate}>
                  <BookOpen size={13} />
                  Read the findings
                </RouteButton>
                <RouteButton to="/paper" onNavigate={onNavigate}>
                  <FileText size={13} />
                  Full manuscript
                </RouteButton>
              </div>
            </footer>
          </article>
        </div>
      </main>
    </div>
  );
}
