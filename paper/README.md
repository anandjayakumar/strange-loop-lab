# Manuscript

`main.tex` is the LaTeX manuscript; `MANUSCRIPT.md` is the same content for the
web viewer; `references.bib` holds the bibliography.

## Build

```bash
npm run paper:figures      # regenerate figures/*.svg + figures/*.pdf and the mirrors
cd paper
pdflatex -interaction=nonstopmode main.tex
bibtex main
pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex
```

The figures are embedded as PDFs (`\includegraphics`), so no Inkscape or
shell-escape is needed. The SVG sources remain the canonical vector files and
are what the web app serves.

Verified with TinyTeX (TeX Live 2026) on Windows: 11 pages, 4 figures,
14 bibliography entries, no undefined citations or references.

## Notes

- `\nocite{*}` includes every entry in `references.bib`, including the
  classical filtering and scoring sources that are positioned rather than cited
  inline.
- `paper/figures/figure-data.json` records every value plotted by
  `tools/generatePaperFigures.ts`, recomputed from `research/*.json`.
