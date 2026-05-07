#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(here, "..");
const repoRoot = resolve(desktopRoot, "..", "..");

// pnpm licenses ls returns: { "MIT": [{name, version, license, author, homepage, ...}, ...], "ISC": [...], ... }
const raw = execFileSync(
  "pnpm",
  [
    "licenses",
    "ls",
    "--json",
    "--recursive",
    "--prod",
    "--filter",
    "@lightfast/desktop",
  ],
  { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }
);
const grouped = JSON.parse(raw);

const lines = [];
lines.push("# Third-Party Notices for @lightfast/desktop");
lines.push("");
lines.push(
  `Generated ${new Date().toISOString()} via \`pnpm licenses ls\`. Do not edit by hand.`
);
lines.push("");

const licenses = Object.keys(grouped).sort();
for (const license of licenses) {
  const entries = grouped[license]
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  lines.push(`## ${license} (${entries.length})`);
  lines.push("");
  for (const e of entries) {
    const versions = Array.isArray(e.versions)
      ? e.versions.join(", ")
      : (e.version ?? "unknown");
    const author = e.author ? ` — ${e.author}` : "";
    const homepage = e.homepage ? ` (${e.homepage})` : "";
    lines.push(`- ${e.name}@${versions}${author}${homepage}`);
  }
  lines.push("");
}

const out = resolve(desktopRoot, "THIRD_PARTY_NOTICES.txt");
writeFileSync(out, lines.join("\n"), "utf8");
console.log(`wrote ${out} (${licenses.length} license groups)`);
