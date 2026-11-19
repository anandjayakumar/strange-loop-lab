# arXiv submission

Built by `npm run paper:arxiv`, which creates `arxiv-submission.zip` with a flat
layout that arXiv can compile directly.

## Metadata

- **Title:** When Self-Models Trap Themselves: Epistemic Probing, Risk-Sensitive
  Metacognition, and Precision Trade-Offs in a White-Box Self-Referential Agent
- **Author:** Anand Jayakumar
- **Primary category:** cs.AI
- **Cross-list:** q-bio.NC
- **Comments:** 10 pages, 4 figures, 4 tables. Code and data statement included.
- **License:** CC BY 4.0 (recommended for maximum reuse; arXiv's default
  non-exclusive licence is the alternative)
- **ORCID / affiliation:** add in the arXiv metadata form. "Independent
  researcher" is acceptable and truthful if no institutional affiliation applies.

## Contents of the zip

```
main.tex          arXiv-style manuscript with flattened paths
arxiv.sty         upstream style (MIT, © 2020 George Kour)
License.txt       MIT licence for the style file
references.bib    14 entries, all cited or included via \nocite{*}
figures/*.pdf     vector figures used by the manuscript
```

## Pre-submission checks

- `main.tex` compiles with pdfLaTeX → BibTeX → pdfLaTeX ×2 (no undefined
  citations or references).
- The author is a human; no AI tool is listed as an author.
- The "Use of AI tools" section names the environment, scope and verification.
- "Data and code availability" and the declarations are present.
- Every number is regenerated from `research/*.json`; the reference list was
  checked against the published sources.
- The paper contains no unfinished sections, meta-comments, template placeholders or unverified citations.

## Registering the paper

1. Upload `arxiv-submission.zip` as the source.
2. Paste the abstract from `paper/MANUSCRIPT.md`.
3. Set cs.AI primary and q-bio.NC cross-list.
4. Choose CC BY 4.0 if the licence choice above is confirmed.
5. Add the author's ORCID and an accurate affiliation in the metadata.
6. Note the licence and category in the submission comments if desired.

The journal version can later reuse the same source; the MIT Press *Artificial
Life* route additionally needs an ORCID, the MIT Press AI disclosure form, and a
data/code availability statement (already drafted in the manuscript).
