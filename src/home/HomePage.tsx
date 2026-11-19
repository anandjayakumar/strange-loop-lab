import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock3,
  FileText,
  FlaskConical,
  Layers,
} from "lucide-react";
import { renderMarkdown } from "../lib/markdown";
import { BEGINNER_GUIDE } from "./beginnerGuide";
import { hrefFor } from "../lib/router";
import { ARTICLE, LESSON_CALLOUTS, READING_MINUTES, type ArticleSection, type LessonCallout } from "./article";

function CTA({
  to,
  onNavigate,
  children,
  variant = "ghost",
  download = false,
}: {
  to: string;
  onNavigate?: (target: string) => void;
  children: React.ReactNode;
  variant?: "solid" | "ghost";
  download?: boolean;
}) {
  const className =
    "landing-cta " +
    (variant === "solid"
      ? "landing-cta-solid inline-flex h-11 items-center justify-center gap-2 rounded-[5px] border border-[#a84824] bg-[#b5532a] px-5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-[#fbf7ee] transition-colors hover:bg-[#98431f]"
      : "inline-flex h-11 items-center justify-center gap-2 rounded-[5px] border border-[#c9bda9] bg-transparent px-5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3f352b] transition-colors hover:border-[#8f7d66] hover:text-[#1c1915]");
  if (download) {
    return (
      <a href={to} download className={className}>
        {children}
      </a>
    );
  }
  return (
    <a
      href={hrefFor(to)}
      onClick={(event) => {
        if (!onNavigate) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate(to);
      }}
      className={className}
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
    <aside className="my-8 rounded-[4px] border border-[#d8cbb7] bg-[#efe8da]/70 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="font-sans text-[8.5px] font-semibold uppercase tracking-[0.2em] text-[#b5532a]">
            Interactive lesson · measured result
          </div>
          <div className="mt-2 font-serif text-[21px] leading-tight text-[#1c1915]">
            {callout.metric}
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
            <span className="num text-[21px] text-[#8a7c69]">{callout.from}</span>
            <ArrowRight size={14} className="text-[#b5532a]" />
            <span className="num text-[25px] text-[#1c1915]">{callout.to}</span>
          </div>
          <p className="mt-2 max-w-[64ch] font-serif text-[12.5px] italic leading-snug text-[#6d6153]">
            {callout.detail}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <CTA to={`/research?version=${callout.researchVersion}`} onNavigate={onNavigate}>
            <FlaskConical size={11} />
            Run this in the lab
            <ArrowRight size={11} />
          </CTA>
          <CTA to={`/findings#${callout.findingsAnchor}`} onNavigate={onNavigate}>
            <BookOpen size={11} />
            See full data
            <ArrowUpRight size={11} />
          </CTA>
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
            <ListTag key={index} className={"article-list my-4 space-y-2 pl-5 " + (block.ordered ? "list-decimal" : "")}>
              {block.items?.map((item, itemIndex) => (
                <li key={itemIndex} dangerouslySetInnerHTML={{ __html: item }} className="pl-1" />
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

const TOC_LABELS = [
  "Introduction",
  "The easy world",
  "Doubt and caution",
  "The epistemic trap",
  "Body or senses",
  "The trade-off",
  "The whole loop",
  "Conclusion",
];

const GLANCE = [
  { icon: FlaskConical, label: "Domain", value: "Cognitive science, artificial life, self-reference" },
  { icon: Layers, label: "Method", value: "Evolutionary simulation of a self-modelling agent" },
  { icon: BarChart3, label: "Key finding", value: "Self-reference improves adaptation but can create stable, hard-to-escape traps" },
  { icon: CalendarDays, label: "Published", value: "Nov 19, 2026" },
  { icon: Clock3, label: "Read time", value: `~${READING_MINUTES} minutes` },
];

export function HomePage({ onNavigate }: { onNavigate: (target: string) => void }) {
  const [lead, ...rest] = ARTICLE.title.split(": ");
  const subtitle = rest.join(": ");
  const sections = ARTICLE.sections;
  const [beginner, setBeginner] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8f4ec] text-[#1c1915]">
      <main className="mx-auto max-w-[1280px] px-5 pb-24 sm:px-8">
        {/* ------------------------------------------------------------- hero */}
        <section className="grid grid-cols-1 gap-x-8 gap-y-10 border-b border-[#2a1d14]/15 pb-10 pt-10 lg:grid-cols-12 lg:pt-14">
          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[8.5px] font-semibold uppercase tracking-[0.2em] text-[#6d6153]">
              <span>Research narrative</span>
              <span className="text-[#b5532a]">·</span>
              <span>Vol. 02</span>
              <span className="text-[#b5532a]">·</span>
              <span>Nov 19, 2026</span>
              <span className="text-[#b5532a]">·</span>
              <span>~{READING_MINUTES} min read</span>
            </div>

            <h1 className="mt-6 max-w-[14ch] font-serif text-[50px] leading-[0.92] tracking-[-0.03em] text-[#1c1915] sm:text-[68px] xl:text-[82px]">
              {lead}
              <span className="text-[#b5532a]">.</span>
            </h1>

            {subtitle ? (
              <p className="mt-5 max-w-[60ch] font-serif text-[19px] italic leading-[1.35] text-[#4a4035] sm:text-[22px]">
                {subtitle}
              </p>
            ) : null}

            <p className="mt-5 max-w-[60ch] font-sans text-[13.5px] leading-[1.75] text-[#5d5144]">
              Six generations of a non-neural agent exploring self-modelling, metacognition, epistemic
              traps, and the measurable trade-offs of consciousness indicators.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <CTA to="/research" onNavigate={onNavigate} variant="solid">
                <FlaskConical size={13} />
                Explore the interactive lab
                <ArrowRight size={13} />
              </CTA>
              <CTA to="/findings" onNavigate={onNavigate}>
                <BarChart3 size={13} />
                Examine key findings
              </CTA>
              <CTA to="/paper" onNavigate={onNavigate}>
                <FileText size={13} />
                Read the full paper
              </CTA>
            </div>

            <div className="mt-4">
              <button
                type="button"
                aria-pressed={beginner}
                onClick={() => setBeginner((value) => !value)}
                className={
                  "landing-cta inline-flex h-10 items-center justify-center gap-2 rounded-[5px] border px-4 font-sans text-[9.5px] font-semibold uppercase tracking-[0.14em] transition-colors " +
                  (beginner
                    ? "border-[#1c1915] bg-[#1c1915] text-[#fbf7ee] hover:bg-[#3f352b]"
                    : "border-[#c9bda9] bg-transparent text-[#5d5144] hover:border-[#8f7d66] hover:text-[#1c1915]")
                }
              >
                <BookOpen size={12} />
                Beginner's version
                {beginner ? <span className="text-[#e7b08f]">· on</span> : null}
              </button>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-5 lg:pt-2">
            <img
              src="/hero-ribbon.png"
              alt="A metallic infinity ribbon beside a luminous profile and layered model panes"
              className="block w-full max-w-full select-none lg:-ml-10 lg:w-[128%] lg:max-w-none"
              draggable={false}
            />
          </div>
        </section>

        {/* ------------------------------------------------------------ article */}
        {beginner ? (
          <section className="mt-10 border-t border-[#2a1d14]/15 pt-10">
            <div
              className="beginner-guide paper-view mx-auto max-w-[820px]"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(BEGINNER_GUIDE) }}
            />
          </section>
        ) : (
        <div className="mt-10 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[170px_minmax(0,1fr)] xl:grid-cols-[170px_minmax(0,1fr)_250px]">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <div className="font-sans text-[8.5px] font-semibold uppercase tracking-[0.2em] text-[#6d6153]">
                On this page
              </div>
              <nav className="mt-4 border-t border-[#2a1d14]/15">
                {sections.map((section, index) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="group flex items-center gap-2 border-b border-[#2a1d14]/10 py-2.5 text-[12.5px] leading-snug text-[#5d5144] transition-colors hover:text-[#1c1915]"
                  >
                    <span
                      className={
                        "h-4 w-[2px] transition-colors " +
                        (index === 0 ? "bg-[#b5532a]" : "bg-transparent group-hover:bg-[#b5532a]/50")
                      }
                    />
                    <span className="font-serif text-[15px]">{TOC_LABELS[index] ?? section.title}</span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <article className="landing-prose min-w-0 max-w-[68ch]">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-28 border-b border-[#2a1d14]/12 pb-9 pt-8 first:pt-0 last:border-b-0"
              >
                {section.number ? (
                  <div className="mb-2 flex items-center gap-3">
                    <span className="font-sans text-[8.5px] font-semibold uppercase tracking-[0.2em] text-[#b5532a]">
                      Lesson {section.number}
                    </span>
                    <span className="h-px flex-1 bg-[#2a1d14]/15" />
                    <span className="font-sans text-[8px] uppercase tracking-[0.18em] text-[#8a7c69]">
                      measured lesson
                    </span>
                  </div>
                ) : (
                  <div className="mb-2 flex items-center gap-3">
                    <span className="font-sans text-[8.5px] font-semibold uppercase tracking-[0.2em] text-[#b5532a]">
                      {section.id === "introduction" ? "The question" : "Conclusion"}
                    </span>
                    <span className="h-px flex-1 bg-[#2a1d14]/15" />
                  </div>
                )}

                <h2 className="font-serif text-[32px] leading-[1.06] tracking-[-0.02em] text-[#1c1915] sm:text-[39px]">
                  {section.title}
                </h2>

                <div className="mt-4">
                  <Blocks section={section} intro={index === 0} />
                </div>

                {LESSON_CALLOUTS[section.id] ? (
                  <LessonCard callout={LESSON_CALLOUTS[section.id]} onNavigate={onNavigate} />
                ) : null}
              </section>
            ))}

            <footer className="pt-10">
              <div className="font-sans text-[8.5px] font-semibold uppercase tracking-[0.2em] text-[#b5532a]">
                Explore the evidence
              </div>
              <p className="mt-3 max-w-[70ch] font-serif text-[24px] leading-[1.35] text-[#1c1915]">
                A falsifiable instrument for studying self-reference — not a conscious creature.
              </p>
              <p className="mt-3 max-w-[72ch] text-[13.5px] leading-[1.75] text-[#5d5144]">
                The code, the seeds and the full statistical record are open. Read the cross-version
                evidence, then run the same organism yourself and ablate the loop one edge at a time.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <CTA to="/research" onNavigate={onNavigate} variant="solid">
                  <FlaskConical size={13} />
                  Open the simulator
                  <ArrowRight size={13} />
                </CTA>
                <CTA to="/findings" onNavigate={onNavigate}>
                  <BookOpen size={13} />
                  Read the findings
                </CTA>
                <CTA to="/paper" onNavigate={onNavigate}>
                  <FileText size={13} />
                  Full manuscript
                </CTA>
              </div>
            </footer>
          </article>

          <aside className="hidden xl:block">
            <div className="sticky top-24 border-l border-[#2a1d14]/15 pl-6">
              <div className="font-sans text-[8.5px] font-semibold uppercase tracking-[0.2em] text-[#6d6153]">
                At a glance
              </div>
              <div className="mt-4 space-y-5">
                {GLANCE.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="border-b border-[#2a1d14]/10 pb-4 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className="text-[#b5532a]" />
                        <span className="font-sans text-[10px] font-semibold text-[#1c1915]">
                          {item.label}
                        </span>
                      </div>
                      <p className="mt-1 font-sans text-[10.5px] leading-[1.55] text-[#6d6153]">
                        {item.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
        )}
      </main>
    </div>
  );
}
