import { execSync } from "node:child_process";
import { resolve } from "node:path";
import type { CollectorOutput, RawFinding } from "../types.js";

export function collectDependencyCruiser(): CollectorOutput {
  const startTime = performance.now();
  const configPath = resolve(
    import.meta.dirname,
    "../../.dependency-cruiser.cjs"
  );
  const monorepoRoot = resolve(import.meta.dirname, "../../../..");

  let output: string;
  try {
    output = execSync(
      `npx --prefix ${resolve(import.meta.dirname, "../..")} dependency-cruiser apps/ api/ packages/ vendor/ db/ core/ --config ${configPath} --output-type json`,
      {
        cwd: monorepoRoot,
        encoding: "utf-8",
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large output
      }
    );
  } catch (error) {
    // dependency-cruiser exits with non-zero if violations found
    const err = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    if (err.stdout) {
      output = typeof err.stdout === "string" ? err.stdout : err.stdout.toString("utf-8");
    } else {
      // Failed completely - no output captured
      const duration_ms = Math.round(performance.now() - startTime);
      console.error("dependency-cruiser failed completely:", err.stderr);
      return {
        tool: "dependency-cruiser",
        raw_findings: [],
        duration_ms,
      };
    }
  }

  try {

    const result = JSON.parse(output);
    const raw_findings: RawFinding[] = [];

    // Parse violations from dependency-cruiser output
    // Always scan all modules, not just when summary has errors
    for (const module of result.modules || []) {
      for (const dep of module.dependencies || []) {
        if (dep.valid === false) {
          for (const rule of dep.rules || []) {
            raw_findings.push({
              rule: rule.name,
              message: `${module.source} → ${dep.resolved}`,
              file: module.source,
              severity: rule.severity === "error" ? "error" : "warn",
              meta: {
                from: module.source,
                to: dep.resolved,
                rule_name: rule.name,
              },
            });
          }
        }
      }
    }

    const duration_ms = Math.round(performance.now() - startTime);

    return {
      tool: "dependency-cruiser",
      raw_findings,
      duration_ms,
      metadata: {
        packages_evaluated: result.summary?.totalCruised || 0,
        packages_total: result.summary?.totalCruised || 0,
      },
    };
  } catch (parseError) {
    // Failed to parse JSON
    const duration_ms = Math.round(performance.now() - startTime);
    return {
      tool: "dependency-cruiser",
      raw_findings: [],
      duration_ms,
    };
  }
}
