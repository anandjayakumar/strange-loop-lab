/**
 * Assemble a flat arXiv submission from paper/arxiv/.
 *
 *   npm run paper:arxiv
 *
 * Copies the arXiv-style manuscript, its class file, the bibliography and the
 * vector PDF figures into paper/arxiv/submission/, rewrites the relative paths,
 * and zips the result. The zip is what gets uploaded to arXiv.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const arXivDir = path.join(ROOT, "paper", "arxiv");
const out = path.join(arXivDir, "submission");
const zip = path.join(arXivDir, "arxiv-submission.zip");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "figures"), { recursive: true });

const main = fs
  .readFileSync(path.join(arXivDir, "main.tex"), "utf8")
  .split("../references")
  .join("references")
  .split("../figures/")
  .join("figures/");
fs.writeFileSync(path.join(out, "main.tex"), main);

for (const name of ["arxiv.sty", "License.txt"]) {
  fs.copyFileSync(path.join(arXivDir, name), path.join(out, name));
}
fs.copyFileSync(path.join(ROOT, "paper", "references.bib"), path.join(out, "references.bib"));

for (const file of fs.readdirSync(path.join(ROOT, "paper", "figures"))) {
  if (file.endsWith(".pdf")) {
    fs.copyFileSync(path.join(ROOT, "paper", "figures", file), path.join(out, "figures", file));
  }
}

fs.rmSync(zip, { force: true });
if (process.platform === "win32") {
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${out.replace(/'/g, "''")}\\*' -DestinationPath '${zip.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: "ignore" },
  );
} else {
  execFileSync("zip", ["-r", "-q", zip, "."], { cwd: out, stdio: "ignore" });
}

const files = fs.readdirSync(out, { recursive: true }) as string[];
console.log(`submission files: ${files.length}`);
console.log(`zip: ${path.relative(ROOT, zip)} (${fs.statSync(zip).size} bytes)`);
