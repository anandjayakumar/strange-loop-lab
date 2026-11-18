# arXiv-style build

The manuscript formatted with the [arxiv-style](https://github.com/kourgeorge/arxiv-style)
template (letter paper, Times, preprint header, `\keywords`, single column).

- `arxiv.sty` — upstream style file, copied verbatim (MIT, © 2020 George Kour; see `License.txt`).
- `main.tex` — the paper adapted to the style. It reuses `../figures/*.pdf` and
  `../references.bib`, so there is one source of truth for figures and bibliography.
- `main.pdf` — the compiled preprint.

## Build

```bash
cd paper/arxiv
pdflatex -interaction=nonstopmode main.tex
bibtex main
pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex
```

Figures are the vector PDFs produced by `npm run paper:figures`. If you change the
figures, rerun that command from the repository root first.

To regenerate `main.tex` after editing `paper/main.tex`, the two are kept in sync
manually: the body is identical, only the preamble, figure paths and bibliography
path differ.
