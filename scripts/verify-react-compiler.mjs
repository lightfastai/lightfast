#!/usr/bin/env node
// Verifies React Compiler output is present in a production build of apps/app.
// Usage: node scripts/verify-react-compiler.mjs <chunks-dir>
//   e.g. node scripts/verify-react-compiler.mjs apps/app/.next/static/chunks
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "apps/app/.next/static/chunks";
const MARKERS = ["react-compiler-runtime", "react.memo_cache_sentinel"];

function walk(d) {
  const out = [];
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) {
      out.push(...walk(p));
    } else if (p.endsWith(".js")) {
      out.push(p);
    }
  }
  return out;
}

const files = walk(dir);
const hit = files.some((f) => {
  const src = readFileSync(f, "utf8");
  return MARKERS.some((m) => src.includes(m));
});

if (!hit) {
  console.error(
    `React Compiler markers not found in ${dir}. Expected one of: ${MARKERS.join(", ")}`
  );
  process.exit(1);
}
console.log(`React Compiler output confirmed in ${dir}.`);
