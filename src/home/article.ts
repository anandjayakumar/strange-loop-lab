import articleSource from "../../docs/ARTICLE.md?raw";
import { renderInline } from "../lib/markdown";
import type { VersionId } from "../lib/router";

export interface ArticleBlock {
  type: "p" | "list";
  html?: string;
  items?: string[];
  ordered?: boolean;
}

export interface ArticleSection {
  id: string;
  number: string | null;
  title: string;
  blocks: ArticleBlock[];
}

export interface LessonCallout {
  metric: string;
  from: string;
  to: string;
  detail: string;
  researchVersion: VersionId;
  findingsAnchor: string;
}

const articleText = articleSource.replace(/\r\n/g, "\n");

const cleanInline = (value: string) => value.replace(/\*\*/g, "").trim();

function parseBlocks(source: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let ordered = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ type: "p", html: renderInline(text) });
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push({ type: "list", ordered, items: list.map((item) => renderInline(item)) });
    list = [];
    ordered = false;
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      flushList();
      continue;
    }
    const bullet = line.match(/^[*-]\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      const isOrdered = !!numbered;
      if (list.length && ordered !== isOrdered) flushList();
      ordered = isOrdered;
      list.push((bullet ?? numbered)?.[1] ?? line);
      continue;
    }
    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

const TITLE_PATTERN = /^#\s+(.+)$/m;
const rawTitle = articleText.match(TITLE_PATTERN)?.[1]?.trim() ?? "Strange Loop Lab";
const title = cleanInline(rawTitle);

const withoutTitle = articleText.replace(/^#\s+.+\n?/, "");
const [introPart, ...lessonParts] = withoutTitle.split(/\n###\s+/);

const introBlocks = parseBlocks(introPart);

function buildSection(raw: string): ArticleSection {
  const newline = raw.indexOf("\n");
  const heading = cleanInline(newline === -1 ? raw : raw.slice(0, newline));
  const body = newline === -1 ? "" : raw.slice(newline + 1);
  const lesson = heading.match(/^Lesson\s+(\d+):\s*(.+)$/i);

  return {
    id: lesson ? `lesson-${lesson[1]}` : "conclusion",
    number: lesson ? lesson[1].padStart(2, "0") : null,
    title: lesson ? lesson[2] : heading,
    blocks: parseBlocks(body),
  };
}

export const ARTICLE = {
  title,
  sections: [
    {
      id: "introduction",
      number: null,
      title: "Introduction",
      blocks: introBlocks,
    } satisfies ArticleSection,
    ...lessonParts.map(buildSection),
  ],
};

const plainWords = articleText
  .replace(/^#\s+.+$/m, "")
  .replace(/[#*_>`|-]/g, " ")
  .split(/\s+/)
  .filter(Boolean).length;

export const READING_MINUTES = Math.max(1, Math.round(plainWords / 220));

export const LESSON_CALLOUTS: Record<string, LessonCallout> = {
  "lesson-1": {
    metric: "Resources under a metabolic cliff",
    from: "22.4",
    to: "32.4",
    detail: "frozen self-model → learned self-model · 100/100 survival in both",
    researchVersion: "v02",
    findingsAnchor: "v02",
  },
  "lesson-2": {
    metric: "Meta-control effect (meta-on − meta-off)",
    from: "−6.8",
    to: "+12.3…+28.8",
    detail: "resources · V0.2 self-doubt turns into V0.3 risk-sensitive caution",
    researchVersion: "v03",
    findingsAnchor: "v03",
  },
  "lesson-3": {
    metric: "Escape from the self-fulfilling phobia",
    from: "0/100",
    to: "74/100",
    detail: "pragmatic → plateau-breaking VoI (74/100 at 100 seeds) · 0 deaths",
    researchVersion: "v05",
    findingsAnchor: "v05",
  },
  "lesson-4": {
    metric: "Correct physical-shift attribution",
    from: "1/100",
    to: "63/100",
    detail: "single-step → action-conditioned MOVE/REST contrast · macro-F1 0.25 → 0.604",
    researchVersion: "v03",
    findingsAnchor: "v03",
  },
  "lesson-5": {
    metric: "PP-1 one-tick illusion absorption",
    from: "≈ 0",
    to: "0.830",
    detail: "stationary MAE 1.68 → 2.74 · AST-1 recovery dz 1.13, p < 0.001",
    researchVersion: "v04",
    findingsAnchor: "v04",
  },
  "lesson-6": {
    metric: "Diagnostic probe in the epistemic fork",
    from: "1%",
    to: "94%",
    detail: "probe rate without → with cognitive self-simulation · 84% of forks solved vs 1% · physical MPC 2% probe / 1% solved",
    researchVersion: "v06",
    findingsAnchor: "v06-indicators",
  },
};
