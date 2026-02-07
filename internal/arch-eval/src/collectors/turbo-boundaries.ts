import { execSync } from "node:child_process";
import { resolve } from "node:path";
import type { CollectorOutput, RawFinding, PipelineConfig } from "../types.js";

export function collectTurboBoundaries(
  config: PipelineConfig
): CollectorOutput {
  const startTime = performance.now();

  // Check feature flag
  if (!config.feature_flags.turbo_boundaries) {
    return {
      tool: "turbo-boundaries",
      raw_findings: [],
      duration_ms: 0,
    };
  }

  const monorepoRoot = resolve(import.meta.dirname, "../../../..");

  try {
    const output = execSync("npx turbo boundaries", {
      cwd: monorepoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const raw_findings: RawFinding[] = [];

    // Parse turbo boundaries text output
    // Format: lines like "Error: packages/foo imports from @scope/bar without declaring it"
    const lines = output.split("\n");
    for (const line of lines) {
      if (line.includes("Error:") || line.includes("Warning:")) {
        const severity = line.includes("Error:") ? "error" : "warn";
        raw_findings.push({
          rule: "turbo-boundary-violation",
          message: line.trim(),
          severity,
          meta: {
            raw_line: line,
          },
        });
      }
    }

    const duration_ms = Math.round(performance.now() - startTime);

    return {
      tool: "turbo-boundaries",
      raw_findings,
      duration_ms,
    };
  } catch (error) {
    // turbo boundaries exits with non-zero if violations found
    const err = error as { stdout?: string; stderr?: string };
    const output = err.stdout || err.stderr || "";
    const raw_findings: RawFinding[] = [];

    const lines = output.split("\n");
    for (const line of lines) {
      if (line.includes("Error:") || line.includes("Warning:")) {
        const severity = line.includes("Error:") ? "error" : "warn";
        raw_findings.push({
          rule: "turbo-boundary-violation",
          message: line.trim(),
          severity,
          meta: {
            raw_line: line,
          },
        });
      }
    }

    const duration_ms = Math.round(performance.now() - startTime);

    return {
      tool: "turbo-boundaries",
      raw_findings,
      duration_ms,
    };
  }
}
