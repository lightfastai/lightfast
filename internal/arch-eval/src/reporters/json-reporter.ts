import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type {
  EvaluationResult,
  Finding,
  CollectorOutput,
} from "../types.js";

export function generateJsonReport(
  findings: Finding[],
  collectorOutputs: CollectorOutput[]
): EvaluationResult {
  const timestamp = new Date().toISOString();
  const monorepoRoot = resolve(import.meta.dirname, "../../../..");

  let git_sha: string;
  let branch: string;

  try {
    git_sha = execSync("git rev-parse HEAD", {
      cwd: monorepoRoot,
      encoding: "utf-8",
    }).trim();
  } catch {
    git_sha = "unknown";
  }

  try {
    branch = execSync("git branch --show-current", {
      cwd: monorepoRoot,
      encoding: "utf-8",
    }).trim();
  } catch {
    branch = "unknown";
  }

  // Extract metadata from collectors
  const packagesEvaluated =
    collectorOutputs.find((o) => o.metadata?.packages_evaluated)?.metadata
      ?.packages_evaluated || 0;
  const packagesTotal =
    collectorOutputs.find((o) => o.metadata?.packages_total)?.metadata
      ?.packages_total || 0;

  const toolsUsed = Array.from(
    new Set(collectorOutputs.map((o) => o.tool))
  ).filter((t) => t !== "turbo-summary"); // Exclude turbo-summary as it's internal

  const tier1 = findings.filter((f) => f.tier === 1);
  const tier2 = findings.filter((f) => f.tier === 2);
  const tier3 = findings.filter((f) => f.tier === 3);

  const result: EvaluationResult = {
    timestamp,
    git_sha,
    branch,
    findings,
    summary: {
      total_findings: findings.length,
      tier1_count: tier1.length,
      tier2_count: tier2.length,
      tier3_count: tier3.length,
      signal_ratio:
        findings.length > 0 ? (tier1.length + tier2.length) / findings.length : 1,
      packages_evaluated: packagesEvaluated,
      packages_total: packagesTotal,
      tools_used: toolsUsed,
    },
  };

  const dateStr = timestamp.slice(0, 10);
  const timeStr = timestamp.slice(11, 19).replace(/:/g, "");
  const filename = `${dateStr}-${timeStr}-arch-eval.json`;

  const resultsDir = resolve(
    monorepoRoot,
    "thoughts/shared/evaluations/results"
  );
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(
    resolve(resultsDir, filename),
    JSON.stringify(result, null, 2)
  );

  return result;
}
