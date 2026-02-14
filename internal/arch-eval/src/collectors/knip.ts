import { execSync } from "node:child_process";
import { resolve } from "node:path";
import type { CollectorOutput, RawFinding } from "../types.js";
import { filterSuppressedFindings } from "../suppressions.js";

export function collectKnip(): CollectorOutput {
  const startTime = performance.now();
  const configPath = resolve(import.meta.dirname, "../../../knip.config.ts");
  const monorepoRoot = resolve(import.meta.dirname, "../../../..");

  try {
    const output = execSync(
      `npx --prefix ${resolve(import.meta.dirname, "../..")} knip --config ${configPath} --reporter json`,
      {
        cwd: monorepoRoot,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    const result = JSON.parse(output);
    const raw_findings: RawFinding[] = [];

    // Parse knip JSON output
    // Format: { files, issues: { files, dependencies, exports, types, ... } }
    for (const [category, items] of Object.entries(result.issues || {})) {
      const itemArray = Array.isArray(items) ? items : [];
      for (const item of itemArray) {
        const severity =
          category === "dependencies" || category === "files"
            ? "error"
            : category === "exports"
              ? "warn"
              : "info";

        raw_findings.push({
          rule: `knip-${category}`,
          message: `Unused ${category}: ${item.symbol || item.name || item}`,
          file: item.file || item.filePath,
          line: item.line,
          severity,
          meta: {
            category,
            item,
          },
        });
      }
    }

    const duration_ms = Math.round(performance.now() - startTime);

    // Filter out suppressed findings
    const filtered_findings = filterSuppressedFindings(raw_findings);

    return {
      tool: "knip",
      raw_findings: filtered_findings,
      duration_ms,
    };
  } catch (error) {
    // knip exits with non-zero if issues found
    const err = error as { stdout?: string; stderr?: string };
    if (err.stdout) {
      try {
        const result = JSON.parse(err.stdout);
        const raw_findings: RawFinding[] = [];

        for (const [category, items] of Object.entries(result.issues || {})) {
          const itemArray = Array.isArray(items) ? items : [];
          for (const item of itemArray) {
            const severity =
              category === "dependencies" || category === "files"
                ? "error"
                : category === "exports"
                  ? "warn"
                  : "info";

            raw_findings.push({
              rule: `knip-${category}`,
              message: `Unused ${category}: ${item.symbol || item.name || item}`,
              file: item.file || item.filePath,
              line: item.line,
              severity,
              meta: {
                category,
                item,
              },
            });
          }
        }

        const duration_ms = Math.round(performance.now() - startTime);

        return {
          tool: "knip",
          raw_findings,
          duration_ms,
        };
      } catch {
        // Failed to parse, return empty
      }
    }

    const duration_ms = Math.round(performance.now() - startTime);
    return {
      tool: "knip",
      raw_findings: [],
      duration_ms,
    };
  }
}
