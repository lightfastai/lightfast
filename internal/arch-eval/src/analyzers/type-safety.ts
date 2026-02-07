import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync, readdirSync, statSync } from "node:fs";
import type {
  CollectorOutput,
  Finding,
  PipelineConfig,
} from "../types.js";

let findingCounter = 1;

function generateFindingId(): string {
  return `TYP-${String(findingCounter++).padStart(3, "0")}`;
}

export function analyzeTypeSafety(
  collectorOutputs: CollectorOutput[],
  config: PipelineConfig
): Finding[] {
  const findings: Finding[] = [];
  const timestamp = new Date().toISOString();
  const monorepoRoot = resolve(import.meta.dirname, "../../../..");

  // Check tsconfig.json files for strict mode
  const tsconfigViolations = checkTsconfigStrictness(monorepoRoot);
  if (tsconfigViolations.length > 0) {
    findings.push({
      id: generateFindingId(),
      tier: 1,
      dimension: "type_safety",
      title: `Missing strict mode in ${tsconfigViolations.length} tsconfig files`,
      description: `${tsconfigViolations.length} tsconfig.json files do not have "strict": true:\n${tsconfigViolations
        .slice(0, 5)
        .map((f) => `- ${f}`)
        .join("\n")}${tsconfigViolations.length > 5 ? `\n... and ${tsconfigViolations.length - 5} more` : ""}`,
      rule: "missing-strict-mode",
      tool: "tsconfig-checker",
      auto_fixable: true,
      status: "open",
      first_seen: timestamp,
    });
  }

  // Count 'any' usage (via grep)
  try {
    const anyCount = countAnyUsage(monorepoRoot);
    const threshold = config.thresholds.any_count_per_package || 5;

    // Group by package
    const packagesAboveThreshold = anyCount.filter(
      ([, count]) => count > threshold
    );

    if (packagesAboveThreshold.length > 0) {
      for (const [pkg, count] of packagesAboveThreshold) {
        findings.push({
          id: generateFindingId(),
          tier: 2,
          dimension: "type_safety",
          title: `Excessive 'any' usage in ${pkg} (${count} occurrences)`,
          description: `${pkg} has ${count} 'any' type usages (threshold: ${threshold})`,
          file: pkg,
          rule: "excessive-any-usage",
          tool: "grep",
          auto_fixable: false,
          status: "open",
          first_seen: timestamp,
        });
      }
    }
  } catch {
    // Failed to count, skip
  }

  return findings;
}

function checkTsconfigStrictness(root: string): string[] {
  const violations: string[] = [];

  function scanDir(dir: string, depth = 0) {
    if (depth > 3) return; // Limit recursion depth

    try {
      const items = readdirSync(dir);
      for (const item of items) {
        if (item === "node_modules" || item === ".turbo" || item === "dist") {
          continue;
        }

        const fullPath = resolve(dir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          scanDir(fullPath, depth + 1);
        } else if (item === "tsconfig.json") {
          try {
            const content = readFileSync(fullPath, "utf-8");
            // Remove comments for JSON parsing
            const cleaned = content.replace(/\/\/.*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
            const parsed = JSON.parse(cleaned);
            if (!parsed.compilerOptions?.strict) {
              violations.push(fullPath.replace(root + "/", ""));
            }
          } catch {
            // Failed to parse, skip
          }
        }
      }
    } catch {
      // Permission denied or other error, skip
    }
  }

  scanDir(root);
  return violations;
}

function countAnyUsage(root: string): [string, number][] {
  const packages = ["apps", "api", "packages", "vendor", "db", "core"];
  const results: [string, number][] = [];

  for (const pkg of packages) {
    const pkgPath = resolve(root, pkg);
    try {
      const output = execSync(
        `grep -r ": any" ${pkgPath} --include="*.ts" --include="*.tsx" | wc -l`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      );
      const count = parseInt(output.trim(), 10);
      if (count > 0) {
        results.push([pkg, count]);
      }
    } catch {
      // No matches or error, skip
    }
  }

  return results;
}
