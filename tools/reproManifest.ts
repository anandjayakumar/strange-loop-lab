/**
 * Reproducibility manifest.
 *
 *   npm run manifest
 *
 * Writes SHA-256 checksums for every archived JSON result file and records the
 * exact runtime and dependency versions used to produce them.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");
const RESEARCH = path.join(ROOT, "research");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const jsonFiles = fs
  .readdirSync(RESEARCH)
  .filter((file) => file.endsWith(".json"))
  .sort();

const entries = jsonFiles.map((file) => {
  const bytes = fs.readFileSync(path.join(RESEARCH, file));
  return {
    file: `research/${file}`,
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
});

const manifest = {
  generatedAt: new Date().toISOString(),
  project: pkg.name,
  version: pkg.version,
  runtime: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    npm: process.env.npm_config_user_agent ?? null,
    typescript: pkg.devDependencies.typescript,
    tsx: pkg.devDependencies.tsx,
    vite: pkg.devDependencies.vite,
    vitest: pkg.devDependencies.vitest,
  },
  dependencies: pkg.dependencies,
  devDependencies: pkg.devDependencies,
  protocol: {
    seeds: "1-100 development; 10001-10100 untouched holdout for V0.6.1",
    tests: "73",
    validators: [
      "npm run validate",
      "npm run validate:v02",
      "npm run validate:v03",
      "npm run validate:v04",
      "npm run validate:v05",
      "npm run validate:v06",
      "npm run validate:holdout",
      "npm run validate:hardening",
    ],
  },
  files: entries,
};

fs.writeFileSync(path.join(RESEARCH, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(
  path.join(RESEARCH, "SHA256SUMS.txt"),
  `${entries.map((entry) => `${entry.sha256}  ${entry.file}`).join("\n")}\n`,
);
console.log(`wrote research/MANIFEST.json and research/SHA256SUMS.txt (${entries.length} JSON files)`);
