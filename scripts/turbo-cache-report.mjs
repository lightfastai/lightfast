#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const runsDir = process.argv[2] ?? ".turbo/runs";
const title = process.argv[3] ?? "Turbo cache report";

let files = [];
try {
  files = readdirSync(runsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ name: f, mtime: statSync(join(runsDir, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);
} catch {
  console.log(
    `### ${title}\n\n_No .turbo/runs/ found — Turbo wasn't run with --summarize._`
  );
  process.exit(0);
}

if (files.length === 0) {
  console.log(`### ${title}\n\n_No summary files in ${runsDir}._`);
  process.exit(0);
}

const tasks = new Map();
for (const { name } of files) {
  const summary = JSON.parse(readFileSync(join(runsDir, name), "utf8"));
  for (const t of summary.tasks ?? []) {
    const id = t.taskId ?? `${t.package}#${t.task}`;
    tasks.set(id, t);
  }
}

const rows = [...tasks.values()].map((t) => ({
  task: t.taskId ?? `${t.package}#${t.task}`,
  status: t.cache?.status ?? "unknown",
  source: (t.cache?.source ?? "").toLowerCase() || "—",
  time:
    t.execution?.startTime && t.execution?.endTime
      ? `${((t.execution.endTime - t.execution.startTime) / 1000).toFixed(1)}s`
      : "—",
}));

const hits = rows.filter((r) => r.status === "HIT").length;
const total = rows.length;
const pct = total > 0 ? Math.round((hits / total) * 100) : 0;

console.log(`### ${title}\n`);
console.log(`**Hit rate**: ${hits}/${total} = ${pct}%\n`);
console.log("| Task | Cache | Source | Time |");
console.log("|------|-------|--------|-----:|");
for (const r of rows) {
  console.log(`| \`${r.task}\` | ${r.status} | ${r.source} | ${r.time} |`);
}
